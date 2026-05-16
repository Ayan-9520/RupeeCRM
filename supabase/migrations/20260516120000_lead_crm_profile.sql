-- Purchased-lead CRM: extended profile + safe buyer updates on leads
-- Run via Supabase CLI or SQL editor. Does not alter existing columns.

ALTER TABLE public.lead_purchases
  ADD COLUMN IF NOT EXISTS crm_profile jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.lead_purchases.crm_profile IS
  'DSA-editable CRM: banking, KYC, banker processing (JSON object)';

-- Purchasers may update leads they bought; trigger below locks marketplace columns.
DROP POLICY IF EXISTS "DSA updates purchased leads" ON public.leads;
CREATE POLICY "DSA updates purchased leads"
ON public.leads
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.lead_purchases lp
    WHERE lp.lead_id = leads.id AND lp.dsa_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.lead_purchases lp
    WHERE lp.lead_id = leads.id AND lp.dsa_id = auth.uid()
  )
);

CREATE OR REPLACE FUNCTION public.protect_lead_buyer_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.lead_purchases lp
    WHERE lp.lead_id = NEW.id AND lp.dsa_id = auth.uid()
  ) THEN
    RETURN NEW;
  END IF;
  NEW.status := OLD.status;
  NEW.price := OLD.price;
  NEW.masked_phone := OLD.masked_phone;
  NEW.is_marketplace := OLD.is_marketplace;
  NEW.workspace_id := OLD.workspace_id;
  NEW.ref_dsa_id := OLD.ref_dsa_id;
  NEW.created_by := OLD.created_by;
  NEW.sale_available := OLD.sale_available;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_lead_buyer_update ON public.leads;
CREATE TRIGGER trg_protect_lead_buyer_update
  BEFORE UPDATE ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_lead_buyer_update();
