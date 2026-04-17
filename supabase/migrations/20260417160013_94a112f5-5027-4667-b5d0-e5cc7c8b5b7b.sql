CREATE OR REPLACE FUNCTION public.dsa_tier_from_score(_score INTEGER)
RETURNS TEXT LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE
    WHEN _score >= 800 THEN 'diamond'
    WHEN _score >= 600 THEN 'platinum'
    WHEN _score >= 400 THEN 'gold'
    WHEN _score >= 200 THEN 'silver'
    ELSE 'bronze'
  END;
$$;

CREATE OR REPLACE FUNCTION public.payout_sla_days(_tier TEXT)
RETURNS INTEGER LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE _tier
    WHEN 'diamond' THEN 0
    WHEN 'platinum' THEN 1
    WHEN 'gold' THEN 3
    WHEN 'silver' THEN 5
    ELSE 7
  END;
$$;