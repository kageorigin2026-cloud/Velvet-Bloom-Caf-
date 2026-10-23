# Velvet Bloom Café V2

> **"Sip. Savor. Bloom."**  
> *Powered by Kage Origin*

Velvet Bloom Café V2 is a multi-tenant, production-grade café ordering, kitchen orchestration, and billing management platform.

---

## Architecture Overview

- **Frontend & App Framework**: Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS
- **Design Aesthetic**: Premium glassmorphism with dark charcoal (`#080808`, `#171717`, `#242424`), warm cream (`#F6EFE7`), rose gold (`#C99A8A`), and champagne (`#D8B58A`) accents
- **Access Architecture**:
  - **Customer**: Anonymous table QR code access without mandatory app download or registration
  - **Kitchen / Chef**: Real-time Kitchen Display System (KDS) with synthesized audio chimes, timers, and status management
  - **Service & Billing Staff**: Unified Waiter & Cashier workspace for ready order delivery, active table floor map, additional item entry, bill splitting, and instant payments
  - **Main Admin / Owner**: Command center with live operational KPIs, rolling 15-day analytics, menu pricing, table management, and tax configuration
- **Data Access Layer**: Pluggable adapter architecture
  - `local`: Zero-credential in-memory development adapter with rich seed data and 15-day analytics
  - `supabase`: Production PostgreSQL with Row Level Security, transactional RPCs, and Realtime publications
- **Validation**: Strict schema validation with Zod on both client and server

---

## Quick Start (Local Development)

The application starts completely out of the box in local development mode without requiring external credentials:

```bash
# 1. Install dependencies
pnpm install

# 2. Start the development server
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser:
- **Landing Page & QR Simulator**: `http://localhost:3000`
- **Kitchen Display System**: `http://localhost:3000/chef`
- **Service & Billing Workspace**: `http://localhost:3000/staff` (or `/service-billing`)
- **Owner Command Center**: `http://localhost:3000/admin`
- **Customer Table 1 Experience**: `http://localhost:3000/table/vb_tbl_01_tok99a`
- **Staff Quick Login**: `http://localhost:3000/staff/login` (PINs: Owner `1111`, Chef `2222`, Staff `3333`)

---

## Running Automated Tests

```bash
# Run unit and integration test suite
pnpm test

# Run production build
pnpm build
```

---

## Future Supabase & GitHub Connection

When you are ready to connect live external infrastructure, refer to [docs/SUPABASE_SETUP.md](docs/SUPABASE_SETUP.md) for step-by-step instructions:
1. Apply the migration files located in `supabase/migrations/` in numerical order.
2. Set `DATA_ADAPTER=supabase` in `.env.local` along with your Supabase URL and keys.
3. Link your new GitHub repository and push your project branch.

