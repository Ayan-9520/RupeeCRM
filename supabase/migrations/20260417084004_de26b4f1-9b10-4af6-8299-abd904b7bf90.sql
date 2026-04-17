-- Add HRMS add-on toggle and pricing config to workspaces
ALTER TABLE public.workspaces
  ADD COLUMN IF NOT EXISTS hrms_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS hrms_price_per_employee NUMERIC NOT NULL DEFAULT 99;

-- Helper to compute current HRMS bill for a workspace
CREATE OR REPLACE FUNCTION public.hrms_monthly_bill(_workspace_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _ws RECORD;
  _count INTEGER;
  _total NUMERIC;
BEGIN
  SELECT hrms_enabled, hrms_price_per_employee INTO _ws
  FROM public.workspaces WHERE id = _workspace_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('enabled', false, 'employees', 0, 'price_per_employee', 0, 'total', 0);
  END IF;

  SELECT COUNT(*) INTO _count
  FROM public.employees
  WHERE workspace_id = _workspace_id AND status = 'active';

  _total := CASE WHEN _ws.hrms_enabled THEN _count * _ws.hrms_price_per_employee ELSE 0 END;

  RETURN jsonb_build_object(
    'enabled', _ws.hrms_enabled,
    'employees', _count,
    'price_per_employee', _ws.hrms_price_per_employee,
    'total', _total
  );
END;
$$;