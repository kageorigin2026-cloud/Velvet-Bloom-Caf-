-- ============================================================
-- VELVET BLOOM CAFÉ V2 — SECURE STORAGE BUCKETS & RLS
-- Multi-Tenant Audio & Asset Storage Configuration
-- ============================================================

-- 1. Create Private Storage Bucket for Cafe Assets (Audio files, Sound clips, Brand assets)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'cafe-assets',
  'cafe-assets',
  FALSE, -- Strictly private! Requires signed URLs or authenticated tenant access
  5242880, -- 5MB file size limit per sound or asset
  ARRAY['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp3', 'image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = FALSE,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp3', 'image/jpeg', 'image/png', 'image/webp'];

-- 2. Tenant-Aware Storage RLS Policies
-- Objects are organized into folders by tenant_id: {tenant_id}/sounds/{filename}

-- Policy: Allow staff of a tenant to view and download their tenant's assets
DROP POLICY IF EXISTS "Tenant staff can view tenant storage objects" ON storage.objects;
CREATE POLICY "Tenant staff can view tenant storage objects"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'cafe-assets'
  AND (
    (storage.foldername(name))[1] = get_auth_tenant_id()::TEXT
    OR auth.role() = 'service_role'
  )
);

-- Policy: Allow authorized staff to upload assets into their tenant's folder
DROP POLICY IF EXISTS "Tenant staff can upload tenant storage objects" ON storage.objects;
CREATE POLICY "Tenant staff can upload tenant storage objects"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'cafe-assets'
  AND (
    (storage.foldername(name))[1] = get_auth_tenant_id()::TEXT
    AND has_tenant_role(get_auth_tenant_id(), ARRAY['OWNER', 'ADMIN', 'CHEF', 'STAFF'])
    OR auth.role() = 'service_role'
  )
);

-- Policy: Allow Admins/Owners to delete their tenant's assets
DROP POLICY IF EXISTS "Tenant admins can delete tenant storage objects" ON storage.objects;
CREATE POLICY "Tenant admins can delete tenant storage objects"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'cafe-assets'
  AND (
    (storage.foldername(name))[1] = get_auth_tenant_id()::TEXT
    AND has_tenant_role(get_auth_tenant_id(), ARRAY['OWNER', 'ADMIN'])
    OR auth.role() = 'service_role'
  )
);
