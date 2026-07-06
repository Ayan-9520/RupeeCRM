-- Platform admin helper (admin, ceo, super_admin)
CREATE OR REPLACE FUNCTION public.is_platform_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin'::app_role, 'ceo'::app_role, 'super_admin'::app_role)
  )
$$;

-- Partner applications: allow platform admins (not just admin role)
DROP POLICY IF EXISTS "Applicants view own application" ON public.partner_applications;
CREATE POLICY "Applicants view own application"
  ON public.partner_applications FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR phone = (SELECT phone FROM public.profiles WHERE id = auth.uid())
    OR public.is_platform_admin(auth.uid())
  );

DROP POLICY IF EXISTS "Admins manage applications" ON public.partner_applications;
CREATE POLICY "Platform admins manage applications"
  ON public.partner_applications FOR ALL
  TO authenticated
  USING (public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_platform_admin(auth.uid()));

-- KYC storage: platform admins can read/delete
DROP POLICY IF EXISTS "Users view own KYC docs" ON storage.objects;
CREATE POLICY "Users view own KYC docs"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'kyc-documents'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.is_platform_admin(auth.uid())
    )
  );

DROP POLICY IF EXISTS "Admins read KYC docs" ON storage.objects;
CREATE POLICY "Platform admins read KYC docs"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'kyc-documents' AND public.is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins delete KYC docs" ON storage.objects;
CREATE POLICY "Platform admins delete KYC docs"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'kyc-documents' AND public.is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins view all KYC docs" ON storage.objects;

-- Approve partner: stop inserting removed leads.loan_type column
CREATE OR REPLACE FUNCTION public.approve_partner_application(
  _application_id uuid, _notes text DEFAULT NULL
)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  _admin UUID := auth.uid();
  _app RECORD;
  _new_dsa_id TEXT;
  _ws_id UUID;
  _lead_id UUID;
  _existing_user UUID;
  _product_cat public.product_category := 'loan';
  _product_sub TEXT := 'personal_loan';
  _first_product TEXT;
BEGIN
  IF _admin IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.is_platform_admin(_admin) THEN RAISE EXCEPTION 'Admin only'; END IF;

  SELECT * INTO _app FROM public.partner_applications WHERE id = _application_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Application not found'; END IF;
  IF _app.status = 'approved' THEN RAISE EXCEPTION 'Already approved'; END IF;

  _new_dsa_id := public.generate_dsa_id(_app.city);

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

  IF _app.products_of_interest IS NOT NULL AND array_length(_app.products_of_interest, 1) > 0 THEN
    _first_product := _app.products_of_interest[1];
    _product_sub := _first_product;
    _product_cat := CASE
      WHEN _first_product = 'credit_card' THEN 'credit_card'::public.product_category
      WHEN _first_product = 'insurance' THEN 'insurance'::public.product_category
      WHEN _first_product IN ('investment', 'mutual_fund') THEN 'investment'::public.product_category
      ELSE 'loan'::public.product_category
    END;
  END IF;

  INSERT INTO public.leads(
    applicant_name, full_phone, masked_phone, email, city, state,
    loan_amount, product_category, product_subtype, source, created_by,
    notes, score, status
  ) VALUES (
    _app.full_name, _app.phone,
    regexp_replace(_app.phone, '(\d{2})\d{6}(\d{2})', '\1******\2'),
    _app.email, _app.city, _app.state,
    COALESCE(_app.monthly_target, 100000),
    _product_cat, _product_sub,
    'partner_signup', _admin,
    'Auto-created from approved partner application: ' || _new_dsa_id,
    'warm', 'sold'
  )
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

CREATE OR REPLACE FUNCTION public.reject_partner_application(
  _application_id uuid, _reason text
)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _admin UUID := auth.uid(); _app RECORD;
BEGIN
  IF _admin IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.is_platform_admin(_admin) THEN RAISE EXCEPTION 'Admin only'; END IF;
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

-- Public lead submission: leads table no longer has loan_type
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
  _subtype TEXT;
BEGIN
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
  _subtype := COALESCE(NULLIF(trim(_product_subtype), ''), _loan_type::text);

  IF _ref_code IS NOT NULL AND length(trim(_ref_code)) > 0 THEN
    SELECT id, allow_marketplace
      INTO _ref_dsa, _ref_allow_marketplace
      FROM public.profiles
      WHERE dsa_id = upper(trim(_ref_code))
      LIMIT 1;
    IF _ref_dsa IS NOT NULL THEN
      _source := 'referral';
      _is_marketplace := _ref_allow_marketplace;
    END IF;
  END IF;

  SELECT COUNT(*) INTO _existing_count
    FROM public.leads
    WHERE full_phone = _phone_clean
      AND created_at > now() - INTERVAL '30 days';
  IF _existing_count > 0 THEN
    RAISE EXCEPTION 'A lead with this phone was submitted recently. Please wait or contact support.';
  END IF;

  INSERT INTO public.leads(
    applicant_name, full_phone, masked_phone, city, email,
    loan_amount, monthly_income, employment_type,
    product_category, product_subtype,
    source, ref_dsa_id, is_marketplace,
    utm_source, utm_medium, utm_campaign,
    status, sale_available, phone_verified
  ) VALUES (
    trim(_applicant_name), _phone_clean, _masked, trim(_city), _email,
    _loan_amount, _monthly_income, _employment_type,
    _product_category, _subtype,
    _source, _ref_dsa, _is_marketplace,
    _utm_source, _utm_medium, _utm_campaign,
    CASE WHEN _ref_dsa IS NOT NULL AND NOT _is_marketplace THEN 'sold' ELSE 'available' END,
    _is_marketplace,
    false
  ) RETURNING id INTO _lead_id;

  IF _ref_dsa IS NOT NULL AND NOT _is_marketplace THEN
    INSERT INTO public.lead_purchases(lead_id, dsa_id, price_paid, pipeline_stage)
    VALUES (_lead_id, _ref_dsa, 0, 'new')
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN jsonb_build_object('success', true, 'lead_id', _lead_id);
END;
$$;
