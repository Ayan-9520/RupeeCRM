-- Add CRM fields to lead_purchases
ALTER TABLE public.lead_purchases
  ADD COLUMN IF NOT EXISTS notes jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS next_followup_at timestamptz,
  ADD COLUMN IF NOT EXISTS converted boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS deal_value numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Allow the buyer (DSA) to update their own purchase: stage, notes, follow-up, converted
CREATE POLICY "DSA updates own purchases"
ON public.lead_purchases
FOR UPDATE
TO authenticated
USING (auth.uid() = dsa_id)
WITH CHECK (auth.uid() = dsa_id);

-- Keep updated_at fresh
CREATE TRIGGER lead_purchases_set_updated_at
BEFORE UPDATE ON public.lead_purchases
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();