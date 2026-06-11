import { supabase } from "@/integrations/supabase/client";
import type { AiInsightDraft } from "./ai-intelligence";
import type { CommChannel } from "./phase6-constants";

function missingTable(msg: string): boolean {
  return /does not exist|42P01/i.test(msg);
}

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

export async function loadAiInsights(purchaseId: string) {
  const { data, error } = await supabase
    .from("customer_ai_insights")
    .select("*")
    .eq("lead_purchase_id", purchaseId)
    .is("dismissed_at", null)
    .order("priority_score", { ascending: false })
    .limit(20);
  if (error && missingTable(error.message)) return { rows: [] as AiInsight[], migrationRequired: true };
  return { rows: (data ?? []) as AiInsight[] };
}

export async function persistAiInsights(
  profileId: string,
  purchaseId: string,
  dsaId: string,
  userId: string,
  drafts: AiInsightDraft[],
) {
  if (!drafts.length) return { error: null };
  const rows = drafts.map((d) => ({
    customer_profile_id: profileId,
    lead_purchase_id: purchaseId,
    dsa_id: dsaId,
    insight_type: d.insight_type,
    channel: d.channel,
    title: d.title,
    content: d.content,
    priority_score: d.priority_score,
    intent_tags: d.intent_tags,
    suggested_action: d.suggested_action ?? null,
    scheduled_for: d.scheduled_for ?? null,
    created_by: userId,
  }));
  const { error } = await supabase.from("customer_ai_insights").insert(rows as never);
  if (error && missingTable(error.message)) return { migrationRequired: true, error: null };
  return { error: error?.message ?? null };
}

export async function dismissAiInsight(id: string) {
  return supabase.from("customer_ai_insights").update({ dismissed_at: new Date().toISOString() }).eq("id", id);
}

export async function loadCommunications(purchaseId: string) {
  const { data, error } = await supabase
    .from("customer_communications")
    .select("*")
    .eq("lead_purchase_id", purchaseId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error && missingTable(error.message)) return { rows: [] as Communication[], migrationRequired: true };
  return { rows: (data ?? []) as Communication[] };
}

export async function saveCommunication(row: {
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
  const { data, error } = await supabase
    .from("customer_communications")
    .insert({
      ...row,
      direction: "outbound",
      status: row.status ?? (row.scheduled_at ? "scheduled" : "sent"),
      sent_at: row.scheduled_at ? null : new Date().toISOString(),
    } as never)
    .select("*")
    .single();
  return { data, error };
}

export async function loadCommTemplates(dsaId: string) {
  const { data, error } = await supabase
    .from("customer_communication_templates")
    .select("*")
    .or(`is_system.eq.true,dsa_id.eq.${dsaId}`)
    .order("name");
  if (error && missingTable(error.message)) return { rows: [] as CommTemplate[], migrationRequired: true };
  return { rows: (data ?? []) as CommTemplate[] };
}

export async function loadSlaEvents(purchaseId: string) {
  const { data, error } = await supabase
    .from("customer_sla_events")
    .select("*")
    .eq("lead_purchase_id", purchaseId)
    .order("created_at", { ascending: false });
  if (error && missingTable(error.message)) return { rows: [] as SlaEvent[], migrationRequired: true };
  return { rows: (data ?? []) as SlaEvent[] };
}

export async function upsertSlaEvent(row: {
  customer_profile_id: string;
  lead_purchase_id: string;
  dsa_id: string;
  sla_type: string;
  target_hours: number;
  status: string;
  started_at?: string;
  completed_at?: string | null;
}) {
  const { data: existing } = await supabase
    .from("customer_sla_events")
    .select("id")
    .eq("lead_purchase_id", row.lead_purchase_id)
    .eq("sla_type", row.sla_type)
    .is("completed_at", null)
    .maybeSingle();

  if (existing?.id) {
    return supabase.from("customer_sla_events").update(row as never).eq("id", existing.id).select("*").single();
  }
  return supabase.from("customer_sla_events").insert(row as never).select("*").single();
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

export async function loadExecutiveMetrics(dsaId: string): Promise<ExecutiveMetrics> {
  const empty: ExecutiveMetrics = {
    dsaPerformance: [],
    stageFunnel: [],
    lenderConversion: [],
    monthlyGrowth: [],
    avgTatHours: 0,
    loginToDisbursalRatio: 0,
    approvalRatio: 0,
    rejectionReasons: [],
  };

  const [pipes, lenders, disb, payouts, purchases] = await Promise.all([
    supabase.from("customer_los_pipeline").select("current_stage,created_at,last_stage_changed_at").eq("dsa_id", dsaId),
    supabase.from("customer_lender_cases").select("lender_name,login_status,sanctioned_amount,rejection_reason").eq("dsa_id", dsaId),
    supabase.from("customer_disbursals").select("disbursed_amount,disbursal_date,created_at").eq("dsa_id", dsaId),
    supabase.from("customer_payouts").select("payout_amount,payout_status,received_date").eq("dsa_id", dsaId),
    supabase.from("lead_purchases").select("id,created_at,pipeline_stage,price_paid").eq("dsa_id", dsaId),
  ]);

  const pipeRows = pipes.data ?? [];
  const lenderRows = lenders.data ?? [];
  const disbRows = disb.data ?? [];
  const payRows = payouts.data ?? [];

  const stageMap = new Map<string, number>();
  for (const p of pipeRows) stageMap.set(p.current_stage, (stageMap.get(p.current_stage) ?? 0) + 1);
  empty.stageFunnel = Array.from(stageMap.entries()).map(([stage, count]) => ({ stage, count }));

  const lenderMap = new Map<string, { logins: number; sanctions: number }>();
  for (const l of lenderRows) {
    const n = l.lender_name ?? "Unknown";
    const cur = lenderMap.get(n) ?? { logins: 0, sanctions: 0 };
    cur.logins += 1;
    if (Number(l.sanctioned_amount) > 0) cur.sanctions += 1;
    lenderMap.set(n, cur);
  }
  empty.lenderConversion = Array.from(lenderMap.entries()).map(([name, v]) => ({ name, ...v }));

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
  empty.monthlyGrowth = Array.from(monthMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, v]) => ({ month, ...v }));

  const logins = lenderRows.length;
  const sanctioned = lenderRows.filter((l) => Number(l.sanctioned_amount) > 0).length;
  const disbursed = disbRows.filter((d) => Number(d.disbursed_amount) > 0).length;
  empty.approvalRatio = logins > 0 ? Math.round((sanctioned / logins) * 100) : 0;
  empty.loginToDisbursalRatio = logins > 0 ? Math.round((disbursed / logins) * 100) : 0;

  const reasonMap = new Map<string, number>();
  for (const l of lenderRows.filter((l) => l.rejection_reason)) {
    const r = l.rejection_reason!.slice(0, 40);
    reasonMap.set(r, (reasonMap.get(r) ?? 0) + 1);
  }
  empty.rejectionReasons = Array.from(reasonMap.entries()).map(([reason, count]) => ({ reason, count }));

  empty.dsaPerformance = [
    { label: "Active cases", value: pipeRows.length },
    { label: "Purchases", value: (purchases.data ?? []).length },
    { label: "Disbursed ₹", value: disbRows.reduce((s, d) => s + (Number(d.disbursed_amount) || 0), 0) },
    { label: "Payout ₹", value: payRows.filter((p) => p.payout_status === "received").reduce((s, p) => s + (Number(p.payout_amount) || 0), 0) },
  ];

  let tatSum = 0;
  let tatN = 0;
  for (const p of pipeRows) {
    if (p.last_stage_changed_at && p.created_at) {
      tatSum += (new Date(p.last_stage_changed_at).getTime() - new Date(p.created_at).getTime()) / 3_600_000;
      tatN += 1;
    }
  }
  empty.avgTatHours = tatN > 0 ? Math.round(tatSum / tatN) : 0;

  return empty;
}
