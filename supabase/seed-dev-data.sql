-- =============================================================================
-- DEV ONLY: Seed dummy petty cash data for visualizations
-- Run in Supabase SQL Editor (DEV project only - never in TEST/PROD)
-- =============================================================================
-- Prerequisites:
-- - profiles table with at least one user
-- - requests table exists
-- - cash_float table exists (run 002_cash_float_and_admin_rpcs.sql first)
-- =============================================================================

DO $$
DECLARE
  req_id UUID;
  mgr_id UUID;
  cat TEXT;
  purp TEXT;
  amt NUMERIC;
  dt TIMESTAMPTZ;
  cats TEXT[] := ARRAY['Office', 'Travel', 'Food', 'Supplies', 'Utilities', 'Miscellaneous'];
  purposes TEXT[] := ARRAY[
    'Office supplies - stationery', 'Taxi to client meeting', 'Team lunch', 'Printer paper',
    'Internet café - research', 'Electricity bill payment', 'Water cooler refill',
    'Courier delivery', 'Conference registration', 'Hotel accommodation',
    'Flight booking - trip', 'Fuel for office vehicle', 'Client dinner',
    'Photocopying services', 'Cleaning supplies', 'Phone recharge',
    'Emergency repair', 'Gift for retiring colleague', 'Training materials'
  ];
  i INT;
  d INT;
BEGIN
  -- Get first user as requester, second as manager (or same if only one)
  SELECT id INTO req_id FROM public.profiles ORDER BY id LIMIT 1;
  SELECT id INTO mgr_id FROM public.profiles ORDER BY id OFFSET 1 LIMIT 1;
  IF mgr_id IS NULL THEN
    mgr_id := req_id;
  END IF;

  IF req_id IS NULL THEN
    RAISE EXCEPTION 'No users in profiles. Create at least one user before running this seed.';
  END IF;

  -- ==========================================================================
  -- 1. DISBURSED requests (past ~45 days, 5 per day) - for Trends, Statistics, Export
  -- ==========================================================================
  FOR d IN 1..45 LOOP
    FOR i IN 1..5 LOOP
      cat := cats[1 + (d + i) % 6];
      purp := purposes[1 + (d * 3 + i) % 19];
      amt := 5000 + (d * 127 + i * 431) % 45000;
      dt := (CURRENT_DATE - (45 - d))::DATE + (9 + (i - 1) * 2)::INT * INTERVAL '1 hour';
      INSERT INTO public.requests (
        requester_id, manager_id, amount, purpose, category, status, created_at
      ) VALUES (
        req_id, mgr_id, amt, purp, cat, 'disbursed', dt
      );
    END LOOP;
  END LOOP;

  -- ==========================================================================
  -- 2. APPROVED requests - for Disbursements view
  -- ==========================================================================
  INSERT INTO public.requests (requester_id, manager_id, amount, purpose, category, status, created_at)
  VALUES
    (req_id, mgr_id, 25000, 'Office furniture - desk chair', 'Office', 'approved', now() - INTERVAL '2 days'),
    (req_id, mgr_id, 15000, 'Client lunch meeting', 'Food', 'approved', now() - INTERVAL '1 day'),
    (req_id, mgr_id, 8500,  'Printer cartridge', 'Office', 'approved', now() - INTERVAL '12 hours'),
    (req_id, mgr_id, 42000, 'Training workshop fee', 'Miscellaneous', 'approved', now() - INTERVAL '6 hours'),
    (req_id, mgr_id, 18500, 'Team offsite catering', 'Food', 'approved', now() - INTERVAL '5 hours'),
    (req_id, mgr_id, 32000, 'Laptop accessories', 'Office', 'approved', now() - INTERVAL '4 hours'),
    (req_id, mgr_id, 9500,  'Fuel reimbursement', 'Travel', 'approved', now() - INTERVAL '2 hours');

  -- ==========================================================================
  -- 3. PENDING requests - for Overview pending total
  -- ==========================================================================
  INSERT INTO public.requests (requester_id, amount, purpose, category, status, created_at)
  VALUES
    (req_id, 12000, 'Travel to branch office', 'Travel', 'pending', now() - INTERVAL '1 day'),
    (req_id, 3500,  'Tea and snacks for team', 'Food', 'pending', now() - INTERVAL '8 hours'),
    (req_id, 18000, 'Internet subscription', 'Utilities', 'pending', now() - INTERVAL '4 hours'),
    (req_id, 22000, 'Airport taxi and parking', 'Travel', 'pending', now() - INTERVAL '3 hours'),
    (req_id, 7600,  'Office cleaning service', 'Miscellaneous', 'pending', now() - INTERVAL '2 hours'),
    (req_id, 14200, 'Paper and toner restock', 'Supplies', 'pending', now() - INTERVAL '1 hour');

  -- ==========================================================================
  -- 4. Update cash float - sum of disbursed + top-up for realistic balance
  -- ==========================================================================
  UPDATE public.cash_float
  SET current_balance = 450000
  WHERE id = 1;

  RAISE NOTICE 'Seed complete: ~225 disbursed, 7 approved, 6 pending requests; cash_float = 450,000 FCFA';
END $$;
