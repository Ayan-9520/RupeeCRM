
-- Tighten public INSERT: only allow safe initial state
DROP POLICY IF EXISTS "Anyone can submit application" ON public.partner_applications;
CREATE POLICY "Anyone can submit application"
  ON public.partner_applications FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    status = 'pending'
    AND reviewed_by IS NULL
    AND reviewed_at IS NULL
    AND generated_dsa_id IS NULL
    AND workspace_id IS NULL
  );

-- Replace admin FOR ALL on storage with explicit per-command policies
DROP POLICY IF EXISTS "Admins view all KYC docs" ON storage.objects;

CREATE POLICY "Admins read KYC docs"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'kyc-documents' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins delete KYC docs"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'kyc-documents' AND has_role(auth.uid(), 'admin'::app_role));
