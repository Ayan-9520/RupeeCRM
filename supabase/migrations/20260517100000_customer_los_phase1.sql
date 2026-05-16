-- Phase 1: Customer LOS/CRM — normalized tables (run before frontend)
-- Safe: only CREATE IF NOT EXISTS; does not alter existing leads / lead_purchases columns

-- Ownership helper for RLS
CREATE OR REPLACE FUNCTION public.user_owns_lead_purchase(_purchase_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.lead_purchases lp
    WHERE lp.id = _purchase_id
      AND (
        lp.dsa_id = auth.uid()
        OR public.has_role(auth.uid(), 'admin')
        OR (
          lp.workspace_id IS NOT NULL
          AND public.is_workspace_member(lp.workspace_id, auth.uid())
        )
      )
  );
$$;

-- ---------------------------------------------------------------------------
-- customer_profiles (1:1 per purchased lead)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.customer_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_purchase_id UUID NOT NULL UNIQUE REFERENCES public.lead_purchases(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  dsa_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE SET NULL,
  -- Personal
  full_name TEXT,
  mobile TEXT,
  alternate_mobile TEXT,
  email TEXT,
  dob DATE,
  gender TEXT,
  marital_status TEXT,
  father_name TEXT,
  mother_name TEXT,
  pan TEXT,
  aadhaar TEXT,
  education TEXT,
  residence_type TEXT,
  current_address TEXT,
  permanent_address TEXT,
  city TEXT,
  state TEXT,
  pincode TEXT,
  family_members INTEGER,
  -- Employment
  employment_type TEXT,
  company_name TEXT,
  business_name TEXT,
  designation TEXT,
  industry_type TEXT,
  monthly_income NUMERIC,
  net_salary NUMERIC,
  annual_turnover NUMERIC,
  work_experience TEXT,
  business_vintage TEXT,
  salary_mode TEXT,
  gst_number TEXT,
  itr_filed TEXT,
  office_address TEXT,
  profile_completion SMALLINT NOT NULL DEFAULT 0 CHECK (profile_completion >= 0 AND profile_completion <= 100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_customer_profiles_purchase ON public.customer_profiles(lead_purchase_id);
CREATE INDEX IF NOT EXISTS idx_customer_profiles_dsa ON public.customer_profiles(dsa_id);

-- ---------------------------------------------------------------------------
-- customer_bank_accounts
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.customer_bank_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_profile_id UUID NOT NULL REFERENCES public.customer_profiles(id) ON DELETE CASCADE,
  lead_purchase_id UUID NOT NULL REFERENCES public.lead_purchases(id) ON DELETE CASCADE,
  dsa_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bank_name TEXT,
  account_type TEXT,
  account_vintage TEXT,
  average_balance NUMERIC,
  is_salary_account BOOLEAN NOT NULL DEFAULT false,
  emi_bounce_history TEXT,
  statement_available BOOLEAN NOT NULL DEFAULT false,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_customer_bank_accounts_profile ON public.customer_bank_accounts(customer_profile_id);

-- ---------------------------------------------------------------------------
-- customer_obligations
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.customer_obligations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_profile_id UUID NOT NULL REFERENCES public.customer_profiles(id) ON DELETE CASCADE,
  lead_purchase_id UUID NOT NULL REFERENCES public.lead_purchases(id) ON DELETE CASCADE,
  dsa_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  loan_type TEXT,
  bank_name TEXT,
  emi NUMERIC,
  outstanding_amount NUMERIC,
  sanction_amount NUMERIC,
  remaining_tenure INTEGER,
  start_date DATE,
  overdue_status TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_customer_obligations_profile ON public.customer_obligations(customer_profile_id);

-- ---------------------------------------------------------------------------
-- customer_co_applicants
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.customer_co_applicants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_profile_id UUID NOT NULL REFERENCES public.customer_profiles(id) ON DELETE CASCADE,
  lead_purchase_id UUID NOT NULL REFERENCES public.lead_purchases(id) ON DELETE CASCADE,
  dsa_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  relation TEXT,
  full_name TEXT,
  mobile TEXT,
  pan TEXT,
  aadhaar TEXT,
  employment_type TEXT,
  income NUMERIC,
  obligations_summary TEXT,
  cibil_score INTEGER,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_customer_co_applicants_profile ON public.customer_co_applicants(customer_profile_id);

-- ---------------------------------------------------------------------------
-- customer_loan_requirements
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.customer_loan_requirements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_profile_id UUID NOT NULL REFERENCES public.customer_profiles(id) ON DELETE CASCADE,
  lead_purchase_id UUID NOT NULL REFERENCES public.lead_purchases(id) ON DELETE CASCADE,
  dsa_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_type TEXT,
  loan_amount NUMERIC,
  tenure_months INTEGER,
  purpose TEXT,
  property_value NUMERIC,
  has_existing_loan BOOLEAN NOT NULL DEFAULT false,
  balance_transfer BOOLEAN NOT NULL DEFAULT false,
  top_up_required BOOLEAN NOT NULL DEFAULT false,
  insurance_type TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_customer_loan_requirements_profile ON public.customer_loan_requirements(customer_profile_id);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS customer_profiles_updated_at ON public.customer_profiles;
CREATE TRIGGER customer_profiles_updated_at
  BEFORE UPDATE ON public.customer_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS customer_bank_accounts_updated_at ON public.customer_bank_accounts;
CREATE TRIGGER customer_bank_accounts_updated_at
  BEFORE UPDATE ON public.customer_bank_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS customer_obligations_updated_at ON public.customer_obligations;
CREATE TRIGGER customer_obligations_updated_at
  BEFORE UPDATE ON public.customer_obligations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS customer_co_applicants_updated_at ON public.customer_co_applicants;
CREATE TRIGGER customer_co_applicants_updated_at
  BEFORE UPDATE ON public.customer_co_applicants
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS customer_loan_requirements_updated_at ON public.customer_loan_requirements;
CREATE TRIGGER customer_loan_requirements_updated_at
  BEFORE UPDATE ON public.customer_loan_requirements
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.customer_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_obligations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_co_applicants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_loan_requirements ENABLE ROW LEVEL SECURITY;

-- customer_profiles
DROP POLICY IF EXISTS "customer_profiles_select" ON public.customer_profiles;
CREATE POLICY "customer_profiles_select" ON public.customer_profiles FOR SELECT TO authenticated
  USING (public.user_owns_lead_purchase(lead_purchase_id));

DROP POLICY IF EXISTS "customer_profiles_insert" ON public.customer_profiles;
CREATE POLICY "customer_profiles_insert" ON public.customer_profiles FOR INSERT TO authenticated
  WITH CHECK (public.user_owns_lead_purchase(lead_purchase_id) AND dsa_id = auth.uid());

DROP POLICY IF EXISTS "customer_profiles_update" ON public.customer_profiles;
CREATE POLICY "customer_profiles_update" ON public.customer_profiles FOR UPDATE TO authenticated
  USING (public.user_owns_lead_purchase(lead_purchase_id))
  WITH CHECK (public.user_owns_lead_purchase(lead_purchase_id));

DROP POLICY IF EXISTS "customer_profiles_delete" ON public.customer_profiles;
CREATE POLICY "customer_profiles_delete" ON public.customer_profiles FOR DELETE TO authenticated
  USING (public.user_owns_lead_purchase(lead_purchase_id));

-- child tables (same ownership via lead_purchase_id)
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'customer_bank_accounts',
    'customer_obligations',
    'customer_co_applicants',
    'customer_loan_requirements'
  ]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "%s_select" ON public.%I', t, t);
    EXECUTE format(
      'CREATE POLICY "%s_select" ON public.%I FOR SELECT TO authenticated USING (public.user_owns_lead_purchase(lead_purchase_id))',
      t, t
    );
    EXECUTE format('DROP POLICY IF EXISTS "%s_insert" ON public.%I', t, t);
    EXECUTE format(
      'CREATE POLICY "%s_insert" ON public.%I FOR INSERT TO authenticated WITH CHECK (public.user_owns_lead_purchase(lead_purchase_id) AND dsa_id = auth.uid())',
      t, t
    );
    EXECUTE format('DROP POLICY IF EXISTS "%s_update" ON public.%I', t, t);
    EXECUTE format(
      'CREATE POLICY "%s_update" ON public.%I FOR UPDATE TO authenticated USING (public.user_owns_lead_purchase(lead_purchase_id)) WITH CHECK (public.user_owns_lead_purchase(lead_purchase_id))',
      t, t
    );
    EXECUTE format('DROP POLICY IF EXISTS "%s_delete" ON public.%I', t, t);
    EXECUTE format(
      'CREATE POLICY "%s_delete" ON public.%I FOR DELETE TO authenticated USING (public.user_owns_lead_purchase(lead_purchase_id))',
      t, t
    );
  END LOOP;
END $$;
