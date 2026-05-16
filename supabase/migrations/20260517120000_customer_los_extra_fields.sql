-- Optional product-specific fields for loan requirements (safe additive)
ALTER TABLE public.customer_loan_requirements
  ADD COLUMN IF NOT EXISTS extra_fields JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.customer_loan_requirements
  ADD COLUMN IF NOT EXISTS roi_percent NUMERIC;
