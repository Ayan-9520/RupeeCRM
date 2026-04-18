-- ============ case_documents ============
CREATE TABLE public.case_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_purchase_id UUID NOT NULL REFERENCES public.lead_purchases(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  uploaded_by UUID NOT NULL,
  doc_type TEXT NOT NULL CHECK (doc_type IN ('pan','aadhaar','bank_statement','salary_slip','itr','agreement','sanction_letter','disbursal_proof','other')),
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT,
  verified BOOLEAN NOT NULL DEFAULT false,
  verified_by UUID,
  verified_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_case_documents_purchase ON public.case_documents(lead_purchase_id);
CREATE INDEX idx_case_documents_lead ON public.case_documents(lead_id);

ALTER TABLE public.case_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage all case documents"
  ON public.case_documents FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "DSA views own case documents"
  ON public.case_documents FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.lead_purchases lp WHERE lp.id = lead_purchase_id AND lp.dsa_id = auth.uid()));

CREATE POLICY "DSA uploads own case documents"
  ON public.case_documents FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.lead_purchases lp WHERE lp.id = lead_purchase_id AND lp.dsa_id = auth.uid()) AND uploaded_by = auth.uid());

CREATE POLICY "Workspace members view case documents"
  ON public.case_documents FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.lead_purchases lp
    WHERE lp.id = lead_purchase_id
      AND lp.workspace_id IS NOT NULL
      AND public.is_workspace_member(lp.workspace_id, auth.uid())
  ));

CREATE POLICY "Lenders view assigned case documents"
  ON public.case_documents FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.disbursals d
    WHERE d.lead_purchase_id = case_documents.lead_purchase_id
      AND d.lender_id = auth.uid()
  ));

-- ============ case_status_logs ============
CREATE TABLE public.case_status_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_purchase_id UUID NOT NULL REFERENCES public.lead_purchases(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  changed_by UUID,
  from_stage TEXT,
  to_stage TEXT NOT NULL,
  notes TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_case_status_logs_purchase ON public.case_status_logs(lead_purchase_id, created_at DESC);

ALTER TABLE public.case_status_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view all status logs"
  ON public.case_status_logs FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "DSA views own status logs"
  ON public.case_status_logs FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.lead_purchases lp WHERE lp.id = lead_purchase_id AND lp.dsa_id = auth.uid()));

CREATE POLICY "Workspace members view status logs"
  ON public.case_status_logs FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.lead_purchases lp
    WHERE lp.id = lead_purchase_id
      AND lp.workspace_id IS NOT NULL
      AND public.is_workspace_member(lp.workspace_id, auth.uid())
  ));

CREATE POLICY "Lenders view assigned status logs"
  ON public.case_status_logs FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.disbursals d
    WHERE d.lead_purchase_id = case_status_logs.lead_purchase_id
      AND d.lender_id = auth.uid()
  ));

-- Auto-log pipeline stage changes
CREATE OR REPLACE FUNCTION public.log_pipeline_stage_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.case_status_logs(lead_purchase_id, lead_id, changed_by, from_stage, to_stage)
      VALUES (NEW.id, NEW.lead_id, auth.uid(), NULL, NEW.pipeline_stage);
  ELSIF TG_OP = 'UPDATE' AND OLD.pipeline_stage IS DISTINCT FROM NEW.pipeline_stage THEN
    INSERT INTO public.case_status_logs(lead_purchase_id, lead_id, changed_by, from_stage, to_stage)
      VALUES (NEW.id, NEW.lead_id, auth.uid(), OLD.pipeline_stage, NEW.pipeline_stage);
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_log_pipeline_stage ON public.lead_purchases;
CREATE TRIGGER trg_log_pipeline_stage
  AFTER INSERT OR UPDATE OF pipeline_stage ON public.lead_purchases
  FOR EACH ROW EXECUTE FUNCTION public.log_pipeline_stage_change();

-- ============ storage bucket ============
INSERT INTO storage.buckets (id, name, public)
  VALUES ('case-documents', 'case-documents', false)
  ON CONFLICT (id) DO NOTHING;

CREATE POLICY "DSA uploads own case docs"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'case-documents'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "DSA reads own case docs"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'case-documents'
    AND (
      auth.uid()::text = (storage.foldername(name))[1]
      OR public.has_role(auth.uid(), 'admin')
    )
  );

CREATE POLICY "DSA deletes own case docs"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'case-documents'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );