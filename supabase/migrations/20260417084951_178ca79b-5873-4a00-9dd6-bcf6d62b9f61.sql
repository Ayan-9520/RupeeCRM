-- 1) Product category enum
DO $$ BEGIN
  CREATE TYPE public.product_category AS ENUM ('loan', 'insurance', 'credit_card', 'investment');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2) New columns on leads (nullable / defaulted so existing rows stay valid)
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS product_category public.product_category NOT NULL DEFAULT 'loan',
  ADD COLUMN IF NOT EXISTS product_subtype TEXT,
  ADD COLUMN IF NOT EXISTS product_details JSONB NOT NULL DEFAULT '{}'::jsonb;

-- 3) Backfill from existing loan_type
UPDATE public.leads SET
  product_category = CASE
    WHEN loan_type = 'credit_card' THEN 'credit_card'::public.product_category
    WHEN loan_type = 'insurance' THEN 'insurance'::public.product_category
    WHEN loan_type = 'mutual_fund' THEN 'investment'::public.product_category
    ELSE 'loan'::public.product_category
  END,
  product_subtype = COALESCE(product_subtype, loan_type::text);

-- 4) Helpful index for filtering on Leadboard
CREATE INDEX IF NOT EXISTS leads_product_category_status_idx
  ON public.leads (product_category, status);
CREATE INDEX IF NOT EXISTS leads_product_subtype_idx
  ON public.leads (product_subtype);