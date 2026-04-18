import { supabase } from "@/integrations/supabase/client";

export type PartnerApplication = {
  id: string;
  user_id: string | null;
  full_name: string;
  email: string;
  phone: string;
  date_of_birth: string | null;
  gender: string | null;
  city: string;
  state: string | null;
  pincode: string | null;
  company_name: string | null;
  experience_years: number;
  products_of_interest: string[];
  monthly_target: number | null;
  pan: string;
  aadhaar_last4: string | null;
  bank_account: string | null;
  ifsc: string | null;
  account_holder: string | null;
  pan_doc_url: string | null;
  aadhaar_doc_url: string | null;
  bank_proof_url: string | null;
  selfie_url: string | null;
  status: "pending" | "under_review" | "approved" | "rejected";
  reviewed_by: string | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
  internal_notes: string | null;
  generated_dsa_id: string | null;
  source: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  created_at: string;
  updated_at: string;
};

export type SubmitPartnerInput = {
  full_name: string;
  email: string;
  phone: string;
  city: string;
  state?: string;
  pincode?: string;
  date_of_birth?: string;
  gender?: string;
  company_name?: string;
  experience_years?: number;
  products?: string[];
  monthly_target?: number;
  pan: string;
  aadhaar_last4?: string;
  bank_account?: string;
  ifsc?: string;
  account_holder?: string;
  pan_doc_url?: string;
  aadhaar_doc_url?: string;
  bank_proof_url?: string;
  selfie_url?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
};

export async function submitPartnerApplication(input: SubmitPartnerInput) {
  const { data, error } = await supabase.rpc("submit_partner_application", {
    _full_name: input.full_name,
    _email: input.email,
    _phone: input.phone,
    _city: input.city,
    _state: input.state ?? null,
    _pincode: input.pincode ?? null,
    _date_of_birth: input.date_of_birth ?? null,
    _gender: input.gender ?? null,
    _company_name: input.company_name ?? null,
    _experience_years: input.experience_years ?? 0,
    _products: input.products ?? [],
    _monthly_target: input.monthly_target ?? null,
    _pan: input.pan,
    _aadhaar_last4: input.aadhaar_last4 ?? null,
    _bank_account: input.bank_account ?? null,
    _ifsc: input.ifsc ?? null,
    _account_holder: input.account_holder ?? null,
    _pan_doc_url: input.pan_doc_url ?? null,
    _aadhaar_doc_url: input.aadhaar_doc_url ?? null,
    _bank_proof_url: input.bank_proof_url ?? null,
    _selfie_url: input.selfie_url ?? null,
    _utm_source: input.utm_source ?? null,
    _utm_medium: input.utm_medium ?? null,
    _utm_campaign: input.utm_campaign ?? null,
  });
  if (error) throw error;
  return data as { success: boolean; application_id: string; status: string };
}

export async function approvePartnerApplication(id: string, notes?: string) {
  const { data, error } = await supabase.rpc("approve_partner_application", {
    _application_id: id,
    _notes: notes ?? null,
  });
  if (error) throw error;
  return data as { success: boolean; dsa_id: string; lead_id: string | null; application_id: string };
}

export async function rejectPartnerApplication(id: string, reason: string) {
  const { data, error } = await supabase.rpc("reject_partner_application", {
    _application_id: id,
    _reason: reason,
  });
  if (error) throw error;
  return data as { success: boolean };
}

export async function listPartnerApplications(status?: PartnerApplication["status"]) {
  let q = supabase.from("partner_applications").select("*").order("created_at", { ascending: false });
  if (status) q = q.eq("status", status);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as PartnerApplication[];
}

/** Upload KYC doc for an unauthenticated public applicant — uses 'public/<random>/' folder. */
export async function uploadKycDoc(file: File, label: string): Promise<string> {
  const ext = file.name.split(".").pop() || "bin";
  const folder = "public/" + crypto.randomUUID();
  const path = `${folder}/${label}-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from("kyc-documents").upload(path, file, {
    cacheControl: "3600",
    upsert: false,
  });
  if (error) throw error;
  // Path-based reference (private bucket); admin can fetch a signed URL on review.
  return path;
}

export async function getKycSignedUrl(path: string, expiresInSec = 3600) {
  const { data, error } = await supabase.storage.from("kyc-documents").createSignedUrl(path, expiresInSec);
  if (error) throw error;
  return data.signedUrl;
}

export const PRODUCT_OPTIONS = [
  { value: "personal_loan", label: "Personal Loan" },
  { value: "business_loan", label: "Business Loan" },
  { value: "home_loan", label: "Home Loan" },
  { value: "lap", label: "Loan Against Property" },
  { value: "credit_card", label: "Credit Card" },
  { value: "insurance", label: "Insurance" },
  { value: "investment", label: "Investments / MF" },
];

export const STATUS_LABEL: Record<PartnerApplication["status"], { label: string; color: string }> = {
  pending: { label: "Pending Review", color: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30" },
  under_review: { label: "Under Review", color: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30" },
  approved: { label: "Approved", color: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30" },
  rejected: { label: "Rejected", color: "bg-destructive/15 text-destructive border-destructive/30" },
};
