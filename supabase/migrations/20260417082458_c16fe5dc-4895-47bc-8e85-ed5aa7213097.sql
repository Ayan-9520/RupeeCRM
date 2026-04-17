-- Function to derive seat limit from plan
CREATE OR REPLACE FUNCTION public.plan_seat_limit(_plan workspace_plan)
RETURNS INTEGER LANGUAGE SQL IMMUTABLE AS $$
  SELECT CASE _plan
    WHEN 'starter' THEN 1
    WHEN 'growth' THEN 3
    WHEN 'pro' THEN 10
    WHEN 'enterprise' THEN 9999
  END
$$;

-- Trigger: keep seat_limit in sync with plan
CREATE OR REPLACE FUNCTION public.sync_workspace_seat_limit()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.seat_limit := public.plan_seat_limit(NEW.plan);
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS workspace_sync_seat_limit ON public.workspaces;
CREATE TRIGGER workspace_sync_seat_limit
BEFORE INSERT OR UPDATE OF plan ON public.workspaces
FOR EACH ROW EXECUTE FUNCTION public.sync_workspace_seat_limit();

-- Trigger: enforce seat limit on member insert
CREATE OR REPLACE FUNCTION public.enforce_workspace_seat_limit()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
DECLARE _limit INTEGER; _count INTEGER;
BEGIN
  SELECT seat_limit INTO _limit FROM public.workspaces WHERE id = NEW.workspace_id;
  SELECT COUNT(*) INTO _count FROM public.workspace_members WHERE workspace_id = NEW.workspace_id;
  IF _count >= _limit THEN
    RAISE EXCEPTION 'SEAT_LIMIT_REACHED: This workspace has reached its seat limit (%). Upgrade your plan to add more members.', _limit
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS workspace_members_seat_check ON public.workspace_members;
CREATE TRIGGER workspace_members_seat_check
BEFORE INSERT ON public.workspace_members
FOR EACH ROW EXECUTE FUNCTION public.enforce_workspace_seat_limit();

-- Backfill existing workspaces
UPDATE public.workspaces SET seat_limit = public.plan_seat_limit(plan);