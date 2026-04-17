-- Payout requests system
CREATE TYPE public.payout_status AS ENUM ('pending', 'approved', 'rejected', 'paid');
CREATE TYPE public.payout_method AS ENUM ('bank', 'upi');

CREATE TABLE public.payout_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  amount NUMERIC NOT NULL CHECK (amount >= 500),
  method public.payout_method NOT NULL,
  upi_id TEXT,
  bank_account TEXT,
  ifsc TEXT,
  account_holder TEXT,
  status public.payout_status NOT NULL DEFAULT 'pending',
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  decided_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  decided_by UUID,
  reject_reason TEXT,
  transaction_ref TEXT,
  admin_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_payout_requests_user ON public.payout_requests(user_id);
CREATE INDEX idx_payout_requests_status ON public.payout_requests(status);

ALTER TABLE public.payout_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own payouts" ON public.payout_requests
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins update payouts" ON public.payout_requests
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_payout_requests_updated
  BEFORE UPDATE ON public.payout_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Compute total paid commission for a user (sum across converted/paid purchases)
CREATE OR REPLACE FUNCTION public.user_paid_commission(_user_id UUID)
RETURNS NUMERIC
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _total NUMERIC := 0;
BEGIN
  SELECT COALESCE(SUM(
    CASE
      WHEN pt.id IS NULL THEN 0
      ELSE
        -- Use midpoint of pct range applied to deal_value (or loan_amount fallback), plus midpoint flat
        ((COALESCE(NULLIF(lp.deal_value, 0), l.loan_amount, 0)) *
          ((pt.commission_pct_min + pt.commission_pct_max) / 200.0))
        + ((pt.commission_flat_min + pt.commission_flat_max) / 2.0)
    END
  ), 0) INTO _total
  FROM public.lead_purchases lp
  JOIN public.leads l ON l.id = lp.lead_id
  LEFT JOIN public.product_types pt ON pt.id = l.product_type_id
  WHERE lp.dsa_id = _user_id
    AND (lp.converted = true OR lp.pipeline_stage IN ('disbursed','policy_issued','delivered','invested'));
  RETURN _total;
END;
$$;

-- Compute amount already locked in pending/approved payouts
CREATE OR REPLACE FUNCTION public.user_locked_payouts(_user_id UUID)
RETURNS NUMERIC
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(amount), 0)
  FROM public.payout_requests
  WHERE user_id = _user_id AND status IN ('pending','approved');
$$;

-- Available withdrawable = paid commission - already locked - paid out
CREATE OR REPLACE FUNCTION public.user_withdrawable(_user_id UUID)
RETURNS NUMERIC
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _earned NUMERIC;
  _withdrawn NUMERIC;
BEGIN
  _earned := public.user_paid_commission(_user_id);
  SELECT COALESCE(SUM(amount), 0) INTO _withdrawn
  FROM public.payout_requests
  WHERE user_id = _user_id AND status IN ('pending','approved','paid');
  RETURN GREATEST(_earned - _withdrawn, 0);
END;
$$;

-- Request payout RPC: validates and inserts
CREATE OR REPLACE FUNCTION public.request_payout(
  _amount NUMERIC,
  _method public.payout_method,
  _upi_id TEXT DEFAULT NULL,
  _bank_account TEXT DEFAULT NULL,
  _ifsc TEXT DEFAULT NULL,
  _account_holder TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user UUID := auth.uid();
  _avail NUMERIC;
  _existing INTEGER;
  _id UUID;
BEGIN
  IF _user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _amount < 500 THEN RAISE EXCEPTION 'Minimum withdrawal is ₹500'; END IF;
  IF _method = 'upi' AND (_upi_id IS NULL OR length(trim(_upi_id)) < 3) THEN
    RAISE EXCEPTION 'UPI ID is required';
  END IF;
  IF _method = 'bank' AND (_bank_account IS NULL OR _ifsc IS NULL OR _account_holder IS NULL) THEN
    RAISE EXCEPTION 'Bank account, IFSC and account holder name are required';
  END IF;

  -- Prevent duplicate pending requests
  SELECT COUNT(*) INTO _existing FROM public.payout_requests
    WHERE user_id = _user AND status = 'pending';
  IF _existing > 0 THEN RAISE EXCEPTION 'You already have a pending withdrawal request'; END IF;

  _avail := public.user_withdrawable(_user);
  IF _amount > _avail THEN
    RAISE EXCEPTION 'Amount exceeds withdrawable balance (₹%).', _avail;
  END IF;

  INSERT INTO public.payout_requests (user_id, amount, method, upi_id, bank_account, ifsc, account_holder)
  VALUES (_user, _amount, _method, _upi_id, _bank_account, _ifsc, _account_holder)
  RETURNING id INTO _id;

  RETURN jsonb_build_object('success', true, 'id', _id, 'remaining', _avail - _amount);
END;
$$;

-- Admin process: approve / reject / paid
CREATE OR REPLACE FUNCTION public.process_payout(
  _payout_id UUID,
  _action TEXT,
  _transaction_ref TEXT DEFAULT NULL,
  _reject_reason TEXT DEFAULT NULL,
  _admin_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _admin UUID := auth.uid();
  _payout RECORD;
BEGIN
  IF _admin IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.has_role(_admin, 'admin') THEN RAISE EXCEPTION 'Admin only'; END IF;

  SELECT * INTO _payout FROM public.payout_requests WHERE id = _payout_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Payout not found'; END IF;

  IF _action = 'approve' THEN
    IF _payout.status <> 'pending' THEN RAISE EXCEPTION 'Only pending payouts can be approved'; END IF;
    UPDATE public.payout_requests
    SET status = 'approved', decided_at = now(), decided_by = _admin, admin_notes = COALESCE(_admin_notes, admin_notes)
    WHERE id = _payout_id;
  ELSIF _action = 'reject' THEN
    IF _payout.status NOT IN ('pending','approved') THEN RAISE EXCEPTION 'Cannot reject a paid payout'; END IF;
    UPDATE public.payout_requests
    SET status = 'rejected', decided_at = now(), decided_by = _admin,
        reject_reason = COALESCE(_reject_reason, 'Rejected by admin'),
        admin_notes = COALESCE(_admin_notes, admin_notes)
    WHERE id = _payout_id;
  ELSIF _action = 'paid' THEN
    IF _payout.status NOT IN ('approved','pending') THEN RAISE EXCEPTION 'Only approved/pending payouts can be marked paid'; END IF;
    UPDATE public.payout_requests
    SET status = 'paid', paid_at = now(), decided_by = _admin,
        decided_at = COALESCE(decided_at, now()),
        transaction_ref = COALESCE(_transaction_ref, transaction_ref),
        admin_notes = COALESCE(_admin_notes, admin_notes)
    WHERE id = _payout_id;
  ELSE
    RAISE EXCEPTION 'Unknown action: %', _action;
  END IF;

  RETURN jsonb_build_object('success', true, 'status', _action);
END;
$$;