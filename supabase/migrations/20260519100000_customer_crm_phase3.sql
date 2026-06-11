-- Phase 3: Documents, bank logins, timeline, followups, tasks (safe additive)

-- ---------------------------------------------------------------------------
-- customer_documents
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.customer_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_profile_id UUID NOT NULL REFERENCES public.customer_profiles(id) ON DELETE CASCADE,
  lead_purchase_id UUID NOT NULL REFERENCES public.lead_purchases(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  dsa_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category TEXT NOT NULL DEFAULT 'kyc',
  doc_slug TEXT NOT NULL,
  doc_label TEXT NOT NULL,
  file_name TEXT,
  file_url TEXT,
  storage_path TEXT,
  file_size INTEGER,
  mime_type TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  verification_notes TEXT,
  comments TEXT,
  uploaded_by UUID REFERENCES auth.users(id),
  verified_by UUID REFERENCES auth.users(id),
  verified_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (lead_purchase_id, doc_slug)
);

CREATE INDEX IF NOT EXISTS idx_customer_documents_purchase ON public.customer_documents(lead_purchase_id);
CREATE INDEX IF NOT EXISTS idx_customer_documents_profile ON public.customer_documents(customer_profile_id);

-- ---------------------------------------------------------------------------
-- customer_bank_logins
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.customer_bank_logins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_profile_id UUID NOT NULL REFERENCES public.customer_profiles(id) ON DELETE CASCADE,
  lead_purchase_id UUID NOT NULL REFERENCES public.lead_purchases(id) ON DELETE CASCADE,
  dsa_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bank_name TEXT,
  product TEXT,
  login_date DATE,
  login_amount NUMERIC,
  roi_percent NUMERIC,
  tenure_months INTEGER,
  banker_name TEXT,
  banker_mobile TEXT,
  branch TEXT,
  login_status TEXT NOT NULL DEFAULT 'draft',
  sanction_amount NUMERIC,
  approved_amount NUMERIC,
  rejection_reason TEXT,
  processing_fees NUMERIC,
  disbursal_status TEXT,
  expected_disbursal_date DATE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_customer_bank_logins_purchase ON public.customer_bank_logins(lead_purchase_id);

-- ---------------------------------------------------------------------------
-- customer_timeline
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.customer_timeline (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_profile_id UUID NOT NULL REFERENCES public.customer_profiles(id) ON DELETE CASCADE,
  lead_purchase_id UUID NOT NULL REFERENCES public.lead_purchases(id) ON DELETE CASCADE,
  dsa_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL DEFAULT 'note',
  title TEXT,
  body TEXT NOT NULL DEFAULT '',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_customer_timeline_purchase ON public.customer_timeline(lead_purchase_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- customer_followups
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.customer_followups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_profile_id UUID NOT NULL REFERENCES public.customer_profiles(id) ON DELETE CASCADE,
  lead_purchase_id UUID NOT NULL REFERENCES public.lead_purchases(id) ON DELETE CASCADE,
  dsa_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  followup_date DATE,
  followup_time TIME,
  priority TEXT NOT NULL DEFAULT 'medium',
  assigned_user_id UUID REFERENCES auth.users(id),
  discussion_notes TEXT,
  outcome TEXT,
  next_action TEXT,
  completed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_customer_followups_purchase ON public.customer_followups(lead_purchase_id);

-- ---------------------------------------------------------------------------
-- customer_tasks
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.customer_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_profile_id UUID NOT NULL REFERENCES public.customer_profiles(id) ON DELETE CASCADE,
  lead_purchase_id UUID NOT NULL REFERENCES public.lead_purchases(id) ON DELETE CASCADE,
  dsa_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  due_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'open',
  assigned_user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_customer_tasks_purchase ON public.customer_tasks(lead_purchase_id);

-- updated_at triggers
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'customer_documents',
    'customer_bank_logins',
    'customer_followups',
    'customer_tasks'
  ]
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
  FOREACH t IN ARRAY ARRAY[
    'customer_documents',
    'customer_bank_logins',
    'customer_timeline',
    'customer_followups',
    'customer_tasks'
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

-- Expand legacy case_documents doc_type (optional — map new slugs to 'other' if insert fails)
ALTER TABLE public.case_documents DROP CONSTRAINT IF EXISTS case_documents_doc_type_check;

-- Storage: allow DSA to manage files under own folder (existing bucket case-documents)
DROP POLICY IF EXISTS "DSA updates own case docs" ON storage.objects;
CREATE POLICY "DSA updates own case docs"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'case-documents' AND auth.uid()::text = (storage.foldername(name))[1]);
