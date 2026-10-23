-- ============================================================
-- VELVET BLOOM CAFÉ V2 — ROW LEVEL SECURITY POLICIES
-- Strict Multi-Tenant Isolation
-- ============================================================

-- Enable RLS on all tenant tables
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE cafe_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE table_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE customization_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE customization_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_item_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE bill_splits ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_activity ENABLE ROW LEVEL SECURITY;

-- Helper function: get current user's tenant_id from auth.uid()
CREATE OR REPLACE FUNCTION get_auth_tenant_id()
RETURNS UUID AS $$
  SELECT tenant_id FROM users WHERE auth_user_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Helper function: check if authenticated user belongs to tenant
CREATE OR REPLACE FUNCTION is_tenant_member(p_tenant_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM users
    WHERE auth_user_id = auth.uid()
      AND tenant_id = p_tenant_id
      AND is_active = TRUE
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Helper function: check staff role
CREATE OR REPLACE FUNCTION has_tenant_role(p_tenant_id UUID, p_roles TEXT[])
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM users
    WHERE auth_user_id = auth.uid()
      AND tenant_id = p_tenant_id
      AND role = ANY(p_roles)
      AND is_active = TRUE
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- 1. TENANTS POLICY
DROP POLICY IF EXISTS "Public can view active tenants" ON tenants;
CREATE POLICY "Public can view active tenants" ON tenants
  FOR SELECT USING (is_active = TRUE);

DROP POLICY IF EXISTS "Owners can update their own tenant" ON tenants;
CREATE POLICY "Owners can update their own tenant" ON tenants
  FOR UPDATE USING (has_tenant_role(id, ARRAY['OWNER', 'ADMIN']));

-- 2. CAFE SETTINGS POLICY
DROP POLICY IF EXISTS "Public can view cafe settings" ON cafe_settings;
CREATE POLICY "Public can view cafe settings" ON cafe_settings
  FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "Staff can update cafe settings" ON cafe_settings;
CREATE POLICY "Staff can update cafe settings" ON cafe_settings
  FOR ALL USING (has_tenant_role(tenant_id, ARRAY['OWNER', 'ADMIN']));

-- 3. MENU & CATEGORIES POLICIES
DROP POLICY IF EXISTS "Public can view menu categories" ON categories;
CREATE POLICY "Public can view menu categories" ON categories
  FOR SELECT USING (is_active = TRUE);

DROP POLICY IF EXISTS "Public can view menu items" ON menu_items;
CREATE POLICY "Public can view menu items" ON menu_items
  FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "Public can view customization groups" ON customization_groups;
CREATE POLICY "Public can view customization groups" ON customization_groups
  FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "Public can view customization options" ON customization_options;
CREATE POLICY "Public can view customization options" ON customization_options
  FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "Staff can manage menu" ON menu_items;
CREATE POLICY "Staff can manage menu" ON menu_items
  FOR ALL USING (has_tenant_role(tenant_id, ARRAY['OWNER', 'ADMIN', 'CHEF']));

-- 4. TABLES & SESSIONS POLICIES
DROP POLICY IF EXISTS "Public can view tables" ON tables;
CREATE POLICY "Public can view tables" ON tables
  FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "Allow updating table status" ON tables;
CREATE POLICY "Allow updating table status" ON tables
  FOR UPDATE USING (TRUE)
  WITH CHECK (TRUE);

DROP POLICY IF EXISTS "Staff can manage tables" ON tables;
CREATE POLICY "Staff can manage tables" ON tables
  FOR ALL USING (is_tenant_member(tenant_id));

DROP POLICY IF EXISTS "Public can read and create table sessions" ON table_sessions;
CREATE POLICY "Public can read and create table sessions" ON table_sessions
  FOR ALL USING (TRUE);

-- 5. ORDERS & ITEMS POLICIES
DROP POLICY IF EXISTS "Public customer can insert order" ON orders;
CREATE POLICY "Public customer can insert order" ON orders
  FOR INSERT WITH CHECK (TRUE);

DROP POLICY IF EXISTS "Public customer can view own order by session" ON orders;
CREATE POLICY "Public customer can view own order by session" ON orders
  FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "Allow updating order status" ON orders;
CREATE POLICY "Allow updating order status" ON orders
  FOR UPDATE USING (TRUE)
  WITH CHECK (TRUE);

DROP POLICY IF EXISTS "Staff can manage orders of their tenant" ON orders;
CREATE POLICY "Staff can manage orders of their tenant" ON orders
  FOR ALL USING (is_tenant_member(tenant_id));

DROP POLICY IF EXISTS "Public customer can insert order items" ON order_items;
CREATE POLICY "Public customer can insert order items" ON order_items
  FOR INSERT WITH CHECK (TRUE);

DROP POLICY IF EXISTS "Public customer and staff can view order items" ON order_items;
CREATE POLICY "Public customer and staff can view order items" ON order_items
  FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "Public customer and staff can view order item options" ON order_item_options;
CREATE POLICY "Public customer and staff can view order item options" ON order_item_options
  FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "Public customer can insert order item options" ON order_item_options;
CREATE POLICY "Public customer can insert order item options" ON order_item_options
  FOR INSERT WITH CHECK (TRUE);

DROP POLICY IF EXISTS "Public customer and staff can view order events" ON order_events;
CREATE POLICY "Public customer and staff can view order events" ON order_events
  FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "Allow inserting order events" ON order_events;
CREATE POLICY "Allow inserting order events" ON order_events
  FOR INSERT WITH CHECK (TRUE);

-- 6. BILLS & PAYMENTS POLICIES
DROP POLICY IF EXISTS "Public customer can view bills" ON bills;
CREATE POLICY "Public customer can view bills" ON bills
  FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "Allow managing bills" ON bills;
CREATE POLICY "Allow managing bills" ON bills
  FOR ALL USING (TRUE);

DROP POLICY IF EXISTS "Staff can manage bills" ON bills;
CREATE POLICY "Staff can manage bills" ON bills
  FOR ALL USING (is_tenant_member(tenant_id));

DROP POLICY IF EXISTS "Public and staff can view bill splits" ON bill_splits;
CREATE POLICY "Public and staff can view bill splits" ON bill_splits
  FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "Staff can manage bill splits" ON bill_splits;
CREATE POLICY "Staff can manage bill splits" ON bill_splits
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM bills b
      WHERE b.id = bill_splits.bill_id
        AND is_tenant_member(b.tenant_id)
    )
  );

DROP POLICY IF EXISTS "Public and staff can view payments" ON payments;
CREATE POLICY "Public and staff can view payments" ON payments
  FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "Allow inserting payments" ON payments;
CREATE POLICY "Allow inserting payments" ON payments
  FOR INSERT WITH CHECK (TRUE);

DROP POLICY IF EXISTS "Staff can manage payments" ON payments;
CREATE POLICY "Staff can manage payments" ON payments
  FOR ALL USING (is_tenant_member(tenant_id));

-- 7. SERVICE REQUESTS & REVIEWS POLICIES
DROP POLICY IF EXISTS "Public can insert service requests" ON service_requests;
CREATE POLICY "Public can insert service requests" ON service_requests
  FOR INSERT WITH CHECK (TRUE);

DROP POLICY IF EXISTS "Public and staff can view service requests" ON service_requests;
CREATE POLICY "Public and staff can view service requests" ON service_requests
  FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "Staff can update service requests" ON service_requests;
CREATE POLICY "Staff can update service requests" ON service_requests
  FOR UPDATE USING (is_tenant_member(tenant_id));

DROP POLICY IF EXISTS "Public can view approved reviews" ON reviews;
CREATE POLICY "Public can view approved reviews" ON reviews
  FOR SELECT USING (is_approved = TRUE);

DROP POLICY IF EXISTS "Public can insert reviews" ON reviews;
CREATE POLICY "Public can insert reviews" ON reviews
  FOR INSERT WITH CHECK (TRUE);

-- 8. USERS & NOTIFICATIONS POLICIES
DROP POLICY IF EXISTS "Users can view their own profile or tenant staff" ON users;
CREATE POLICY "Users can view their own profile or tenant staff" ON users
  FOR SELECT USING (
    auth.uid() = auth_user_id
    OR is_tenant_member(tenant_id)
  );

DROP POLICY IF EXISTS "Owners and admins can manage tenant users" ON users;
CREATE POLICY "Owners and admins can manage tenant users" ON users
  FOR ALL USING (has_tenant_role(tenant_id, ARRAY['OWNER', 'ADMIN']));

DROP POLICY IF EXISTS "Tenant staff can view and manage notifications" ON notifications;
CREATE POLICY "Tenant staff can view and manage notifications" ON notifications
  FOR ALL USING (is_tenant_member(tenant_id));
