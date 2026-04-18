-- Verify lead phone after OTP success (called from public apply flow, no auth required)
CREATE OR REPLACE FUNCTION public.verify_lead_phone(_lead_id uuid, _phone text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE _lead RECORD;
BEGIN
  SELECT id, full_phone, phone_verified, quality_score
    INTO _lead FROM public.leads WHERE id = _lead_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lead not found';
  END IF;
  -- Strict match on phone to prevent random verification
  IF _lead.full_phone <> _phone THEN
    RAISE EXCEPTION 'Phone mismatch';
  END IF;
  IF _lead.phone_verified THEN
    RETURN jsonb_build_object('success', true, 'already_verified', true);
  END IF;

  UPDATE public.leads
     SET phone_verified = true,
         quality_score = LEAST(100, COALESCE(quality_score, 50) + 20),
         updated_at = now()
   WHERE id = _lead_id;

  RETURN jsonb_build_object('success', true, 'verified', true);
END;
$function$;

-- Allow anonymous (apply funnel) to call it
GRANT EXECUTE ON FUNCTION public.verify_lead_phone(uuid, text) TO anon, authenticated;