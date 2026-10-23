-- ============================================================
-- VELVET BLOOM CAFÉ V2 — INITIAL PRODUCTION SEED
-- ============================================================

-- 1. Create Default Tenant
INSERT INTO tenants (id, name, slug, tagline, tech_brand, currency, tax_rate, service_charge_rate, is_active)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Velvet Bloom Café',
  'velvet-bloom',
  'Sip. Savor. Bloom.',
  'Powered by Kage Origin',
  '₹',
  5.00,
  0.00,
  TRUE
) ON CONFLICT (slug) DO NOTHING;

-- 2. Create Default Settings
INSERT INTO cafe_settings (tenant_id, cafe_name, tagline, tech_brand, tax_rate, service_charge_rate, currency, is_ordering_paused, busy_message, average_prep_time_minutes)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Velvet Bloom Café',
  'Sip. Savor. Bloom.',
  'Powered by Kage Origin',
  5.00,
  0.00,
  '₹',
  FALSE,
  'The kitchen is currently in full bloom. Orders may take slightly longer.',
  15
) ON CONFLICT (tenant_id) DO NOTHING;

-- 3. Create Tables
INSERT INTO tables (tenant_id, table_number, qr_code_token, capacity, status)
VALUES
  ('00000000-0000-0000-0000-000000000001', 'Table 1', 'vb_tbl_01_tok99a', 2, 'AVAILABLE'),
  ('00000000-0000-0000-0000-000000000001', 'Table 2', 'vb_tbl_02_tok88b', 2, 'AVAILABLE'),
  ('00000000-0000-0000-0000-000000000001', 'Table 3', 'vb_tbl_03_tok77c', 4, 'AVAILABLE'),
  ('00000000-0000-0000-0000-000000000001', 'Table 4', 'vb_tbl_04_tok66d', 4, 'AVAILABLE'),
  ('00000000-0000-0000-0000-000000000001', 'Table 5', 'vb_tbl_05_tok55e', 4, 'AVAILABLE'),
  ('00000000-0000-0000-0000-000000000001', 'Table 6', 'vb_tbl_06_tok44f', 6, 'AVAILABLE'),
  ('00000000-0000-0000-0000-000000000001', 'Table 7', 'vb_tbl_07_tok33g', 6, 'AVAILABLE'),
  ('00000000-0000-0000-0000-000000000001', 'Table 8', 'vb_tbl_08_tok22h', 4, 'AVAILABLE'),
  ('00000000-0000-0000-0000-000000000001', 'Table 9 (Terrace)', 'vb_tbl_09_tok11i', 2, 'AVAILABLE'),
  ('00000000-0000-0000-0000-000000000001', 'Table 10 (Terrace)', 'vb_tbl_10_tok00j', 4, 'AVAILABLE'),
  ('00000000-0000-0000-0000-000000000001', 'Table 11 (VIP Booth)', 'vb_tbl_11_tok98k', 8, 'AVAILABLE'),
  ('00000000-0000-0000-0000-000000000001', 'Table 12 (VIP Lounge)', 'vb_tbl_12_tok87l', 8, 'AVAILABLE')
ON CONFLICT (tenant_id, table_number) DO NOTHING;

-- 4. Create Categories
INSERT INTO categories (id, tenant_id, name, display_order, icon, is_active)
VALUES
  ('c0000001-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Artisan Coffee', 1, 'coffee', TRUE),
  ('c0000001-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'Gourmet Sandwiches & Burgers', 2, 'utensils', TRUE),
  ('c0000001-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'Wood-Fired Artisanal Pizzas', 3, 'pizza', TRUE),
  ('c0000001-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', 'Bloom Pastries & Desserts', 4, 'cake', TRUE),
  ('c0000001-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001', 'Botanical Mocktails & Cold Brews', 5, 'glass-water', TRUE),
  ('c0000001-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000001', 'Rare Teas & Herbal Infusions', 6, 'cup-soda', TRUE)
ON CONFLICT DO NOTHING;

-- 5. Create Signature Menu Items
INSERT INTO menu_items (id, tenant_id, category_id, name, description, price, image_url, is_veg, is_available, is_bestseller, is_chef_special, preparation_time_minutes, calories, average_rating, total_reviews)
VALUES
  (
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    'c0000001-0000-0000-0000-000000000001',
    'Rose Gold Velvet Latte',
    'Signature espresso infused with organic Damask rose reduction, Madagascar vanilla, and microfoam crowned with edible 24k gold leaf flakes.',
    320.00,
    'https://images.unsplash.com/photo-1541167760496-1628856ab772?q=80&w=800&auto=format&fit=crop',
    TRUE, TRUE, TRUE, TRUE, 8, 180, 4.90, 128
  ),
  (
    '00000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000001',
    'c0000001-0000-0000-0000-000000000001',
    'Smoked Cinnamon Flat White',
    'Double shot of single-origin Ethiopian roast with steamed oat milk, smoked lightly over Ceylon cinnamon bark.',
    280.00,
    'https://images.unsplash.com/photo-1577968897966-3d4325b36b61?q=80&w=800&auto=format&fit=crop',
    TRUE, TRUE, TRUE, FALSE, 7, 140, 4.80, 94
  ),
  (
    '00000000-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000001',
    'c0000001-0000-0000-0000-000000000002',
    'Truffle Mushroom & Brie Panini',
    'Wild portobello and shiitake mushrooms, French brie cheese, thyme-infused black truffle butter on sourdough.',
    390.00,
    'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?q=80&w=800&auto=format&fit=crop',
    TRUE, TRUE, TRUE, FALSE, 12, 480, 4.80, 110
  ),
  (
    '00000000-0000-0000-0000-000000000004',
    '00000000-0000-0000-0000-000000000001',
    'c0000001-0000-0000-0000-000000000002',
    'Smoked Rosemary Chicken Brioche Burger',
    'Crispy buttermilk free-range chicken, smoked gouda, pickled shallots, charred jalapeño aioli on toasted brioche.',
    440.00,
    'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?q=80&w=800&auto=format&fit=crop',
    FALSE, TRUE, TRUE, TRUE, 18, 620, 4.90, 156
  ),
  (
    '00000000-0000-0000-0000-000000000005',
    '00000000-0000-0000-0000-000000000001',
    'c0000001-0000-0000-0000-000000000003',
    'Burrata & Fig Balsamic Pizza',
    'Wood-fired slow-fermented Neapolitan crust, artisanal burrata, caramelized Mission figs, prosciutto crudo, and aged Modena glaze.',
    580.00,
    'https://images.unsplash.com/photo-1513104890138-7c749659a591?q=80&w=800&auto=format&fit=crop',
    FALSE, TRUE, TRUE, TRUE, 20, 780, 4.95, 210
  ),
  (
    '00000000-0000-0000-0000-000000000006',
    '00000000-0000-0000-0000-000000000001',
    'c0000001-0000-0000-0000-000000000004',
    'Velvet Bloom Opera Cake',
    'Layers of almond sponge soaked in Grand Marnier coffee syrup, layered with ganache, coffee buttercream, and rose dust.',
    360.00,
    'https://images.unsplash.com/photo-1578985545062-69928b1d9587?q=80&w=800&auto=format&fit=crop',
    TRUE, TRUE, TRUE, TRUE, 5, 420, 4.90, 140
  )
ON CONFLICT DO NOTHING;

