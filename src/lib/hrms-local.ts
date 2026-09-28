/** Soft HRMS persistence (browser) until dedicated APIs land. */

export type AttStatus = "P" | "A" | "L" | "";

function monthKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function attStorageKey(scope: string, month?: string) {
  return `rd_hrms_att_${scope}_${month || monthKey()}`;
}

function leaveStorageKey(scope: string) {
  return `rd_hrms_leave_${scope}`;
}

function payslipStorageKey(scope: string) {
  return `rd_hrms_payslips_${scope}`;
}

export function loadAttendance(
  scope: string,
  month?: string,
): Record<string, Record<string, AttStatus>> {
  try {
    const raw = localStorage.getItem(attStorageKey(scope, month));
    return raw ? (JSON.parse(raw) as Record<string, Record<string, AttStatus>>) : {};
  } catch {
    return {};
  }
}

export function saveAttendance(
  scope: string,
  data: Record<string, Record<string, AttStatus>>,
  month?: string,
) {
  localStorage.setItem(attStorageKey(scope, month), JSON.stringify(data));
}

export type LeaveRow = {
  id: string;
  user_id: string;
  name: string;
  from: string;
  to: string;
  reason: string;
  status: "pending" | "approved" | "rejected";
  created_at: string;
};

export function loadLeaves(scope: string): LeaveRow[] {
  try {
    const raw = localStorage.getItem(leaveStorageKey(scope));
    return raw ? (JSON.parse(raw) as LeaveRow[]) : [];
  } catch {
    return [];
  }
}

export function saveLeaves(scope: string, rows: LeaveRow[]) {
  localStorage.setItem(leaveStorageKey(scope), JSON.stringify(rows));
}

export type PayslipRow = {
  id: string;
  user_id: string;
  name: string;
  month: string;
  basic: number;
  allowances: number;
  deductions: number;
  net: number;
  created_at: string;
};

export function loadPayslips(scope: string): PayslipRow[] {
  try {
    const raw = localStorage.getItem(payslipStorageKey(scope));
    return raw ? (JSON.parse(raw) as PayslipRow[]) : [];
  } catch {
    return [];
  }
}

export function savePayslips(scope: string, rows: PayslipRow[]) {
  localStorage.setItem(payslipStorageKey(scope), JSON.stringify(rows));
}

export { monthKey };
