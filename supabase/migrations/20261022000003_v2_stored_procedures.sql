-- ============================================================
-- VELVET BLOOM CAFÉ V2 — STORED PROCEDURES & ATOMIC TRANSACTIONS
-- Multi-Tenant Database Operations
-- ============================================================

-- 1. Atomic Order Creation
CREATE OR REPLACE FUNCTION create_tenant_order(
  p_tenant_id UUID,
  p_table_id UUID,
  p_session_id UUID,
  p_customer_name TEXT,
  p_customer_phone TEXT,
  p_special_instructions TEXT,
  p_items JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_settings RECORD;
  v_table RECORD;
  v_session RECORD;
  v_order_id UUID;
  v_date_prefix TEXT;
  v_seq INT;
  v_order_number TEXT;
  v_item RECORD;
  v_menu_item RECORD;
  v_options_extra NUMERIC(10,2);
  v_line_total NUMERIC(10,2);
  v_subtotal NUMERIC(10,2) := 0.00;
  v_tax NUMERIC(10,2) := 0.00;
  v_total NUMERIC(10,2) := 0.00;
  v_order_item_id UUID;
  v_opt RECORD;
  v_result JSONB;
BEGIN
  -- Verify tenant settings
  SELECT * INTO v_settings FROM cafe_settings WHERE tenant_id = p_tenant_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Settings not found for tenant %', p_tenant_id;
  END IF;

  -- Verify table
  SELECT * INTO v_table FROM tables WHERE id = p_table_id AND tenant_id = p_tenant_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Table % not found for tenant %', p_table_id, p_tenant_id;
  END IF;

  -- Verify session is active
  SELECT * INTO v_session FROM table_sessions WHERE id = p_session_id AND tenant_id = p_tenant_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Session % not found for tenant %', p_session_id, p_tenant_id;
  END IF;
  IF NOT v_session.is_active THEN
    RAISE EXCEPTION 'Session % has been concluded and is no longer active', p_session_id;
  END IF;

  -- Generate sequential order number
  v_date_prefix := TO_CHAR(NOW(), 'YYYYMMDD');
  SELECT COUNT(*) + 1 INTO v_seq FROM orders WHERE tenant_id = p_tenant_id AND created_at::DATE = CURRENT_DATE;
  v_order_number := 'VB-' || v_date_prefix || '-' || LPAD(v_seq::TEXT, 4, '0');

  v_order_id := gen_random_uuid();

  -- Initial Order Record (with zero totals, to be updated after summing items)
  INSERT INTO orders (
    id, tenant_id, order_number, table_id, session_id,
    customer_name, customer_phone, status,
    subtotal, tax, discount, total,
    special_instructions, estimated_time_minutes,
    eta_timestamp, created_at, updated_at
  ) VALUES (
    v_order_id, p_tenant_id, v_order_number, p_table_id, p_session_id,
    COALESCE(p_customer_name, 'Valued Guest'), p_customer_phone, 'PENDING',
    0.00, 0.00, 0.00, 0.00,
    p_special_instructions, COALESCE(v_settings.average_prep_time_minutes, 15),
    NOW() + (COALESCE(v_settings.average_prep_time_minutes, 15) || ' minutes')::INTERVAL,
    NOW(), NOW()
  );

  -- Process Order Items
  FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(
    "menuItemId" UUID,
    quantity INT,
    options JSONB,
    "specialNotes" TEXT
  )
  LOOP
    SELECT * INTO v_menu_item FROM menu_items WHERE id = v_item."menuItemId" AND tenant_id = p_tenant_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Menu item % not found', v_item."menuItemId";
    END IF;

    -- Calculate options extra
    v_options_extra := 0.00;
    IF v_item.options IS NOT NULL AND jsonb_array_length(v_item.options) > 0 THEN
      SELECT COALESCE(SUM((opt->>'extraPrice')::NUMERIC), 0.00)
      INTO v_options_extra
      FROM jsonb_array_elements(v_item.options) AS opt;
    END IF;

    v_line_total := (v_menu_item.price + v_options_extra) * v_item.quantity;
    v_subtotal := v_subtotal + v_line_total;

    v_order_item_id := gen_random_uuid();

    INSERT INTO order_items (
      id, order_id, menu_item_id, item_name, item_price,
      quantity, options_price, item_total, special_notes,
      is_additional, created_at
    ) VALUES (
      v_order_item_id, v_order_id, v_menu_item.id, v_menu_item.name, v_menu_item.price,
      v_item.quantity, v_options_extra, v_line_total, v_item."specialNotes",
      FALSE, NOW()
    );

    -- Insert options if any
    IF v_item.options IS NOT NULL AND jsonb_array_length(v_item.options) > 0 THEN
      FOR v_opt IN SELECT * FROM jsonb_to_recordset(v_item.options) AS y(
        "groupName" TEXT,
        "optionName" TEXT,
        "extraPrice" NUMERIC(10,2)
      )
      LOOP
        INSERT INTO order_item_options (
          order_item_id, group_name, option_name, extra_price
        ) VALUES (
          v_order_item_id, v_opt."groupName", v_opt."optionName", COALESCE(v_opt."extraPrice", 0.00)
        );
      END LOOP;
    END IF;
  END LOOP;

  -- Compute tax and grand total
  v_tax := ROUND(v_subtotal * (v_settings.tax_rate / 100.0), 2);
  v_total := v_subtotal + v_tax;

  -- Update order totals
  UPDATE orders
  SET subtotal = v_subtotal,
      tax = v_tax,
      total = v_total,
      updated_at = NOW()
  WHERE id = v_order_id;

  -- Insert initial PENDING event
  INSERT INTO order_events (
    order_id, previous_status, new_status, actor_type, notes, created_at
  ) VALUES (
    v_order_id, NULL, 'PENDING', 'CUSTOMER', 'Order placed by customer via table QR', NOW()
  );

  -- Update Table status to OCCUPIED
  UPDATE tables
  SET status = 'OCCUPIED',
      current_session_id = p_session_id,
      updated_at = NOW()
  WHERE id = p_table_id;

  -- Return complete order as JSON
  SELECT to_jsonb(o.*) || jsonb_build_object(
    'table', to_jsonb(t.*),
    'items', (
      SELECT jsonb_agg(
        to_jsonb(oi.*) || jsonb_build_object(
          'options', COALESCE((
            SELECT jsonb_agg(to_jsonb(oio.*))
            FROM order_item_options oio
            WHERE oio.order_item_id = oi.id
          ), '[]'::jsonb)
        )
      )
      FROM order_items oi
      WHERE oi.order_id = o.id
    )
  )
  INTO v_result
  FROM orders o
  JOIN tables t ON t.id = o.table_id
  WHERE o.id = v_order_id;

  RETURN v_result;
END;
$$;


-- 2. Atomic Order Status Update with Event Tracking
CREATE OR REPLACE FUNCTION update_order_status_with_event(
  p_tenant_id UUID,
  p_order_id UUID,
  p_new_status TEXT,
  p_actor_type TEXT,
  p_actor_id TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_order RECORD;
  v_prev_status TEXT;
  v_actor_uuid UUID := NULL;
  v_effective_notes TEXT;
  v_result JSONB;
BEGIN
  SELECT * INTO v_order FROM orders WHERE id = p_order_id AND tenant_id = p_tenant_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order % not found for tenant %', p_order_id, p_tenant_id;
  END IF;

  -- Idempotency check: if order is already at target status, return existing order directly
  IF v_order.status = p_new_status THEN
    SELECT to_jsonb(o.*) || jsonb_build_object(
      'table', to_jsonb(t.*),
      'items', (
        SELECT jsonb_agg(
          to_jsonb(oi.*) || jsonb_build_object(
            'options', COALESCE((
              SELECT jsonb_agg(to_jsonb(oio.*))
              FROM order_item_options oio
              WHERE oio.order_item_id = oi.id
            ), '[]'::jsonb)
          )
        )
        FROM order_items oi
        WHERE oi.order_id = o.id
      ),
      'events', (
        SELECT jsonb_agg(to_jsonb(oe.*) ORDER BY oe.created_at ASC)
        FROM order_events oe
        WHERE oe.order_id = o.id
      )
    )
    INTO v_result
    FROM orders o
    JOIN tables t ON t.id = o.table_id
    WHERE o.id = p_order_id;

    RETURN v_result;
  END IF;

  v_prev_status := v_order.status;

  IF p_actor_id IS NOT NULL THEN
    BEGIN
      v_actor_uuid := p_actor_id::UUID;
      IF NOT EXISTS (SELECT 1 FROM users WHERE id = v_actor_uuid) THEN
        v_actor_uuid := NULL;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      v_actor_uuid := NULL;
    END;
  END IF;

  v_effective_notes := COALESCE(p_notes, 'Status transitioned from ' || v_prev_status || ' to ' || p_new_status);
  IF p_actor_id IS NOT NULL AND v_actor_uuid IS NULL AND POSITION(p_actor_id IN v_effective_notes) = 0 THEN
    v_effective_notes := v_effective_notes || ' (by ' || p_actor_id || ')';
  END IF;

  -- Update Order status
  UPDATE orders
  SET status = p_new_status,
      updated_at = NOW()
  WHERE id = p_order_id;

  -- Insert Event
  INSERT INTO order_events (
    order_id, previous_status, new_status, actor_type, actor_id, notes, created_at
  ) VALUES (
    p_order_id, v_prev_status, p_new_status, p_actor_type, v_actor_uuid,
    v_effective_notes,
    NOW()
  );

  -- Return full updated order
  SELECT to_jsonb(o.*) || jsonb_build_object(
    'table', to_jsonb(t.*),
    'items', (
      SELECT jsonb_agg(
        to_jsonb(oi.*) || jsonb_build_object(
          'options', COALESCE((
            SELECT jsonb_agg(to_jsonb(oio.*))
            FROM order_item_options oio
            WHERE oio.order_item_id = oi.id
          ), '[]'::jsonb)
        )
      )
      FROM order_items oi
      WHERE oi.order_id = o.id
    ),
    'events', (
      SELECT jsonb_agg(to_jsonb(oe.*) ORDER BY oe.created_at ASC)
      FROM order_events oe
      WHERE oe.order_id = o.id
    )
  )
  INTO v_result
  FROM orders o
  JOIN tables t ON t.id = o.table_id
  WHERE o.id = p_order_id;

  RETURN v_result;
END;
$$;


-- 3. Atomic Addition of Items by Staff
CREATE OR REPLACE FUNCTION add_additional_item_transaction(
  p_tenant_id UUID,
  p_order_id UUID,
  p_menu_item_id UUID,
  p_quantity INT,
  p_options JSONB,
  p_special_notes TEXT,
  p_staff_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_order RECORD;
  v_menu_item RECORD;
  v_settings RECORD;
  v_options_extra NUMERIC(10,2) := 0.00;
  v_item_total NUMERIC(10,2);
  v_order_item_id UUID;
  v_staff_uuid UUID := NULL;
  v_opt RECORD;
  v_subtotal NUMERIC(10,2);
  v_tax NUMERIC(10,2);
  v_total NUMERIC(10,2);
  v_result JSONB;
BEGIN
  SELECT * INTO v_order FROM orders WHERE id = p_order_id AND tenant_id = p_tenant_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order % not found', p_order_id;
  END IF;

  IF v_order.status IN ('COMPLETED', 'CANCELLED', 'REJECTED') THEN
    RAISE EXCEPTION 'Cannot add items to an order with status %', v_order.status;
  END IF;

  SELECT * INTO v_menu_item FROM menu_items WHERE id = p_menu_item_id AND tenant_id = p_tenant_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Menu item % not found', p_menu_item_id;
  END IF;

  SELECT * INTO v_settings FROM cafe_settings WHERE tenant_id = p_tenant_id;

  IF p_staff_id IS NOT NULL THEN
    BEGIN
      v_staff_uuid := p_staff_id::UUID;
      IF NOT EXISTS (SELECT 1 FROM users WHERE id = v_staff_uuid) THEN
        v_staff_uuid := NULL;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      v_staff_uuid := NULL;
    END;
  END IF;

  -- Calculate options
  IF p_options IS NOT NULL AND jsonb_array_length(p_options) > 0 THEN
    SELECT COALESCE(SUM((opt->>'extraPrice')::NUMERIC), 0.00)
    INTO v_options_extra
    FROM jsonb_array_elements(p_options) AS opt;
  END IF;

  v_item_total := (v_menu_item.price + v_options_extra) * p_quantity;
  v_order_item_id := gen_random_uuid();

  -- Insert additional item
  INSERT INTO order_items (
    id, order_id, menu_item_id, item_name, item_price,
    quantity, options_price, item_total, special_notes,
    is_additional, added_by_staff_id, created_at
  ) VALUES (
    v_order_item_id, p_order_id, v_menu_item.id, v_menu_item.name, v_menu_item.price,
    p_quantity, v_options_extra, v_item_total, p_special_notes,
    TRUE, v_staff_uuid, NOW()
  );

  -- Insert item options
  IF p_options IS NOT NULL AND jsonb_array_length(p_options) > 0 THEN
    FOR v_opt IN SELECT * FROM jsonb_to_recordset(p_options) AS y(
      "groupName" TEXT,
      "optionName" TEXT,
      "extraPrice" NUMERIC(10,2)
    )
    LOOP
      INSERT INTO order_item_options (
        order_item_id, group_name, option_name, extra_price
      ) VALUES (
        v_order_item_id, v_opt."groupName", v_opt."optionName", COALESCE(v_opt."extraPrice", 0.00)
      );
    END LOOP;
  END IF;

  -- Recalculate whole order totals
  SELECT SUM(item_total) INTO v_subtotal FROM order_items WHERE order_id = p_order_id;
  v_tax := ROUND(v_subtotal * (COALESCE(v_settings.tax_rate, 5.0) / 100.0), 2);
  v_total := v_subtotal + v_tax - v_order.discount;

  -- If status was READY or SERVED, reopen status to PREPARING
  UPDATE orders
  SET subtotal = v_subtotal,
      tax = v_tax,
      total = v_total,
      status = CASE WHEN status IN ('READY', 'SERVED') THEN 'PREPARING' ELSE status END,
      updated_at = NOW()
  WHERE id = p_order_id;

  -- Insert event
  INSERT INTO order_events (
    order_id, previous_status, new_status, actor_type, actor_id, notes, created_at
  ) VALUES (
    p_order_id, v_order.status,
    CASE WHEN v_order.status IN ('READY', 'SERVED') THEN 'PREPARING' ELSE v_order.status END,
    'STAFF', p_staff_id,
    'Additional item added: ' || p_quantity || 'x ' || v_menu_item.name,
    NOW()
  );

  -- Update associated unpaid bill if exists
  UPDATE bills
  SET subtotal = v_subtotal,
      tax = v_tax,
      final_total = v_total,
      updated_at = NOW()
  WHERE order_id = p_order_id AND status != 'PAID';

  -- Return updated order
  SELECT to_jsonb(o.*) || jsonb_build_object(
    'table', to_jsonb(t.*),
    'items', (
      SELECT jsonb_agg(
        to_jsonb(oi.*) || jsonb_build_object(
          'options', COALESCE((
            SELECT jsonb_agg(to_jsonb(oio.*))
            FROM order_item_options oio
            WHERE oio.order_item_id = oi.id
          ), '[]'::jsonb)
        )
      )
      FROM order_items oi
      WHERE oi.order_id = o.id
    )
  )
  INTO v_result
  FROM orders o
  JOIN tables t ON t.id = o.table_id
  WHERE o.id = p_order_id;

  RETURN v_result;
END;
$$;


-- 4. Atomic Bill Generation
CREATE OR REPLACE FUNCTION generate_tenant_bill(
  p_tenant_id UUID,
  p_table_id UUID,
  p_session_id TEXT DEFAULT NULL,
  p_order_id UUID DEFAULT NULL,
  p_discount NUMERIC(10,2) DEFAULT 0.00,
  p_split_type TEXT DEFAULT 'NONE',
  p_split_count INT DEFAULT 1
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_bill_id UUID;
  v_bill_number TEXT;
  v_session_id UUID := NULL;
  v_subtotal NUMERIC(10,2) := 0.00;
  v_tax NUMERIC(10,2) := 0.00;
  v_total NUMERIC(10,2) := 0.00;
  v_split_amount NUMERIC(10,2);
  v_i INT;
  v_result JSONB;
BEGIN
  -- Resolve session ID safely
  IF p_session_id IS NOT NULL THEN
    BEGIN
      v_session_id := p_session_id::UUID;
    EXCEPTION WHEN OTHERS THEN
      v_session_id := NULL;
    END;
  END IF;

  IF v_session_id IS NULL THEN
    SELECT id INTO v_session_id
    FROM table_sessions
    WHERE table_id = p_table_id AND is_active = TRUE
    ORDER BY created_at DESC
    LIMIT 1;
  END IF;

  -- Get order totals if order_id is provided, else fetch active non-completed orders for this table
  IF p_order_id IS NOT NULL THEN
    SELECT subtotal, tax, total INTO v_subtotal, v_tax, v_total
    FROM orders
    WHERE id = p_order_id AND tenant_id = p_tenant_id;
  ELSE
    SELECT COALESCE(SUM(subtotal), 0.00), COALESCE(SUM(tax), 0.00), COALESCE(SUM(total), 0.00), MAX(id)
    INTO v_subtotal, v_tax, v_total, p_order_id
    FROM orders
    WHERE table_id = p_table_id AND tenant_id = p_tenant_id
      AND status NOT IN ('COMPLETED', 'CANCELLED', 'REJECTED');
  END IF;

  v_total := GREATEST(0.00, v_total - COALESCE(p_discount, 0.00));
  v_bill_number := 'BILL-' || LPAD(FLOOR(RANDOM() * 900000 + 100000)::TEXT, 6, '0');
  v_bill_id := gen_random_uuid();

  INSERT INTO bills (
    id, tenant_id, bill_number, order_id, table_id, session_id,
    subtotal, tax, service_charge, discount, final_total,
    split_type, split_count, status, created_at, updated_at
  ) VALUES (
    v_bill_id, p_tenant_id, v_bill_number, p_order_id, p_table_id, v_session_id,
    v_subtotal, v_tax, 0.00, COALESCE(p_discount, 0.00), v_total,
    COALESCE(p_split_type, 'NONE'), GREATEST(1, COALESCE(p_split_count, 1)),
    'REQUESTED', NOW(), NOW()
  );

  -- If equal split, create split records
  IF p_split_type = 'EQUAL' AND p_split_count > 1 THEN
    v_split_amount := ROUND(v_total / p_split_count, 2);
    FOR v_i IN 0..(p_split_count - 1) LOOP
      INSERT INTO bill_splits (
        id, bill_id, split_index, person_label, assigned_amount,
        payment_status, created_at
      ) VALUES (
        gen_random_uuid(), v_bill_id, v_i, 'Person ' || (v_i + 1),
        CASE WHEN v_i = p_split_count - 1 THEN v_total - (v_split_amount * (p_split_count - 1)) ELSE v_split_amount END,
        'PENDING', NOW()
      );
    END LOOP;
  END IF;

  -- Update table status
  UPDATE tables SET status = 'BILL_REQUESTED', updated_at = NOW() WHERE id = p_table_id;

  SELECT to_jsonb(b.*) || jsonb_build_object(
    'table', to_jsonb(t.*),
    'splits', COALESCE((SELECT jsonb_agg(to_jsonb(bs.*)) FROM bill_splits bs WHERE bs.bill_id = b.id), '[]'::jsonb)
  )
  INTO v_result
  FROM bills b
  JOIN tables t ON t.id = b.table_id
  WHERE b.id = v_bill_id;

  RETURN v_result;
END;
$$;


-- 5. Atomic Payment Recording
CREATE OR REPLACE FUNCTION record_tenant_payment(
  p_tenant_id UUID,
  p_bill_id UUID,
  p_amount NUMERIC(10,2),
  p_payment_method TEXT,
  p_transaction_ref TEXT DEFAULT NULL,
  p_split_index INT DEFAULT NULL,
  p_recorded_by TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_bill RECORD;
  v_payment_id UUID;
  v_total_paid NUMERIC(10,2);
  v_recorded_uuid UUID := NULL;
  v_result JSONB;
BEGIN
  SELECT * INTO v_bill FROM bills WHERE id = p_bill_id AND tenant_id = p_tenant_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Bill % not found for tenant %', p_bill_id, p_tenant_id;
  END IF;

  IF v_bill.status = 'PAID' THEN
    RAISE EXCEPTION 'Bill % is already paid and settled', p_bill_id;
  END IF;

  IF p_recorded_by IS NOT NULL THEN
    BEGIN
      v_recorded_uuid := p_recorded_by::UUID;
      IF NOT EXISTS (SELECT 1 FROM users WHERE id = v_recorded_uuid) THEN
        v_recorded_uuid := NULL;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      v_recorded_uuid := NULL;
    END;
  END IF;

  v_payment_id := gen_random_uuid();

  INSERT INTO payments (
    id, tenant_id, bill_id, amount, payment_method, transaction_ref,
    status, recorded_by, created_at
  ) VALUES (
    v_payment_id, p_tenant_id, p_bill_id, p_amount, p_payment_method,
    COALESCE(p_transaction_ref, 'TXN-' || LPAD(FLOOR(RANDOM() * 900000 + 100000)::TEXT, 6, '0')),
    'COMPLETED', v_recorded_uuid, NOW()
  );

  -- Mark split paid if specified
  IF p_split_index IS NOT NULL THEN
    UPDATE bill_splits
    SET payment_status = 'PAID',
        payment_method = p_payment_method,
        paid_at = NOW()
    WHERE bill_id = p_bill_id AND split_index = p_split_index;
  END IF;

  -- Check if bill is fully paid
  SELECT COALESCE(SUM(amount), 0.00) INTO v_total_paid
  FROM payments
  WHERE bill_id = p_bill_id AND status = 'COMPLETED';

  IF v_total_paid >= v_bill.final_total THEN
    UPDATE bills SET status = 'PAID', updated_at = NOW() WHERE id = p_bill_id;
    IF v_bill.order_id IS NOT NULL THEN
      UPDATE orders SET status = 'COMPLETED', updated_at = NOW() WHERE id = v_bill.order_id;
    END IF;
    UPDATE tables SET status = 'PAID', updated_at = NOW() WHERE id = v_bill.table_id;

    -- Conclude customer table session upon full settlement
    IF v_bill.session_id IS NOT NULL THEN
      UPDATE table_sessions
      SET is_active = FALSE,
          ended_at = NOW()
      WHERE id = v_bill.session_id;
    END IF;
    UPDATE table_sessions
    SET is_active = FALSE,
        ended_at = NOW()
    WHERE table_id = v_bill.table_id AND is_active = TRUE;
  END IF;

  SELECT to_jsonb(p.*) INTO v_result FROM payments p WHERE p.id = v_payment_id;
  RETURN v_result;
END;
$$;


-- 6. Live Dashboard KPIs Calculation
CREATE OR REPLACE FUNCTION get_live_kpis(p_tenant_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_orders_today INT;
  v_pending INT;
  v_accepted INT;
  v_preparing INT;
  v_ready INT;
  v_served INT;
  v_completed INT;
  v_cancelled INT;
  v_active_tables INT;
  v_outstanding_bills INT;
  v_revenue_today NUMERIC(10,2);
  v_aov NUMERIC(10,2);
  v_delayed INT;
BEGIN
  -- Today's orders
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE status = 'PENDING'),
    COUNT(*) FILTER (WHERE status = 'ACCEPTED'),
    COUNT(*) FILTER (WHERE status = 'PREPARING'),
    COUNT(*) FILTER (WHERE status = 'READY'),
    COUNT(*) FILTER (WHERE status = 'SERVED'),
    COUNT(*) FILTER (WHERE status = 'COMPLETED'),
    COUNT(*) FILTER (WHERE status IN ('CANCELLED', 'REJECTED')),
    COUNT(*) FILTER (WHERE status = 'PREPARING' AND created_at < NOW() - INTERVAL '20 minutes')
  INTO
    v_orders_today, v_pending, v_accepted, v_preparing,
    v_ready, v_served, v_completed, v_cancelled, v_delayed
  FROM orders
  WHERE tenant_id = p_tenant_id AND created_at::DATE = CURRENT_DATE;

  -- Active tables
  SELECT COUNT(*) INTO v_active_tables
  FROM tables
  WHERE tenant_id = p_tenant_id AND status NOT IN ('AVAILABLE', 'CLEANING');

  -- Outstanding bills
  SELECT COUNT(*) INTO v_outstanding_bills
  FROM bills
  WHERE tenant_id = p_tenant_id AND status = 'REQUESTED';

  -- Revenue today
  SELECT COALESCE(SUM(final_total), 0.00) INTO v_revenue_today
  FROM bills
  WHERE tenant_id = p_tenant_id AND status = 'PAID' AND updated_at::DATE = CURRENT_DATE;

  -- Average order value
  SELECT COALESCE(ROUND(AVG(total), 2), 0.00) INTO v_aov
  FROM orders
  WHERE tenant_id = p_tenant_id AND created_at::DATE = CURRENT_DATE AND status NOT IN ('CANCELLED', 'REJECTED');

  RETURN jsonb_build_object(
    'orders_today', COALESCE(v_orders_today, 0),
    'pending_orders', COALESCE(v_pending, 0),
    'accepted_orders', COALESCE(v_accepted, 0),
    'preparing_orders', COALESCE(v_preparing, 0),
    'ready_orders', COALESCE(v_ready, 0),
    'served_orders', COALESCE(v_served, 0),
    'completed_orders', COALESCE(v_completed, 0),
    'cancelled_orders', COALESCE(v_cancelled, 0),
    'active_tables', COALESCE(v_active_tables, 0),
    'outstanding_bill_requests', COALESCE(v_outstanding_bills, 0),
    'revenue_today', COALESCE(v_revenue_today, 0.00),
    'average_order_value_today', COALESCE(v_aov, 0.00),
    'delayed_orders_count', COALESCE(v_delayed, 0)
  );
END;
$$;


-- 7. Atomic Table Status Update
CREATE OR REPLACE FUNCTION update_tenant_table_status(
  p_tenant_id UUID,
  p_table_id UUID,
  p_status TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_table RECORD;
BEGIN
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


