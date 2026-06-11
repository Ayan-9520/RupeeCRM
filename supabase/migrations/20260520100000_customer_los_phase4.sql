-- Phase 4: LOS workflow pipeline, lender cases, assignments, sanction (safe additive)

-- ---------------------------------------------------------------------------
-- customer_los_pipeline (1:1 per purchase)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.customer_los_pipeline (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_profile_id UUID NOT NULL REFERENCES public.customer_profiles(id) ON DELETE CASCADE,
  lead_purchase_id UUID NOT NULL REFERENCES public.lead_purchases(id) ON DELETE CASCADE,
  dsa_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  current_stage TEXT NOT NULL DEFAULT 'lead_purchased',
  case_owner_id UUID REFERENCES auth.users(id),
  assigned_rm_id UUID REFERENCES auth.users(id),
  assigned_dsa_id UUID REFERENCES auth.users(id),
  banker_name TEXT,
  banker_mobile TEXT,
  banker_email TEXT,
  priority TEXT NOT NULL DEFAULT 'medium',
  sla_target_date DATE,
  reminder_at TIMESTAMPTZ,
  last_stage_changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_stage_changed_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (customer_profile_id),
  UNIQUE (lead_purchase_id)
);

CREATE INDEX IF NOT EXISTS idx_customer_los_pipeline_stage ON public.customer_los_pipeline(current_stage);
CREATE INDEX IF NOT EXISTS idx_customer_los_pipeline_purchase ON public.customer_los_pipeline(lead_purchase_id);

-- ---------------------------------------------------------------------------
-- customer_pipeline_history
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.customer_pipeline_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_profile_id UUID NOT NULL REFERENCES public.customer_profiles(id) ON DELETE CASCADE,
  lead_purchase_id UUID NOT NULL REFERENCES public.lead_purchases(id) ON DELETE CASCADE,
  dsa_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  from_stage TEXT,
  to_stage TEXT NOT NULL,
  changed_by UUID REFERENCES auth.users(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_customer_pipeline_history_purchase ON public.customer_pipeline_history(lead_purchase_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- customer_lender_cases
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.customer_lender_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_profile_id UUID NOT NULL REFERENCES public.customer_profiles(id) ON DELETE CASCADE,
  lead_purchase_id UUID NOT NULL REFERENCES public.lead_purchases(id) ON DELETE CASCADE,
  dsa_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lender_name TEXT,
  branch TEXT,
  banker_name TEXT,
  banker_mobile TEXT,
  banker_email TEXT,
  login_date DATE,
  login_status TEXT NOT NULL DEFAULT 'draft',
  sanctioned_amount NUMERIC,
  roi NUMERIC,
  tenure INTEGER,
  processing_fee NUMERIC,
  insurance_amount NUMERIC,
  disbursed_amount NUMERIC,
  payout_expected NUMERIC,
  payout_received NUMERIC,
  payout_status TEXT DEFAULT 'pending',
  rejection_reason TEXT,
  remarks TEXT,
  is_best_offer BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_customer_lender_cases_purchase ON public.customer_lender_cases(lead_purchase_id);

-- ---------------------------------------------------------------------------
-- customer_sanction_disbursal (per lender case or standalone)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.customer_sanction_disbursal (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_profile_id UUID NOT NULL REFERENCES public.customer_profiles(id) ON DELETE CASCADE,
  lead_purchase_id UUID NOT NULL REFERENCES public.lead_purchases(id) ON DELETE CASCADE,
  lender_case_id UUID REFERENCES public.customer_lender_cases(id) ON DELETE SET NULL,
  dsa_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sanction_amount NUMERIC,
  final_roi NUMERIC,
  final_tenure INTEGER,
  emi NUMERIC,
  processing_fee NUMERIC,
  insurance_deduction NUMERIC,
  net_disbursal NUMERIC,
  disbursal_date DATE,
  utr_number TEXT,
  bank_account_credited TEXT,
  payout_expected NUMERIC,
  payout_received NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_customer_sanction_disbursal_purchase ON public.customer_sanction_disbursal(lead_purchase_id);

-- ---------------------------------------------------------------------------
-- Extend customer_tasks (Phase 3)
-- ---------------------------------------------------------------------------
ALTER TABLE public.customer_tasks ADD COLUMN IF NOT EXISTS task_type TEXT DEFAULT 'general';
ALTER TABLE public.customer_tasks ADD COLUMN IF NOT EXISTS comments JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.customer_tasks ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

-- Normalize task status values: open -> pending for new UI
-- (no destructive update; app maps both)

-- ---------------------------------------------------------------------------
-- Extend customer_followups
-- ---------------------------------------------------------------------------
ALTER TABLE public.customer_followups ADD COLUMN IF NOT EXISTS note_type TEXT DEFAULT 'call';
ALTER TABLE public.customer_followups ADD COLUMN IF NOT EXISTS channel TEXT;

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS customer_los_pipeline_updated_at ON public.customer_los_pipeline;
CREATE TRIGGER customer_los_pipeline_updated_at
  BEFORE UPDATE ON public.customer_los_pipeline FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS customer_lender_cases_updated_at ON public.customer_lender_cases;
CREATE TRIGGER customer_lender_cases_updated_at
  BEFORE UPDATE ON public.customer_lender_cases FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS customer_sanction_disbursal_updated_at ON public.customer_sanction_disbursal;
CREATE TRIGGER customer_sanction_disbursal_updated_at
  BEFORE UPDATE ON public.customer_sanction_disbursal FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'customer_los_pipeline',
    'customer_pipeline_history',
    'customer_lender_cases',
    'customer_sanction_disbursal'
  ]
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
