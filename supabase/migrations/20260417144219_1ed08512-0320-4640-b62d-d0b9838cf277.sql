
-- Product images table (curated + AI-generated)
CREATE TABLE public.product_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product marketing_product NOT NULL DEFAULT 'generic',
  image_url TEXT NOT NULL,
  prompt TEXT,
  source TEXT NOT NULL DEFAULT 'ai', -- 'ai' | 'upload' | 'curated'
  tags TEXT[] NOT NULL DEFAULT '{}',
  display_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_product_images_product ON public.product_images(product, is_active, display_order);

ALTER TABLE public.product_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authed reads active images"
  ON public.product_images FOR SELECT
  TO authenticated
  USING (is_active = true OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins manage product images"
  ON public.product_images FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_product_images_updated_at
  BEFORE UPDATE ON public.product_images
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Storage bucket for marketing images
INSERT INTO storage.buckets (id, name, public)
VALUES ('marketing-images', 'marketing-images', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read marketing images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'marketing-images');

CREATE POLICY "Authed users upload marketing images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'marketing-images');

CREATE POLICY "Admins update marketing images"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'marketing-images' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins delete marketing images"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'marketing-images' AND has_role(auth.uid(), 'admin'::app_role));
