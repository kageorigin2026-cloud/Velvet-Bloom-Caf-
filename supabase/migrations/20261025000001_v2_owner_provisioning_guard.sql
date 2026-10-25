-- Migration: 20261025000001_v2_owner_provisioning_guard.sql
-- Description: Strengthen initial owner provisioning with transactional advisory locks,
-- tenant uniqueness constraints, and strict service_role execution enforcement.

-- 1. Ensure absolute tenant uniqueness for the OWNER role at the table constraint level
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_single_owner_per_tenant
  ON public.users(tenant_id)
  WHERE role = 'OWNER';

-- 2. Concurrency-safe initial owner provisioning function
CREATE OR REPLACE FUNCTION public.provision_initial_owner(
  p_tenant_id UUID,
  p_full_name TEXT,
  p_email TEXT,
  p_auth_user_id UUID DEFAULT NULL,
  p_pin TEXT DEFAULT NULL
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
  -- Concurrency Guard: Transactional advisory lock scoped to tenant owner provisioning
  PERFORM pg_advisory_xact_lock(hashtext('provision_owner_' || p_tenant_id::text));

  -- 1. Validate parameters
  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Tenant ID is required';
  END IF;

  IF p_email IS NULL OR trim(p_email) = '' THEN
    RAISE EXCEPTION 'Email is required';
  END IF;

  IF p_pin IS NULL OR length(trim(p_pin)) < 4 THEN
    RAISE EXCEPTION 'Owner PIN must be between 4 and 6 numeric digits';
  END IF;

  -- 2. Verify tenant exists
  PERFORM id FROM public.tenants WHERE id = p_tenant_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tenant % does not exist', p_tenant_id;
  END IF;

  -- 3. Check if ANY Owner already exists for this tenant
  SELECT id INTO v_existing_owner
  FROM public.users
  WHERE tenant_id = p_tenant_id AND role = 'OWNER'
  LIMIT 1;

  IF FOUND THEN
    RAISE EXCEPTION 'An owner is already configured for this tenant. Duplicate owner provisioning is denied.';
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
    extensions.crypt(trim(p_pin), extensions.gen_salt('bf', 10)),
    TRUE
  )
  RETURNING * INTO v_new_owner;

  RETURN to_jsonb(v_new_owner);
END;
$$;

-- 3. Strict security permissions: Accessible ONLY to trusted server-side service_role
REVOKE ALL ON FUNCTION public.provision_initial_owner(UUID, TEXT, TEXT, UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.provision_initial_owner(UUID, TEXT, TEXT, UUID, TEXT) TO service_role;
