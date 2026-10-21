import { request } from "@/lib/python-api";
import type { LosPipelineStage } from "./workflow-constants";

function apiError(err: unknown, fallback: string) {
  return err instanceof Error ? err.message : fallback;
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
  _profileId: string,
  purchaseId: string,
  _dsaId: string,
): Promise<{ pipeline: LosPipeline | null; error?: string }> {
  try {
    const pipeline = await request<LosPipeline>(`/api/my-leads/${purchaseId}/los-pipeline`);
    return { pipeline };
  } catch (err) {
    return { pipeline: null, error: apiError(err, "Could not load the pipeline") };
  }
}

export async function updatePipelineStage(
  pipeline: LosPipeline,
  toStage: string,
  _userId: string,
  _profileId: string,
): Promise<{ error: string | null }> {
  try {
    await request(`/api/customer-los-pipelines/${pipeline.id}/stage`, {
      method: "POST",
      body: JSON.stringify({ to_stage: toStage }),
    });
    return { error: null };
  } catch (err) {
    return { error: apiError(err, "Could not update the stage") };
  }
}

export async function updatePipelineAssignment(
  pipelineId: string,
  patch: Partial<LosPipeline>,
): Promise<{ error: string | null }> {
  try {
    await request(`/api/customer-los-pipelines/${pipelineId}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
    return { error: null };
  } catch (err) {
    return { error: apiError(err, "Could not update assignment") };
  }
}

export async function loadPipelineHistory(purchaseId: string): Promise<{ rows: PipelineHistoryRow[]; error?: string }> {
  try {
    const data = await request<{ rows: PipelineHistoryRow[] }>(`/api/my-leads/${purchaseId}/pipeline-history`);
    return { rows: data.rows ?? [] };
  } catch (err) {
    return { rows: [], error: apiError(err, "Could not load stage history") };
  }
}

export async function loadLenderCases(purchaseId: string): Promise<{ rows: LenderCase[]; error?: string }> {
  try {
    const data = await request<{ rows: LenderCase[] }>(`/api/my-leads/${purchaseId}/lender-cases`);
    return { rows: data.rows ?? [] };
  } catch (err) {
    return { rows: [], error: apiError(err, "Could not load lender cases") };
  }
}

export async function insertLenderCase(row: Omit<LenderCase, "id" | "created_by"> & { created_by?: string }) {
  try {
    const data = await request<LenderCase>(`/api/my-leads/${row.lead_purchase_id}/lender-cases`, {
      method: "POST",
      body: JSON.stringify(row),
    });
    return { data, error: null as { message: string } | null };
  } catch (err) {
    return { data: null, error: { message: apiError(err, "Could not add lender") } };
  }
}

export async function updateLenderCase(id: string, patch: Partial<LenderCase>) {
  try {
    const data = await request<LenderCase>(`/api/customer-lender-cases/${id}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
    return { data, error: null as { message: string } | null };
  } catch (err) {
    return { data: null, error: { message: apiError(err, "Could not update lender") } };
  }
}

export async function deleteLenderCase(id: string) {
  try {
    await request(`/api/customer-lender-cases/${id}`, { method: "DELETE" });
    return { error: null as { message: string } | null };
  } catch (err) {
    return { error: { message: apiError(err, "Could not remove lender") } };
  }
}

export async function setBestOffer(_purchaseId: string, lenderCaseId: string) {
  try {
    await request(`/api/customer-lender-cases/${lenderCaseId}/best-offer`, { method: "POST" });
    return { error: null as string | null };
  } catch (err) {
    return { error: apiError(err, "Could not mark the best offer") };
  }
}

export async function loadSanctionRecords(purchaseId: string): Promise<{ rows: SanctionDisbursal[]; error?: string }> {
  try {
    const data = await request<{ rows: SanctionDisbursal[] }>(`/api/my-leads/${purchaseId}/sanction`);
    return { rows: data.rows ?? [] };
  } catch (err) {
    return { rows: [], error: apiError(err, "Could not load sanction details") };
  }
}

export async function upsertSanction(row: Partial<SanctionDisbursal> & { id?: string; lead_purchase_id?: string }) {
  if (!row.lead_purchase_id) {
    return { data: null, error: { message: "Missing purchase" } };
  }
  try {
    const data = await request<SanctionDisbursal>(`/api/my-leads/${row.lead_purchase_id}/sanction`, {
      method: "PUT",
      body: JSON.stringify(row),
    });
    return { data, error: null as { message: string } | null };
  } catch (err) {
    return { data: null, error: { message: apiError(err, "Could not save sanction details") } };
  }
}

export async function loadLosTasks(purchaseId: string): Promise<{ rows: LosTask[]; error?: string }> {
  try {
    const data = await request<{ rows: LosTask[] }>(`/api/my-leads/${purchaseId}/tasks`);
    return { rows: data.rows ?? [] };
  } catch (err) {
    return { rows: [], error: apiError(err, "Could not load tasks") };
  }
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
  try {
    const data = await request<LosTask>(`/api/my-leads/${row.lead_purchase_id}/tasks`, {
      method: "POST",
      body: JSON.stringify(row),
    });
    return { data, error: null as { message: string } | null };
  } catch (err) {
    return { data: null, error: { message: apiError(err, "Could not add task") } };
  }
}

export async function updateLosTask(id: string, patch: Partial<LosTask>) {
  try {
    const data = await request<LosTask>(`/api/customer-tasks/${id}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
    return { data, error: null as { message: string } | null };
  } catch (err) {
    return { data: null, error: { message: apiError(err, "Could not update task") } };
  }
}

const EMPTY_STATS: LosDashboardStats = {
  activeCases: 0,
  approvedCases: 0,
  disbursedAmount: 0,
  pendingDocs: 0,
  followupsDueToday: 0,
  payoutPending: 0,
  rejectionCount: 0,
};

export async function loadLosDashboardStats(_dsaId: string): Promise<LosDashboardStats> {
  try {
    return await request<LosDashboardStats>("/api/los/summary");
  } catch {
    return EMPTY_STATS;
  }
}
