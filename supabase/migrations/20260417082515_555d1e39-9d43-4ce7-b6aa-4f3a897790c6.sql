CREATE OR REPLACE FUNCTION public.plan_seat_limit(_plan workspace_plan)
RETURNS INTEGER LANGUAGE SQL IMMUTABLE SET search_path = public AS $$
  SELECT CASE _plan
    WHEN 'starter' THEN 1
    WHEN 'growth' THEN 3
    WHEN 'pro' THEN 10
    WHEN 'enterprise' THEN 9999
  END
$$;