
-- ============ FIX QUOTA NULL BUG ============
CREATE OR REPLACE FUNCTION public.can_buy_lead(_workspace_id uuid)
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
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
  _limit := COALESCE((_sub ->> 'leads_per_day')::INTEGER, 2);
  IF _limit < 0 THEN
    RETURN jsonb_build_object('allowed', true, 'used', 0, 'limit', -1, 'unlimited', true,
      'plan_code', _sub ->> 'plan_code');
  END IF;
  SELECT COALESCE(count, 0) INTO _used
    FROM public.usage_counters
    WHERE workspace_id = _workspace_id AND kind = 'leads_daily' AND period_key = _key;
  _used := COALESCE(_used, 0);
  RETURN jsonb_build_object(
    'allowed', _used < _limit,
    'used', _used, 'limit', _limit,
    'reason', CASE WHEN _used >= _limit THEN 'daily_limit_reached' ELSE 'ok' END,
    'plan_code', _sub ->> 'plan_code'
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.can_create_marketing_post(_workspace_id uuid)
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  _sub JSONB; _limit INTEGER; _used INTEGER := 0;
  _key TEXT := to_char(now(), 'YYYY-MM');
BEGIN
  IF _workspace_id IS NULL THEN
    SELECT marketing_posts_per_month INTO _limit FROM public.subscription_plans WHERE code = 'free' LIMIT 1;
    RETURN jsonb_build_object('allowed', COALESCE(_limit, 2) > 0, 'used', 0, 'limit', COALESCE(_limit, 2));
  END IF;
  _sub := public.get_active_subscription(_workspace_id);
  _limit := COALESCE((_sub ->> 'marketing_posts_per_month')::INTEGER, 2);
  IF _limit < 0 THEN
    RETURN jsonb_build_object('allowed', true, 'used', 0, 'limit', -1, 'unlimited', true,
      'plan_code', _sub ->> 'plan_code');
  END IF;
  SELECT COALESCE(count, 0) INTO _used
    FROM public.usage_counters
    WHERE workspace_id = _workspace_id AND kind = 'posts_monthly' AND period_key = _key;
  _used := COALESCE(_used, 0);
  RETURN jsonb_build_object(
    'allowed', _used < _limit,
    'used', _used, 'limit', _limit,
    'reason', CASE WHEN _used >= _limit THEN 'monthly_limit_reached' ELSE 'ok' END,
    'plan_code', _sub ->> 'plan_code'
  );
END;
$function$;

-- Sync workspaces.plan to match active subscription
UPDATE public.workspaces w
   SET plan = COALESCE(s.plan_code, 'free'::workspace_plan), updated_at = now()
  FROM (
    SELECT DISTINCT ON (workspace_id) workspace_id, plan_code
      FROM public.subscriptions
     WHERE status IN ('active','trial')
     ORDER BY workspace_id, created_at DESC
  ) s
 WHERE s.workspace_id = w.id;

-- ============ DSA ID + KYC fields on profiles ============
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS dsa_id TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS kyc_status TEXT NOT NULL DEFAULT 'not_submitted',
  ADD COLUMN IF NOT EXISTS kyc_approved_at TIMESTAMPTZ;

-- ============ Partner Applications ============
CREATE TABLE IF NOT EXISTS public.partner_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  date_of_birth DATE,
  gender TEXT,
  city TEXT NOT NULL,
  state TEXT,
  pincode TEXT,
  address TEXT,
  company_name TEXT,
  experience_years INTEGER DEFAULT 0,
  products_of_interest TEXT[] DEFAULT '{}',
  monthly_target NUMERIC,
  pan TEXT NOT NULL,
  aadhaar_last4 TEXT,
  bank_account TEXT,
  ifsc TEXT,
  account_holder TEXT,
  pan_doc_url TEXT,
  aadhaar_doc_url TEXT,
  bank_proof_url TEXT,
  selfie_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  rejection_reason TEXT,
  internal_notes TEXT,
  generated_dsa_id TEXT,
  workspace_id UUID,
  source TEXT DEFAULT 'public_signup',
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_partner_apps_status ON public.partner_applications(status);
CREATE INDEX IF NOT EXISTS idx_partner_apps_user ON public.partner_applications(user_id);
CREATE INDEX IF NOT EXISTS idx_partner_apps_phone ON public.partner_applications(phone);

ALTER TABLE public.partner_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit application"
  ON public.partner_applications FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Applicants view own application"
  ON public.partner_applications FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR phone = (SELECT phone FROM public.profiles WHERE id = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Public view by id (for status lookup)"
  ON public.partner_applications FOR SELECT
  TO anon
  USING (false); -- intentionally false; public lookup goes through edge function

CREATE POLICY "Admins manage applications"
  ON public.partner_applications FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER partner_apps_updated
  BEFORE UPDATE ON public.partner_applications
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ DSA ID generator ============
CREATE OR REPLACE FUNCTION public.generate_dsa_id(_city text)
 RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  _city_code TEXT;
  _seq INTEGER;
BEGIN
  _city_code := upper(substring(regexp_replace(COALESCE(_city, 'IND'), '[^a-zA-Z]', '', 'g') from 1 for 3));
  IF length(_city_code) < 3 THEN _city_code := rpad(_city_code, 3, 'X'); END IF;

  SELECT COALESCE(MAX(SUBSTRING(dsa_id FROM '\d+$')::INTEGER), 0) + 1 INTO _seq
    FROM public.profiles
   WHERE dsa_id LIKE 'RD-' || _city_code || '-%';

  RETURN 'RD-' || _city_code || '-' || lpad(_seq::text, 4, '0');
END;
$function$;

-- ============ Submit application (public, no auth) ============
CREATE OR REPLACE FUNCTION public.submit_partner_application(
  _full_name text, _email text, _phone text,
  _city text, _state text DEFAULT NULL, _pincode text DEFAULT NULL,
  _date_of_birth date DEFAULT NULL, _gender text DEFAULT NULL,
  _company_name text DEFAULT NULL, _experience_years integer DEFAULT 0,
  _products text[] DEFAULT '{}', _monthly_target numeric DEFAULT NULL,
  _pan text DEFAULT NULL, _aadhaar_last4 text DEFAULT NULL,
  _bank_account text DEFAULT NULL, _ifsc text DEFAULT NULL, _account_holder text DEFAULT NULL,
  _pan_doc_url text DEFAULT NULL, _aadhaar_doc_url text DEFAULT NULL,
  _bank_proof_url text DEFAULT NULL, _selfie_url text DEFAULT NULL,
  _utm_source text DEFAULT NULL, _utm_medium text DEFAULT NULL, _utm_campaign text DEFAULT NULL
)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _id UUID; _existing INTEGER;
BEGIN
  IF _full_name IS NULL OR length(trim(_full_name)) < 2 THEN
    RAISE EXCEPTION 'Full name is required';
  END IF;
  IF _phone IS NULL OR length(regexp_replace(_phone, '[^0-9]', '', 'g')) < 10 THEN
    RAISE EXCEPTION 'Valid phone number is required';
  END IF;
  IF _email IS NULL OR _email !~ '^[^@]+@[^@]+\.[^@]+$' THEN
    RAISE EXCEPTION 'Valid email is required';
  END IF;
  IF _pan IS NULL OR _pan !~ '^[A-Z]{5}[0-9]{4}[A-Z]{1}$' THEN
    RAISE EXCEPTION 'Valid PAN is required (e.g. ABCDE1234F)';
  END IF;

  -- Block duplicate pending applications by phone
  SELECT COUNT(*) INTO _existing FROM public.partner_applications
    WHERE phone = _phone AND status IN ('pending','under_review');
  IF _existing > 0 THEN
    RAISE EXCEPTION 'An application with this phone is already under review';
  END IF;

  INSERT INTO public.partner_applications(
    user_id, full_name, email, phone, date_of_birth, gender,
    city, state, pincode, company_name, experience_years, products_of_interest, monthly_target,
    pan, aadhaar_last4, bank_account, ifsc, account_holder,
    pan_doc_url, aadhaar_doc_url, bank_proof_url, selfie_url,
    utm_source, utm_medium, utm_campaign
  ) VALUES (
    auth.uid(), trim(_full_name), lower(trim(_email)), _phone, _date_of_birth, _gender,
    trim(_city), _state, _pincode, _company_name, _experience_years, _products, _monthly_target,
    upper(_pan), _aadhaar_last4, _bank_account, _ifsc, _account_holder,
    _pan_doc_url, _aadhaar_doc_url, _bank_proof_url, _selfie_url,
    _utm_source, _utm_medium, _utm_campaign
  ) RETURNING id INTO _id;

  -- Notify all admins
  INSERT INTO public.notifications(user_id, type, title, body, link)
  SELECT ur.user_id, 'system', '🆕 New partner application',
         _full_name || ' from ' || _city || ' applied for partnership',
         '/dashboard/admin/partners'
    FROM public.user_roles ur WHERE ur.role = 'admin';

  RETURN jsonb_build_object('success', true, 'application_id', _id, 'status', 'pending');
END;
$function$;

-- ============ Approve application ============
CREATE OR REPLACE FUNCTION public.approve_partner_application(
  _application_id uuid, _notes text DEFAULT NULL
)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  _admin UUID := auth.uid();
  _app RECORD; _new_dsa_id TEXT; _ws_id UUID; _slug TEXT; _lead_id UUID;
  _existing_user UUID;
BEGIN
  IF _admin IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.has_role(_admin, 'admin') THEN RAISE EXCEPTION 'Admin only'; END IF;

  SELECT * INTO _app FROM public.partner_applications WHERE id = _application_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Application not found'; END IF;
  IF _app.status = 'approved' THEN RAISE EXCEPTION 'Already approved'; END IF;

  _new_dsa_id := public.generate_dsa_id(_app.city);

  -- If applicant already has an account, update profile + grant DSA role
  IF _app.user_id IS NOT NULL THEN
    UPDATE public.profiles
       SET dsa_id = _new_dsa_id,
           kyc_status = 'approved',
           kyc_approved_at = now(),
           full_name = COALESCE(full_name, _app.full_name),
           phone = COALESCE(phone, _app.phone),
           city = COALESCE(city, _app.city),
           company_name = COALESCE(company_name, _app.company_name),
           updated_at = now()
     WHERE id = _app.user_id;
    INSERT INTO public.user_roles(user_id, role)
      VALUES (_app.user_id, 'dsa') ON CONFLICT DO NOTHING;
    _existing_user := _app.user_id;
  END IF;

  -- Auto-create CRM lead from application (so it shows up in admin/leads)
  INSERT INTO public.leads(
    applicant_name, full_phone, masked_phone, email, city, state,
    loan_type, loan_amount, product_category, source, created_by,
    notes, score, status
  ) VALUES (
    _app.full_name, _app.phone,
    regexp_replace(_app.phone, '(\d{2})\d{6}(\d{2})', '\1******\2'),
    _app.email, _app.city, _app.state,
    'personal', COALESCE(_app.monthly_target, 100000), 'loan',
    'partner_signup', _admin,
    'Auto-created from approved partner application: ' || _new_dsa_id,
    'warm', 'sold' -- mark sold so it doesn't appear in marketplace
  )
  ON CONFLICT DO NOTHING
  RETURNING id INTO _lead_id;

  UPDATE public.partner_applications SET
    status = 'approved',
    reviewed_by = _admin,
    reviewed_at = now(),
    generated_dsa_id = _new_dsa_id,
    internal_notes = COALESCE(_notes, internal_notes),
    workspace_id = _ws_id,
    updated_at = now()
  WHERE id = _application_id;

  IF _existing_user IS NOT NULL THEN
    PERFORM public.notify(_existing_user, 'system',
      '🎉 You are now a verified partner!',
      'Your DSA ID: ' || _new_dsa_id || '. Start buying leads and earning.',
      '/dashboard');
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'dsa_id', _new_dsa_id,
    'lead_id', _lead_id,
    'application_id', _application_id
  );
END;
$function$;

-- ============ Reject application ============
CREATE OR REPLACE FUNCTION public.reject_partner_application(
  _application_id uuid, _reason text
)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _admin UUID := auth.uid(); _app RECORD;
BEGIN
  IF _admin IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.has_role(_admin, 'admin') THEN RAISE EXCEPTION 'Admin only'; END IF;
  IF _reason IS NULL OR length(trim(_reason)) < 5 THEN
    RAISE EXCEPTION 'Rejection reason is required (min 5 chars)';
  END IF;

  SELECT * INTO _app FROM public.partner_applications WHERE id = _application_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Application not found'; END IF;

  UPDATE public.partner_applications SET
    status = 'rejected', reviewed_by = _admin, reviewed_at = now(),
    rejection_reason = _reason, updated_at = now()
  WHERE id = _application_id;

  IF _app.user_id IS NOT NULL THEN
    PERFORM public.notify(_app.user_id, 'system',
      'Partner application update',
      'Your application was not approved. Reason: ' || _reason,
      '/auth');
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$function$;

-- ============ KYC Documents storage bucket ============
INSERT INTO storage.buckets (id, name, public)
VALUES ('kyc-documents', 'kyc-documents', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Anyone can upload KYC docs to own folder"
  ON storage.objects FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    bucket_id = 'kyc-documents'
    AND (storage.foldername(name))[1] IN ('public', auth.uid()::text)
  );

CREATE POLICY "Users view own KYC docs"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'kyc-documents'
    AND ((storage.foldername(name))[1] = auth.uid()::text OR has_role(auth.uid(), 'admin'::app_role))
  );

CREATE POLICY "Admins view all KYC docs"
  ON storage.objects FOR ALL
  TO authenticated
  USING (bucket_id = 'kyc-documents' AND has_role(auth.uid(), 'admin'::app_role));
