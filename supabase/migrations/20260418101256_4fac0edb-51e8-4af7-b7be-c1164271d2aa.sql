-- 1. Add referral attribution + UTM columns to leads
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS ref_dsa_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_marketplace BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS utm_source TEXT,
  ADD COLUMN IF NOT EXISTS utm_medium TEXT,
  ADD COLUMN IF NOT EXISTS utm_campaign TEXT;

CREATE INDEX IF NOT EXISTS idx_leads_ref_dsa_id ON public.leads(ref_dsa_id) WHERE ref_dsa_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_leads_is_marketplace ON public.leads(is_marketplace, status);

-- 2. Add allow_marketplace toggle to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS allow_marketplace BOOLEAN NOT NULL DEFAULT false;

-- 3. Referral commissions table
CREATE TYPE public.referral_commission_status AS ENUM ('pending','approved','cancelled','paid');

CREATE TABLE IF NOT EXISTS public.referral_commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  lead_purchase_id UUID NOT NULL REFERENCES public.lead_purchases(id) ON DELETE CASCADE,
  referrer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  buyer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  lead_price NUMERIC NOT NULL DEFAULT 0,
  commission_pct NUMERIC NOT NULL DEFAULT 20,
  amount NUMERIC NOT NULL DEFAULT 0,
  status public.referral_commission_status NOT NULL DEFAULT 'pending',
  approved_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  cancellation_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(lead_purchase_id)
);

CREATE INDEX IF NOT EXISTS idx_ref_comm_referrer ON public.referral_commissions(referrer_id, status);
CREATE INDEX IF NOT EXISTS idx_ref_comm_buyer ON public.referral_commissions(buyer_id);

ALTER TABLE public.referral_commissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Referrer views own commissions"
  ON public.referral_commissions FOR SELECT
  TO authenticated
  USING (auth.uid() = referrer_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage commissions"
  ON public.referral_commissions FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_ref_comm_updated
  BEFORE UPDATE ON public.referral_commissions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Public lead submission RPC (anonymous-callable)
CREATE OR REPLACE FUNCTION public.submit_public_lead(
  _applicant_name TEXT,
  _phone TEXT,
  _city TEXT,
  _loan_type loan_type,
  _loan_amount NUMERIC,
  _email TEXT DEFAULT NULL,
  _monthly_income NUMERIC DEFAULT NULL,
  _employment_type TEXT DEFAULT NULL,
  _product_category product_category DEFAULT 'loan',
  _product_subtype TEXT DEFAULT NULL,
  _ref_code TEXT DEFAULT NULL,
  _utm_source TEXT DEFAULT NULL,
  _utm_medium TEXT DEFAULT NULL,
  _utm_campaign TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _phone_clean TEXT;
  _masked TEXT;
  _ref_dsa UUID;
  _ref_allow_marketplace BOOLEAN := false;
  _is_marketplace BOOLEAN := true;
  _lead_id UUID;
  _existing_count INTEGER;
  _source TEXT := 'website';
BEGIN
  -- Basic validation
  IF _applicant_name IS NULL OR length(trim(_applicant_name)) < 2 THEN
    RAISE EXCEPTION 'Name is required';
  END IF;
  _phone_clean := regexp_replace(COALESCE(_phone,''), '[^0-9]', '', 'g');
  IF length(_phone_clean) < 10 THEN
    RAISE EXCEPTION 'Valid 10-digit phone required';
  END IF;
  _phone_clean := right(_phone_clean, 10);
  IF _city IS NULL OR length(trim(_city)) < 2 THEN
    RAISE EXCEPTION 'City is required';
  END IF;
  IF _loan_amount IS NULL OR _loan_amount <= 0 THEN
    RAISE EXCEPTION 'Loan amount is required';
  END IF;

  _masked := 'XXXXXX' || right(_phone_clean, 4);

  -- Resolve referral code
  IF _ref_code IS NOT NULL AND length(trim(_ref_code)) > 0 THEN
    SELECT id, allow_marketplace
      INTO _ref_dsa, _ref_allow_marketplace
      FROM public.profiles
      WHERE dsa_id = upper(trim(_ref_code))
      LIMIT 1;
    IF _ref_dsa IS NOT NULL THEN
      _source := 'referral';
      -- If partner does NOT allow marketplace → exclusive (free) lead
      _is_marketplace := _ref_allow_marketplace;
    END IF;
  END IF;

  -- Block 30-day duplicate
  SELECT COUNT(*) INTO _existing_count
    FROM public.leads
    WHERE full_phone = _phone_clean
      AND created_at > now() - INTERVAL '30 days';
  IF _existing_count > 0 THEN
    RAISE EXCEPTION 'A lead with this phone was submitted recently. Please wait or contact support.';
  END IF;

  -- Insert lead
  INSERT INTO public.leads(
    applicant_name, full_phone, masked_phone, city, email,
    loan_type, loan_amount, monthly_income, employment_type,
    product_category, product_subtype,
    source, ref_dsa_id, is_marketplace,
    utm_source, utm_medium, utm_campaign,
    status, sale_available, phone_verified
  ) VALUES (
    trim(_applicant_name), _phone_clean, _masked, trim(_city), _email,
    _loan_type, _loan_amount, _monthly_income, _employment_type,
    _product_category, _product_subtype,
    _source, _ref_dsa, _is_marketplace,
    _utm_source, _utm_medium, _utm_campaign,
    CASE WHEN _ref_dsa IS NOT NULL AND NOT _is_marketplace THEN 'sold' ELSE 'available' END,
    _is_marketplace,
    false
  ) RETURNING id INTO _lead_id;

  -- Exclusive referral → auto-create a free lead_purchase for the partner
  IF _ref_dsa IS NOT NULL AND NOT _is_marketplace THEN
    INSERT INTO public.lead_purchases(lead_id, dsa_id, price_paid, pipeline_stage)
    VALUES (_lead_id, _ref_dsa, 0, 'new');

    PERFORM public.notify(
      _ref_dsa, 'lead_purchased',
      '🎁 New referral lead!',
      _applicant_name || ' (' || _city || ') just applied via your link. Free — added to My Leads.',
      '/dashboard/my-leads'
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'lead_id', _lead_id,
    'masked_phone', _masked,
    'source', _source,
    'exclusive', (_ref_dsa IS NOT NULL AND NOT _is_marketplace)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_public_lead TO anon, authenticated;

-- 5. Trigger: when marketplace purchase happens AND lead has a referrer → create pending commission
CREATE OR REPLACE FUNCTION public.create_referral_commission_on_purchase()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _lead RECORD;
  _pct NUMERIC := 20;
  _amount NUMERIC;
BEGIN
  SELECT ref_dsa_id, is_marketplace, price INTO _lead
    FROM public.leads WHERE id = NEW.lead_id;

  -- Only when: lead has referrer, is marketplace-enabled, and buyer != referrer
  IF _lead.ref_dsa_id IS NOT NULL
     AND _lead.is_marketplace = true
     AND _lead.ref_dsa_id <> NEW.dsa_id THEN
    _amount := ROUND(NEW.price_paid * _pct / 100.0, 2);
    INSERT INTO public.referral_commissions(
      lead_id, lead_purchase_id, referrer_id, buyer_id,
      lead_price, commission_pct, amount, status
    ) VALUES (
      NEW.lead_id, NEW.id, _lead.ref_dsa_id, NEW.dsa_id,
      NEW.price_paid, _pct, _amount, 'pending'
    ) ON CONFLICT (lead_purchase_id) DO NOTHING;

    PERFORM public.notify(
      _lead.ref_dsa_id, 'lead_purchased',
      '💰 Your referral lead was sold!',
      'Pending commission: ₹' || _amount || '. Will credit when buyer disburses.',
      '/dashboard/referrals'
    );
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_create_ref_commission ON public.lead_purchases;
CREATE TRIGGER trg_create_ref_commission
  AFTER INSERT ON public.lead_purchases
  FOR EACH ROW EXECUTE FUNCTION public.create_referral_commission_on_purchase();

-- 6. Trigger: when lead_purchase pipeline_stage → 'disbursed' → approve commission + credit wallet
CREATE OR REPLACE FUNCTION public.approve_referral_on_disbursal()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _comm RECORD;
  _new_balance NUMERIC;
BEGIN
  IF NEW.pipeline_stage = 'disbursed' AND OLD.pipeline_stage <> 'disbursed' THEN
    SELECT * INTO _comm FROM public.referral_commissions
      WHERE lead_purchase_id = NEW.id AND status = 'pending';
    IF FOUND THEN
      UPDATE public.referral_commissions
        SET status = 'approved', approved_at = now()
        WHERE id = _comm.id;

      -- Credit referrer wallet
      UPDATE public.wallets
        SET balance = balance + _comm.amount,
            total_recharged = total_recharged + _comm.amount
        WHERE user_id = _comm.referrer_id
        RETURNING balance INTO _new_balance;

      INSERT INTO public.wallet_transactions(user_id, type, amount, description, reference_id, balance_after)
      VALUES (
        _comm.referrer_id, 'credit', _comm.amount,
        'Referral commission (lead disbursed)', _comm.lead_id, COALESCE(_new_balance, 0)
      );

      PERFORM public.notify(
        _comm.referrer_id, 'lead_purchased',
        '✅ Commission credited: ₹' || _comm.amount,
        'Buyer disbursed the lead you referred. Funds added to your wallet.',
        '/dashboard/wallet'
      );
    END IF;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_approve_ref_on_disbursal ON public.lead_purchases;
CREATE TRIGGER trg_approve_ref_on_disbursal
  AFTER UPDATE OF pipeline_stage ON public.lead_purchases
  FOR EACH ROW EXECUTE FUNCTION public.approve_referral_on_disbursal();

-- 7. Trigger: when lead_refund approved → cancel any pending referral commission
CREATE OR REPLACE FUNCTION public.cancel_referral_on_refund()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.status IN ('approved','auto_approved') AND OLD.status = 'pending' THEN
    UPDATE public.referral_commissions
      SET status = 'cancelled', cancelled_at = now(),
          cancellation_reason = 'Buyer refund approved'
      WHERE lead_purchase_id = NEW.lead_purchase_id
        AND status = 'pending';
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_cancel_ref_on_refund ON public.lead_refunds;
CREATE TRIGGER trg_cancel_ref_on_refund
  AFTER UPDATE OF status ON public.lead_refunds
  FOR EACH ROW EXECUTE FUNCTION public.cancel_referral_on_refund();

-- 8. Helper: referrer dashboard stats
CREATE OR REPLACE FUNCTION public.get_referral_stats(_user_id UUID)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _generated INTEGER;
  _sold INTEGER;
  _pending NUMERIC;
  _approved NUMERIC;
  _dsa_id TEXT;
BEGIN
  SELECT dsa_id INTO _dsa_id FROM public.profiles WHERE id = _user_id;
  SELECT COUNT(*) INTO _generated FROM public.leads WHERE ref_dsa_id = _user_id;
  SELECT COUNT(*) INTO _sold FROM public.leads l
    JOIN public.lead_purchases lp ON lp.lead_id = l.id
    WHERE l.ref_dsa_id = _user_id AND lp.dsa_id <> _user_id;
  SELECT COALESCE(SUM(amount),0) INTO _pending FROM public.referral_commissions
    WHERE referrer_id = _user_id AND status = 'pending';
  SELECT COALESCE(SUM(amount),0) INTO _approved FROM public.referral_commissions
    WHERE referrer_id = _user_id AND status IN ('approved','paid');

  RETURN jsonb_build_object(
    'dsa_id', _dsa_id,
    'leads_generated', _generated,
    'leads_sold', _sold,
    'conversion_rate', CASE WHEN _generated > 0 THEN ROUND((_sold::NUMERIC / _generated) * 100, 1) ELSE 0 END,
    'pending_earnings', _pending,
    'approved_earnings', _approved,
    'total_earnings', _pending + _approved
  );
END; $$;

GRANT EXECUTE ON FUNCTION public.get_referral_stats TO authenticated;