-- ============== TABLES ==============

CREATE TABLE public.course_quizzes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_slug TEXT NOT NULL UNIQUE,
  course_title TEXT NOT NULL,
  pass_percent INTEGER NOT NULL DEFAULT 70,
  total_points INTEGER NOT NULL DEFAULT 100,
  badge TEXT,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.quiz_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id UUID NOT NULL REFERENCES public.course_quizzes(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  options JSONB NOT NULL,
  correct_index INTEGER NOT NULL,
  explanation TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_quiz_questions_quiz ON public.quiz_questions(quiz_id, display_order);

CREATE TABLE public.quiz_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  quiz_id UUID NOT NULL REFERENCES public.course_quizzes(id) ON DELETE CASCADE,
  course_slug TEXT NOT NULL,
  answers JSONB NOT NULL DEFAULT '[]'::jsonb,
  correct_count INTEGER NOT NULL DEFAULT 0,
  total_count INTEGER NOT NULL DEFAULT 0,
  score_percent INTEGER NOT NULL DEFAULT 0,
  passed BOOLEAN NOT NULL DEFAULT false,
  points_awarded INTEGER NOT NULL DEFAULT 0,
  certificate_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_quiz_attempts_user ON public.quiz_attempts(user_id, created_at DESC);

CREATE TABLE public.certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  course_slug TEXT NOT NULL,
  course_title TEXT NOT NULL,
  certificate_no TEXT NOT NULL UNIQUE,
  score_percent INTEGER NOT NULL,
  badge TEXT,
  pdf_url TEXT,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, course_slug)
);
CREATE INDEX idx_certificates_user ON public.certificates(user_id, issued_at DESC);

CREATE TABLE public.user_points (
  user_id UUID PRIMARY KEY,
  total_points INTEGER NOT NULL DEFAULT 0,
  level TEXT NOT NULL DEFAULT 'beginner',
  badges TEXT[] NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============== TRIGGERS ==============
CREATE TRIGGER trg_course_quizzes_updated
BEFORE UPDATE ON public.course_quizzes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============== RLS ==============
ALTER TABLE public.course_quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_points ENABLE ROW LEVEL SECURITY;

-- course_quizzes
CREATE POLICY "Authed read enabled quizzes" ON public.course_quizzes
  FOR SELECT TO authenticated USING (enabled = true OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage quizzes" ON public.course_quizzes
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- quiz_questions: authed users can read questions of enabled quizzes (correct_index is OK to expose
-- because grading happens server-side via submit_quiz; UI just renders options)
CREATE POLICY "Authed read questions" ON public.quiz_questions
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.course_quizzes q WHERE q.id = quiz_id AND (q.enabled = true OR public.has_role(auth.uid(), 'admin')))
  );
CREATE POLICY "Admins manage questions" ON public.quiz_questions
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- quiz_attempts
CREATE POLICY "Users view own attempts" ON public.quiz_attempts
  FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users insert own attempts" ON public.quiz_attempts
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- certificates
CREATE POLICY "Users view own certificates" ON public.certificates
  FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users insert own certificates" ON public.certificates
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own certificate pdf" ON public.certificates
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- user_points
CREATE POLICY "Users view own points" ON public.user_points
  FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Public read leaderboard points" ON public.user_points
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage points" ON public.user_points
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============== submit_quiz FUNCTION ==============
CREATE OR REPLACE FUNCTION public.submit_quiz(
  _course_slug TEXT,
  _answers JSONB  -- array of integers, length = number of questions, in display_order
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user UUID := auth.uid();
  _quiz RECORD;
  _q RECORD;
  _idx INTEGER := 0;
  _correct INTEGER := 0;
  _total INTEGER := 0;
  _score INTEGER;
  _passed BOOLEAN;
  _attempt_id UUID;
  _cert_id UUID := NULL;
  _cert_no TEXT;
  _points INTEGER := 0;
  _existing_cert UUID;
  _new_total INTEGER;
  _new_level TEXT;
  _user_phone TEXT;
BEGIN
  IF _user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO _quiz FROM public.course_quizzes
    WHERE course_slug = _course_slug AND enabled = true;
  IF NOT FOUND THEN RAISE EXCEPTION 'Quiz not found for this course'; END IF;

  -- Grade
  FOR _q IN
    SELECT correct_index FROM public.quiz_questions
    WHERE quiz_id = _quiz.id
    ORDER BY display_order, created_at
  LOOP
    _total := _total + 1;
    IF (_answers ->> _idx)::INTEGER = _q.correct_index THEN
      _correct := _correct + 1;
    END IF;
    _idx := _idx + 1;
  END LOOP;

  IF _total = 0 THEN RAISE EXCEPTION 'Quiz has no questions yet'; END IF;
  _score := ROUND((_correct::NUMERIC / _total) * 100);
  _passed := _score >= _quiz.pass_percent;

  IF _passed THEN
    _points := _quiz.total_points;
  END IF;

  -- Insert attempt
  INSERT INTO public.quiz_attempts(user_id, quiz_id, course_slug, answers, correct_count, total_count, score_percent, passed, points_awarded)
  VALUES (_user, _quiz.id, _course_slug, _answers, _correct, _total, _score, _passed, _points)
  RETURNING id INTO _attempt_id;

  IF _passed THEN
    -- Issue certificate (only if not already issued)
    SELECT id INTO _existing_cert FROM public.certificates
      WHERE user_id = _user AND course_slug = _course_slug;

    IF _existing_cert IS NULL THEN
      _cert_no := 'RD-' || upper(substring(replace(_course_slug,'-','') from 1 for 4)) || '-' ||
                  to_char(now(), 'YYMMDD') || '-' ||
                  upper(substring(md5(random()::text || _user::text) from 1 for 6));
      INSERT INTO public.certificates(user_id, course_slug, course_title, certificate_no, score_percent, badge)
      VALUES (_user, _course_slug, _quiz.course_title, _cert_no, _score, _quiz.badge)
      RETURNING id INTO _cert_id;
    ELSE
      _cert_id := _existing_cert;
    END IF;

    -- Update user_points (award only on first pass — points already awarded check via existing cert)
    INSERT INTO public.user_points(user_id, total_points, badges)
    VALUES (_user, _points, CASE WHEN _quiz.badge IS NOT NULL THEN ARRAY[_quiz.badge] ELSE ARRAY[]::TEXT[] END)
    ON CONFLICT (user_id) DO UPDATE
      SET total_points = public.user_points.total_points +
            CASE WHEN _existing_cert IS NULL THEN _points ELSE 0 END,
          badges = CASE
            WHEN _quiz.badge IS NOT NULL AND NOT (_quiz.badge = ANY(public.user_points.badges))
              THEN array_append(public.user_points.badges, _quiz.badge)
            ELSE public.user_points.badges
          END,
          updated_at = now();

    -- Update level
    SELECT total_points INTO _new_total FROM public.user_points WHERE user_id = _user;
    _new_level := CASE
      WHEN _new_total >= 2000 THEN 'expert'
      WHEN _new_total >= 500 THEN 'pro'
      ELSE 'beginner'
    END;
    UPDATE public.user_points SET level = _new_level WHERE user_id = _user;

    -- Bump reputation score
    UPDATE public.profiles
      SET reputation_score = LEAST(1000, reputation_score + 25),
          dsa_tier = public.dsa_tier_from_score(LEAST(1000, reputation_score + 25)),
          updated_at = now()
      WHERE id = _user;

    -- Link cert to attempt
    UPDATE public.quiz_attempts SET certificate_id = _cert_id WHERE id = _attempt_id;

    -- Notification
    PERFORM public.notify(
      _user, 'course_completed',
      '🎓 Certificate earned: ' || _quiz.course_title,
      'You scored ' || _score || '%. Download your certificate from the academy.',
      '/dashboard/learn'
    );

    -- WhatsApp follow-up: if user has a wa conversation, schedule a celebratory template send
    SELECT phone INTO _user_phone FROM public.profiles WHERE id = _user;
    IF _user_phone IS NOT NULL AND length(_user_phone) >= 10 THEN
      INSERT INTO public.whatsapp_conversations(wa_phone, contact_name, current_step, last_message_preview, last_outbound_at, assigned_to)
      VALUES (
        _user_phone,
        (SELECT full_name FROM public.profiles WHERE id = _user),
        'certified',
        '🎓 Certified in ' || _quiz.course_title,
        now(),
        _user
      )
      ON CONFLICT (wa_phone) DO UPDATE
        SET last_outbound_at = now(),
            last_message_preview = '🎓 Certified in ' || _quiz.course_title,
            current_step = 'certified';

      INSERT INTO public.whatsapp_followups(conversation_id, template_name, send_at, status)
      SELECT id, 'course_completed_celebration', now(), 'scheduled'
      FROM public.whatsapp_conversations WHERE wa_phone = _user_phone;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'passed', _passed,
    'score_percent', _score,
    'correct', _correct,
    'total', _total,
    'points_awarded', _points,
    'certificate_id', _cert_id,
    'attempt_id', _attempt_id
  );
END;
$$;

-- Need unique constraint on whatsapp_conversations.wa_phone for ON CONFLICT
CREATE UNIQUE INDEX IF NOT EXISTS uniq_wa_conversations_phone ON public.whatsapp_conversations(wa_phone);
