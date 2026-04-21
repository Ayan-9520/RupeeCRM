-- ============================================================
-- HRMS: Leaves + Hierarchy (additive)
-- ============================================================

-- 1. Hierarchy grade enum
DO $$ BEGIN
  CREATE TYPE public.employee_grade AS ENUM ('NSM','RSM','ASM','SM','RM','RO','MGR','EXEC');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS grade public.employee_grade;

-- 2. Leave status / type enums
DO $$ BEGIN
  CREATE TYPE public.leave_status AS ENUM ('pending','approved','rejected','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Add 'leave' / 'on_leave' attendance value if missing
DO $$ BEGIN
  ALTER TYPE public.attendance_status ADD VALUE IF NOT EXISTS 'on_leave';
EXCEPTION WHEN others THEN NULL; END $$;

-- 3. leave_types
CREATE TABLE IF NOT EXISTS public.leave_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  default_annual_quota NUMERIC(5,1) NOT NULL DEFAULT 0,
  is_paid BOOLEAN NOT NULL DEFAULT true,
  color TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, code)
);

ALTER TABLE public.leave_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace members read leave types"
  ON public.leave_types FOR SELECT TO authenticated
  USING (workspace_id IS NULL OR is_workspace_member(workspace_id, auth.uid()) OR has_role(auth.uid(),'admin'::app_role));

CREATE POLICY "Owners/admins manage leave types"
  ON public.leave_types FOR ALL TO authenticated
  USING (
    workspace_id IS NULL AND has_role(auth.uid(),'admin'::app_role)
    OR (workspace_id IS NOT NULL AND has_workspace_role(workspace_id, auth.uid(), ARRAY['owner'::workspace_role,'admin'::workspace_role]))
    OR has_role(auth.uid(),'admin'::app_role)
  )
  WITH CHECK (
    workspace_id IS NULL AND has_role(auth.uid(),'admin'::app_role)
    OR (workspace_id IS NOT NULL AND has_workspace_role(workspace_id, auth.uid(), ARRAY['owner'::workspace_role,'admin'::workspace_role]))
    OR has_role(auth.uid(),'admin'::app_role)
  );

CREATE TRIGGER trg_leave_types_updated_at
  BEFORE UPDATE ON public.leave_types
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed global defaults (workspace_id NULL = template)
INSERT INTO public.leave_types (workspace_id, code, name, default_annual_quota, is_paid, color)
VALUES
  (NULL,'ANNUAL','Annual Leave',12,true,'#22c55e'),
  (NULL,'SICK','Sick Leave',8,true,'#ef4444'),
  (NULL,'CASUAL','Casual Leave',6,true,'#3b82f6'),
  (NULL,'UNPAID','Unpaid Leave',0,false,'#64748b')
ON CONFLICT DO NOTHING;

-- 4. leave_balances
CREATE TABLE IF NOT EXISTS public.leave_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  leave_type_code TEXT NOT NULL,
  year INTEGER NOT NULL,
  allocated NUMERIC(5,1) NOT NULL DEFAULT 0,
  used NUMERIC(5,1) NOT NULL DEFAULT 0,
  carried_forward NUMERIC(5,1) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (employee_id, leave_type_code, year)
);

ALTER TABLE public.leave_balances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view balances in workspace"
  ON public.leave_balances FOR SELECT TO authenticated
  USING (
    is_workspace_member(workspace_id, auth.uid())
    OR has_role(auth.uid(),'admin'::app_role)
    OR EXISTS (SELECT 1 FROM employees e WHERE e.id = leave_balances.employee_id AND e.user_id = auth.uid())
  );

CREATE POLICY "Owners/admins/managers manage balances"
  ON public.leave_balances FOR ALL TO authenticated
  USING (has_workspace_role(workspace_id, auth.uid(), ARRAY['owner'::workspace_role,'admin'::workspace_role,'manager'::workspace_role]) OR has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (has_workspace_role(workspace_id, auth.uid(), ARRAY['owner'::workspace_role,'admin'::workspace_role,'manager'::workspace_role]) OR has_role(auth.uid(),'admin'::app_role));

CREATE TRIGGER trg_leave_balances_updated_at
  BEFORE UPDATE ON public.leave_balances
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. leaves
CREATE TABLE IF NOT EXISTS public.leaves (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  user_id UUID,
  leave_type_code TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  days NUMERIC(5,1) NOT NULL,
  reason TEXT,
  status public.leave_status NOT NULL DEFAULT 'pending',
  approver_id UUID,
  decision_notes TEXT,
  decided_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_leaves_employee ON public.leaves(employee_id);
CREATE INDEX IF NOT EXISTS idx_leaves_workspace ON public.leaves(workspace_id);
CREATE INDEX IF NOT EXISTS idx_leaves_status ON public.leaves(status);

ALTER TABLE public.leaves ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view leaves in workspace"
  ON public.leaves FOR SELECT TO authenticated
  USING (
    is_workspace_member(workspace_id, auth.uid())
    OR has_role(auth.uid(),'admin'::app_role)
    OR auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM employees e WHERE e.id = leaves.employee_id AND e.user_id = auth.uid())
  );

CREATE POLICY "Employees create own leave"
  ON public.leaves FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (SELECT 1 FROM employees e WHERE e.id = leaves.employee_id AND e.user_id = auth.uid() AND e.workspace_id = leaves.workspace_id)
  );

CREATE POLICY "Employees cancel own pending leave"
  ON public.leaves FOR UPDATE TO authenticated
  USING (auth.uid() = user_id AND status = 'pending')
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Owners/admins/managers approve leaves"
  ON public.leaves FOR UPDATE TO authenticated
  USING (has_workspace_role(workspace_id, auth.uid(), ARRAY['owner'::workspace_role,'admin'::workspace_role,'manager'::workspace_role]) OR has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (has_workspace_role(workspace_id, auth.uid(), ARRAY['owner'::workspace_role,'admin'::workspace_role,'manager'::workspace_role]) OR has_role(auth.uid(),'admin'::app_role));

CREATE TRIGGER trg_leaves_updated_at
  BEFORE UPDATE ON public.leaves
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 6. RPC: approve_leave
CREATE OR REPLACE FUNCTION public.approve_leave(_leave_id UUID, _notes TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_leave   RECORD;
  v_year    INTEGER;
  d         DATE;
BEGIN
  SELECT * INTO v_leave FROM leaves WHERE id = _leave_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Leave not found'; END IF;
  IF v_leave.status <> 'pending' THEN
    RAISE EXCEPTION 'Leave already %', v_leave.status;
  END IF;

  IF NOT (
    has_workspace_role(v_leave.workspace_id, auth.uid(), ARRAY['owner'::workspace_role,'admin'::workspace_role,'manager'::workspace_role])
    OR has_role(auth.uid(),'admin'::app_role)
  ) THEN
    RAISE EXCEPTION 'Not authorised to approve';
  END IF;

  v_year := EXTRACT(YEAR FROM v_leave.start_date)::INT;

  -- Ensure balance row exists
  INSERT INTO leave_balances (workspace_id, employee_id, leave_type_code, year, allocated)
  SELECT v_leave.workspace_id, v_leave.employee_id, v_leave.leave_type_code, v_year,
         COALESCE((SELECT default_annual_quota FROM leave_types WHERE code = v_leave.leave_type_code AND (workspace_id = v_leave.workspace_id OR workspace_id IS NULL) ORDER BY workspace_id NULLS LAST LIMIT 1), 0)
  ON CONFLICT (employee_id, leave_type_code, year) DO NOTHING;

  -- Deduct balance
  UPDATE leave_balances
     SET used = used + v_leave.days, updated_at = now()
   WHERE employee_id = v_leave.employee_id
     AND leave_type_code = v_leave.leave_type_code
     AND year = v_year;

  -- Mark leave approved
  UPDATE leaves
     SET status = 'approved',
         approver_id = auth.uid(),
         decided_at = now(),
         decision_notes = _notes,
         updated_at = now()
   WHERE id = _leave_id;

  -- Auto-mark attendance for each day (only if not already present)
  d := v_leave.start_date;
  WHILE d <= v_leave.end_date LOOP
    INSERT INTO attendance (workspace_id, employee_id, date, status, notes)
    VALUES (v_leave.workspace_id, v_leave.employee_id, d, 'on_leave', format('Auto: %s leave', v_leave.leave_type_code))
    ON CONFLICT DO NOTHING;
    d := d + 1;
  END LOOP;

  -- Notify employee
  IF v_leave.user_id IS NOT NULL THEN
    INSERT INTO notifications (user_id, type, title, body, link, metadata)
    VALUES (
      v_leave.user_id, 'system',
      'Leave approved',
      format('Your %s leave (%s → %s) was approved', v_leave.leave_type_code, v_leave.start_date, v_leave.end_date),
      '/dashboard/hrms/leaves',
      jsonb_build_object('leave_id', _leave_id)
    );
  END IF;

  RETURN jsonb_build_object('success', true, 'leave_id', _leave_id);
END;
$$;

-- 7. RPC: reject_leave
CREATE OR REPLACE FUNCTION public.reject_leave(_leave_id UUID, _notes TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_leave RECORD;
BEGIN
  SELECT * INTO v_leave FROM leaves WHERE id = _leave_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Leave not found'; END IF;
  IF v_leave.status <> 'pending' THEN RAISE EXCEPTION 'Leave already %', v_leave.status; END IF;

  IF NOT (
    has_workspace_role(v_leave.workspace_id, auth.uid(), ARRAY['owner'::workspace_role,'admin'::workspace_role,'manager'::workspace_role])
    OR has_role(auth.uid(),'admin'::app_role)
  ) THEN
    RAISE EXCEPTION 'Not authorised';
  END IF;

  UPDATE leaves
     SET status = 'rejected', approver_id = auth.uid(), decided_at = now(),
         decision_notes = _notes, updated_at = now()
   WHERE id = _leave_id;

  IF v_leave.user_id IS NOT NULL THEN
    INSERT INTO notifications (user_id, type, title, body, link)
    VALUES (v_leave.user_id, 'system', 'Leave rejected',
      format('Your %s leave (%s → %s) was rejected', v_leave.leave_type_code, v_leave.start_date, v_leave.end_date),
      '/dashboard/hrms/leaves');
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- 8. RPC: cancel_own_leave
CREATE OR REPLACE FUNCTION public.cancel_own_leave(_leave_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_leave RECORD;
BEGIN
  SELECT * INTO v_leave FROM leaves WHERE id = _leave_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Leave not found'; END IF;
  IF v_leave.user_id <> auth.uid() THEN RAISE EXCEPTION 'Not your leave'; END IF;
  IF v_leave.status NOT IN ('pending','approved') THEN RAISE EXCEPTION 'Cannot cancel'; END IF;

  -- If approved, refund balance
  IF v_leave.status = 'approved' THEN
    UPDATE leave_balances
       SET used = GREATEST(0, used - v_leave.days), updated_at = now()
     WHERE employee_id = v_leave.employee_id
       AND leave_type_code = v_leave.leave_type_code
       AND year = EXTRACT(YEAR FROM v_leave.start_date)::INT;

    DELETE FROM attendance
     WHERE employee_id = v_leave.employee_id
       AND date BETWEEN v_leave.start_date AND v_leave.end_date
       AND status = 'on_leave';
  END IF;

  UPDATE leaves SET status = 'cancelled', updated_at = now() WHERE id = _leave_id;
  RETURN jsonb_build_object('success', true);
END;
$$;
