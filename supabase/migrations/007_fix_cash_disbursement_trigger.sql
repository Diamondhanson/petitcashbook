-- Fix "UPDATE requires a WHERE clause" from on_cash_disbursement trigger.
-- The existing trigger calls a function that does UPDATE without WHERE; we replace it with a safe version.

-- 1. Drop the existing trigger (and its old function will remain but no longer fire)
DROP TRIGGER IF EXISTS on_cash_disbursement ON public.requests;

-- 2. Create a safe trigger function: decrement cash_float only when status becomes 'disbursed'.
--    All UPDATEs use explicit WHERE so pg_safeupdate is satisfied.
CREATE OR REPLACE FUNCTION public.on_cash_disbursement()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'disbursed' AND (OLD.status IS NULL OR OLD.status IS DISTINCT FROM 'disbursed') THEN
    UPDATE public.cash_float
    SET current_balance = current_balance - COALESCE(NEW.amount, 0)
    WHERE id = 1;
  END IF;
  RETURN NEW;
END;
$$;

-- 3. Recreate the trigger
CREATE TRIGGER on_cash_disbursement
  AFTER UPDATE ON public.requests
  FOR EACH ROW
  EXECUTE PROCEDURE public.on_cash_disbursement();
