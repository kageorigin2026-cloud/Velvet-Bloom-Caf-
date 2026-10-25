-- ============================================================
-- VELVET BLOOM CAFÉ V2 — TEST DATA CLEANUP & RESET
-- Tenant: 00000000-0000-0000-0000-000000000001
-- Safe Execution in Supabase SQL Editor
-- ============================================================

BEGIN;

-- 1. Remove order items & order events associated with orders of this tenant
DELETE FROM order_item_options
WHERE order_item_id IN (
  SELECT oi.id FROM order_items oi
  JOIN orders o ON oi.order_id = o.id
  WHERE o.tenant_id = '00000000-0000-0000-0000-000000000001'
);

DELETE FROM order_items
WHERE order_id IN (
  SELECT id FROM orders
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
);

DELETE FROM order_events
WHERE tenant_id = '00000000-0000-0000-0000-000000000001';

-- 2. Remove payments and bill splits
DELETE FROM payments
WHERE tenant_id = '00000000-0000-0000-0000-000000000001';

DELETE FROM bill_splits
WHERE bill_id IN (
  SELECT id FROM bills
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
);

-- 3. Remove bills
DELETE FROM bills
WHERE tenant_id = '00000000-0000-0000-0000-000000000001';

-- 4. Remove orders
DELETE FROM orders
WHERE tenant_id = '00000000-0000-0000-0000-000000000001';

-- 5. Remove reviews
DELETE FROM reviews
WHERE tenant_id = '00000000-0000-0000-0000-000000000001';

-- 6. Remove service requests
DELETE FROM service_requests
WHERE tenant_id = '00000000-0000-0000-0000-000000000001';

-- 7. Remove test table sessions
DELETE FROM table_sessions
WHERE tenant_id = '00000000-0000-0000-0000-000000000001';

-- 8. Reset all tables to AVAILABLE
UPDATE tables
SET status = 'AVAILABLE',
    updated_at = NOW()
WHERE tenant_id = '00000000-0000-0000-0000-000000000001';

COMMIT;
