-- Extend product_images to support both images and videos (reels)
ALTER TABLE public.product_images 
  ADD COLUMN IF NOT EXISTS media_type text NOT NULL DEFAULT 'image' CHECK (media_type IN ('image','video')),
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS thumbnail_url text;

CREATE INDEX IF NOT EXISTS idx_product_images_product_media ON public.product_images(product, media_type, display_order);

-- Storage policies for marketing-images bucket: allow admins to upload/update/delete; public read (bucket already public).
DO $$ BEGIN
  CREATE POLICY "Admins upload marketing media"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'marketing-images' AND public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Admins update marketing media"
    ON storage.objects FOR UPDATE TO authenticated
    USING (bucket_id = 'marketing-images' AND public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Admins delete marketing media"
    ON storage.objects FOR DELETE TO authenticated
    USING (bucket_id = 'marketing-images' AND public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;