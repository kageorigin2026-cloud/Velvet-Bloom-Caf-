-- ============================================================
-- VELVET BLOOM CAFÉ V2 — FORWARD MIGRATION
-- Stored Procedure Updates: Session Validation, Full Settlement Auto-Close & Active Bill Summation
-- ============================================================

-- 1. Atomic Order Creation with Inactive Session Guard
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
      v_order_item_id, v_order_id, v_item."menuItemId", v_menu_item.name,
      v_menu_item.price, v_item.quantity, v_options_extra,
      v_line_total, v_item."specialNotes", FALSE, NOW()
    );

    -- Insert options
    IF v_item.options IS NOT NULL AND jsonb_array_length(v_item.options) > 0 THEN
      FOR v_opt IN SELECT * FROM jsonb_to_recordset(v_item.options) AS y(
        "groupName" TEXT,
        "optionName" TEXT,
        "extraPrice" NUMERIC(10,2)
      )
      LOOP
        INSERT INTO order_item_options (
          id, order_item_id, group_name, option_name, extra_price, created_at
        ) VALUES (
          gen_random_uuid(), v_order_item_id, v_opt."groupName",
          v_opt."optionName", COALESCE(v_opt."extraPrice", 0.00), NOW()
        );
      END LOOP;
    END IF;
  END LOOP;

  -- Calculate Tax and Total
  v_tax := ROUND(v_subtotal * (v_settings.tax_rate / 100.0), 2);
  v_total := v_subtotal + v_tax;

  -- Update order with authoritative totals
  UPDATE orders
  SET subtotal = v_subtotal,
      tax = v_tax,
      total = v_total,
      updated_at = NOW()
  WHERE id = v_order_id;

  -- Create Initial Lifecycle Event
  INSERT INTO order_events (
    id, order_id, tenant_id, previous_status, new_status,
    actor_type, actor_id, notes, created_at
  ) VALUES (
    gen_random_uuid(), v_order_id, p_tenant_id, NULL, 'PENDING',
    'CUSTOMER', NULL, 'Order placed via digital table menu', NOW()
  );

  -- Update Table Status to OCCUPIED
  UPDATE tables
  SET status = 'OCCUPIED',
      updated_at = NOW()
  WHERE id = p_table_id;

  -- Return complete order as JSON
  SELECT jsonb_build_object(
    'id', o.id,
    'tenant_id', o.tenant_id,
    'order_number', o.order_number,
    'table_id', o.table_id,
    'session_id', o.session_id,
    'customer_name', o.customer_name,
    'customer_phone', o.customer_phone,
    'status', o.status,
    'subtotal', o.subtotal,
    'tax', o.tax,
    'discount', o.discount,
    'total', o.total,
    'special_instructions', o.special_instructions,
    'estimated_time_minutes', o.estimated_time_minutes,
    'eta_timestamp', o.eta_timestamp,
    'created_at', o.created_at,
    'updated_at', o.updated_at
  ) INTO v_result
  FROM orders o
  WHERE o.id = v_order_id;

  RETURN v_result;
END;
$$;


-- 2. Bill Generation with Active Order Fallback
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

  SELECT jsonb_build_object(
    'id', b.id,
    'bill_number', b.bill_number,
    'final_total', b.final_total,
    'status', b.status
  ) INTO v_result
  FROM bills b WHERE b.id = v_bill_id;

  RETURN v_result;
END;
$$;


-- 3. Payment Settlement with Automated Session Conclusion
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
