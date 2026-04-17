DROP POLICY IF EXISTS "Authenticated read product types" ON public.product_types;
CREATE POLICY "Public read product types"
ON public.product_types
FOR SELECT
TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS "Authenticated read pipelines" ON public.product_pipelines;
CREATE POLICY "Public read pipelines"
ON public.product_pipelines
FOR SELECT
TO anon, authenticated
USING (true);