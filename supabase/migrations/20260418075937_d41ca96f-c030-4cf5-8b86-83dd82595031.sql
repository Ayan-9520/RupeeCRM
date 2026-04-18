-- ============================================================
-- ENUMS for billing
-- ============================================================
CREATE TYPE public.billing_cycle AS ENUM ('monthly', 'quarterly', 'yearly');
CREATE TYPE public.subscription_status AS ENUM ('trial', 'active', 'past_due', 'cancelled', 'expired');
CREATE TYPE public.invoice_status AS ENUM ('draft', 'pending', 'paid', 'failed', 'refunded');

-- ============================================================
-- 1. SUBSCRIPTION_PLANS (catalog)
-- ============================================================
CREATE TABLE public.subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code public.workspace_plan NOT NULL UNIQUE,
  name TEXT NOT NULL,
  tagline TEXT,
  description TEXT,
  price_monthly NUMERIC NOT NULL DEFAULT 0,
  price_quarterly NUMERIC NOT NULL DEFAULT 0,
  price_yearly NUMERIC NOT NULL DEFAULT 0,
  gst_percent NUMERIC NOT NULL DEFAULT 18,
  seat_limit INTEGER NOT NULL DEFAULT 1,
  leads_per_day INTEGER NOT NULL DEFAULT 2,
  marketing_posts_per_month INTEGER NOT NULL DEFAULT 2,
  hrms_user_limit INTEGER NOT NULL DEFAULT 0,
  withdrawal_enabled BOOLEAN NOT NULL DEFAULT false,
  recharge_bonus_max_pct NUMERIC NOT NULL DEFAULT 0,
  whatsapp_enabled BOOLEAN NOT NULL DEFAULT false,
  affiliate_enabled BOOLEAN NOT NULL DEFAULT false,
  api_access BOOLEAN NOT NULL DEFAULT false,
  custom_branding BOOLEAN NOT NULL DEFAULT false,
  priority_leads BOOLEAN NOT NULL DEFAULT false,
  features JSONB NOT NULL DEFAULT '[]'::jsonb,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_popular BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone reads active plans" ON public.subscription_plans
  FOR SELECT TO anon, authenticated
  USING (is_active = true OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage plans" ON public.subscription_plans
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_subscription_plans_updated_at
  BEFORE UPDATE ON public.subscription_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 2. SUBSCRIPTIONS
-- ============================================================
CREATE TABLE public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES public.subscription_plans(id),
  plan_code public.workspace_plan NOT NULL,
  cycle public.billing_cycle NOT NULL DEFAULT 'monthly',
  status public.subscription_status NOT NULL DEFAULT 'active',
  amount NUMERIC NOT NULL DEFAULT 0,
  gst_amount NUMERIC NOT NULL DEFAULT 0,
  total_amount NUMERIC NOT NULL DEFAULT 0,
  current_period_start TIMESTAMPTZ NOT NULL DEFAULT now(),
  current_period_end TIMESTAMPTZ NOT NULL,
  trial_ends_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
  auto_renew BOOLEAN NOT NULL DEFAULT true,
  razorpay_subscription_id TEXT,
  razorpay_customer_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_subscriptions_workspace ON public.subscriptions(workspace_id);
CREATE INDEX idx_subscriptions_status ON public.subscriptions(status);
CREATE UNIQUE INDEX idx_subscriptions_workspace_active
  ON public.subscriptions(workspace_id)
  WHERE status IN ('active', 'trial', 'past_due');

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace members view own subscription" ON public.subscriptions
  FOR SELECT TO authenticated
  USING (public.is_workspace_member(workspace_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage subscriptions" ON public.subscriptions
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 3. INVOICES
-- ============================================================
CREATE TABLE public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number TEXT NOT NULL UNIQUE,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  user_id UUID NOT NULL,
  plan_code public.workspace_plan NOT NULL,
  cycle public.billing_cycle NOT NULL,
  subtotal NUMERIC NOT NULL DEFAULT 0,
  discount NUMERIC NOT NULL DEFAULT 0,
  gst_amount NUMERIC NOT NULL DEFAULT 0,
  gst_percent NUMERIC NOT NULL DEFAULT 18,
  total_amount NUMERIC NOT NULL DEFAULT 0,
  status public.invoice_status NOT NULL DEFAULT 'pending',
  line_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  billing_name TEXT,
  billing_email TEXT,
  billing_phone TEXT,
  billing_address JSONB DEFAULT '{}'::jsonb,
  gstin TEXT,
  razorpay_payment_id TEXT,
  razorpay_order_id TEXT,
  paid_at TIMESTAMPTZ,
  due_at TIMESTAMPTZ,
  pdf_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_invoices_workspace ON public.invoices(workspace_id);
CREATE INDEX idx_invoices_status ON public.invoices(status);
CREATE INDEX idx_invoices_created ON public.invoices(created_at DESC);

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace members view invoices" ON public.invoices
  FOR SELECT TO authenticated
  USING (public.is_workspace_member(workspace_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage invoices" ON public.invoices
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_invoices_updated_at
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 4. USAGE COUNTERS
-- ============================================================
CREATE TABLE public.usage_counters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  period_key TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, kind, period_key)
);

CREATE INDEX idx_usage_counters_lookup ON public.usage_counters(workspace_id, kind, period_key);

ALTER TABLE public.usage_counters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace members view counters" ON public.usage_counters
  FOR SELECT TO authenticated
  USING (public.is_workspace_member(workspace_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'));

-- ============================================================
-- 5. plan_seat_limit includes 'free'
-- ============================================================
CREATE OR REPLACE FUNCTION public.plan_seat_limit(_plan public.workspace_plan)
RETURNS INTEGER
LANGUAGE sql IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE _plan
    WHEN 'free' THEN 1
    WHEN 'starter' THEN 1
    WHEN 'growth' THEN 3
    WHEN 'pro' THEN 10
    WHEN 'enterprise' THEN 9999
  END
$$;

-- ============================================================
-- 6. CORE FUNCTIONS
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_active_subscription(_workspace_id UUID)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _sub RECORD;
  _plan RECORD;
BEGIN
  SELECT s.*, p.name AS plan_name, p.leads_per_day, p.marketing_posts_per_month,
         p.withdrawal_enabled, p.recharge_bonus_max_pct, p.hrms_user_limit,
         p.whatsapp_enabled, p.affiliate_enabled, p.api_access,
         p.custom_branding, p.priority_leads
    INTO _sub
    FROM public.subscriptions s
    JOIN public.subscription_plans p ON p.id = s.plan_id
    WHERE s.workspace_id = _workspace_id
      AND s.status IN ('active', 'trial')
      AND s.current_period_end > now()
    ORDER BY s.created_at DESC
    LIMIT 1;

  IF NOT FOUND THEN
    SELECT * INTO _plan FROM public.subscription_plans WHERE code = 'free' LIMIT 1;
    RETURN jsonb_build_object(
      'has_subscription', false,
      'plan_code', 'free',
      'plan_name', COALESCE(_plan.name, 'Free'),
      'status', 'active',
      'leads_per_day', COALESCE(_plan.leads_per_day, 2),
      'marketing_posts_per_month', COALESCE(_plan.marketing_posts_per_month, 2),
      'withdrawal_enabled', COALESCE(_plan.withdrawal_enabled, false),
      'recharge_bonus_max_pct', COALESCE(_plan.recharge_bonus_max_pct, 0),
      'hrms_user_limit', COALESCE(_plan.hrms_user_limit, 0),
      'whatsapp_enabled', COALESCE(_plan.whatsapp_enabled, false),
      'affiliate_enabled', COALESCE(_plan.affiliate_enabled, false),
      'api_access', false,
      'custom_branding', false,
      'priority_leads', false
    );
  END IF;

  RETURN jsonb_build_object(
    'has_subscription', true,
    'subscription_id', _sub.id,
    'plan_code', _sub.plan_code,
    'plan_name', _sub.plan_name,
    'status', _sub.status,
    'cycle', _sub.cycle,
    'current_period_end', _sub.current_period_end,
    'cancel_at_period_end', _sub.cancel_at_period_end,
    'leads_per_day', _sub.leads_per_day,
    'marketing_posts_per_month', _sub.marketing_posts_per_month,
    'withdrawal_enabled', _sub.withdrawal_enabled,
    'recharge_bonus_max_pct', _sub.recharge_bonus_max_pct,
    'hrms_user_limit', _sub.hrms_user_limit,
    'whatsapp_enabled', _sub.whatsapp_enabled,
    'affiliate_enabled', _sub.affiliate_enabled,
    'api_access', _sub.api_access,
    'custom_branding', _sub.custom_branding,
    'priority_leads', _sub.priority_leads
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.can_buy_lead(_workspace_id UUID)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _sub JSONB; _limit INTEGER; _used INTEGER := 0;
  _key TEXT := to_char(now(), 'YYYY-MM-DD');
BEGIN
  IF _workspace_id IS NULL THEN
    SELECT leads_per_day INTO _limit FROM public.subscription_plans WHERE code = 'free' LIMIT 1;
    RETURN jsonb_build_object('allowed', COALESCE(_limit, 2) > 0,
      'reason', 'no_workspace', 'used', 0, 'limit', COALESCE(_limit, 2));
  END IF;

  _sub := public.get_active_subscription(_workspace_id);
  _limit := (_sub ->> 'leads_per_day')::INTEGER;

  IF _limit < 0 THEN
    RETURN jsonb_build_object('allowed', true, 'used', 0, 'limit', -1, 'unlimited', true);
  END IF;

  SELECT COALESCE(count, 0) INTO _used
    FROM public.usage_counters
    WHERE workspace_id = _workspace_id AND kind = 'leads_daily' AND period_key = _key;

  RETURN jsonb_build_object(
    'allowed', _used < _limit,
    'used', _used, 'limit', _limit,
    'reason', CASE WHEN _used >= _limit THEN 'daily_limit_reached' ELSE 'ok' END,
    'plan_code', _sub ->> 'plan_code'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.can_create_marketing_post(_workspace_id UUID)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _sub JSONB; _limit INTEGER; _used INTEGER := 0;
  _key TEXT := to_char(now(), 'YYYY-MM');
BEGIN
  IF _workspace_id IS NULL THEN
    SELECT marketing_posts_per_month INTO _limit FROM public.subscription_plans WHERE code = 'free' LIMIT 1;
    RETURN jsonb_build_object('allowed', COALESCE(_limit, 2) > 0, 'used', 0, 'limit', COALESCE(_limit, 2));
  END IF;

  _sub := public.get_active_subscription(_workspace_id);
  _limit := (_sub ->> 'marketing_posts_per_month')::INTEGER;

  IF _limit < 0 THEN
    RETURN jsonb_build_object('allowed', true, 'used', 0, 'limit', -1, 'unlimited', true);
  END IF;

  SELECT COALESCE(count, 0) INTO _used
    FROM public.usage_counters
    WHERE workspace_id = _workspace_id AND kind = 'posts_monthly' AND period_key = _key;

  RETURN jsonb_build_object(
    'allowed', _used < _limit,
    'used', _used, 'limit', _limit,
    'reason', CASE WHEN _used >= _limit THEN 'monthly_limit_reached' ELSE 'ok' END,
    'plan_code', _sub ->> 'plan_code'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.increment_usage(_workspace_id UUID, _kind TEXT)
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _key TEXT; _new_count INTEGER;
BEGIN
  IF _workspace_id IS NULL THEN RETURN 0; END IF;
  _key := CASE _kind
    WHEN 'leads_daily' THEN to_char(now(), 'YYYY-MM-DD')
    WHEN 'posts_monthly' THEN to_char(now(), 'YYYY-MM')
    ELSE to_char(now(), 'YYYY-MM-DD')
  END;
  INSERT INTO public.usage_counters(workspace_id, kind, period_key, count)
  VALUES (_workspace_id, _kind, _key, 1)
  ON CONFLICT (workspace_id, kind, period_key)
  DO UPDATE SET count = public.usage_counters.count + 1, updated_at = now()
  RETURNING count INTO _new_count;
  RETURN _new_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.can_request_withdrawal(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _ws_id UUID; _sub JSONB;
BEGIN
  SELECT id INTO _ws_id FROM public.workspaces
    WHERE owner_id = _user_id ORDER BY created_at LIMIT 1;
  IF _ws_id IS NULL THEN RETURN false; END IF;
  _sub := public.get_active_subscription(_ws_id);
  RETURN COALESCE((_sub ->> 'withdrawal_enabled')::BOOLEAN, false);
END;
$$;

CREATE OR REPLACE FUNCTION public.subscribe_workspace(
  _workspace_id UUID,
  _plan_code public.workspace_plan,
  _cycle public.billing_cycle DEFAULT 'monthly',
  _billing_name TEXT DEFAULT NULL,
  _billing_email TEXT DEFAULT NULL,
  _billing_phone TEXT DEFAULT NULL,
  _gstin TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user UUID := auth.uid();
  _plan RECORD; _amount NUMERIC; _gst NUMERIC; _total NUMERIC;
  _period_end TIMESTAMPTZ;
  _sub_id UUID; _invoice_id UUID; _invoice_no TEXT; _seq INTEGER;
BEGIN
  IF _user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT (public.has_workspace_role(_workspace_id, _user, ARRAY['owner','admin']::workspace_role[])
          OR public.has_role(_user, 'admin')) THEN
    RAISE EXCEPTION 'Only workspace owners/admins can change plan';
  END IF;

  SELECT * INTO _plan FROM public.subscription_plans WHERE code = _plan_code AND is_active = true;
  IF NOT FOUND THEN RAISE EXCEPTION 'Plan not found: %', _plan_code; END IF;

  _amount := CASE _cycle
    WHEN 'monthly' THEN _plan.price_monthly
    WHEN 'quarterly' THEN _plan.price_quarterly
    WHEN 'yearly' THEN _plan.price_yearly
  END;
  _period_end := CASE _cycle
    WHEN 'monthly' THEN now() + INTERVAL '1 month'
    WHEN 'quarterly' THEN now() + INTERVAL '3 months'
    WHEN 'yearly' THEN now() + INTERVAL '1 year'
  END;
  _gst := ROUND(_amount * _plan.gst_percent / 100.0, 2);
  _total := _amount + _gst;

  UPDATE public.subscriptions
    SET status = 'cancelled', cancelled_at = now(), updated_at = now()
    WHERE workspace_id = _workspace_id AND status IN ('active','trial','past_due');

  INSERT INTO public.subscriptions(
    workspace_id, plan_id, plan_code, cycle, status,
    amount, gst_amount, total_amount,
    current_period_start, current_period_end,
    razorpay_subscription_id, razorpay_customer_id
  ) VALUES (
    _workspace_id, _plan.id, _plan_code, _cycle, 'active',
    _amount, _gst, _total, now(), _period_end,
    'sub_mock_' || substr(md5(random()::text), 1, 14),
    'cust_mock_' || substr(md5(_workspace_id::text), 1, 14)
  ) RETURNING id INTO _sub_id;

  UPDATE public.workspaces SET plan = _plan_code, updated_at = now() WHERE id = _workspace_id;

  IF _amount > 0 THEN
    SELECT COALESCE(MAX(SUBSTRING(invoice_number FROM '\d+$')::INTEGER), 0) + 1 INTO _seq
      FROM public.invoices
      WHERE invoice_number LIKE 'RD-INV-' || to_char(now(),'YYYYMM') || '-%';
    _invoice_no := 'RD-INV-' || to_char(now(),'YYYYMM') || '-' || lpad(_seq::text, 4, '0');

    INSERT INTO public.invoices(
      invoice_number, workspace_id, subscription_id, user_id,
      plan_code, cycle, subtotal, gst_amount, gst_percent, total_amount,
      status, line_items, billing_name, billing_email, billing_phone, gstin,
      razorpay_payment_id, razorpay_order_id, paid_at
    ) VALUES (
      _invoice_no, _workspace_id, _sub_id, _user,
      _plan_code, _cycle, _amount, _gst, _plan.gst_percent, _total,
      'paid',
      jsonb_build_array(jsonb_build_object(
        'description', _plan.name || ' Plan (' || _cycle || ')',
        'quantity', 1, 'unit_price', _amount, 'amount', _amount
      )),
      _billing_name, _billing_email, _billing_phone, _gstin,
      'pay_mock_' || substr(md5(random()::text), 1, 14),
      'order_mock_' || substr(md5(random()::text), 1, 14),
      now()
    ) RETURNING id INTO _invoice_id;
  END IF;

  PERFORM public.notify(
    _user, 'system', '✅ Plan activated: ' || _plan.name,
    'Your workspace is now on the ' || _plan.name || ' plan. Total: ₹' || _total,
    '/dashboard/billing'
  );

  RETURN jsonb_build_object(
    'success', true,
    'subscription_id', _sub_id,
    'invoice_id', _invoice_id,
    'invoice_number', _invoice_no,
    'amount', _amount, 'gst_amount', _gst, 'total_amount', _total,
    'plan_name', _plan.name, 'period_end', _period_end
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_subscription(_subscription_id UUID, _immediate BOOLEAN DEFAULT false)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _user UUID := auth.uid(); _sub RECORD;
BEGIN
  IF _user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO _sub FROM public.subscriptions WHERE id = _subscription_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Subscription not found'; END IF;
  IF NOT (public.has_workspace_role(_sub.workspace_id, _user, ARRAY['owner','admin']::workspace_role[])
          OR public.has_role(_user, 'admin')) THEN
    RAISE EXCEPTION 'Insufficient permissions';
  END IF;
  IF _immediate THEN
    UPDATE public.subscriptions
      SET status = 'cancelled', cancelled_at = now(), updated_at = now()
      WHERE id = _subscription_id;
    UPDATE public.workspaces SET plan = 'free' WHERE id = _sub.workspace_id;
  ELSE
    UPDATE public.subscriptions
      SET cancel_at_period_end = true, auto_renew = false, updated_at = now()
      WHERE id = _subscription_id;
  END IF;
  PERFORM public.notify(_user, 'system', 'Subscription cancelled',
    CASE WHEN _immediate THEN 'Your plan has been downgraded to Free.'
         ELSE 'Your plan will end on ' || to_char(_sub.current_period_end, 'DD Mon YYYY') END,
    '/dashboard/billing');
  RETURN jsonb_build_object('success', true, 'immediate', _immediate);
END;
$$;

-- ============================================================
-- 7. Auto-seed Free subscription on workspace create
-- ============================================================
CREATE OR REPLACE FUNCTION public.seed_free_subscription()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _free_plan_id UUID;
BEGIN
  SELECT id INTO _free_plan_id FROM public.subscription_plans WHERE code = 'free' LIMIT 1;
  IF _free_plan_id IS NOT NULL THEN
    INSERT INTO public.subscriptions(
      workspace_id, plan_id, plan_code, cycle, status,
      amount, gst_amount, total_amount,
      current_period_start, current_period_end
    ) VALUES (
      NEW.id, _free_plan_id, 'free', 'monthly', 'active',
      0, 0, 0, now(), now() + INTERVAL '100 years'
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_workspace_created_seed_subscription
  AFTER INSERT ON public.workspaces
  FOR EACH ROW EXECUTE FUNCTION public.seed_free_subscription();