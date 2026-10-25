-- ============================================================
-- VELVET BLOOM CAFÉ V2 — PRODUCTION SECURITY HARDENING & RBAC
-- Migration: 20261025000000_v2_table_session_and_rbac.sql
-- Target: Supabase V2 (iwszvepliiqwaoetgaub)
-- Non-destructive forward migration with strict least privilege
-- ============================================================

-- Ensure pgcrypto extension is active for salted bcrypt hashing
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA extensions;

-- ------------------------------------------------------------
-- 1. Schema & Constraints: Ensure UserRole includes MANAGER
-- ------------------------------------------------------------
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE public.users ADD CONSTRAINT users_role_check 
  CHECK (role IN ('OWNER', 'ADMIN', 'MANAGER', 'CHEF', 'STAFF', 'WAITER', 'CASHIER', 'CUSTOMER'));

-- ------------------------------------------------------------
-- 2. Audit & Deduplicate Existing Active Sessions (Data Consistency)
-- If concurrent requests created duplicate active sessions on a table,
-- keep the newest active session and cleanly close previous duplicates.
-- ------------------------------------------------------------
DO $$
DECLARE
  v_dup RECORD;
BEGIN
  FOR v_dup IN
    SELECT table_id, COUNT(*) as cnt
    FROM public.table_sessions
    WHERE is_active = TRUE
    GROUP BY table_id
    HAVING COUNT(*) > 1
  LOOP
    UPDATE public.table_sessions
    SET is_active = FALSE,
        ended_at = NOW()
    WHERE table_id = v_dup.table_id
      AND is_active = TRUE
      AND id NOT IN (
        SELECT id FROM public.table_sessions
        WHERE table_id = v_dup.table_id AND is_active = TRUE
        ORDER BY created_at DESC
        LIMIT 1
      );
  END LOOP;

  -- Ensure all tables with an active session have status = 'OCCUPIED' and current_session_id set
  UPDATE public.tables t
  SET status = 'OCCUPIED',
      current_session_id = s.id,
      updated_at = NOW()
  FROM (
    SELECT DISTINCT ON (table_id) id, table_id
    FROM public.table_sessions
    WHERE is_active = TRUE
    ORDER BY table_id, created_at DESC
  ) s
  WHERE t.id = s.table_id
    AND (t.status = 'AVAILABLE' OR t.current_session_id IS NULL OR t.current_session_id != s.id);
END $$;

-- ------------------------------------------------------------
-- 3. Transition Existing Plaintext PINs to Bcrypt Hashes
-- Safely rehash any legacy unhashed credentials without locking out staff
-- ------------------------------------------------------------
UPDATE public.users
SET pin_code = extensions.crypt(trim(pin_code), extensions.gen_salt('bf', 8)),
    updated_at = NOW()
WHERE pin_code IS NOT NULL
  AND pin_code NOT LIKE '$2%'
  AND length(trim(pin_code)) >= 4;

-- ------------------------------------------------------------
-- 4. Cross-Instance Login Rate Limiting Table
-- Tracks failed attempts across all serverless lambda instances
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.staff_login_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_ip TEXT NOT NULL,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_success BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_staff_login_attempts_ip_time 
  ON public.staff_login_attempts(client_ip, attempted_at);

-- ------------------------------------------------------------
-- 5. Secure Staff Authentication (Bcrypt Only, No Plaintext Fallback)
-- Validates rate limits with concurrency-safe advisory locks and authenticates strictly via bcrypt hashes
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.authenticate_tenant_staff(
  p_tenant_id UUID,
  p_pin TEXT,
  p_client_ip TEXT DEFAULT '127.0.0.1'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_user RECORD;
  v_clean_pin TEXT;
  v_clean_ip TEXT;
  v_failed_count INT;
  v_max_attempts INT := 5;
BEGIN
  -- Strict input validation
  IF p_tenant_id IS NULL OR p_pin IS NULL OR length(trim(p_pin)) < 4 THEN
    RETURN NULL;
  END IF;

  v_clean_pin := trim(p_pin);
  v_clean_ip := COALESCE(NULLIF(trim(p_client_ip), ''), '127.0.0.1');

  -- Sanitize IP string to prevent injection / spoofing anomalies
  IF length(v_clean_ip) > 64 OR v_clean_ip ~ '[^0-9a-fA-F:\.]' THEN
    v_clean_ip := '127.0.0.1';
  END IF;

  -- Acquire exclusive transactional advisory lock per tenant + IP to guarantee concurrency safety
  PERFORM pg_advisory_xact_lock(hashtext(p_tenant_id::text || ':' || v_clean_ip));

  -- Opportunistic cleanup of stale failed attempts older than 1 hour
  DELETE FROM public.staff_login_attempts
  WHERE attempted_at < (NOW() - INTERVAL '1 hour');

  -- 1. Check rate limits across all serverless instances
  SELECT COUNT(*) INTO v_failed_count
  FROM public.staff_login_attempts
  WHERE client_ip = v_clean_ip
    AND tenant_id = p_tenant_id
    AND is_success = FALSE
    AND attempted_at > (NOW() - INTERVAL '5 minutes');

  IF v_failed_count >= v_max_attempts THEN
    RAISE EXCEPTION 'Too many failed login attempts. Terminal locked for 5 minutes.';
  END IF;

  -- 2. Verify staff credentials strictly with bcrypt hash (No plaintext fallback)
  SELECT id, tenant_id, auth_user_id, full_name, email, role, phone, is_active, created_at, updated_at
  INTO v_user
  FROM public.users
  WHERE tenant_id = p_tenant_id
    AND is_active = TRUE
    AND pin_code LIKE '$2%'
    AND extensions.crypt(v_clean_pin, pin_code) = pin_code;

  IF NOT FOUND THEN
    -- Record failed attempt
    INSERT INTO public.staff_login_attempts (tenant_id, client_ip, is_success)
    VALUES (p_tenant_id, v_clean_ip, FALSE);
    RETURN NULL;
  END IF;

  -- Record successful attempt & clear previous failed attempts for this IP
  DELETE FROM public.staff_login_attempts
  WHERE client_ip = v_clean_ip AND tenant_id = p_tenant_id;

  RETURN to_jsonb(v_user);
END;
$$;

-- Restrict to service_role and authenticated callers; anon access revoked to prevent rate-limit bypass
REVOKE ALL ON FUNCTION public.authenticate_tenant_staff(UUID, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.authenticate_tenant_staff(UUID, TEXT, TEXT) TO service_role, authenticated;

-- ------------------------------------------------------------
-- 6. Hardened Table Session Creation with QR Authorization & Concurrency Lock
-- Acquires row-level lock BEFORE QR validation and active session lookup
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_or_create_tenant_session(
  p_tenant_id UUID,
  p_table_id UUID,
  p_qr_token TEXT,
  p_customer_name TEXT DEFAULT 'Valued Guest',
  p_phone TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_table RECORD;
  v_session RECORD;
  v_token TEXT;
BEGIN
  -- 1. Validate parameters
  IF p_tenant_id IS NULL OR p_table_id IS NULL OR p_qr_token IS NULL OR trim(p_qr_token) = '' THEN
    RAISE EXCEPTION 'Tenant ID, Table ID, and physical QR authorization token are required';
  END IF;

  -- 2. Acquire row-level concurrency lock on table row BEFORE QR token validation and session lookup
  SELECT * INTO v_table
  FROM public.tables
  WHERE id = p_table_id AND tenant_id = p_tenant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Table % not found for tenant %', p_table_id, p_tenant_id;
  END IF;

  -- 3. Validate physical QR authorization token against locked table row
  IF v_table.qr_code_token IS DISTINCT FROM trim(p_qr_token) THEN
    RAISE EXCEPTION 'Invalid QR authorization token for table %', p_table_id;
  END IF;

  -- 4. Check for existing active session (now protected under table row lock)
  SELECT * INTO v_session
  FROM public.table_sessions
  WHERE tenant_id = p_tenant_id
    AND table_id = p_table_id
    AND is_active = TRUE
  ORDER BY created_at DESC
  LIMIT 1;

  IF FOUND THEN
    -- Ensure table status reflects occupancy and points to active session
    IF v_table.status = 'AVAILABLE' OR v_table.current_session_id IS DISTINCT FROM v_session.id THEN
      UPDATE public.tables
      SET status = CASE WHEN status = 'AVAILABLE' THEN 'OCCUPIED' ELSE status END,
          current_session_id = v_session.id,
          updated_at = NOW()
      WHERE id = p_table_id AND tenant_id = p_tenant_id;
    END IF;

    RETURN to_jsonb(v_session);
  END IF;

  -- 5. Create new active session atomically under table lock
  v_token := 'stok_' || substr(md5(random()::text || clock_timestamp()::text), 1, 10);

  INSERT INTO public.table_sessions (
    tenant_id,
    table_id,
    session_token,
    customer_name,
    customer_phone,
    is_active,
    started_at
  ) VALUES (
    p_tenant_id,
    p_table_id,
    v_token,
    COALESCE(NULLIF(trim(p_customer_name), ''), 'Valued Guest'),
    NULLIF(trim(p_phone), ''),
    TRUE,
    NOW()
  )
  RETURNING * INTO v_session;

  -- 6. Atomically transition table status to OCCUPIED
  UPDATE public.tables
  SET status = 'OCCUPIED',
      current_session_id = v_session.id,
      updated_at = NOW()
  WHERE id = p_table_id AND tenant_id = p_tenant_id;

  RETURN to_jsonb(v_session);
END;
$$;

-- Granted to anon, authenticated, and service_role (needed for seated customer QR ordering)
GRANT EXECUTE ON FUNCTION public.get_or_create_tenant_session(UUID, UUID, TEXT, TEXT, TEXT) TO anon, authenticated, service_role;

-- ------------------------------------------------------------
-- 7. RBAC Table Status Update Function
-- Strictly restricts transitions by staff role and prevents cross-tenant changes
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_tenant_table_status(
  p_tenant_id UUID,
  p_table_id UUID,
  p_status TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_caller_role TEXT;
  v_caller_tenant UUID;
  v_table RECORD;
BEGIN
  -- 1. Validate status input
  IF p_status NOT IN ('AVAILABLE', 'OCCUPIED', 'BILL_REQUESTED', 'PAYMENT_PENDING', 'PAID', 'CLEANING') THEN
    RAISE EXCEPTION 'Invalid table status: %', p_status;
  END IF;

  -- 2. Verify caller authorization if called via authenticated user
  IF auth.uid() IS NOT NULL THEN
    SELECT role, tenant_id INTO v_caller_role, v_caller_tenant
    FROM public.users
    WHERE auth_user_id = auth.uid() AND is_active = TRUE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Authenticated staff profile not found';
    END IF;

    IF v_caller_tenant != p_tenant_id THEN
      RAISE EXCEPTION 'Cross-tenant table update forbidden';
    END IF;

    -- Role transition boundary enforcement
    IF v_caller_role NOT IN ('OWNER', 'ADMIN', 'MANAGER') THEN
      IF v_caller_role IN ('WAITER', 'STAFF') AND p_status NOT IN ('OCCUPIED', 'BILL_REQUESTED', 'CLEANING', 'AVAILABLE') THEN
        RAISE EXCEPTION 'Waiters may only update table to OCCUPIED, BILL_REQUESTED, CLEANING, or AVAILABLE';
      ELSIF v_caller_role = 'CASHIER' AND p_status NOT IN ('BILL_REQUESTED', 'PAYMENT_PENDING', 'PAID') THEN
        RAISE EXCEPTION 'Cashiers may only update table to BILL_REQUESTED, PAYMENT_PENDING, or PAID';
      ELSIF v_caller_role = 'CHEF' THEN
        RAISE EXCEPTION 'Chefs are not permitted to change dining table floor status';
      END IF;
    END IF;
  END IF;

  -- 3. Execute update with strict tenant isolation
  UPDATE public.tables
  SET status = p_status,
      current_session_id = CASE WHEN p_status IN ('AVAILABLE', 'PAID', 'CLEANING') THEN NULL ELSE current_session_id END,
      updated_at = NOW()
  WHERE id = p_table_id AND tenant_id = p_tenant_id
  RETURNING * INTO v_table;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Table % not found for tenant %', p_table_id, p_tenant_id;
  END IF;

  RETURN to_jsonb(v_table);
END;
$$;

-- Restrict to authenticated staff and service_role; revoke from anon
REVOKE ALL ON FUNCTION public.update_tenant_table_status(UUID, UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_tenant_table_status(UUID, UUID, TEXT) TO authenticated, service_role;

-- ------------------------------------------------------------
-- 8. Owner/Admin PIN Management (Cryptographically Salted & Verified)
-- Enforces caller authorization strictly via auth.uid(), verified tenant membership,
-- and forbids caller-supplied tenant/role spoofing
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_tenant_staff_pin(
  p_user_id UUID,
  p_new_pin TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_caller_role TEXT;
  v_caller_tenant UUID;
  v_target_user RECORD;
BEGIN
  -- 1. Identify caller strictly from auth.uid()
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT role, tenant_id INTO v_caller_role, v_caller_tenant
  FROM public.users
  WHERE auth_user_id = auth.uid() AND is_active = TRUE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Caller user profile not found or inactive';
  END IF;

  -- 2. Verify caller has OWNER or ADMIN privileges
  IF v_caller_role NOT IN ('OWNER', 'ADMIN') THEN
    RAISE EXCEPTION 'Insufficient permissions. Only OWNER or ADMIN may update staff PINs';
  END IF;

  -- 3. Validate new PIN complexity
  IF p_new_pin IS NULL OR length(trim(p_new_pin)) < 4 THEN
    RAISE EXCEPTION 'PIN must be at least 4 digits';
  END IF;

  -- 4. Verify target user belongs strictly to the caller tenant
  SELECT * INTO v_target_user
  FROM public.users
  WHERE id = p_user_id AND tenant_id = v_caller_tenant;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Target staff user not found in caller tenant';
  END IF;

  -- 5. Update with bcrypt salted hash
  UPDATE public.users
  SET pin_code = extensions.crypt(trim(p_new_pin), extensions.gen_salt('bf', 8)),
      updated_at = NOW()
  WHERE id = p_user_id AND tenant_id = v_caller_tenant;

  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.set_tenant_staff_pin(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_tenant_staff_pin(UUID, TEXT) TO authenticated, service_role;

-- ------------------------------------------------------------
-- 9. Secure Initial Owner Provisioning Procedure
-- Restricted exclusively to service_role to prevent unauthorized owner creation or tenant spoofing.
-- Allows provisioning the initial Owner profile ONLY if the tenant exists and has NO existing owner record.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.provision_initial_owner(
  p_tenant_id UUID,
  p_full_name TEXT,
  p_email TEXT,
  p_auth_user_id UUID,
  p_pin TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_existing_owner RECORD;
  v_new_owner RECORD;
BEGIN
  -- 1. Validate parameters
  IF p_tenant_id IS NULL OR p_email IS NULL OR trim(p_email) = '' THEN
    RAISE EXCEPTION 'Tenant ID and Email are required';
  END IF;

  IF p_pin IS NULL OR length(trim(p_pin)) < 4 THEN
    RAISE EXCEPTION 'Owner PIN must be at least 4 digits';
  END IF;

  -- 2. Verify tenant exists
  PERFORM id FROM public.tenants WHERE id = p_tenant_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tenant % does not exist', p_tenant_id;
  END IF;

  -- 3. Check if ANY Owner (active or inactive) already exists for this tenant
  SELECT id INTO v_existing_owner
  FROM public.users
  WHERE tenant_id = p_tenant_id AND role = 'OWNER'
  LIMIT 1;

  IF FOUND THEN
    RAISE EXCEPTION 'Tenant already has an owner configured. Use set_tenant_staff_pin or standard staff management.';
  END IF;

  -- 4. Check if email is already in use within this tenant
  PERFORM id FROM public.users
  WHERE tenant_id = p_tenant_id AND lower(email) = lower(trim(p_email));
  IF FOUND THEN
    RAISE EXCEPTION 'Email % is already in use for tenant %', p_email, p_tenant_id;
  END IF;

  -- 5. Insert new Owner with salted bcrypt hash
  INSERT INTO public.users (
    tenant_id,
    auth_user_id,
    full_name,
    email,
    role,
    pin_code,
    is_active
  ) VALUES (
    p_tenant_id,
    p_auth_user_id,
    COALESCE(NULLIF(trim(p_full_name), ''), 'Alexander Vance (Owner)'),
    lower(trim(p_email)),
    'OWNER',
    extensions.crypt(trim(p_pin), extensions.gen_salt('bf', 8)),
    TRUE
  )
  RETURNING * INTO v_new_owner;

  RETURN to_jsonb(v_new_owner);
END;
$$;

-- Restricted strictly to service_role; revoke from PUBLIC, anon, and authenticated
REVOKE ALL ON FUNCTION public.provision_initial_owner(UUID, TEXT, TEXT, UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.provision_initial_owner(UUID, TEXT, TEXT, UUID, TEXT) TO service_role;


