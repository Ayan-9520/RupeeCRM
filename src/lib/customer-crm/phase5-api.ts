import { request } from "@/lib/python-api";

function apiError(err: unknown, fallback: string) {
  return err instanceof Error ? err.message : fallback;
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
  created_at?: string;
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
  created_at?: string;
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

export async function loadDisbursals(purchaseId: string): Promise<{ rows: CustomerDisbursal[]; error?: string }> {
  try {
    const data = await request<{ rows: CustomerDisbursal[] }>(`/api/my-leads/${purchaseId}/disbursals`);
    return { rows: data.rows ?? [] };
  } catch (err) {
    return { rows: [], error: apiError(err, "Could not load disbursals") };
  }
}

export async function insertDisbursal(row: Omit<CustomerDisbursal, "id">, _userId: string) {
  try {
    const data = await request<CustomerDisbursal>(`/api/my-leads/${row.lead_purchase_id}/disbursals`, {
      method: "POST",
      body: JSON.stringify(row),
    });
    return { data, error: null as { message: string } | null };
  } catch (err) {
    return { data: null, error: { message: apiError(err, "Could not add disbursal") } };
  }
}

export async function updateDisbursal(
  id: string,
  patch: Partial<CustomerDisbursal>,
  _ctx: { profileId: string; purchaseId: string; dsaId: string; userId: string; old?: CustomerDisbursal },
) {
  try {
    const data = await request<CustomerDisbursal>(`/api/customer-disbursals/${id}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
    return { data, error: null as { message: string } | null };
  } catch (err) {
    return { data: null, error: { message: apiError(err, "Could not update disbursal") } };
  }
}

export async function deleteDisbursal(id: string) {
  try {
    await request(`/api/customer-disbursals/${id}`, { method: "DELETE" });
    return { error: null as { message: string } | null };
  } catch (err) {
    return { error: { message: apiError(err, "Could not remove disbursal") } };
  }
}

export async function loadPayouts(purchaseId: string): Promise<{ rows: CustomerPayout[]; error?: string }> {
  try {
    const data = await request<{ rows: CustomerPayout[] }>(`/api/my-leads/${purchaseId}/case-payouts`);
    return { rows: data.rows ?? [] };
  } catch (err) {
    return { rows: [], error: apiError(err, "Could not load payouts") };
  }
}

export async function insertPayout(row: Omit<CustomerPayout, "id">, _userId: string) {
  try {
    const data = await request<CustomerPayout>(`/api/my-leads/${row.lead_purchase_id}/case-payouts`, {
      method: "POST",
      body: JSON.stringify(row),
    });
    return { data, error: null as { message: string } | null };
  } catch (err) {
    return { data: null, error: { message: apiError(err, "Could not add payout") } };
  }
}

export async function updatePayout(
  id: string,
  patch: Partial<CustomerPayout>,
  _ctx: { profileId: string; purchaseId: string; dsaId: string; userId: string },
) {
  try {
    const data = await request<CustomerPayout>(`/api/customer-case-payouts/${id}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
    return { data, error: null as { message: string } | null };
  } catch (err) {
    return { data: null, error: { message: apiError(err, "Could not update payout") } };
  }
}

export async function deletePayout(id: string) {
  try {
    await request(`/api/customer-case-payouts/${id}`, { method: "DELETE" });
    return { error: null as { message: string } | null };
  } catch (err) {
    return { error: { message: apiError(err, "Could not remove payout") } };
  }
}

export async function loadAuditLogs(purchaseId: string, _opts?: { section?: string; limit?: number }): Promise<{ rows: AuditLogRow[]; error?: string }> {
  try {
    const data = await request<{ rows: AuditLogRow[] }>(`/api/my-leads/${purchaseId}/audit`);
    return { rows: data.rows ?? [] };
  } catch (err) {
    return { rows: [], error: apiError(err, "Could not load the audit trail") };
  }
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

export async function loadDsaReportMetrics(_dsaId: string): Promise<LosReportMetrics> {
  try {
    return await request<LosReportMetrics>("/api/los/finance-report");
  } catch {
    return {
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
  }
}
