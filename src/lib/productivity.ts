import type { CrmPurchase } from "@/lib/python-api";

export type ProductivityMode = "month" | "quarter" | "year";

export type ProductivityPoint = {
  label: string;
  disbursed: number;
  cases: number;
  calls: number;
  login: number;
  target: number;
  loginTarget: number;
};

function monthStart(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date: Date, count: number) {
  return new Date(date.getFullYear(), date.getMonth() + count, 1);
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(date: Date) {
  return date.toLocaleDateString("en-IN", { month: "short", year: "numeric" });
}

export function disbursedOn(row: CrmPurchase): Date | null {
  if (row.pipeline_stage !== "disbursed") return null;
  const notes = [...(row.notes || [])].reverse();
  const hit = notes.find((note) => note.kind === "stage" && /disbursed/i.test(note.text || ""));
  const iso = hit?.at || row.updated_at || row.created_at;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function disbursedAmount(row: CrmPurchase) {
  const deal = Number(row.deal_value || 0);
  if (deal > 0) return deal;
  return Number(row.lead?.loan_amount || 0);
}

export function loginOn(row: CrmPurchase): Date | null {
  const hit = (row.notes || []).find((note) => {
    if (!note.at) return false;
    if (note.kind === "disposition" && note.code === "login_sent") return true;
    return note.kind === "stage" && /bank_submitted/i.test(note.text || "");
  });
  if (hit?.at) {
    const date = new Date(hit.at);
    if (!Number.isNaN(date.getTime())) return date;
  }
  return disbursedOn(row);
}

export function productivitySeries(
  rows: CrmPurchase[],
  joinedAt: Date,
  monthlyTarget: number,
  monthlyLoginTarget: number,
  mode: ProductivityMode,
  now = new Date(),
): ProductivityPoint[] {
  const start = monthStart(joinedAt);
  const end = monthStart(now);
  if (start.getTime() > end.getTime()) return [];

  const months: { key: string; label: string; date: Date; disbursed: number; cases: number; calls: number; login: number }[] = [];
  for (let cursor = start; cursor.getTime() <= end.getTime(); cursor = addMonths(cursor, 1)) {
    months.push({ key: monthKey(cursor), label: monthLabel(cursor), date: cursor, disbursed: 0, cases: 0, calls: 0, login: 0 });
  }
  const index = new Map(months.map((month, position) => [month.key, position]));

  for (const row of rows) {
    const when = disbursedOn(row);
    if (when) {
      const slot = index.get(monthKey(when));
      if (slot !== undefined) {
        months[slot].disbursed += disbursedAmount(row);
        months[slot].cases += 1;
      }
    }
    const logged = loginOn(row);
    if (logged) {
      const slot = index.get(monthKey(logged));
      if (slot !== undefined) months[slot].login += disbursedAmount(row);
    }
    for (const note of row.notes || []) {
      if (note.kind !== "disposition" || !note.at) continue;
      const called = new Date(note.at);
      if (Number.isNaN(called.getTime())) continue;
      const slot = index.get(monthKey(called));
      if (slot !== undefined) months[slot].calls += 1;
    }
  }

  const target = Math.max(0, monthlyTarget || 0);
  const loginTarget = Math.max(0, monthlyLoginTarget || 0);
  if (mode === "month") {
    return months.map((month) => ({
      label: month.label,
      disbursed: Math.round(month.disbursed),
      cases: month.cases,
      calls: month.calls,
      login: Math.round(month.login),
      target,
      loginTarget,
    }));
  }

  const groups = new Map<string, ProductivityPoint & { months: number }>();
  for (const month of months) {
    const year = month.date.getFullYear();
    const key = mode === "quarter" ? `${year}-Q${Math.floor(month.date.getMonth() / 3) + 1}` : String(year);
    const label = mode === "quarter" ? `Q${Math.floor(month.date.getMonth() / 3) + 1} ${year}` : String(year);
    const group = groups.get(key) || { label, disbursed: 0, cases: 0, calls: 0, login: 0, target: 0, loginTarget: 0, months: 0 };
    group.disbursed += month.disbursed;
    group.cases += month.cases;
    group.calls += month.calls;
    group.login += month.login;
    group.months += 1;
    group.target = Math.round(target * group.months);
    group.loginTarget = Math.round(loginTarget * group.months);
    groups.set(key, group);
  }
  return [...groups.values()].map((group) => ({
    label: group.label,
    disbursed: Math.round(group.disbursed),
    cases: group.cases,
    calls: group.calls,
    login: Math.round(group.login),
    target: group.target,
    loginTarget: group.loginTarget,
  }));
}
