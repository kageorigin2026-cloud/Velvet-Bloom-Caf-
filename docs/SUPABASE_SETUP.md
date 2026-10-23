# Velvet Bloom Café V2 — Supabase Connection & Setup Guide

This guide describes how to connect a live Supabase project to **Velvet Bloom Café V2**, apply database migrations, configure Row Level Security (RLS), enable Realtime subscriptions, set up private Storage, and provision your initial Owner account.

---

## 1. Create a New Supabase Project

1. Log into your [Supabase Dashboard](https://supabase.com/dashboard).
2. Click **New project**.
3. Choose an organization, enter a project name (e.g., `velvet-bloom-cafe-v2`), and generate a strong database password.
4. Select the region closest to your primary café location (e.g., South Asia / Mumbai for India).
5. Click **Create new project** and wait ~2 minutes for provisioning.

---

## 2. Apply Database Migrations

Run the SQL migration scripts in exact numerical order. You can execute them using either the **Supabase SQL Editor** or the **Supabase CLI**.

### Option A: Using the Supabase Dashboard SQL Editor (Recommended & Fastest)

1. Navigate to **SQL Editor** in the Supabase Dashboard.
2. Run each migration file in sequential order:
   - **Step 1**: `supabase/migrations/20261022000000_v2_multi_tenant_schema.sql`  
     *Creates the complete multi-tenant schema: tenants, tables, sessions, menu items, orders, order items, events, bills, payments, reviews, and service requests.*
   - **Step 2**: `supabase/migrations/20261022000001_v2_rls_policies.sql`  
     *Enables Row Level Security (RLS) across all tenant tables and enforces strict tenant isolation.*
   - **Step 3**: `supabase/migrations/20261022000002_v2_seed_data.sql`  
     *Inserts the default tenant (`00000000-0000-0000-0000-000000000001`), table layouts (Tables 1-12 with QR tokens), categories, and signature artisan menu items.*
   - **Step 4**: `supabase/migrations/20261022000003_v2_stored_procedures.sql`  
     *Installs atomic transactional procedures (`create_tenant_order`, `update_order_status_with_event`, `add_additional_item_transaction`, `generate_tenant_bill`, `record_tenant_payment`, `get_live_kpis`).*
   - **Step 5**: `supabase/migrations/20261022000004_v2_storage_setup.sql`  
     *Creates the private `cafe-assets` storage bucket with 5MB limits and tenant-aware access policies.*

### Option B: Using Supabase CLI

```bash
# Link local workspace to your remote Supabase project
supabase link --project-ref your-project-id

# Push all migrations
supabase db push
```

---

## 3. Verify Realtime Configuration

1. In the Supabase Dashboard, navigate to **Database** -> **Publications**.
2. Select `supabase_realtime`.
3. Confirm that the following tables are toggled **ON**:
   - `orders`
   - `order_items`
   - `order_events`
   - `bills`
   - `tables`
   - `service_requests`
   - `menu_items`

---

## 4. Configure Supabase Authentication

1. Go to **Authentication** -> **Providers** -> **Email**.
2. Verify that the **Email provider** is **Enabled**.
3. (For initial setup/testing): Toggle **Confirm email** off if you want staff accounts to sign in immediately without an external SMTP mail server.

---

## 5. Provision the Initial Owner Account

1. Go to **Authentication** -> **Users** and click **Add user** -> **Create user**.
2. Enter the Owner email (e.g., `owner@velvetbloom.com`) and a strong password.
3. Copy the newly created user's **User UID** (UUID).
4. Run the following SQL query in the **SQL Editor** to link this auth user to the tenant's Owner profile:

```sql
INSERT INTO users (tenant_id, auth_user_id, full_name, email, role, pin_code, is_active)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  '<PASTE_COPIED_AUTH_USER_UID_HERE>',
  'Alexander Vance (Owner)',
  'owner@velvetbloom.com',
  'OWNER',
  '1111',
  TRUE
)
ON CONFLICT (tenant_id, email)
DO UPDATE SET
  auth_user_id = EXCLUDED.auth_user_id,
  role = 'OWNER',
  is_active = TRUE;
```

---

## 6. Update Local Environment Variables

In your V2 project directory, update `.env.local` to switch from the local adapter to Supabase:

```env
# Switch adapter to live Supabase PostgreSQL
DATA_ADAPTER=supabase

# Application URL
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Primary Tenant UUID (from migration 20261022000002_v2_seed_data.sql)
DEFAULT_TENANT_ID=00000000-0000-0000-0000-000000000001
DEFAULT_TENANT_SLUG=velvet-bloom

# Your Supabase Project API Credentials (Project Settings -> API)
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-actual-anon-public-key

# Server-Only Secret Service Key (Never prefix with NEXT_PUBLIC_)
SUPABASE_SERVICE_ROLE_KEY=your-actual-service-role-key
```

Restart the Next.js development server:

```bash
pnpm dev
```

The application will now communicate directly with your live Supabase PostgreSQL database, enforce Row Level Security, and sync events over Supabase Realtime!
