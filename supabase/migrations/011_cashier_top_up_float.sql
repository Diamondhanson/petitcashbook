-- Allow cashier to top up the cash float (same audit log as admin).

CREATE OR REPLACE FUNCTION public.update_cash_float(amount_add NUMERIC)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_role TEXT;
  new_bal NUMERIC;
BEGIN
  SELECT role INTO caller_role FROM public.profiles WHERE id = auth.uid();
  IF caller_role IS NULL OR caller_role NOT IN ('admin', 'cashier') THEN
    RAISE EXCEPTION 'Forbidden: admin or cashier role required';
  END IF;
  IF amount_add IS NULL OR amount_add <= 0 THEN
    RAISE EXCEPTION 'amount_add must be positive';
  END IF;
  UPDATE public.cash_float
  SET current_balance = current_balance + amount_add, updated_at = now()
  WHERE id = 1
  RETURNING current_balance INTO new_bal;

  INSERT INTO public.float_topup_log (amount_added, balance_after, performed_by)
  VALUES (amount_add, new_bal, auth.uid());

  RETURN jsonb_build_object('current_balance', new_bal);
END;
$$;
