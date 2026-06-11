-- Phase 5: Disbursals, payouts, audit logs (safe additive)

-- ---------------------------------------------------------------------------
-- customer_disbursals
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.customer_disbursals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_profile_id UUID NOT NULL REFERENCES public.customer_profiles(id) ON DELETE CASCADE,
  lead_purchase_id UUID NOT NULL REFERENCES public.lead_purchases(id) ON DELETE CASCADE,
  lender_case_id UUID REFERENCES public.customer_lender_cases(id) ON DELETE SET NULL,
  dsa_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  disbursal_status TEXT NOT NULL DEFAULT 'pending',
  sanctioned_amount NUMERIC,
  disbursed_amount NUMERIC,
  net_disbursal NUMERIC,
  roi NUMERIC,
  tenure INTEGER,
  emi NUMERIC,
  processing_fee NUMERIC,
  insurance_amount NUMERIC,
  deductions NUMERIC,
  payout_expected NUMERIC,
  payout_received NUMERIC,
  payout_pending NUMERIC,
  payout_status TEXT DEFAULT 'expected',
  disbursal_date DATE,
  utr_number TEXT,
  credited_bank_name TEXT,
  credited_account_number TEXT,
  credited_ifsc TEXT,
  first_emi_date DATE,
  disbursal_notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_customer_disbursals_purchase ON public.customer_disbursals(lead_purchase_id);
CREATE INDEX IF NOT EXISTS idx_customer_disbursals_lender ON public.customer_disbursals(lender_case_id);

-- ---------------------------------------------------------------------------
-- customer_payouts
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.customer_payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_profile_id UUID NOT NULL REFERENCES public.customer_profiles(id) ON DELETE CASCADE,
  lead_purchase_id UUID NOT NULL REFERENCES public.lead_purchases(id) ON DELETE CASCADE,
  lender_case_id UUID REFERENCES public.customer_lender_cases(id) ON DELETE SET NULL,
  dsa_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  payout_amount NUMERIC,
  payout_type TEXT DEFAULT 'commission',
  payout_status TEXT NOT NULL DEFAULT 'expected',
  expected_date DATE,
  received_date DATE,
  payout_reference TEXT,
  payout_notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_customer_payouts_purchase ON public.customer_payouts(lead_purchase_id);

-- ---------------------------------------------------------------------------
-- customer_audit_logs
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.customer_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_profile_id UUID NOT NULL REFERENCES public.customer_profiles(id) ON DELETE CASCADE,
  lead_purchase_id UUID NOT NULL REFERENCES public.lead_purchases(id) ON DELETE CASCADE,
  dsa_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL,
  section_name TEXT,
  field_name TEXT,
  old_value TEXT,
  new_value TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  action_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_customer_audit_logs_purchase ON public.customer_audit_logs(lead_purchase_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_customer_audit_logs_section ON public.customer_audit_logs(section_name);

-- updated_at triggers
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['customer_disbursals', 'customer_payouts']
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I_updated_at ON public.%I', t, t);
    EXECUTE format(
      'CREATE TRIGGER %I_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column()',
      t, t
    );
  END LOOP;
END $$;

-- RLS
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['customer_disbursals', 'customer_payouts', 'customer_audit_logs']
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
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
