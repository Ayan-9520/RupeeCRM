import { request, requestBlob } from "@/lib/python-api";
import { MAX_UPLOAD_BYTES, ALLOWED_MIME } from "./document-catalog";
import type { DocumentStatus } from "./document-catalog";

export type CustomerDocument = {
  id: string;
  customer_profile_id: string;
  lead_purchase_id: string;
  lead_id: string;
  dsa_id: string;
  category: string;
  doc_slug: string;
  doc_label: string;
  file_name: string | null;
  file_url: string | null;
  storage_path: string | null;
  file_size: number | null;
  mime_type: string | null;
  status: DocumentStatus;
  verification_notes: string | null;
  comments: string | null;
  uploaded_by: string | null;
  verified_by: string | null;
  verified_at: string | null;
  created_at: string;
  updated_at: string;
};

export type BankLogin = {
  id: string;
  customer_profile_id: string;
  lead_purchase_id: string;
  dsa_id: string;
  bank_name: string | null;
  product: string | null;
  login_date: string | null;
  login_amount: number | null;
  roi_percent: number | null;
  tenure_months: number | null;
  banker_name: string | null;
  banker_mobile: string | null;
  branch: string | null;
  login_status: string;
  sanction_amount: number | null;
  approved_amount: number | null;
  rejection_reason: string | null;
  processing_fees: number | null;
  disbursal_status: string | null;
  expected_disbursal_date: string | null;
  sort_order: number;
};

export type TimelineEntry = {
  id: string;
  activity_type: string;
  title: string | null;
  body: string;
  metadata: Record<string, unknown>;
  created_by: string | null;
  created_at: string;
};

export type CustomerFollowup = {
  id: string;
  followup_date: string | null;
  followup_time: string | null;
  priority: string;
  assigned_user_id: string | null;
  discussion_notes: string | null;
  outcome: string | null;
  next_action: string | null;
  completed: boolean;
  note_type?: string;
};

function apiError(err: unknown, fallback: string) {
  return { message: err instanceof Error ? err.message : fallback };
}

export async function ensureDocumentSlots(
  _profileId: string,
  _purchaseId: string,
  _leadId: string,
  _dsaId: string,
): Promise<{ ok: boolean; migrationRequired?: boolean }> {
  return { ok: true };
}

export async function loadCustomerDocuments(purchaseId: string): Promise<{
  docs: CustomerDocument[];
  migrationRequired?: boolean;
  error?: string;
}> {
  try {
    const data = await request<{ documents: CustomerDocument[] }>(`/api/my-leads/${purchaseId}/documents`);
    return { docs: data.documents ?? [] };
  } catch (err) {
    return { docs: [], error: err instanceof Error ? err.message : "Could not load documents" };
  }
}

export async function uploadCustomerDocument(opts: {
  doc: CustomerDocument;
  file: File;
  userId: string;
  leadId: string;
  onProgress?: (pct: number) => void;
}): Promise<{ error: string | null }> {
  const { doc, file, onProgress } = opts;
  if (file.size > MAX_UPLOAD_BYTES) return { error: "File too large (max 10MB)" };
  if (!ALLOWED_MIME.includes(file.type) && !file.type.startsWith("image/")) {
    return { error: "Only PDF and images are allowed" };
  }
  const body = new FormData();
  body.append("file", file);
  onProgress?.(30);
  try {
    await request(`/api/my-leads/${doc.lead_purchase_id}/documents/${doc.doc_slug}/file`, {
      method: "POST",
      body,
    });
    onProgress?.(100);
    return { error: null };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Upload failed" };
  }
}

export async function updateDocumentMeta(
  id: string,
  patch: Partial<Pick<CustomerDocument, "status" | "verification_notes" | "comments">>,
) {
  try {
    await request(`/api/customer-documents/${id}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
    return { error: null as { message: string } | null };
  } catch (err) {
    return { error: { message: err instanceof Error ? err.message : "Update failed" } };
  }
}

export async function removeCustomerDocument(doc: CustomerDocument) {
  try {
    await request(`/api/customer-documents/${doc.id}/file`, { method: "DELETE" });
    return { error: null as { message: string } | null };
  } catch (err) {
    return { error: { message: err instanceof Error ? err.message : "Remove failed" } };
  }
}

export { requestBlob };

export async function loadBankLogins(purchaseId: string): Promise<{ rows: BankLogin[]; error?: string }> {
  try {
    const data = await request<{ rows: BankLogin[] }>(`/api/my-leads/${purchaseId}/bank-logins`);
    return { rows: data.rows ?? [] };
  } catch (err) {
    return { rows: [], error: apiError(err, "Could not load bank logins").message };
  }
}

export async function insertBankLogin(row: Omit<BankLogin, "id" | "created_at" | "updated_at">) {
  try {
    const data = await request<BankLogin>(`/api/my-leads/${row.lead_purchase_id}/bank-logins`, {
      method: "POST",
      body: JSON.stringify(row),
    });
    return { data, error: null as { message: string } | null };
  } catch (err) {
    return { data: null, error: apiError(err, "Could not add bank login") };
  }
}

export async function updateBankLogin(id: string, patch: Partial<BankLogin>) {
  try {
    const data = await request<BankLogin>(`/api/customer-bank-logins/${id}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
    return { data, error: null as { message: string } | null };
  } catch (err) {
    return { data: null, error: apiError(err, "Could not update bank login") };
  }
}

export async function deleteBankLogin(id: string) {
  try {
    await request(`/api/customer-bank-logins/${id}`, { method: "DELETE" });
    return { error: null as { message: string } | null };
  } catch (err) {
    return { error: apiError(err, "Could not remove bank login") };
  }
}

export async function loadTimeline(purchaseId: string): Promise<{ entries: TimelineEntry[]; error?: string }> {
  try {
    const data = await request<{ entries: TimelineEntry[] }>(`/api/my-leads/${purchaseId}/timeline`);
    return { entries: data.entries ?? [] };
  } catch (err) {
    return { entries: [], error: apiError(err, "Could not load activity").message };
  }
}

export async function addTimelineEntry(row: {
  customer_profile_id: string;
  lead_purchase_id: string;
  dsa_id: string;
  activity_type: string;
  title?: string;
  body: string;
  metadata?: Record<string, unknown>;
  created_by: string;
}) {
  const noteType = ["call", "whatsapp", "meeting", "email"].includes(row.activity_type) ? row.activity_type : "other";
  return insertFollowup({
    customer_profile_id: row.customer_profile_id,
    lead_purchase_id: row.lead_purchase_id,
    dsa_id: row.dsa_id,
    followup_date: null,
    followup_time: null,
    priority: "medium",
    assigned_user_id: row.created_by,
    discussion_notes: row.body,
    outcome: null,
    next_action: null,
    completed: false,
    note_type: noteType,
  });
}

export async function loadFollowups(purchaseId: string): Promise<{ rows: CustomerFollowup[]; error?: string }> {
  try {
    const data = await request<{ rows: CustomerFollowup[] }>(`/api/my-leads/${purchaseId}/followups`);
    return { rows: data.rows ?? [] };
  } catch (err) {
    return { rows: [], error: apiError(err, "Could not load follow-ups").message };
  }
}

export async function insertFollowup(
  row: Omit<CustomerFollowup, "id" | "created_at" | "updated_at"> & {
    customer_profile_id: string;
    lead_purchase_id: string;
    dsa_id: string;
    note_type?: string;
  },
) {
  try {
    const data = await request<CustomerFollowup>(`/api/my-leads/${row.lead_purchase_id}/followups`, {
      method: "POST",
      body: JSON.stringify(row),
    });
    return { data, error: null as { message: string } | null };
  } catch (err) {
    return { data: null, error: apiError(err, "Could not save follow-up") };
  }
}

export async function updateFollowup(id: string, patch: Partial<CustomerFollowup>) {
  try {
    const data = await request<CustomerFollowup>(`/api/customer-followups/${id}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
    return { data, error: null as { message: string } | null };
  } catch (err) {
    return { data: null, error: apiError(err, "Could not update follow-up") };
  }
}

export async function deleteFollowup(id: string) {
  try {
    await request(`/api/customer-followups/${id}`, { method: "DELETE" });
    return { error: null as { message: string } | null };
  } catch (err) {
    return { error: apiError(err, "Could not delete follow-up") };
  }
}
