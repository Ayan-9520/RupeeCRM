import { supabase } from "@/integrations/supabase/client";
import { DOCUMENT_CATALOG, MAX_UPLOAD_BYTES, ALLOWED_MIME } from "./document-catalog";
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
};

function missingTable(msg: string): boolean {
  return /does not exist|42P01|relation.*not found/i.test(msg);
}

export async function ensureDocumentSlots(
  profileId: string,
  purchaseId: string,
  leadId: string,
  dsaId: string,
): Promise<{ ok: boolean; migrationRequired?: boolean }> {
  const rows = DOCUMENT_CATALOG.map((d) => ({
    customer_profile_id: profileId,
    lead_purchase_id: purchaseId,
    lead_id: leadId,
    dsa_id: dsaId,
    category: d.category,
    doc_slug: d.slug,
    doc_label: d.label,
    status: "pending",
  }));
  const { error } = await supabase.from("customer_documents").upsert(rows, {
    onConflict: "lead_purchase_id,doc_slug",
    ignoreDuplicates: true,
  });
  if (error) {
    if (missingTable(error.message)) return { ok: false, migrationRequired: true };
    return { ok: false };
  }
  return { ok: true };
}

export async function loadCustomerDocuments(purchaseId: string): Promise<{
  docs: CustomerDocument[];
  migrationRequired?: boolean;
}> {
  const { data, error } = await supabase
    .from("customer_documents")
    .select("*")
    .eq("lead_purchase_id", purchaseId)
    .order("category")
    .order("doc_label");
  if (error) {
    if (missingTable(error.message)) return { docs: [], migrationRequired: true };
    return { docs: [] };
  }
  return { docs: (data ?? []) as CustomerDocument[] };
}

export async function uploadCustomerDocument(opts: {
  doc: CustomerDocument;
  file: File;
  userId: string;
  leadId: string;
  onProgress?: (pct: number) => void;
}): Promise<{ error: string | null }> {
  const { doc, file, userId, leadId, onProgress } = opts;
  if (file.size > MAX_UPLOAD_BYTES) return { error: "File too large (max 10MB)" };
  if (!ALLOWED_MIME.includes(file.type) && !file.type.startsWith("image/")) {
    return { error: "Only PDF and images are allowed" };
  }
  const path = `${userId}/${doc.lead_purchase_id}/${doc.category}/${doc.doc_slug}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  onProgress?.(10);
  const { error: upErr } = await supabase.storage.from("case-documents").upload(path, file, { upsert: true });
  if (upErr) return { error: upErr.message };
  onProgress?.(70);
  const { data: signed } = await supabase.storage.from("case-documents").createSignedUrl(path, 60 * 60 * 24 * 365);
  const fileUrl = signed?.signedUrl ?? path;
  const { error: docErr } = await supabase
    .from("customer_documents")
    .update({
      file_name: file.name,
      file_url: fileUrl,
      storage_path: path,
      file_size: file.size,
      mime_type: file.type,
      status: "uploaded",
      uploaded_by: userId,
    })
    .eq("id", doc.id);
  if (docErr) return { error: docErr.message };
  onProgress?.(90);
  const catalog = DOCUMENT_CATALOG.find((c) => c.slug === doc.doc_slug);
  await supabase.from("case_documents").insert({
    lead_purchase_id: doc.lead_purchase_id,
    lead_id: leadId,
    uploaded_by: userId,
    doc_type: catalog?.legacyDocType ?? "other",
    file_name: file.name,
    file_url: fileUrl,
    file_size: file.size,
    mime_type: file.type,
  });
  onProgress?.(100);
  return { error: null };
}

export async function updateDocumentMeta(
  id: string,
  patch: Partial<Pick<CustomerDocument, "status" | "verification_notes" | "comments">>,
) {
  return supabase.from("customer_documents").update(patch).eq("id", id);
}

export async function removeCustomerDocument(doc: CustomerDocument) {
  if (doc.storage_path) {
    await supabase.storage.from("case-documents").remove([doc.storage_path]);
  }
  return supabase
    .from("customer_documents")
    .update({
      file_name: null,
      file_url: null,
      storage_path: null,
      file_size: null,
      mime_type: null,
      status: "pending",
      uploaded_by: null,
      verified_by: null,
      verified_at: null,
    })
    .eq("id", doc.id);
}

export async function loadBankLogins(purchaseId: string) {
  const { data, error } = await supabase
    .from("customer_bank_logins")
    .select("*")
    .eq("lead_purchase_id", purchaseId)
    .order("sort_order");
  if (error && missingTable(error.message)) return { rows: [] as BankLogin[], migrationRequired: true };
  return { rows: (data ?? []) as BankLogin[] };
}

export async function insertBankLogin(row: Omit<BankLogin, "id" | "created_at" | "updated_at">) {
  return supabase.from("customer_bank_logins").insert(row as never).select("*").single();
}

export async function updateBankLogin(id: string, patch: Partial<BankLogin>) {
  return supabase.from("customer_bank_logins").update(patch as never).eq("id", id).select("*").single();
}

export async function deleteBankLogin(id: string) {
  return supabase.from("customer_bank_logins").delete().eq("id", id);
}

export async function loadTimeline(purchaseId: string) {
  const { data, error } = await supabase
    .from("customer_timeline")
    .select("*")
    .eq("lead_purchase_id", purchaseId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error && missingTable(error.message)) return { entries: [] as TimelineEntry[], migrationRequired: true };
  return { entries: (data ?? []) as TimelineEntry[] };
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
  return supabase.from("customer_timeline").insert(row as never).select("*").single();
}

export async function loadFollowups(purchaseId: string) {
  const { data, error } = await supabase
    .from("customer_followups")
    .select("*")
    .eq("lead_purchase_id", purchaseId)
    .order("followup_date", { ascending: true });
  if (error && missingTable(error.message)) return { rows: [] as CustomerFollowup[], migrationRequired: true };
  return { rows: (data ?? []) as CustomerFollowup[] };
}

export async function insertFollowup(row: Omit<CustomerFollowup, "id" | "created_at" | "updated_at"> & {
  customer_profile_id: string;
  lead_purchase_id: string;
  dsa_id: string;
}) {
  return supabase.from("customer_followups").insert(row as never).select("*").single();
}

export async function updateFollowup(id: string, patch: Partial<CustomerFollowup>) {
  return supabase.from("customer_followups").update(patch as never).eq("id", id);
}
