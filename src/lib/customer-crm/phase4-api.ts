import { supabase } from "@/integrations/supabase/client";
import { createAuditLog } from "./audit-log";
import type { LosPipelineStage } from "./workflow-constants";
import { stageLabel } from "./workflow-constants";

function missingTable(msg: string): boolean {
  return /does not exist|42P01|relation.*not found/i.test(msg);
}

export type LosPipeline = {
  id: string;
  customer_profile_id: string;
  lead_purchase_id: string;
  dsa_id: string;
  current_stage: LosPipelineStage | string;
  case_owner_id: string | null;
  assigned_rm_id: string | null;
  assigned_dsa_id: string | null;
  banker_name: string | null;
  banker_mobile: string | null;
  banker_email: string | null;
  priority: string;
  sla_target_date: string | null;
  reminder_at: string | null;
  last_stage_changed_at: string;
  last_stage_changed_by: string | null;
};

export type PipelineHistoryRow = {
  id: string;
  from_stage: string | null;
  to_stage: string;
  changed_by: string | null;
  notes: string | null;
  created_at: string;
};

export type LenderCase = {
  id: string;
  customer_profile_id: string;
  lead_purchase_id: string;
  dsa_id: string;
  lender_name: string | null;
  branch: string | null;
  banker_name: string | null;
  banker_mobile: string | null;
  banker_email: string | null;
  login_date: string | null;
  login_status: string;
  sanctioned_amount: number | null;
  roi: number | null;
  tenure: number | null;
  processing_fee: number | null;
  insurance_amount: number | null;
  disbursed_amount: number | null;
  payout_expected: number | null;
  payout_received: number | null;
  payout_status: string | null;
  rejection_reason: string | null;
  remarks: string | null;
  is_best_offer: boolean;
  sort_order: number;
  created_by: string | null;
};

export type SanctionDisbursal = {
  id: string;
  customer_profile_id: string;
  lead_purchase_id: string;
  lender_case_id: string | null;
  dsa_id: string;
  sanction_amount: number | null;
  final_roi: number | null;
  final_tenure: number | null;
  emi: number | null;
  processing_fee: number | null;
  insurance_deduction: number | null;
  net_disbursal: number | null;
  disbursal_date: string | null;
  utr_number: string | null;
  bank_account_credited: string | null;
  payout_expected: number | null;
  payout_received: number | null;
};

export type LosTask = {
  id: string;
  customer_profile_id: string;
  lead_purchase_id: string;
  dsa_id: string;
  title: string;
  description: string | null;
  task_type: string;
  status: string;
  due_at: string | null;
  assigned_user_id: string | null;
  comments: { at: string; text: string; by?: string }[];
  completed_at: string | null;
};

export type LosDashboardStats = {
  activeCases: number;
  approvedCases: number;
  disbursedAmount: number;
  pendingDocs: number;
  followupsDueToday: number;
  payoutPending: number;
  rejectionCount: number;
};

export async function ensureLosPipeline(
  profileId: string,
  purchaseId: string,
  dsaId: string,
): Promise<{ pipeline: LosPipeline | null; migrationRequired?: boolean }> {
  const { data: existing } = await supabase
    .from("customer_los_pipeline")
    .select("*")
    .eq("lead_purchase_id", purchaseId)
    .maybeSingle();

  if (existing) return { pipeline: existing as LosPipeline };

  const { data, error } = await supabase
    .from("customer_los_pipeline")
    .insert({
      customer_profile_id: profileId,
      lead_purchase_id: purchaseId,
      dsa_id: dsaId,
      current_stage: "lead_purchased",
      case_owner_id: dsaId,
      assigned_dsa_id: dsaId,
      last_stage_changed_by: dsaId,
    })
    .select("*")
    .single();

  if (error) {
    if (missingTable(error.message)) return { pipeline: null, migrationRequired: true };
    return { pipeline: null };
  }

  await supabase.from("customer_pipeline_history").insert({
    customer_profile_id: profileId,
    lead_purchase_id: purchaseId,
    dsa_id: dsaId,
    from_stage: null,
    to_stage: "lead_purchased",
    changed_by: dsaId,
    notes: "Pipeline initialized",
  });

  return { pipeline: data as LosPipeline };
}

export async function updatePipelineStage(
  pipeline: LosPipeline,
  toStage: string,
  userId: string,
  profileId: string,
): Promise<{ error: string | null }> {
  const from = pipeline.current_stage;
  if (from === toStage) return { error: null };

  const { error: uErr } = await supabase
    .from("customer_los_pipeline")
    .update({
      current_stage: toStage,
      last_stage_changed_at: new Date().toISOString(),
      last_stage_changed_by: userId,
    })
    .eq("id", pipeline.id);

  if (uErr) return { error: uErr.message };

  await supabase.from("customer_pipeline_history").insert({
    customer_profile_id: profileId,
    lead_purchase_id: pipeline.lead_purchase_id,
    dsa_id: pipeline.dsa_id,
    from_stage: from,
    to_stage: toStage,
    changed_by: userId,
  });

  await supabase.from("customer_timeline").insert({
    customer_profile_id: profileId,
    lead_purchase_id: pipeline.lead_purchase_id,
    dsa_id: pipeline.dsa_id,
    activity_type: "stage_changed",
    title: "Stage changed",
    body: `${stageLabel(from)} → ${stageLabel(toStage)}`,
    metadata: { from_stage: from, to_stage: toStage },
    created_by: userId,
  });

  await createAuditLog({
    customer_profile_id: profileId,
    lead_purchase_id: pipeline.lead_purchase_id,
    dsa_id: pipeline.dsa_id,
    action_type: "stage_changed",
    section_name: "Pipeline",
    field_name: "current_stage",
    old_value: from,
    new_value: toStage,
    action_by: userId,
  });

  return { error: null };
}

export async function updatePipelineAssignment(
  pipelineId: string,
  patch: Partial<LosPipeline>,
): Promise<{ error: string | null }> {
  const { error } = await supabase.from("customer_los_pipeline").update(patch).eq("id", pipelineId);
  return { error: error?.message ?? null };
}

export async function loadPipelineHistory(purchaseId: string) {
  const { data, error } = await supabase
    .from("customer_pipeline_history")
    .select("*")
    .eq("lead_purchase_id", purchaseId)
    .order("created_at", { ascending: false });
  if (error && missingTable(error.message)) return { rows: [] as PipelineHistoryRow[], migrationRequired: true };
  return { rows: (data ?? []) as PipelineHistoryRow[] };
}

export async function loadLenderCases(purchaseId: string) {
  const { data, error } = await supabase
    .from("customer_lender_cases")
    .select("*")
    .eq("lead_purchase_id", purchaseId)
    .order("sort_order");
  if (error && missingTable(error.message)) return { rows: [] as LenderCase[], migrationRequired: true };
  return { rows: (data ?? []) as LenderCase[] };
}

export async function insertLenderCase(row: Omit<LenderCase, "id" | "created_by"> & { created_by?: string }) {
  return supabase.from("customer_lender_cases").insert(row as never).select("*").single();
}

export async function updateLenderCase(id: string, patch: Partial<LenderCase>) {
  return supabase.from("customer_lender_cases").update(patch as never).eq("id", id).select("*").single();
}

export async function deleteLenderCase(id: string) {
  return supabase.from("customer_lender_cases").delete().eq("id", id);
}

export async function setBestOffer(purchaseId: string, lenderCaseId: string) {
  await supabase.from("customer_lender_cases").update({ is_best_offer: false }).eq("lead_purchase_id", purchaseId);
  return supabase.from("customer_lender_cases").update({ is_best_offer: true }).eq("id", lenderCaseId);
}

export async function loadSanctionRecords(purchaseId: string) {
  const { data, error } = await supabase.from("customer_sanction_disbursal").select("*").eq("lead_purchase_id", purchaseId);
  if (error && missingTable(error.message)) return { rows: [] as SanctionDisbursal[], migrationRequired: true };
  return { rows: (data ?? []) as SanctionDisbursal[] };
}

export async function upsertSanction(row: Partial<SanctionDisbursal> & { id?: string }) {
  if (row.id) {
    return supabase.from("customer_sanction_disbursal").update(row as never).eq("id", row.id).select("*").single();
  }
  return supabase.from("customer_sanction_disbursal").insert(row as never).select("*").single();
}

export async function loadLosTasks(purchaseId: string) {
  const { data, error } = await supabase
    .from("customer_tasks")
    .select("*")
    .eq("lead_purchase_id", purchaseId)
    .order("created_at", { ascending: false });
  if (error) return { rows: [] as LosTask[] };
  return {
    rows: (data ?? []).map((t) => ({
      ...t,
      task_type: (t as { task_type?: string }).task_type ?? "general",
      comments: Array.isArray((t as { comments?: unknown }).comments)
        ? ((t as { comments: LosTask["comments"] }).comments ?? [])
        : [],
      status: mapTaskStatus((t as { status: string }).status),
    })) as LosTask[],
  };
}

function mapTaskStatus(s: string) {
  if (s === "open") return "pending";
  return s;
}

export async function insertLosTask(row: {
  customer_profile_id: string;
  lead_purchase_id: string;
  dsa_id: string;
  title: string;
  task_type: string;
  status?: string;
  due_at?: string | null;
  assigned_user_id?: string | null;
  description?: string | null;
}) {
  return supabase
    .from("customer_tasks")
    .insert({ ...row, status: row.status ?? "pending", comments: [] } as never)
    .select("*")
    .single();
}

export async function updateLosTask(id: string, patch: Partial<LosTask>) {
  const dbPatch: Record<string, unknown> = { ...patch };
  if (patch.status === "completed" && !patch.completed_at) {
    dbPatch.completed_at = new Date().toISOString();
  }
  return supabase.from("customer_tasks").update(dbPatch as never).eq("id", id).select("*").single();
}

export async function loadLosDashboardStats(dsaId: string): Promise<LosDashboardStats> {
  const empty: LosDashboardStats = {
    activeCases: 0,
    approvedCases: 0,
    disbursedAmount: 0,
    pendingDocs: 0,
    followupsDueToday: 0,
    payoutPending: 0,
    rejectionCount: 0,
  };

  const today = new Date().toISOString().slice(0, 10);

  const [pipelines, docs, followups, lenders] = await Promise.all([
    supabase.from("customer_los_pipeline").select("current_stage").eq("dsa_id", dsaId),
    supabase.from("customer_documents").select("status").eq("dsa_id", dsaId),
    supabase.from("customer_followups").select("followup_date,completed").eq("dsa_id", dsaId),
    supabase.from("customer_lender_cases").select("payout_status,disbursed_amount,login_status").eq("dsa_id", dsaId),
  ]);

  const stages = pipelines.data ?? [];
  empty.activeCases = stages.filter((s) => !["closed", "rejected", "disbursed"].includes(s.current_stage)).length;
  empty.approvedCases = stages.filter((s) => ["approved", "sanctioned", "disbursed"].includes(s.current_stage)).length;
  empty.rejectionCount = stages.filter((s) => s.current_stage === "rejected").length;

  empty.pendingDocs = (docs.data ?? []).filter((d) =>
    ["pending", "requested"].includes(d.status ?? ""),
  ).length;

  empty.followupsDueToday = (followups.data ?? []).filter(
    (f) => !f.completed && f.followup_date && f.followup_date <= today,
  ).length;

  const lenderRows = lenders.data ?? [];
  empty.disbursedAmount = lenderRows.reduce((s, r) => s + (Number(r.disbursed_amount) || 0), 0);
  empty.payoutPending = lenderRows.filter((r) => r.payout_status === "pending" && Number(r.payout_expected) > 0).length;

  return empty;
}
