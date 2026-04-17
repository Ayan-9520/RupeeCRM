-- =====================================================================
-- PHASE 1: TRUST & MONEY LAYER
-- =====================================================================

-- Add tier + quality score to existing wallets/leads
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS reputation_score INTEGER NOT NULL DEFAULT 100 CHECK (reputation_score >= 0 AND reputation_score <= 1000),
  ADD COLUMN IF NOT EXISTS dsa_tier TEXT NOT NULL DEFAULT 'bronze' CHECK (dsa_tier IN ('bronze','silver','gold','platinum','diamond')),
  ADD COLUMN IF NOT EXISTS total_conversions INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_leads_purchased INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_refunds INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fraud_flags INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS quality_score INTEGER CHECK (quality_score >= 0 AND quality_score <= 100),
  ADD COLUMN IF NOT EXISTS quality_factors JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS fraud_risk TEXT NOT NULL DEFAULT 'low' CHECK (fraud_risk IN ('low','medium','high'));

-- Disbursal confirmation table (lender confirms here)
CREATE TYPE public.disbursal_status AS ENUM ('pending','disbursed','docs_pending','docs_clear','customer_paid','rejected','cancelled');

CREATE TABLE IF NOT EXISTS public.disbursals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_purchase_id UUID NOT NULL REFERENCES public.lead_purchases(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  dsa_id UUID NOT NULL,
  lender_id UUID,
  lender_name TEXT,
  loan_account_no TEXT,
  disbursed_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  commission_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  status public.disbursal_status NOT NULL DEFAULT 'pending',
  disbursed_at TIMESTAMPTZ,
  docs_clear_at TIMESTAMPTZ,
  customer_paid_at TIMESTAMPTZ,
  payout_eligible_at TIMESTAMPTZ,
  payout_due_at TIMESTAMPTZ,
  payout_id UUID,
  notes TEXT,
  webhook_payload JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_disbursals_dsa ON public.disbursals(dsa_id);
CREATE INDEX idx_disbursals_status ON public.disbursals(status);
CREATE INDEX idx_disbursals_due ON public.disbursals(payout_due_at) WHERE status = 'customer_paid' AND payout_id IS NULL;

ALTER TABLE public.disbursals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "DSA views own disbursals" ON public.disbursals
  FOR SELECT TO authenticated USING (auth.uid() = dsa_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage disbursals" ON public.disbursals
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Lenders insert disbursals" ON public.disbursals
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'lender') OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Lenders update own disbursals" ON public.disbursals
  FOR UPDATE TO authenticated USING (auth.uid() = lender_id OR public.has_role(auth.uid(), 'admin'));

-- Lead refund requests
CREATE TYPE public.refund_status AS ENUM ('pending','approved','rejected','auto_approved');
CREATE TYPE public.refund_reason AS ENUM ('invalid_phone','wrong_number','do_not_call','duplicate','fake_data','no_intent','other');

CREATE TABLE IF NOT EXISTS public.lead_refunds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.leads(id),
  lead_purchase_id UUID NOT NULL REFERENCES public.lead_purchases(id),
  dsa_id UUID NOT NULL,
  reason public.refund_reason NOT NULL,
  description TEXT,
  evidence_urls TEXT[] DEFAULT '{}',
  amount NUMERIC(12,2) NOT NULL,
  status public.refund_status NOT NULL DEFAULT 'pending',
  decided_by UUID,
  decided_at TIMESTAMPTZ,
  admin_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_refunds_dsa ON public.lead_refunds(dsa_id);
CREATE INDEX idx_refunds_status ON public.lead_refunds(status);

ALTER TABLE public.lead_refunds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "DSA views own refunds" ON public.lead_refunds
  FOR SELECT TO authenticated USING (auth.uid() = dsa_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "DSA creates own refund" ON public.lead_refunds
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = dsa_id);

CREATE POLICY "Admins manage refunds" ON public.lead_refunds
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Notifications
CREATE TYPE public.notification_type AS ENUM (
  'payout_approved','payout_paid','payout_rejected',
  'refund_approved','refund_rejected',
  'disbursal_confirmed','docs_pending','docs_clear',
  'lead_purchased','lead_assigned','followup_due',
  'tier_upgraded','badge_earned','course_completed',
  'system','marketing'
);

CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  type public.notification_type NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  link TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notif_user ON public.notifications(user_id, created_at DESC);
CREATE INDEX idx_notif_unread ON public.notifications(user_id) WHERE read_at IS NULL;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own notifications" ON public.notifications
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users mark own as read" ON public.notifications
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Admins manage notifications" ON public.notifications
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- =====================================================================
-- FUNCTIONS
-- =====================================================================

-- Tier from reputation score
CREATE OR REPLACE FUNCTION public.dsa_tier_from_score(_score INTEGER)
RETURNS TEXT LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN _score >= 800 THEN 'diamond'
    WHEN _score >= 600 THEN 'platinum'
    WHEN _score >= 400 THEN 'gold'
    WHEN _score >= 200 THEN 'silver'
    ELSE 'bronze'
  END;
$$;

-- Payout SLA days from tier
CREATE OR REPLACE FUNCTION public.payout_sla_days(_tier TEXT)
RETURNS INTEGER LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE _tier
    WHEN 'diamond' THEN 0
    WHEN 'platinum' THEN 1
    WHEN 'gold' THEN 3
    WHEN 'silver' THEN 5
    ELSE 7
  END;
$$;

-- Send notification helper
CREATE OR REPLACE FUNCTION public.notify(_user_id UUID, _type public.notification_type, _title TEXT, _body TEXT DEFAULT NULL, _link TEXT DEFAULT NULL, _metadata JSONB DEFAULT '{}'::jsonb)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _id UUID;
BEGIN
  INSERT INTO public.notifications(user_id, type, title, body, link, metadata)
  VALUES (_user_id, _type, _title, _body, _link, _metadata)
  RETURNING id INTO _id;
  RETURN _id;
END; $$;

-- Recalculate reputation score for a DSA
CREATE OR REPLACE FUNCTION public.recalc_reputation(_user_id UUID)
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _purchases INTEGER; _conversions INTEGER; _refunds INTEGER; _fraud INTEGER;
  _conv_rate NUMERIC; _refund_rate NUMERIC;
  _score INTEGER := 100;
  _tier TEXT;
BEGIN
  SELECT COUNT(*) INTO _purchases FROM public.lead_purchases WHERE dsa_id = _user_id;
  SELECT COUNT(*) INTO _conversions FROM public.lead_purchases
    WHERE dsa_id = _user_id AND (converted = true OR pipeline_stage IN ('disbursed','policy_issued','delivered','invested'));
  SELECT COUNT(*) INTO _refunds FROM public.lead_refunds WHERE dsa_id = _user_id AND status IN ('approved','auto_approved');
  SELECT COALESCE(fraud_flags, 0) INTO _fraud FROM public.profiles WHERE id = _user_id;

  IF _purchases > 0 THEN
    _conv_rate := _conversions::NUMERIC / _purchases;
    _refund_rate := _refunds::NUMERIC / _purchases;
    _score := 100
      + LEAST(_conversions * 15, 600)         -- +15 per conversion, cap 600
      + LEAST(_purchases * 2, 200)            -- +2 per purchase, cap 200
      + (_conv_rate * 100)::INTEGER           -- conversion rate bonus
      - LEAST(_refunds * 20, 200)             -- -20 per refund
      - LEAST(_fraud * 100, 500);             -- -100 per fraud flag
    _score := GREATEST(0, LEAST(1000, _score));
  END IF;

  _tier := public.dsa_tier_from_score(_score);

  UPDATE public.profiles
    SET reputation_score = _score,
        dsa_tier = _tier,
        total_conversions = _conversions,
        total_leads_purchased = _purchases,
        total_refunds = _refunds,
        updated_at = now()
    WHERE id = _user_id;

  RETURN _score;
END; $$;

-- Auto-score lead quality (rules-based; AI score updated by edge function later)
CREATE OR REPLACE FUNCTION public.score_lead_quality()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  _score INTEGER := 50;
  _factors JSONB := '{}'::jsonb;
  _phone_clean TEXT;
  _dup_count INTEGER;
BEGIN
  _phone_clean := regexp_replace(COALESCE(NEW.full_phone,''), '[^0-9]', '', 'g');

  -- Phone format (Indian mobile)
  IF length(_phone_clean) = 10 AND substring(_phone_clean,1,1) IN ('6','7','8','9') THEN
    _score := _score + 15; _factors := _factors || jsonb_build_object('phone_valid', true);
  ELSE
    _score := _score - 30; _factors := _factors || jsonb_build_object('phone_valid', false);
    NEW.fraud_risk := 'high';
  END IF;

  -- Email present
  IF NEW.email IS NOT NULL AND NEW.email ~ '^[^@]+@[^@]+\.[^@]+$' THEN
    _score := _score + 10; _factors := _factors || jsonb_build_object('email_valid', true);
  END IF;

  -- Income (loans/cards)
  IF NEW.product_category IN ('loan','credit_card') AND COALESCE(NEW.monthly_income,0) >= 25000 THEN
    _score := _score + 15; _factors := _factors || jsonb_build_object('income_ok', true);
  END IF;

  -- CIBIL
  IF COALESCE(NEW.cibil_score, 0) >= 700 THEN
    _score := _score + 15; _factors := _factors || jsonb_build_object('cibil_good', true);
  ELSIF NEW.cibil_score IS NOT NULL AND NEW.cibil_score < 600 THEN
    _score := _score - 10;
  END IF;

  -- Loan amount sanity
  IF NEW.loan_amount BETWEEN 50000 AND 10000000 THEN
    _score := _score + 5;
  END IF;

  -- Duplicate phone in last 90 days = fraud risk
  SELECT COUNT(*) INTO _dup_count FROM public.leads
    WHERE full_phone = NEW.full_phone
      AND created_at > now() - INTERVAL '90 days'
      AND id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);
  IF _dup_count > 0 THEN
    _score := _score - 20;
    NEW.fraud_risk := 'medium';
    _factors := _factors || jsonb_build_object('duplicate_in_90d', _dup_count);
  END IF;

  NEW.quality_score := GREATEST(0, LEAST(100, _score));
  NEW.quality_factors := _factors;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_score_lead_quality ON public.leads;
CREATE TRIGGER trg_score_lead_quality
  BEFORE INSERT OR UPDATE OF full_phone, email, monthly_income, cibil_score, loan_amount ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.score_lead_quality();

-- Submit refund request (DSA-callable)
CREATE OR REPLACE FUNCTION public.submit_refund(_lead_id UUID, _reason public.refund_reason, _description TEXT DEFAULT NULL, _evidence TEXT[] DEFAULT '{}')
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _user UUID := auth.uid();
  _purchase RECORD;
  _refund_id UUID;
  _auto_approve BOOLEAN := false;
BEGIN
  IF _user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT lp.*, l.quality_score, l.full_phone, l.created_at AS lead_created
    INTO _purchase
    FROM public.lead_purchases lp
    JOIN public.leads l ON l.id = lp.lead_id
    WHERE lp.lead_id = _lead_id AND lp.dsa_id = _user
    FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Lead purchase not found'; END IF;

  -- Refund window: 24h from purchase
  IF _purchase.created_at < now() - INTERVAL '24 hours' THEN
    RAISE EXCEPTION 'Refund window expired (24 hours from purchase).';
  END IF;

  -- Already refunded?
  IF EXISTS (SELECT 1 FROM public.lead_refunds WHERE lead_purchase_id = _purchase.id AND status IN ('pending','approved','auto_approved')) THEN
    RAISE EXCEPTION 'Refund already requested for this lead.';
  END IF;

  -- Auto-approve rules
  IF _reason IN ('invalid_phone','wrong_number','duplicate') AND _purchase.quality_score < 40 THEN
    _auto_approve := true;
  END IF;

  INSERT INTO public.lead_refunds(lead_id, lead_purchase_id, dsa_id, reason, description, evidence_urls, amount, status, decided_at, decided_by)
  VALUES (_lead_id, _purchase.id, _user, _reason, _description, _evidence, _purchase.price_paid,
          CASE WHEN _auto_approve THEN 'auto_approved'::public.refund_status ELSE 'pending'::public.refund_status END,
          CASE WHEN _auto_approve THEN now() ELSE NULL END,
          CASE WHEN _auto_approve THEN _user ELSE NULL END)
  RETURNING id INTO _refund_id;

  IF _auto_approve THEN
    UPDATE public.wallets SET balance = balance + _purchase.price_paid WHERE user_id = _user;
    INSERT INTO public.wallet_transactions(user_id, type, amount, description, reference_id, balance_after)
    SELECT _user, 'credit', _purchase.price_paid, 'Auto-refund: dead lead ' || _purchase.full_phone, _lead_id, balance
      FROM public.wallets WHERE user_id = _user;
    PERFORM public.notify(_user, 'refund_approved', 'Refund approved instantly',
      'Your wallet has been credited ₹' || _purchase.price_paid || '. Reason: ' || _reason::text,
      '/dashboard/wallet');
  ELSE
    PERFORM public.notify(_user, 'refund_approved', 'Refund request submitted',
      'Admin will review within 24 hours.', '/dashboard/my-leads');
  END IF;

  PERFORM public.recalc_reputation(_user);
  RETURN jsonb_build_object('success', true, 'refund_id', _refund_id, 'auto_approved', _auto_approve);
END; $$;

-- Process disbursal confirmation (lender or admin) → schedule payout
CREATE OR REPLACE FUNCTION public.confirm_disbursal(_disbursal_id UUID, _new_status public.disbursal_status, _amount NUMERIC DEFAULT NULL, _notes TEXT DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _user UUID := auth.uid();
  _d RECORD;
  _tier TEXT;
  _sla_days INTEGER;
BEGIN
  IF _user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO _d FROM public.disbursals WHERE id = _disbursal_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Disbursal not found'; END IF;

  IF NOT (public.has_role(_user, 'admin') OR public.has_role(_user, 'lender') OR _user = _d.lender_id) THEN
    RAISE EXCEPTION 'Insufficient permissions';
  END IF;

  UPDATE public.disbursals SET
    status = _new_status,
    disbursed_amount = COALESCE(_amount, disbursed_amount),
    disbursed_at = CASE WHEN _new_status = 'disbursed' THEN now() ELSE disbursed_at END,
    docs_clear_at = CASE WHEN _new_status = 'docs_clear' THEN now() ELSE docs_clear_at END,
    customer_paid_at = CASE WHEN _new_status = 'customer_paid' THEN now() ELSE customer_paid_at END,
    notes = COALESCE(_notes, notes),
    updated_at = now()
  WHERE id = _disbursal_id;

  -- When customer is paid → schedule payout per tier SLA
  IF _new_status = 'customer_paid' THEN
    SELECT dsa_tier INTO _tier FROM public.profiles WHERE id = _d.dsa_id;
    _sla_days := public.payout_sla_days(COALESCE(_tier, 'bronze'));

    UPDATE public.disbursals SET
      payout_eligible_at = now(),
      payout_due_at = now() + (_sla_days || ' days')::INTERVAL
    WHERE id = _disbursal_id;

    -- Update lead_purchase as converted with deal value
    UPDATE public.lead_purchases SET
      converted = true,
      pipeline_stage = 'disbursed',
      deal_value = COALESCE(_amount, deal_value),
      updated_at = now()
    WHERE id = _d.lead_purchase_id;

    PERFORM public.notify(_d.dsa_id, 'disbursal_confirmed',
      '🎉 Disbursal confirmed!',
      'Payout of your commission scheduled within ' || _sla_days || ' day(s). Tier: ' || _tier,
      '/dashboard/earnings');

    PERFORM public.recalc_reputation(_d.dsa_id);
  ELSE
    PERFORM public.notify(_d.dsa_id, _new_status::TEXT::public.notification_type,
      'Disbursal status: ' || _new_status::TEXT, _notes, '/dashboard/my-leads');
  END IF;

  RETURN jsonb_build_object('success', true, 'status', _new_status);
END; $$;

-- Mark notification read
CREATE OR REPLACE FUNCTION public.mark_notification_read(_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.notifications SET read_at = now()
    WHERE id = _id AND user_id = auth.uid() AND read_at IS NULL;
  RETURN FOUND;
END; $$;

CREATE OR REPLACE FUNCTION public.mark_all_notifications_read()
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _n INTEGER;
BEGIN
  WITH upd AS (
    UPDATE public.notifications SET read_at = now()
      WHERE user_id = auth.uid() AND read_at IS NULL
    RETURNING 1
  ) SELECT COUNT(*) INTO _n FROM upd;
  RETURN _n;
END; $$;

-- updated_at triggers
CREATE TRIGGER trg_disbursals_updated BEFORE UPDATE ON public.disbursals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_refunds_updated BEFORE UPDATE ON public.lead_refunds
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();