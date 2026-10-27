-- ============================================================
-- VELVET BLOOM CAFÉ V2 — MIGRATION 20261025000002
-- Staff Management RPCs, Menu Archiving & Owner Controls
-- Tenant: 00000000-0000-0000-0000-000000000001
-- ============================================================

-- 1. Add is_archived column to menu_items if not present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'menu_items' 
      AND column_name = 'is_archived'
  ) THEN
    ALTER TABLE public.menu_items ADD COLUMN is_archived BOOLEAN NOT NULL DEFAULT FALSE;
  END IF;
END $$;

-- 2. Secure Staff Creation Procedure
-- Strictly enforces role bounds (MANAGER, CHEF, WAITER, CASHIER, STAFF)
-- Prohibits unauthorized OWNER or ADMIN self-creation/promotion
-- Automatically hashes numeric PIN using pgcrypto bcrypt ($2bf$8)
CREATE OR REPLACE FUNCTION public.admin_create_staff(
  p_tenant_id UUID,
  p_full_name TEXT,
  p_email TEXT,
  p_role TEXT,
  p_pin TEXT,
  p_phone TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_clean_email TEXT;
  v_clean_name TEXT;
  v_clean_role TEXT;
  v_clean_pin TEXT;
  v_new_user RECORD;
BEGIN
  -- Validate tenant
  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Tenant ID is required';
  END IF;

  -- Validate name
  v_clean_name := trim(COALESCE(p_full_name, ''));
  IF length(v_clean_name) < 2 THEN
    RAISE EXCEPTION 'Staff full name must be at least 2 characters';
  END IF;

  -- Validate email
  v_clean_email := lower(trim(COALESCE(p_email, '')));
  IF v_clean_email = '' OR v_clean_email NOT LIKE '%@%.%' THEN
    RAISE EXCEPTION 'A valid email address is required';
  END IF;

  -- Validate role: explicitly permit only standard staff roles (NO OWNER/ADMIN bypass)
  v_clean_role := upper(trim(COALESCE(p_role, '')));
  IF v_clean_role NOT IN ('MANAGER', 'CHEF', 'WAITER', 'CASHIER', 'STAFF') THEN
    RAISE EXCEPTION 'Invalid staff role: %. Permitted roles: MANAGER, CHEF, WAITER, CASHIER, STAFF', v_clean_role;
  END IF;

  -- Validate PIN: 4 to 6 numeric digits
  v_clean_pin := trim(COALESCE(p_pin, ''));
  IF length(v_clean_pin) < 4 OR length(v_clean_pin) > 6 OR v_clean_pin !~ '^[0-9]+$' THEN
    RAISE EXCEPTION 'Staff PIN must be between 4 and 6 numeric digits';
  END IF;

  -- Check email uniqueness within tenant
  IF EXISTS (
    SELECT 1 FROM public.users 
    WHERE tenant_id = p_tenant_id AND lower(email) = v_clean_email
  ) THEN
    RAISE EXCEPTION 'Email % is already in use within this tenant', v_clean_email;
  END IF;

  -- Insert user with salted bcrypt PIN hash
  INSERT INTO public.users (
    tenant_id,
    full_name,
    email,
    role,
    phone,
    pin_code,
    is_active
  ) VALUES (
    p_tenant_id,
    v_clean_name,
    v_clean_email,
    v_clean_role,
    NULLIF(trim(p_phone), ''),
    extensions.crypt(v_clean_pin, extensions.gen_salt('bf', 8)),
    TRUE
  )
  RETURNING id, tenant_id, auth_user_id, full_name, email, role, phone, is_active, created_at, updated_at
  INTO v_new_user;

  RETURN to_jsonb(v_new_user);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_create_staff(UUID, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_create_staff(UUID, TEXT, TEXT, TEXT, TEXT, TEXT) TO service_role, authenticated;

-- 3. Secure Staff PIN Reset Procedure
-- Updates numeric PIN with bcrypt hash for a specific staff member
CREATE OR REPLACE FUNCTION public.admin_update_staff_pin(
  p_tenant_id UUID,
  p_user_id UUID,
  p_new_pin TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_clean_pin TEXT;
  v_target_user RECORD;
BEGIN
  IF p_tenant_id IS NULL OR p_user_id IS NULL THEN
    RAISE EXCEPTION 'Tenant ID and User ID are required';
  END IF;

  -- Validate PIN: 4 to 6 numeric digits
  v_clean_pin := trim(COALESCE(p_new_pin, ''));
  IF length(v_clean_pin) < 4 OR length(v_clean_pin) > 6 OR v_clean_pin !~ '^[0-9]+$' THEN
    RAISE EXCEPTION 'PIN must be between 4 and 6 numeric digits';
  END IF;

  -- Verify target user belongs to tenant
  SELECT id, role INTO v_target_user
  FROM public.users
  WHERE id = p_user_id AND tenant_id = p_tenant_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Staff user not found in this tenant';
  END IF;

  -- Update PIN with bcrypt salt
  UPDATE public.users
  SET pin_code = extensions.crypt(v_clean_pin, extensions.gen_salt('bf', 8)),
      updated_at = NOW()
  WHERE id = p_user_id AND tenant_id = p_tenant_id;

  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_update_staff_pin(UUID, UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_update_staff_pin(UUID, UUID, TEXT) TO service_role, authenticated;

-- 4. Secure Staff Profile Update Procedure
-- Safely modifies full_name, email, role, phone, and is_active status
-- Protects Owner account against demotion or deactivation
CREATE OR REPLACE FUNCTION public.admin_update_staff(
  p_tenant_id UUID,
  p_user_id UUID,
  p_full_name TEXT DEFAULT NULL,
  p_email TEXT DEFAULT NULL,
  p_role TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL,
  p_is_active BOOLEAN DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_target_user RECORD;
  v_clean_email TEXT;
  v_clean_name TEXT;
  v_clean_role TEXT;
  v_updated_user RECORD;
BEGIN
  IF p_tenant_id IS NULL OR p_user_id IS NULL THEN
    RAISE EXCEPTION 'Tenant ID and User ID are required';
  END IF;

  SELECT * INTO v_target_user
  FROM public.users
  WHERE id = p_user_id AND tenant_id = p_tenant_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Staff user not found in this tenant';
  END IF;

  -- Prevent demoting or deactivating OWNER
  IF v_target_user.role = 'OWNER' THEN
    IF p_is_active IS NOT NULL AND p_is_active = FALSE THEN
      RAISE EXCEPTION 'Cannot deactivate the primary Owner account';
    END IF;
    IF p_role IS NOT NULL AND upper(trim(p_role)) != 'OWNER' THEN
      RAISE EXCEPTION 'Cannot change the role of the primary Owner account';
    END IF;
  END IF;

  -- Validate role if updating
  IF p_role IS NOT NULL THEN
    v_clean_role := upper(trim(p_role));
    IF v_clean_role NOT IN ('OWNER', 'MANAGER', 'CHEF', 'WAITER', 'CASHIER', 'STAFF') THEN
      RAISE EXCEPTION 'Invalid role: %', v_clean_role;
    END IF;
  ELSE
    v_clean_role := v_target_user.role;
  END IF;

  -- Validate email if updating
  IF p_email IS NOT NULL THEN
    v_clean_email := lower(trim(p_email));
    IF v_clean_email = '' OR v_clean_email NOT LIKE '%@%.%' THEN
      RAISE EXCEPTION 'A valid email address is required';
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.users 
      WHERE tenant_id = p_tenant_id AND lower(email) = v_clean_email AND id != p_user_id
    ) THEN
      RAISE EXCEPTION 'Email % is already in use by another user', v_clean_email;
    END IF;
  ELSE
    v_clean_email := v_target_user.email;
  END IF;

  -- Clean name
  IF p_full_name IS NOT NULL THEN
    v_clean_name := trim(p_full_name);
    IF length(v_clean_name) < 2 THEN
      RAISE EXCEPTION 'Staff name must be at least 2 characters';
    END IF;
  ELSE
    v_clean_name := v_target_user.full_name;
  END IF;

  UPDATE public.users
  SET full_name = v_clean_name,
      email = v_clean_email,
      role = v_clean_role,
      phone = COALESCE(NULLIF(trim(p_phone), ''), phone),
      is_active = COALESCE(p_is_active, is_active),
      updated_at = NOW()
  WHERE id = p_user_id AND tenant_id = p_tenant_id
  RETURNING id, tenant_id, auth_user_id, full_name, email, role, phone, is_active, created_at, updated_at
  INTO v_updated_user;

  RETURN to_jsonb(v_updated_user);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_update_staff(UUID, UUID, TEXT, TEXT, TEXT, TEXT, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_update_staff(UUID, UUID, TEXT, TEXT, TEXT, TEXT, BOOLEAN) TO service_role, authenticated;

