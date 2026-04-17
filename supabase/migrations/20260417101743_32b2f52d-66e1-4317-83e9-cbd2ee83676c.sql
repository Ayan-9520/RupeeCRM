-- Add structured fields to leads
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS state TEXT,
  ADD COLUMN IF NOT EXISTS alternate_phone TEXT,
  ADD COLUMN IF NOT EXISTS employment_type TEXT,
  ADD COLUMN IF NOT EXISTS company_name TEXT,
  ADD COLUMN IF NOT EXISTS cibil_score INTEGER,
  ADD COLUMN IF NOT EXISTS age INTEGER,
  ADD COLUMN IF NOT EXISTS gender TEXT,
  ADD COLUMN IF NOT EXISTS sum_insured NUMERIC,
  ADD COLUMN IF NOT EXISTS family_members INTEGER,
  ADD COLUMN IF NOT EXISTS card_type TEXT,
  ADD COLUMN IF NOT EXISTS campaign_name TEXT,
  ADD COLUMN IF NOT EXISTS assigned_to UUID,
  ADD COLUMN IF NOT EXISTS follow_up_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS next_call_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS remarks TEXT,
  ADD COLUMN IF NOT EXISTS internal_notes TEXT,
  ADD COLUMN IF NOT EXISTS sale_available BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS created_by UUID;

CREATE INDEX IF NOT EXISTS idx_leads_full_phone ON public.leads(full_phone);
CREATE INDEX IF NOT EXISTS idx_leads_follow_up_date ON public.leads(follow_up_date);
CREATE INDEX IF NOT EXISTS idx_leads_assigned_to ON public.leads(assigned_to);

-- updated_at trigger
DROP TRIGGER IF EXISTS leads_updated_at ON public.leads;
CREATE TRIGGER leads_updated_at
  BEFORE UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-score by income brackets (loans / cards) and amount (insurance / investment)
CREATE OR REPLACE FUNCTION public.auto_score_lead()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  _income NUMERIC;
BEGIN
  -- Auto-score only if creator didn't override
  IF NEW.score IS NULL OR NEW.score = 'warm' THEN
    IF NEW.product_category IN ('loan','credit_card') THEN
      _income := COALESCE(NEW.monthly_income, 0);
      IF _income >= 100000 THEN NEW.score := 'hot';
      ELSIF _income >= 50000 THEN NEW.score := 'warm';
      ELSE NEW.score := 'cold';
      END IF;
    ELSIF NEW.product_category = 'insurance' THEN
      IF COALESCE(NEW.sum_insured, 0) >= 1000000 THEN NEW.score := 'hot';
      ELSIF COALESCE(NEW.sum_insured, 0) >= 300000 THEN NEW.score := 'warm';
      ELSE NEW.score := 'cold';
      END IF;
    ELSIF NEW.product_category = 'investment' THEN
      IF NEW.loan_amount >= 500000 THEN NEW.score := 'hot';
      ELSIF NEW.loan_amount >= 100000 THEN NEW.score := 'warm';
      ELSE NEW.score := 'cold';
      END IF;
    END IF;
  END IF;

  -- Auto follow-up if blank: hot=1d, warm=3d, cold=7d
  IF NEW.follow_up_date IS NULL THEN
    NEW.follow_up_date := now() + (
      CASE NEW.score WHEN 'hot' THEN INTERVAL '1 day'
                     WHEN 'warm' THEN INTERVAL '3 days'
                     ELSE INTERVAL '7 days' END
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS leads_auto_score ON public.leads;
CREATE TRIGGER leads_auto_score
  BEFORE INSERT ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.auto_score_lead();

-- Block duplicate phone within last 30 days
CREATE OR REPLACE FUNCTION public.block_duplicate_lead()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  _exists INTEGER;
BEGIN
  SELECT COUNT(*) INTO _exists FROM public.leads
   WHERE full_phone = NEW.full_phone
     AND created_at > now() - INTERVAL '30 days'
     AND id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);
  IF _exists > 0 THEN
    RAISE EXCEPTION 'DUPLICATE_LEAD: A lead with this phone number was already added in the last 30 days.'
      USING ERRCODE = 'unique_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS leads_block_duplicate ON public.leads;
CREATE TRIGGER leads_block_duplicate
  BEFORE INSERT ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.block_duplicate_lead();