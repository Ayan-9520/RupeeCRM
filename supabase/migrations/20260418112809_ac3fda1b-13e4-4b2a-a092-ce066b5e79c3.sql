-- ===================================================================
-- COMMUNITY POSTS + TRAINING COURSES
-- ===================================================================

-- Community post categories
DO $$ BEGIN
  CREATE TYPE public.community_post_category AS ENUM (
    'success_story', 'tip', 'motivation', 'sales_hack', 'question', 'announcement'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ============= community_posts =============
CREATE TABLE IF NOT EXISTS public.community_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  category public.community_post_category NOT NULL DEFAULT 'tip',
  tags text[] NOT NULL DEFAULT '{}',
  image_url text,
  likes_count integer NOT NULL DEFAULT 0,
  comments_count integer NOT NULL DEFAULT 0,
  pinned boolean NOT NULL DEFAULT false,
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.community_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authed can read posts"
  ON public.community_posts FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authors can insert own posts"
  ON public.community_posts FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Authors can update own posts"
  ON public.community_posts FOR UPDATE TO authenticated
  USING (auth.uid() = author_id OR public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (auth.uid() = author_id OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins delete posts"
  ON public.community_posts FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR auth.uid() = author_id);

-- ============= community_post_likes =============
CREATE TABLE IF NOT EXISTS public.community_post_likes (
  post_id uuid NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);

ALTER TABLE public.community_post_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authed can read likes"
  ON public.community_post_likes FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users like posts"
  ON public.community_post_likes FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users unlike own"
  ON public.community_post_likes FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- ============= community_post_comments =============
CREATE TABLE IF NOT EXISTS public.community_post_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
  author_id uuid NOT NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.community_post_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authed can read comments"
  ON public.community_post_comments FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authed can comment"
  ON public.community_post_comments FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Authors delete own comments"
  ON public.community_post_comments FOR DELETE TO authenticated
  USING (auth.uid() = author_id OR public.has_role(auth.uid(), 'admin'::app_role));

-- Trigger: keep counts in sync
CREATE OR REPLACE FUNCTION public.bump_post_likes_count()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.community_posts SET likes_count = likes_count + 1 WHERE id = NEW.post_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.community_posts SET likes_count = GREATEST(0, likes_count - 1) WHERE id = OLD.post_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_post_likes_count ON public.community_post_likes;
CREATE TRIGGER trg_post_likes_count
AFTER INSERT OR DELETE ON public.community_post_likes
FOR EACH ROW EXECUTE FUNCTION public.bump_post_likes_count();

CREATE OR REPLACE FUNCTION public.bump_post_comments_count()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.community_posts SET comments_count = comments_count + 1 WHERE id = NEW.post_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.community_posts SET comments_count = GREATEST(0, comments_count - 1) WHERE id = OLD.post_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_post_comments_count ON public.community_post_comments;
CREATE TRIGGER trg_post_comments_count
AFTER INSERT OR DELETE ON public.community_post_comments
FOR EACH ROW EXECUTE FUNCTION public.bump_post_comments_count();

-- ============= training_courses =============
CREATE TABLE IF NOT EXISTS public.training_courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  description text,
  category text NOT NULL DEFAULT 'general',
  thumbnail_url text,
  video_url text,
  duration_minutes integer NOT NULL DEFAULT 0,
  difficulty text NOT NULL DEFAULT 'beginner',
  modules jsonb NOT NULL DEFAULT '[]'::jsonb,
  tags text[] NOT NULL DEFAULT '{}',
  enabled boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.training_courses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authed reads enabled courses"
  ON public.training_courses FOR SELECT TO authenticated
  USING (enabled = true OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins manage courses"
  ON public.training_courses FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- ============= training_progress =============
CREATE TABLE IF NOT EXISTS public.training_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  course_id uuid NOT NULL REFERENCES public.training_courses(id) ON DELETE CASCADE,
  progress_percent integer NOT NULL DEFAULT 0 CHECK (progress_percent BETWEEN 0 AND 100),
  completed_modules text[] NOT NULL DEFAULT '{}',
  completed_at timestamptz,
  last_watched_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, course_id)
);

ALTER TABLE public.training_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own progress"
  ON public.training_progress FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users upsert own progress"
  ON public.training_progress FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own progress"
  ON public.training_progress FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_community_posts_created ON public.community_posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_community_posts_category ON public.community_posts(category);
CREATE INDEX IF NOT EXISTS idx_training_courses_order ON public.training_courses(display_order);
CREATE INDEX IF NOT EXISTS idx_training_progress_user ON public.training_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_leads_source ON public.leads(source);