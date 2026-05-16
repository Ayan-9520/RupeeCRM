-- Phase 2: Eligibility engine + financial analysis (safe additive)

CREATE TABLE IF NOT EXISTS public.customer_financial_summary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_profile_id UUID NOT NULL REFERENCES public.customer_profiles(id) ON DELETE CASCADE,
  lead_purchase_id UUID NOT NULL REFERENCES public.lead_purchases(id) ON DELETE CASCADE,
  dsa_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  gross_income NUMERIC,
  net_income NUMERIC,
  household_income NUMERIC,
  co_applicant_income NUMERIC,
  business_turnover NUMERIC,
  annual_income NUMERIC,
  total_emi NUMERIC,
  credit_card_emi NUMERIC,
  od_cc_obligations NUMERIC,
  other_obligations NUMERIC,
  avg_balance NUMERIC,
  salary_credit_stable BOOLEAN NOT NULL DEFAULT false,
  emi_bounce_count INTEGER NOT NULL DEFAULT 0,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (customer_profile_id)
);

CREATE TABLE IF NOT EXISTS public.customer_risk_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_profile_id UUID NOT NULL REFERENCES public.customer_profiles(id) ON DELETE CASCADE,
  lead_purchase_id UUID NOT NULL REFERENCES public.lead_purchases(id) ON DELETE CASCADE,
  dsa_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cibil_score INTEGER,
  risk_grade TEXT,
  banking_stability TEXT,
  foir_health TEXT,
  eligibility_status TEXT NOT NULL DEFAULT 'moderate',
  workflow_stage TEXT NOT NULL DEFAULT 'profile_completed',
  validation_issues JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (customer_profile_id)
);

CREATE TABLE IF NOT EXISTS public.customer_eligibility_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_profile_id UUID NOT NULL REFERENCES public.customer_profiles(id) ON DELETE CASCADE,
  lead_purchase_id UUID NOT NULL REFERENCES public.lead_purchases(id) ON DELETE CASCADE,
  dsa_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  primary_product_type TEXT,
  foir_percent NUMERIC,
  dbr_percent NUMERIC,
  emi_income_ratio NUMERIC,
  eligible_emi NUMERIC,
  eligible_amount NUMERIC,
  estimated_roi NUMERIC,
  recommended_tenure INTEGER,
  ltv_percent NUMERIC,
  approval_probability NUMERIC,
  product_calculations JSONB NOT NULL DEFAULT '{}'::jsonb,
  lender_recommendations JSONB NOT NULL DEFAULT '[]'::jsonb,
  snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (customer_profile_id)
);

CREATE INDEX IF NOT EXISTS idx_customer_financial_summary_purchase ON public.customer_financial_summary(lead_purchase_id);
CREATE INDEX IF NOT EXISTS idx_customer_risk_profiles_purchase ON public.customer_risk_profiles(lead_purchase_id);
CREATE INDEX IF NOT EXISTS idx_customer_eligibility_reports_purchase ON public.customer_eligibility_reports(lead_purchase_id);

DROP TRIGGER IF EXISTS customer_financial_summary_updated_at ON public.customer_financial_summary;
CREATE TRIGGER customer_financial_summary_updated_at
  BEFORE UPDATE ON public.customer_financial_summary FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS customer_risk_profiles_updated_at ON public.customer_risk_profiles;
CREATE TRIGGER customer_risk_profiles_updated_at
  BEFORE UPDATE ON public.customer_risk_profiles FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS customer_eligibility_reports_updated_at ON public.customer_eligibility_reports;
CREATE TRIGGER customer_eligibility_reports_updated_at
  BEFORE UPDATE ON public.customer_eligibility_reports FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.customer_financial_summary ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_risk_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_eligibility_reports ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['customer_financial_summary', 'customer_risk_profiles', 'customer_eligibility_reports']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "%s_select" ON public.%I', t, t);
    EXECUTE format('CREATE POLICY "%s_select" ON public.%I FOR SELECT TO authenticated USING (public.user_owns_lead_purchase(lead_purchase_id))', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "%s_insert" ON public.%I', t, t);
    EXECUTE format('CREATE POLICY "%s_insert" ON public.%I FOR INSERT TO authenticated WITH CHECK (public.user_owns_lead_purchase(lead_purchase_id) AND dsa_id = auth.uid())', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "%s_update" ON public.%I', t, t);
    EXECUTE format('CREATE POLICY "%s_update" ON public.%I FOR UPDATE TO authenticated USING (public.user_owns_lead_purchase(lead_purchase_id)) WITH CHECK (public.user_owns_lead_purchase(lead_purchase_id))', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "%s_delete" ON public.%I', t, t);
    EXECUTE format('CREATE POLICY "%s_delete" ON public.%I FOR DELETE TO authenticated USING (public.user_owns_lead_purchase(lead_purchase_id))', t, t);
  END LOOP;
END $$;
