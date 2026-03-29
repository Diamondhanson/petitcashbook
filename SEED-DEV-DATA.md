# Seed Dev Data (Visualizations)

**DEV environment only.** Do not run in TEST or PROD.

## What it does

- Inserts **~84 disbursed** requests across 28 days (for Trends, Statistics, Export charts)
- Inserts **4 approved** requests (for Disbursements view)
- Inserts **3 pending** requests (for Overview pending total)
- Sets **cash float** to 450,000 FCFA

## Prerequisites

- At least one user in `profiles`
- `requests` table exists
- `cash_float` table exists (run `002_cash_float_and_admin_rpcs.sql` first)

## How to run

1. Open [Supabase Dashboard](https://supabase.com/dashboard) → your **DEV** project
2. Go to **SQL Editor** → **New query**
3. Copy contents of `supabase/seed-dev-data.sql` and paste
4. Click **Run**

After running, log in as **accountant** or **admin** to see the charts and trends populate.
