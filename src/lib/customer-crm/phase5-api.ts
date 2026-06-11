import { supabase } from "@/integrations/supabase/client";
import { createAuditLog } from "./audit-log";
import { calculateEmi, calculateNetDisbursal, calculatePayoutPending } from "./finance-calculators";

function missingTable(msg: string): boolean {
  return /does not exist|42P01/i.test(msg);
}

export type CustomerDisbursal = {
  id: string;
  customer_profile_id: string;
  lead_purchase_id: string;
  lender_case_id: string | null;
  dsa_id: string;
  disbursal_status: string;
  sanctioned_amount: number | null;
  disbursed_amount: number | null;
  net_disbursal: number | null;
  roi: number | null;
  tenure: number | null;
  emi: number | null;
  processing_fee: number | null;
  insurance_amount: number | null;
  deductions: number | null;
  payout_expected: number | null;
  payout_received: number | null;
  payout_pending: number | null;
  payout_status: string | null;
  disbursal_date: string | null;
  utr_number: string | null;
  credited_bank_name: string | null;
  credited_account_number: string | null;
  credited_ifsc: string | null;
  first_emi_date: string | null;
  disbursal_notes: string | null;
  created_by: string | null;
};

export type CustomerPayout = {
  id: string;
  customer_profile_id: string;
  lead_purchase_id: string;
  lender_case_id: string | null;
  dsa_id: string;
  payout_amount: number | null;
  payout_type: string;
  payout_status: string;
  expected_date: string | null;
  received_date: string | null;
  payout_reference: string | null;
  payout_notes: string | null;
  created_by: string | null;
};

export type AuditLogRow = {
  id: string;
  action_type: string;
  section_name: string | null;
  field_name: string | null;
  old_value: string | null;
  new_value: string | null;
  action_by: string | null;
  created_at: string;
};

export type CaseFinanceSummary = {
  totalSanction: number;
  totalDisbursed: number;
  totalNetDisbursal: number;
  totalPayoutExpected: number;
  totalPayoutReceived: number;
  totalPayoutPending: number;
};

export type LosReportMetrics = {
  totalLoginAmount: number;
  totalSanction: number;
  totalDisbursal: number;
  totalPayoutReceived: number;
  conversionRatio: number;
  averageRoi: number;
  rejectionRatio: number;
  pendingDocs: number;
  followupsDue: number;
  activePipelines: number;
  byLender: { name: string; sanction: number; disbursed: number }[];
  monthlyDisbursal: { month: string; amount: number }[];
  stageFunnel: { stage: string; count: number }[];
};

function enrichDisbursal(row: Partial<CustomerDisbursal>): Partial<CustomerDisbursal> {
  const sanctioned = Number(row.sanctioned_amount) || 0;
  const pf = Number(row.processing_fee) || 0;
  const ins = Number(row.insurance_amount) || 0;
  const ded = Number(row.deductions) || 0;
  const roi = Number(row.roi) || 0;
  const tenure = Number(row.tenure) || 0;
  const expected = Number(row.payout_expected) || 0;
  const received = Number(row.payout_received) || 0;
  const net = calculateNetDisbursal(sanctioned, pf, ins, ded);
  const emi = tenure > 0 && sanctioned > 0 ? calculateEmi(sanctioned, roi, tenure) : row.emi;
  return {
    ...row,
    net_disbursal: net,
    emi: emi ?? row.emi,
    payout_pending: calculatePayoutPending(expected, received),
  };
}

export async function loadDisbursals(purchaseId: string) {
  const { data, error } = await supabase
    .from("customer_disbursals")
    .select("*")
    .eq("lead_purchase_id", purchaseId)
    .order("created_at", { ascending: false });
  if (error && missingTable(error.message)) return { rows: [] as CustomerDisbursal[], migrationRequired: true };
  return { rows: (data ?? []) as CustomerDisbursal[] };
}

export async function insertDisbursal(
  row: Omit<CustomerDisbursal, "id">,
  userId: string,
) {
  const enriched = enrichDisbursal(row);
  const { data, error } = await supabase.from("customer_disbursals").insert(enriched as never).select("*").single();
  if (!error && data) {
    await createAuditLog({
      customer_profile_id: row.customer_profile_id,
      lead_purchase_id: row.lead_purchase_id,
      dsa_id: row.dsa_id,
      action_type: "disbursal",
      section_name: "Disbursal",
      new_value: "Disbursal record created",
      action_by: userId,
    });
  }
  return { data, error };
}

export async function updateDisbursal(
  id: string,
  patch: Partial<CustomerDisbursal>,
  ctx: { profileId: string; purchaseId: string; dsaId: string; userId: string; old?: CustomerDisbursal },
) {
  const enriched = enrichDisbursal(patch);
  const { data, error } = await supabase.from("customer_disbursals").update(enriched as never).eq("id", id).select("*").single();
  if (!error && ctx.old) {
    for (const key of Object.keys(patch)) {
      const o = (ctx.old as Record<string, unknown>)[key];
      const n = (patch as Record<string, unknown>)[key];
      if (o !== n) {
        await createAuditLog({
          customer_profile_id: ctx.profileId,
          lead_purchase_id: ctx.purchaseId,
          dsa_id: ctx.dsaId,
          action_type: "disbursal",
          section_name: "Disbursal",
          field_name: key,
          old_value: o != null ? String(o) : null,
          new_value: n != null ? String(n) : null,
          action_by: ctx.userId,
        });
      }
    }
  }
  return { data, error };
}

export async function deleteDisbursal(id: string) {
  return supabase.from("customer_disbursals").delete().eq("id", id);
}

export async function loadPayouts(purchaseId: string) {
  const { data, error } = await supabase
    .from("customer_payouts")
    .select("*")
    .eq("lead_purchase_id", purchaseId)
    .order("created_at", { ascending: false });
  if (error && missingTable(error.message)) return { rows: [] as CustomerPayout[], migrationRequired: true };
  return { rows: (data ?? []) as CustomerPayout[] };
}

export async function insertPayout(row: Omit<CustomerPayout, "id">, userId: string) {
  const { data, error } = await supabase.from("customer_payouts").insert(row as never).select("*").single();
  if (!error && data) {
    await createAuditLog({
      customer_profile_id: row.customer_profile_id,
      lead_purchase_id: row.lead_purchase_id,
      dsa_id: row.dsa_id,
      action_type: "payout",
      section_name: "Payout",
      new_value: `Payout ${row.payout_amount ?? 0}`,
      action_by: userId,
    });
  }
  return { data, error };
}

export async function updatePayout(
  id: string,
  patch: Partial<CustomerPayout>,
  ctx: { profileId: string; purchaseId: string; dsaId: string; userId: string },
) {
  const { data, error } = await supabase.from("customer_payouts").update(patch as never).eq("id", id).select("*").single();
  if (!error) {
    await createAuditLog({
      customer_profile_id: ctx.profileId,
      lead_purchase_id: ctx.purchaseId,
      dsa_id: ctx.dsaId,
      action_type: "payout",
      section_name: "Payout",
      new_value: JSON.stringify(patch),
      action_by: ctx.userId,
    });
  }
  return { data, error };
}

export async function deletePayout(id: string) {
  return supabase.from("customer_payouts").delete().eq("id", id);
}

export async function loadAuditLogs(purchaseId: string, opts?: { section?: string; limit?: number }) {
  let q = supabase
    .from("customer_audit_logs")
    .select("*")
    .eq("lead_purchase_id", purchaseId)
    .order("created_at", { ascending: false })
    .limit(opts?.limit ?? 100);
  if (opts?.section) q = q.eq("section_name", opts.section);
  const { data, error } = await q;
  if (error && missingTable(error.message)) return { rows: [] as AuditLogRow[], migrationRequired: true };
  return { rows: (data ?? []) as AuditLogRow[] };
}

export function summarizeFinance(disbursals: CustomerDisbursal[], payouts: CustomerPayout[]): CaseFinanceSummary {
  return {
    totalSanction: disbursals.reduce((s, d) => s + (Number(d.sanctioned_amount) || 0), 0),
    totalDisbursed: disbursals.reduce((s, d) => s + (Number(d.disbursed_amount) || 0), 0),
    totalNetDisbursal: disbursals.reduce((s, d) => s + (Number(d.net_disbursal) || 0), 0),
    totalPayoutExpected: disbursals.reduce((s, d) => s + (Number(d.payout_expected) || 0), 0),
    totalPayoutReceived: payouts
      .filter((p) => p.payout_status === "received")
      .reduce((s, p) => s + (Number(p.payout_amount) || 0), 0),
    totalPayoutPending: disbursals.reduce((s, d) => s + (Number(d.payout_pending) || 0), 0),
  };
}

export async function loadDsaReportMetrics(dsaId: string): Promise<LosReportMetrics> {
  const empty: LosReportMetrics = {
    totalLoginAmount: 0,
    totalSanction: 0,
    totalDisbursal: 0,
    totalPayoutReceived: 0,
    conversionRatio: 0,
    averageRoi: 0,
    rejectionRatio: 0,
    pendingDocs: 0,
    followupsDue: 0,
    activePipelines: 0,
    byLender: [],
    monthlyDisbursal: [],
    stageFunnel: [],
  };

  const [lenders, disbursals, payouts, pipelines, docs, followups] = await Promise.all([
    supabase.from("customer_lender_cases").select("lender_name,login_amount,sanctioned_amount,login_status,roi").eq("dsa_id", dsaId),
    supabase.from("customer_disbursals").select("disbursed_amount,sanctioned_amount,roi,disbursal_date").eq("dsa_id", dsaId),
    supabase.from("customer_payouts").select("payout_amount,payout_status").eq("dsa_id", dsaId),
    supabase.from("customer_los_pipeline").select("current_stage").eq("dsa_id", dsaId),
    supabase.from("customer_documents").select("status").eq("dsa_id", dsaId),
    supabase.from("customer_followups").select("followup_date,completed").eq("dsa_id", dsaId),
  ]);

  const lenderRows = lenders.data ?? [];
  const disbRows = disbursals.data ?? [];
  const payRows = payouts.data ?? [];
  const pipeRows = pipelines.data ?? [];

  empty.totalLoginAmount = lenderRows.reduce((s, r) => s + (Number(r.login_amount) || 0), 0);
  empty.totalSanction = disbRows.reduce((s, r) => s + (Number(r.sanctioned_amount) || 0), 0);
  empty.totalDisbursal = disbRows.reduce((s, r) => s + (Number(r.disbursed_amount) || 0), 0);
  empty.totalPayoutReceived = payRows
    .filter((p) => p.payout_status === "received")
    .reduce((s, p) => s + (Number(p.payout_amount) || 0), 0);

  const logins = lenderRows.length;
  const sanctioned = lenderRows.filter((r) => Number(r.sanctioned_amount) > 0).length;
  empty.conversionRatio = logins > 0 ? Math.round((sanctioned / logins) * 100) : 0;
  empty.rejectionRatio =
    logins > 0 ? Math.round((lenderRows.filter((r) => r.login_status === "rejected").length / logins) * 100) : 0;

  const rois = disbRows.map((r) => Number(r.roi)).filter((n) => n > 0);
  empty.averageRoi = rois.length ? rois.reduce((a, b) => a + b, 0) / rois.length : 0;

  const today = new Date().toISOString().slice(0, 10);
  empty.pendingDocs = (docs.data ?? []).filter((d) => ["pending", "requested"].includes(d.status ?? "")).length;
  empty.followupsDue = (followups.data ?? []).filter((f) => !f.completed && f.followup_date && f.followup_date <= today).length;
  empty.activePipelines = pipeRows.filter((p) => !["closed", "rejected", "disbursed"].includes(p.current_stage)).length;

  const lenderMap = new Map<string, { sanction: number; disbursed: number }>();
  for (const r of lenderRows) {
    const name = r.lender_name ?? "Unknown";
    const cur = lenderMap.get(name) ?? { sanction: 0, disbursed: 0 };
    cur.sanction += Number(r.sanctioned_amount) || 0;
    lenderMap.set(name, cur);
  }
  for (const r of disbRows) {
    const name = "Case";
    const cur = lenderMap.get(name) ?? { sanction: 0, disbursed: 0 };
    cur.disbursed += Number(r.disbursed_amount) || 0;
    lenderMap.set(name, cur);
  }
  empty.byLender = Array.from(lenderMap.entries()).map(([name, v]) => ({ name, ...v }));

  const monthMap = new Map<string, number>();
  for (const r of disbRows) {
    if (!r.disbursal_date) continue;
    const m = r.disbursal_date.slice(0, 7);
    monthMap.set(m, (monthMap.get(m) ?? 0) + (Number(r.disbursed_amount) || 0));
  }
  empty.monthlyDisbursal = Array.from(monthMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, amount]) => ({ month, amount }));

  const stageMap = new Map<string, number>();
  for (const p of pipeRows) {
    stageMap.set(p.current_stage, (stageMap.get(p.current_stage) ?? 0) + 1);
  }
  empty.stageFunnel = Array.from(stageMap.entries()).map(([stage, count]) => ({ stage, count }));

  return empty;
}
