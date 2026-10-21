import type { AiInsightDraft } from "./ai-intelligence";
import type { CommChannel } from "./phase6-constants";

export type AiInsight = {
  id: string;
  insight_type: string;
  channel: string;
  title: string;
  content: string;
  priority_score: number;
  intent_tags: string[];
  suggested_action: string | null;
  scheduled_for: string | null;
  dismissed_at: string | null;
  created_at: string;
};

export type Communication = {
  id: string;
  channel: string;
  direction: string;
  subject: string | null;
  body: string;
  status: string;
  scheduled_at: string | null;
  sent_at: string | null;
  created_at: string;
};

export type CommTemplate = {
  id: string;
  channel: string;
  name: string;
  body_template: string;
  is_system: boolean;
};

export type SlaEvent = {
  id: string;
  sla_type: string;
  started_at: string;
  completed_at: string | null;
  target_hours: number;
  status: string;
};

/* AI insights, communications, templates, and SLA events have no Python API or table yet. */

export async function loadAiInsights(_purchaseId: string) {
  return { rows: [] as AiInsight[] };
}

export async function persistAiInsights(
  _profileId: string,
  _purchaseId: string,
  _dsaId: string,
  _userId: string,
  drafts: AiInsightDraft[],
) {
  if (!drafts.length) return { error: null as string | null };
  return { error: "AI suggestions are not stored yet." as string | null };
}

export async function dismissAiInsight(_id: string) {
  return { error: { message: "AI suggestions are not stored yet." } };
}

export async function loadCommunications(_purchaseId: string) {
  return { rows: [] as Communication[] };
}

export async function saveCommunication(_row: {
  customer_profile_id: string;
  lead_purchase_id: string;
  dsa_id: string;
  channel: CommChannel;
  body: string;
  subject?: string;
  status?: string;
  scheduled_at?: string | null;
  created_by: string;
}) {
  return {
    data: null as Communication | null,
    error: { message: "Communication history is not stored yet. Log calls and messages under Follow-ups." },
  };
}

export async function loadCommTemplates(_dsaId: string) {
  return { rows: [] as CommTemplate[] };
}

export async function loadSlaEvents(_purchaseId: string) {
  return { rows: [] as SlaEvent[] };
}

export function computeSlaStatus(startedAt: string, targetHours: number, completedAt?: string | null): string {
  if (completedAt) return "completed";
  const elapsed = (Date.now() - new Date(startedAt).getTime()) / 3_600_000;
  if (elapsed > targetHours) return "breached";
  if (elapsed > targetHours * 0.8) return "at_risk";
  return "on_track";
}

export type ExecutiveMetrics = {
  dsaPerformance: { label: string; value: number }[];
  stageFunnel: { stage: string; count: number }[];
  lenderConversion: { name: string; logins: number; sanctions: number }[];
  monthlyGrowth: { month: string; disbursed: number; payout: number }[];
  avgTatHours: number;
  loginToDisbursalRatio: number;
  approvalRatio: number;
  rejectionReasons: { reason: string; count: number }[];
};

export type ExecutiveSourceRows = {
  pipelines: { current_stage: string; created_at: string | null; last_stage_changed_at: string | null }[];
  lenderCases: { lender_name: string | null; sanctioned_amount: number | null; rejection_reason: string | null }[];
  disbursals: { disbursed_amount: number | null; disbursal_date: string | null; created_at: string }[];
  payouts: { payout_amount: number | null; payout_status: string; received_date: string | null }[];
  purchaseCount: number;
};

export function buildExecutiveMetrics(src: ExecutiveSourceRows): ExecutiveMetrics {
  const out: ExecutiveMetrics = {
    dsaPerformance: [],
    stageFunnel: [],
    lenderConversion: [],
    monthlyGrowth: [],
    avgTatHours: 0,
    loginToDisbursalRatio: 0,
    approvalRatio: 0,
    rejectionReasons: [],
  };
  const { pipelines: pipeRows, lenderCases: lenderRows, disbursals: disbRows, payouts: payRows } = src;

  const stageMap = new Map<string, number>();
  for (const p of pipeRows) stageMap.set(p.current_stage, (stageMap.get(p.current_stage) ?? 0) + 1);
  out.stageFunnel = Array.from(stageMap.entries()).map(([stage, count]) => ({ stage, count }));

  const lenderMap = new Map<string, { logins: number; sanctions: number }>();
  for (const l of lenderRows) {
    const n = l.lender_name ?? "Unknown";
    const cur = lenderMap.get(n) ?? { logins: 0, sanctions: 0 };
    cur.logins += 1;
    if (Number(l.sanctioned_amount) > 0) cur.sanctions += 1;
    lenderMap.set(n, cur);
  }
  out.lenderConversion = Array.from(lenderMap.entries()).map(([name, v]) => ({ name, ...v }));

  const monthMap = new Map<string, { disbursed: number; payout: number }>();
  for (const d of disbRows) {
    const m = (d.disbursal_date ?? d.created_at).slice(0, 7);
    const cur = monthMap.get(m) ?? { disbursed: 0, payout: 0 };
    cur.disbursed += Number(d.disbursed_amount) || 0;
    monthMap.set(m, cur);
  }
  for (const p of payRows.filter((x) => x.payout_status === "received")) {
    const m = (p.received_date ?? "").slice(0, 7) || new Date().toISOString().slice(0, 7);
    const cur = monthMap.get(m) ?? { disbursed: 0, payout: 0 };
    cur.payout += Number(p.payout_amount) || 0;
    monthMap.set(m, cur);
  }
  out.monthlyGrowth = Array.from(monthMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, v]) => ({ month, ...v }));

  const logins = lenderRows.length;
  const sanctioned = lenderRows.filter((l) => Number(l.sanctioned_amount) > 0).length;
  const disbursed = disbRows.filter((d) => Number(d.disbursed_amount) > 0).length;
  out.approvalRatio = logins > 0 ? Math.round((sanctioned / logins) * 100) : 0;
  out.loginToDisbursalRatio = logins > 0 ? Math.round((disbursed / logins) * 100) : 0;

  const reasonMap = new Map<string, number>();
  for (const l of lenderRows) {
    if (!l.rejection_reason) continue;
    const r = l.rejection_reason.slice(0, 40);
    reasonMap.set(r, (reasonMap.get(r) ?? 0) + 1);
  }
  out.rejectionReasons = Array.from(reasonMap.entries()).map(([reason, count]) => ({ reason, count }));

  out.dsaPerformance = [
    { label: "Active cases", value: pipeRows.length },
    { label: "Purchases", value: src.purchaseCount },
    { label: "Disbursed ₹", value: disbRows.reduce((s, d) => s + (Number(d.disbursed_amount) || 0), 0) },
    {
      label: "Payout ₹",
      value: payRows.filter((p) => p.payout_status === "received").reduce((s, p) => s + (Number(p.payout_amount) || 0), 0),
    },
  ];

  let tatSum = 0;
  let tatN = 0;
  for (const p of pipeRows) {
    if (p.last_stage_changed_at && p.created_at) {
      tatSum += (new Date(p.last_stage_changed_at).getTime() - new Date(p.created_at).getTime()) / 3_600_000;
      tatN += 1;
    }
  }
  out.avgTatHours = tatN > 0 ? Math.round(tatSum / tatN) : 0;

  return out;
}

/** No cross-case metrics endpoint exists yet, so this returns the empty aggregate. */
export async function loadExecutiveMetrics(_dsaId: string): Promise<ExecutiveMetrics> {
  return buildExecutiveMetrics({ pipelines: [], lenderCases: [], disbursals: [], payouts: [], purchaseCount: 0 });
}
