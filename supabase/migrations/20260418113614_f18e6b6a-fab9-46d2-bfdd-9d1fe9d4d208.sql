-- 1. Rewards redemption log
CREATE TABLE public.rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  points_used INTEGER NOT NULL,
  reward_amount NUMERIC NOT NULL,
  wallet_txn_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.rewards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own rewards" ON public.rewards FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins view all rewards" ON public.rewards FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- 2. Daily login tracking
CREATE TABLE public.daily_logins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  login_date DATE NOT NULL DEFAULT CURRENT_DATE,
  points_awarded INTEGER NOT NULL DEFAULT 10,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, login_date)
);
ALTER TABLE public.daily_logins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own logins" ON public.daily_logins FOR SELECT USING (auth.uid() = user_id);

-- 3. Claim daily login points (idempotent per day)
CREATE OR REPLACE FUNCTION public.claim_daily_login_points()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _user UUID := auth.uid();
  _existing INTEGER;
  _new_total INTEGER;
  _streak INTEGER;
BEGIN
  IF _user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT COUNT(*) INTO _existing FROM public.daily_logins
    WHERE user_id = _user AND login_date = CURRENT_DATE;
  IF _existing > 0 THEN
    SELECT total_points INTO _new_total FROM public.user_points WHERE user_id = _user;
    RETURN jsonb_build_object('success', true, 'already_claimed', true, 'total_points', COALESCE(_new_total, 0));
  END IF;

  INSERT INTO public.daily_logins(user_id) VALUES (_user);

  INSERT INTO public.user_points(user_id, total_points)
    VALUES (_user, 10)
    ON CONFLICT (user_id) DO UPDATE
      SET total_points = public.user_points.total_points + 10,
          updated_at = now();

  SELECT total_points INTO _new_total FROM public.user_points WHERE user_id = _user;

  -- Compute streak (consecutive days)
  SELECT COUNT(*) INTO _streak FROM (
    SELECT login_date FROM public.daily_logins
     WHERE user_id = _user
       AND login_date > CURRENT_DATE - INTERVAL '30 days'
     ORDER BY login_date DESC
  ) t;

  RETURN jsonb_build_object('success', true, 'awarded', 10, 'total_points', _new_total, 'streak', _streak);
END; $$;

-- 4. Redeem points for wallet bonus
CREATE OR REPLACE FUNCTION public.redeem_points_for_bonus(_points INTEGER)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _user UUID := auth.uid();
  _bonus NUMERIC;
  _current INTEGER;
  _new_balance NUMERIC;
  _txn_id UUID;
  _reward_id UUID;
BEGIN
  IF _user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  -- Mapping: 500=>100, 1000=>300, 5000=>2000
  _bonus := CASE _points
    WHEN 500 THEN 100
    WHEN 1000 THEN 300
    WHEN 5000 THEN 2000
    ELSE 0
  END;
  IF _bonus = 0 THEN RAISE EXCEPTION 'Invalid redemption tier (use 500, 1000, or 5000 points)'; END IF;

  SELECT total_points INTO _current FROM public.user_points WHERE user_id = _user;
  IF COALESCE(_current, 0) < _points THEN
    RAISE EXCEPTION 'Insufficient points. You have % pts.', COALESCE(_current, 0);
  END IF;

  -- Deduct points
  UPDATE public.user_points
     SET total_points = total_points - _points, updated_at = now()
   WHERE user_id = _user;

  -- Credit wallet
  UPDATE public.wallets
     SET balance = balance + _bonus,
         total_recharged = total_recharged + _bonus,
         updated_at = now()
   WHERE user_id = _user
   RETURNING balance INTO _new_balance;

  IF _new_balance IS NULL THEN
    INSERT INTO public.wallets(user_id, balance, total_recharged)
      VALUES (_user, _bonus, _bonus)
      RETURNING balance INTO _new_balance;
  END IF;

  -- Log txn
  INSERT INTO public.wallet_transactions(user_id, type, amount, description, balance_after)
    VALUES (_user, 'credit', _bonus, '🎁 Reward bonus: ' || _points || ' pts redeemed', _new_balance)
    RETURNING id INTO _txn_id;

  -- Log reward
  INSERT INTO public.rewards(user_id, points_used, reward_amount, wallet_txn_id)
    VALUES (_user, _points, _bonus, _txn_id)
    RETURNING id INTO _reward_id;

  PERFORM public.notify(_user, 'system', '🎁 Reward redeemed!',
    '₹' || _bonus || ' bonus added to your wallet for ' || _points || ' pts.',
    '/dashboard/wallet');

  RETURN jsonb_build_object('success', true, 'reward_id', _reward_id,
    'bonus_credited', _bonus, 'new_balance', _new_balance,
    'remaining_points', _current - _points);
END; $$;

-- 5. Leaderboard function (supports both ranking modes)
CREATE OR REPLACE FUNCTION public.get_leaderboard(_basis TEXT DEFAULT 'points', _limit INTEGER DEFAULT 50)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _result JSONB;
BEGIN
  IF _basis = 'earnings' THEN
    SELECT jsonb_agg(row_to_json(t)) INTO _result FROM (
      SELECT
        p.id AS user_id,
        COALESCE(p.full_name, 'Partner') AS name,
        p.dsa_id,
        p.dsa_tier,
        p.avatar_url,
        p.city,
        COALESCE(up.total_points, 0) AS points,
        COALESCE(up.badges, ARRAY[]::TEXT[]) AS badges,
        COALESCE(public.user_paid_commission(p.id), 0) AS earnings,
        ROW_NUMBER() OVER (ORDER BY public.user_paid_commission(p.id) DESC NULLS LAST) AS rank
      FROM public.profiles p
      LEFT JOIN public.user_points up ON up.user_id = p.id
      WHERE p.dsa_id IS NOT NULL
      ORDER BY earnings DESC
      LIMIT _limit
    ) t;
  ELSE
    SELECT jsonb_agg(row_to_json(t)) INTO _result FROM (
      SELECT
        p.id AS user_id,
        COALESCE(p.full_name, 'Partner') AS name,
        p.dsa_id,
        p.dsa_tier,
        p.avatar_url,
        p.city,
        COALESCE(up.total_points, 0) AS points,
        COALESCE(up.badges, ARRAY[]::TEXT[]) AS badges,
        COALESCE(public.user_paid_commission(p.id), 0) AS earnings,
        ROW_NUMBER() OVER (ORDER BY COALESCE(up.total_points, 0) DESC) AS rank
      FROM public.profiles p
      LEFT JOIN public.user_points up ON up.user_id = p.id
      WHERE COALESCE(up.total_points, 0) > 0 OR p.dsa_id IS NOT NULL
      ORDER BY points DESC
      LIMIT _limit
    ) t;
  END IF;
  RETURN COALESCE(_result, '[]'::jsonb);
END; $$;