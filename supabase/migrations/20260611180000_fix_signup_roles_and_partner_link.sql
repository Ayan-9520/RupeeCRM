-- Safe signup role assignment + auto-link approved partner applications by email

CREATE OR REPLACE FUNCTION public.parse_signup_role(_raw text)
RETURNS app_role
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE _raw
    WHEN 'dsa' THEN 'dsa'::app_role
    WHEN 'caller' THEN 'caller'::app_role
    WHEN 'coordinator' THEN 'coordinator'::app_role
    WHEN 'lender' THEN 'lender'::app_role
    WHEN 'affiliate' THEN 'affiliate'::app_role
    WHEN 'customer' THEN 'customer'::app_role
    ELSE 'customer'::app_role
  END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _role app_role;
  _phone TEXT;
  _pa RECORD;
BEGIN
  _role := public.parse_signup_role(NEW.raw_user_meta_data ->> 'role');
  _phone := regexp_replace(COALESCE(NEW.raw_user_meta_data ->> 'phone', ''), '[^0-9]', '', 'g');
  IF length(_phone) > 10 THEN
    _phone := right(_phone, 10);
  END IF;

  INSERT INTO public.profiles (id, full_name, phone)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''),
    _phone
  );

  INSERT INTO public.wallets (user_id, balance, total_recharged)
  VALUES (NEW.id, 500, 500);

  INSERT INTO public.wallet_transactions (user_id, type, amount, description, balance_after)
  VALUES (NEW.id, 'credit', 500, 'Welcome bonus', 500);

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, _role);

  -- Link pre-approved partner application (same email) → promote to DSA
  SELECT * INTO _pa
  FROM public.partner_applications
  WHERE lower(email) = lower(NEW.email)
    AND status = 'approved'
    AND generated_dsa_id IS NOT NULL
  ORDER BY reviewed_at DESC NULLS LAST
  LIMIT 1;

  IF FOUND THEN
    UPDATE public.profiles
       SET dsa_id = _pa.generated_dsa_id,
           kyc_status = 'approved',
           kyc_approved_at = COALESCE(kyc_approved_at, now()),
           full_name = COALESCE(NULLIF(trim(full_name), ''), _pa.full_name),
           phone = COALESCE(NULLIF(_phone, ''), _pa.phone),
           city = COALESCE(city, _pa.city),
           company_name = COALESCE(company_name, _pa.company_name),
           updated_at = now()
     WHERE id = NEW.id;

    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'dsa')
    ON CONFLICT DO NOTHING;

    DELETE FROM public.user_roles
    WHERE user_id = NEW.id AND role = 'customer';

    UPDATE public.partner_applications
       SET user_id = NEW.id, updated_at = now()
     WHERE id = _pa.id;
  END IF;

  RETURN NEW;
END;
$$;

-- Approve partner: also link existing auth user by email when user_id was null
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

  _existing_user := _app.user_id;
  IF _existing_user IS NULL THEN
    SELECT id INTO _existing_user FROM auth.users WHERE lower(email) = lower(_app.email) LIMIT 1;
  END IF;

  IF _existing_user IS NOT NULL THEN
    UPDATE public.profiles
       SET dsa_id = _new_dsa_id,
           kyc_status = 'approved',
           kyc_approved_at = now(),
           full_name = COALESCE(full_name, _app.full_name),
           phone = COALESCE(phone, _app.phone),
           city = COALESCE(city, _app.city),
           company_name = COALESCE(company_name, _app.company_name),
           updated_at = now()
     WHERE id = _existing_user;

    INSERT INTO public.user_roles(user_id, role)
      VALUES (_existing_user, 'dsa') ON CONFLICT DO NOTHING;

    DELETE FROM public.user_roles
    WHERE user_id = _existing_user AND role = 'customer';

    UPDATE public.partner_applications
       SET user_id = _existing_user
     WHERE id = _application_id;
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
    user_id = COALESCE(user_id, _existing_user),
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
    'application_id', _application_id,
    'user_linked', _existing_user IS NOT NULL
  );
END;
$function$;

-- One-time: link already-approved partners to existing auth users by email
UPDATE public.partner_applications pa
SET user_id = u.id, updated_at = now()
FROM auth.users u
WHERE pa.user_id IS NULL
  AND pa.status = 'approved'
  AND lower(pa.email) = lower(u.email);

UPDATE public.profiles p
SET dsa_id = pa.generated_dsa_id,
    kyc_status = 'approved',
    kyc_approved_at = COALESCE(p.kyc_approved_at, now()),
    updated_at = now()
FROM public.partner_applications pa
WHERE pa.user_id = p.id
  AND pa.status = 'approved'
  AND pa.generated_dsa_id IS NOT NULL
  AND (p.dsa_id IS NULL OR p.dsa_id = '');

INSERT INTO public.user_roles (user_id, role)
SELECT DISTINCT pa.user_id, 'dsa'::app_role
FROM public.partner_applications pa
WHERE pa.status = 'approved' AND pa.user_id IS NOT NULL
ON CONFLICT DO NOTHING;

DELETE FROM public.user_roles ur
USING public.partner_applications pa
WHERE pa.user_id = ur.user_id
  AND pa.status = 'approved'
  AND pa.generated_dsa_id IS NOT NULL
  AND ur.role = 'customer';
