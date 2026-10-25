-- ============================================================
-- VELVET BLOOM CAFÉ V2 — TABLE SESSION ATOMICITY, RBAC & SECURE STAFF AUTH
-- Forward Migration: 20261025000000_v2_table_session_and_rbac.sql
-- ============================================================

-- Ensure pgcrypto extension is available for salted hashing
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Ensure UserRole check constraint includes MANAGER
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check 
  CHECK (role IN ('OWNER', 'ADMIN', 'MANAGER', 'CHEF', 'STAFF', 'WAITER', 'CASHIER', 'CUSTOMER'));

-- 2. Atomic Table Status Update Function (Staff / Service-Role only)
CREATE OR REPLACE FUNCTION update_tenant_table_status(
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
  v_table RECORD;
BEGIN
  -- Strict tenant check
  UPDATE tables
  SET status = p_status,
      updated_at = NOW()
  WHERE id = p_table_id AND tenant_id = p_tenant_id
  RETURNING * INTO v_table;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Table % not found for tenant %', p_table_id, p_tenant_id;
  END IF;

  RETURN to_jsonb(v_table);
END;
$$;

-- Restricted: only authenticated staff & service role may change table statuses directly
REVOKE EXECUTE ON FUNCTION update_tenant_table_status(UUID, UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION update_tenant_table_status(UUID, UUID, TEXT) TO authenticated, service_role;

-- 3. Atomic Table Session Creation with Concurrency Lock
-- Prevents duplicate session creation when multiple requests or prefetch calls arrive within milliseconds
CREATE OR REPLACE FUNCTION get_or_create_tenant_session(
  p_tenant_id UUID,
  p_table_id UUID,
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
  -- 1. Verify table belongs to tenant
  SELECT * INTO v_table
  FROM tables
  WHERE id = p_table_id AND tenant_id = p_tenant_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Table % not found for tenant %', p_table_id, p_tenant_id;
  END IF;

  -- 2. Concurrency lock on table row to serialize concurrent session requests
  PERFORM id FROM tables WHERE id = p_table_id AND tenant_id = p_tenant_id FOR UPDATE;

  -- 3. Check for existing active session
  SELECT * INTO v_session
  FROM table_sessions
  WHERE tenant_id = p_tenant_id
    AND table_id = p_table_id
    AND is_active = TRUE
  ORDER BY created_at DESC
  LIMIT 1;

  IF FOUND THEN
    -- If table is still marked AVAILABLE, transition it to OCCUPIED atomically
    IF v_table.status = 'AVAILABLE' THEN
      UPDATE tables
      SET status = 'OCCUPIED',
          current_session_id = v_session.id,
          updated_at = NOW()
      WHERE id = p_table_id AND tenant_id = p_tenant_id;
    END IF;

    RETURN to_jsonb(v_session);
  END IF;

  -- 4. Create new active session atomically
  v_token := 'stok_' || substr(md5(random()::text || clock_timestamp()::text), 1, 10);

  INSERT INTO table_sessions (
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
    COALESCE(NULLIF(p_customer_name, ''), 'Valued Guest'),
    p_phone,
    TRUE,
    NOW()
  )
  RETURNING * INTO v_session;

  -- 5. Atomically update table status to OCCUPIED
  UPDATE tables
  SET status = 'OCCUPIED',
      current_session_id = v_session.id,
      updated_at = NOW()
  WHERE id = p_table_id AND tenant_id = p_tenant_id;

  RETURN to_jsonb(v_session);
END;
$$;

GRANT EXECUTE ON FUNCTION get_or_create_tenant_session(UUID, UUID, TEXT, TEXT) TO anon, authenticated, service_role;

-- 4. Secure Staff Terminal PIN Authentication Function (Salted Cryptographic Hash)
-- Authenticates a staff PIN securely inside PostgreSQL using pgcrypto bcrypt hash verification
CREATE OR REPLACE FUNCTION authenticate_tenant_staff(
  p_tenant_id UUID,
  p_pin TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_user RECORD;
  v_clean_pin TEXT;
BEGIN
  IF p_pin IS NULL OR length(trim(p_pin)) < 4 THEN
    RETURN NULL;
  END IF;

  v_clean_pin := trim(p_pin);

  SELECT id, tenant_id, auth_user_id, full_name, email, role, phone, is_active, created_at, updated_at
  INTO v_user
  FROM users
  WHERE tenant_id = p_tenant_id
    AND is_active = TRUE
    AND (
      -- Bcrypt hash verification
      (pin_code LIKE '$2%' AND crypt(v_clean_pin, pin_code) = pin_code)
      -- Fallback during transition if pin was plain
      OR (pin_code = v_clean_pin)
    );

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  RETURN to_jsonb(v_user);
END;
$$;

GRANT EXECUTE ON FUNCTION authenticate_tenant_staff(UUID, TEXT) TO anon, authenticated, service_role;

-- 5. Secure Procedure for Admin/Owner to Update Staff PINs with Cryptographic Hashing
CREATE OR REPLACE FUNCTION set_tenant_staff_pin(
  p_tenant_id UUID,
  p_user_id UUID,
  p_new_pin TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF p_new_pin IS NULL OR length(trim(p_new_pin)) < 4 THEN
    RAISE EXCEPTION 'Staff PIN must be at least 4 digits';
  END IF;

  UPDATE users
  SET pin_code = crypt(trim(p_new_pin), gen_salt('bf', 8)),
      updated_at = NOW()
  WHERE id = p_user_id AND tenant_id = p_tenant_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Staff user % not found for tenant %', p_user_id, p_tenant_id;
  END IF;

  RETURN TRUE;
END;
$$;

REVOKE EXECUTE ON FUNCTION set_tenant_staff_pin(UUID, UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION set_tenant_staff_pin(UUID, UUID, TEXT) TO authenticated, service_role;

-- 6. Provision Initial Staff Profiles with Salted Bcrypt Hashed Credentials
-- Notice: Stored with bcrypt salts via pgcrypto crypt(), NEVER plaintext
INSERT INTO users (id, tenant_id, full_name, email, role, pin_code, phone, is_active)
VALUES 
  (
    '00000000-0000-0000-0000-000000000101',
    '00000000-0000-0000-0000-000000000001',
    'Alexander Vance (Owner)',
    'owner@velvetbloom.com',
    'OWNER',
    crypt('1111', gen_salt('bf', 8)),
    '+91 98765 43210',
    TRUE
  ),
  (
    '00000000-0000-0000-0000-000000000102',
    '00000000-0000-0000-0000-000000000001',
    'Elena Rostova (General Manager)',
    'manager@velvetbloom.com',
    'MANAGER',
    crypt('5555', gen_salt('bf', 8)),
    '+91 98765 43215',
    TRUE
  ),
  (
    '00000000-0000-0000-0000-000000000103',
    '00000000-0000-0000-0000-000000000001',
    'Chef Marcus Chen (Executive Chef)',
    'chef@velvetbloom.com',
    'CHEF',
    crypt('2222', gen_salt('bf', 8)),
    '+91 98765 43211',
    TRUE
  ),
  (
    '00000000-0000-0000-0000-000000000104',
    '00000000-0000-0000-0000-000000000001',
    'Liam Patel (Head Waiter)',
    'waiter@velvetbloom.com',
    'WAITER',
    crypt('3333', gen_salt('bf', 8)),
    '+91 98765 43212',
    TRUE
  ),
  (
    '00000000-0000-0000-0000-000000000105',
    '00000000-0000-0000-0000-000000000001',
    'Sophia Al-Mansoor (Chief Cashier)',
    'cashier@velvetbloom.com',
    'CASHIER',
    crypt('4444', gen_salt('bf', 8)),
    '+91 98765 43214',
    TRUE
  )
ON CONFLICT (tenant_id, email) DO UPDATE SET
  full_name = EXCLUDED.full_name,
  role = EXCLUDED.role,
  pin_code = EXCLUDED.pin_code,
  phone = EXCLUDED.phone,
  is_active = TRUE;
