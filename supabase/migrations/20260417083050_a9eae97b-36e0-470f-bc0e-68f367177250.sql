-- Enums
CREATE TYPE public.employee_status AS ENUM ('active', 'on_leave', 'terminated');
CREATE TYPE public.attendance_status AS ENUM ('present', 'absent', 'half_day', 'leave', 'holiday', 'weekend');
CREATE TYPE public.payslip_status AS ENUM ('draft', 'processed', 'paid');

-- Employees
CREATE TABLE public.employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id UUID,
  employee_code TEXT NOT NULL,
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  department TEXT,
  designation TEXT,
  reports_to UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  join_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status employee_status NOT NULL DEFAULT 'active',
  ctc NUMERIC NOT NULL DEFAULT 0,
  pan TEXT,
  bank_account TEXT,
  ifsc TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, employee_code)
);
CREATE INDEX idx_employees_workspace ON public.employees(workspace_id);
CREATE INDEX idx_employees_reports_to ON public.employees(reports_to);

-- Attendance
CREATE TABLE public.attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  status attendance_status NOT NULL DEFAULT 'present',
  check_in TIME,
  check_out TIME,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (employee_id, date)
);
CREATE INDEX idx_attendance_employee_date ON public.attendance(employee_id, date);
CREATE INDEX idx_attendance_workspace_date ON public.attendance(workspace_id, date);

-- Salary structure (versioned)
CREATE TABLE public.salary_structures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  basic NUMERIC NOT NULL DEFAULT 0,
  hra NUMERIC NOT NULL DEFAULT 0,
  conveyance NUMERIC NOT NULL DEFAULT 0,
  medical NUMERIC NOT NULL DEFAULT 0,
  special_allowance NUMERIC NOT NULL DEFAULT 0,
  pf NUMERIC NOT NULL DEFAULT 0,
  professional_tax NUMERIC NOT NULL DEFAULT 0,
  tds NUMERIC NOT NULL DEFAULT 0,
  other_deductions NUMERIC NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_salary_employee ON public.salary_structures(employee_id, is_active);

-- Payslips
CREATE TABLE public.payslips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  period_month INTEGER NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  period_year INTEGER NOT NULL CHECK (period_year BETWEEN 2000 AND 2100),
  working_days INTEGER NOT NULL DEFAULT 0,
  paid_days NUMERIC NOT NULL DEFAULT 0,
  earnings JSONB NOT NULL DEFAULT '{}'::jsonb,
  deductions JSONB NOT NULL DEFAULT '{}'::jsonb,
  gross NUMERIC NOT NULL DEFAULT 0,
  total_deductions NUMERIC NOT NULL DEFAULT 0,
  net_pay NUMERIC NOT NULL DEFAULT 0,
  status payslip_status NOT NULL DEFAULT 'draft',
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  paid_at TIMESTAMPTZ,
  UNIQUE (employee_id, period_month, period_year)
);
CREATE INDEX idx_payslips_workspace_period ON public.payslips(workspace_id, period_year, period_month);

-- updated_at triggers
CREATE TRIGGER trg_employees_updated_at
BEFORE UPDATE ON public.employees
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Helper: check if user is employee in workspace (for self-view)
CREATE OR REPLACE FUNCTION public.is_workspace_employee(_workspace_id UUID, _user_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.employees WHERE workspace_id = _workspace_id AND user_id = _user_id)
$$;

-- Enable RLS
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.salary_structures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payslips ENABLE ROW LEVEL SECURITY;

-- EMPLOYEES policies
CREATE POLICY "Members view employees in workspace"
ON public.employees FOR SELECT TO authenticated
USING (public.is_workspace_member(workspace_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Owners/admins/managers create employees"
ON public.employees FOR INSERT TO authenticated
WITH CHECK (public.has_workspace_role(workspace_id, auth.uid(), ARRAY['owner','admin','manager']::workspace_role[]) OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Owners/admins/managers update employees"
ON public.employees FOR UPDATE TO authenticated
USING (public.has_workspace_role(workspace_id, auth.uid(), ARRAY['owner','admin','manager']::workspace_role[]) OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Owners/admins delete employees"
ON public.employees FOR DELETE TO authenticated
USING (public.has_workspace_role(workspace_id, auth.uid(), ARRAY['owner','admin']::workspace_role[]) OR public.has_role(auth.uid(), 'admin'));

-- ATTENDANCE policies
CREATE POLICY "Members view attendance in workspace"
ON public.attendance FOR SELECT TO authenticated
USING (public.is_workspace_member(workspace_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Managers manage attendance"
ON public.attendance FOR ALL TO authenticated
USING (public.has_workspace_role(workspace_id, auth.uid(), ARRAY['owner','admin','manager']::workspace_role[]) OR public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_workspace_role(workspace_id, auth.uid(), ARRAY['owner','admin','manager']::workspace_role[]) OR public.has_role(auth.uid(), 'admin'));

-- SALARY policies (sensitive: only admins/owners/managers; employees see their own)
CREATE POLICY "Owners/admins/managers view all salaries"
ON public.salary_structures FOR SELECT TO authenticated
USING (
  public.has_workspace_role(workspace_id, auth.uid(), ARRAY['owner','admin','manager']::workspace_role[])
  OR public.has_role(auth.uid(), 'admin')
  OR EXISTS (SELECT 1 FROM public.employees e WHERE e.id = employee_id AND e.user_id = auth.uid())
);

CREATE POLICY "Owners/admins/managers manage salaries"
ON public.salary_structures FOR ALL TO authenticated
USING (public.has_workspace_role(workspace_id, auth.uid(), ARRAY['owner','admin','manager']::workspace_role[]) OR public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_workspace_role(workspace_id, auth.uid(), ARRAY['owner','admin','manager']::workspace_role[]) OR public.has_role(auth.uid(), 'admin'));

-- PAYSLIPS policies
CREATE POLICY "Owners/admins/managers view all payslips"
ON public.payslips FOR SELECT TO authenticated
USING (
  public.has_workspace_role(workspace_id, auth.uid(), ARRAY['owner','admin','manager']::workspace_role[])
  OR public.has_role(auth.uid(), 'admin')
  OR EXISTS (SELECT 1 FROM public.employees e WHERE e.id = employee_id AND e.user_id = auth.uid())
);

CREATE POLICY "Owners/admins/managers manage payslips"
ON public.payslips FOR ALL TO authenticated
USING (public.has_workspace_role(workspace_id, auth.uid(), ARRAY['owner','admin','manager']::workspace_role[]) OR public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_workspace_role(workspace_id, auth.uid(), ARRAY['owner','admin','manager']::workspace_role[]) OR public.has_role(auth.uid(), 'admin'));

-- Payroll processing function: generates draft payslips for all active employees in a workspace for a given month
CREATE OR REPLACE FUNCTION public.process_payroll(_workspace_id UUID, _month INTEGER, _year INTEGER)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _user UUID := auth.uid();
  _emp RECORD;
  _sal RECORD;
  _gross NUMERIC; _ded NUMERIC; _net NUMERIC;
  _present_days INTEGER; _working_days INTEGER := 30;
  _earnings JSONB; _deductions JSONB;
  _count INTEGER := 0;
BEGIN
  IF _user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT (public.has_workspace_role(_workspace_id, _user, ARRAY['owner','admin','manager']::workspace_role[]) OR public.has_role(_user, 'admin')) THEN
    RAISE EXCEPTION 'Insufficient permissions';
  END IF;

  FOR _emp IN SELECT * FROM public.employees WHERE workspace_id = _workspace_id AND status = 'active' LOOP
    SELECT * INTO _sal FROM public.salary_structures
      WHERE employee_id = _emp.id AND is_active = true
      ORDER BY effective_from DESC LIMIT 1;
    IF NOT FOUND THEN CONTINUE; END IF;

    SELECT COUNT(*) INTO _present_days FROM public.attendance
      WHERE employee_id = _emp.id
        AND EXTRACT(MONTH FROM date) = _month
        AND EXTRACT(YEAR FROM date) = _year
        AND status IN ('present','half_day','holiday','weekend');
    IF _present_days = 0 THEN _present_days := _working_days; END IF;

    _earnings := jsonb_build_object(
      'basic', _sal.basic, 'hra', _sal.hra, 'conveyance', _sal.conveyance,
      'medical', _sal.medical, 'special_allowance', _sal.special_allowance
    );
    _deductions := jsonb_build_object(
      'pf', _sal.pf, 'professional_tax', _sal.professional_tax,
      'tds', _sal.tds, 'other', _sal.other_deductions
    );
    _gross := _sal.basic + _sal.hra + _sal.conveyance + _sal.medical + _sal.special_allowance;
    _ded := _sal.pf + _sal.professional_tax + _sal.tds + _sal.other_deductions;
    _gross := ROUND(_gross * (_present_days::NUMERIC / _working_days), 2);
    _net := _gross - _ded;

    INSERT INTO public.payslips (workspace_id, employee_id, period_month, period_year, working_days, paid_days, earnings, deductions, gross, total_deductions, net_pay, status)
    VALUES (_workspace_id, _emp.id, _month, _year, _working_days, _present_days, _earnings, _deductions, _gross, _ded, _net, 'processed')
    ON CONFLICT (employee_id, period_month, period_year) DO UPDATE
      SET working_days = EXCLUDED.working_days, paid_days = EXCLUDED.paid_days,
          earnings = EXCLUDED.earnings, deductions = EXCLUDED.deductions,
          gross = EXCLUDED.gross, total_deductions = EXCLUDED.total_deductions,
          net_pay = EXCLUDED.net_pay, status = 'processed', generated_at = now();
    _count := _count + 1;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'count', _count, 'period', _month::text || '/' || _year::text);
END; $$;