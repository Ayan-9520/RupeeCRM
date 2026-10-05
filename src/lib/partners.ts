import {
  approveCrmPartner,
  importCrmPartner,
  listCrmPartners,
  rejectCrmPartner,
  API_URL,
  type CrmPartnerApplication,
} from "@/lib/python-api";

export type PartnerApplication = CrmPartnerApplication;

export async function listPartnerApplications(status?: PartnerApplication["status"] | "all") {
  const data = await listCrmPartners(status === "all" ? undefined : status);
  return data.items;
}

export async function approvePartnerApplication(id: string, notes?: string) {
  return approveCrmPartner(id, notes);
}

export async function rejectPartnerApplication(id: string, reason: string) {
  return rejectCrmPartner(id, reason);
}

/** One-time: pull a Hostinger MySQL row into CRM by pasting fields */
export async function importWebsitePartner(input: {
  website_lead_id: string;
  full_name: string;
  phone: string;
  email: string;
  city: string;
  ref_code?: string;
  dsa_type?: string;
}) {
  return importCrmPartner(input);
}

/** CRM become-partner form → public partners API (docs stored as metadata URLs). */
export async function submitPartnerApplication(input: {
  full_name: string;
  email: string;
  phone: string;
  city: string;
  state?: string;
  pincode?: string;
  company_name?: string;
  experience_years?: number;
  products?: string[];
  monthly_target?: number;
  pan?: string;
  aadhaar_last4?: string;
  bank_account?: string;
  ifsc?: string;
  account_holder?: string;
  pan_doc_url?: string;
  aadhaar_doc_url?: string;
  bank_proof_url?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  dsa_type?: string;
}): Promise<{ application_id: string; website_lead_id: string }> {
  const key =
    (import.meta.env.VITE_PUBLIC_API_KEY as string | undefined) || "rupeedial-website-key-change-me";
  const website_lead_id = `crm-apply-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const documents: Record<string, unknown> = {};
  if (input.pan) documents.pan = input.pan;
  if (input.aadhaar_last4) documents.aadhaar_last4 = input.aadhaar_last4;
  if (input.bank_account) documents.bank_account = input.bank_account;
  if (input.ifsc) documents.ifsc = input.ifsc;
  if (input.account_holder) documents.account_holder = input.account_holder;
  if (input.pan_doc_url) documents.pan_doc = input.pan_doc_url;
  if (input.aadhaar_doc_url) documents.aadhaar_doc = input.aadhaar_doc_url;
  if (input.bank_proof_url) documents.bank_proof = input.bank_proof_url;
  if (input.company_name) documents.company_name = input.company_name;
  if (input.pincode) documents.pincode = input.pincode;
  if (input.experience_years != null) documents.experience_years = String(input.experience_years);
  if (input.monthly_target != null) documents.monthly_target = String(input.monthly_target);
  if (input.products?.length) documents.products = input.products.join(",");
  documents.journey = {
    kyc: input.pan ? "submitted" : "pending",
    verification: "pending",
    agreement: "accepted",
    bank: input.bank_account ? "submitted" : "pending",
    products: input.products?.length ? "selected" : "pending",
    geography: "submitted",
    experience: input.experience_years != null ? "submitted" : "pending",
    training: "pending",
    activation: "pending",
  };

  const res = await fetch(`${API_URL}/api/public/partners`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": key,
    },
    body: JSON.stringify({
      website_lead_id,
      full_name: input.full_name,
      phone: input.phone,
      email: input.email,
      city: input.city,
      state: input.state || null,
      dsa_type: input.dsa_type || "channel",
      ref_code: input.utm_source || null,
      documents,
    }),
  });
  if (!res.ok) {
    let detail = `Submit failed (${res.status})`;
    try {
      const body = await res.json();
      if (typeof body?.detail === "string") detail = body.detail;
    } catch {
      /* ignore */
    }
    throw new Error(detail);
  }
  const data = (await res.json()) as { id: string; website_lead_id: string };
  return { application_id: data.id, website_lead_id: data.website_lead_id };
}

/**
 * Local KYC placeholder — stores a data-URL so apply flow works without object storage.
 * Replace with S3/R2 upload later.
 */
export async function uploadKycDoc(file: File, _label: string): Promise<string> {
  if (file.size > 5 * 1024 * 1024) throw new Error("File too large (max 5MB)");
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.readAsDataURL(file);
  });
}

export async function getKycSignedUrl(_path: string, _expiresInSec = 3600) {
  return "";
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

export const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  pending: { label: "Pending Review", color: "bg-amber-50 text-amber-700 border-amber-200" },
  under_review: { label: "Under Review", color: "bg-sky-50 text-sky-700 border-sky-200" },
  approved: { label: "Approved", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  rejected: { label: "Rejected", color: "bg-red-50 text-red-600 border-red-200" },
};
