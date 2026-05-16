/** CRM field schema for purchased leads — maps UI fields to Supabase storage. */

export type FieldStorage = "leads" | "product_details" | "crm_profile";

export type CrmFieldType = "text" | "number" | "email" | "tel" | "date" | "select" | "textarea";

export type CrmFieldDef = {
  key: string;
  label: string;
  storage: FieldStorage;
  type: CrmFieldType;
  options?: string[];
  readOnly?: boolean;
  /** Read from application_draft in purchase notes when DB value empty */
  draftKey?: string;
  placeholder?: string;
};

export type CrmSectionDef = {
  id: string;
  title: string;
  fields: CrmFieldDef[];
};

export type LeadCrmLead = {
  id: string;
  applicant_name: string;
  full_phone: string;
  alternate_phone: string | null;
  email: string | null;
  city: string;
  state: string | null;
  loan_amount: number;
  monthly_income: number | null;
  employment_type: string | null;
  company_name: string | null;
  cibil_score: number | null;
  age: number | null;
  gender: string | null;
  score: string;
  product_category: string;
  product_subtype: string | null;
  product_type_id: string | null;
  product_details: Record<string, unknown>;
  source: string | null;
  notes: string | null;
  loan_type?: string | null;
  sum_insured?: number | null;
  card_type?: string | null;
  family_members?: number | null;
  phone_verified?: boolean;
  quality_score?: number | null;
  fraud_risk?: string | null;
  remarks?: string | null;
  internal_notes?: string | null;
  created_at: string;
};

export type ApplicationDraft = {
  pan?: string;
  existing_emi?: string;
  purpose?: string;
  full_name?: string;
  email?: string;
  city?: string;
  age?: string;
  gender?: string;
  loan_amount?: string;
  monthly_income?: string;
  employment_type?: string;
  cibil_score?: string;
  company_name?: string;
};

const EMPLOYMENT_OPTIONS = ["Salaried", "Self-employed", "Business owner", "Freelancer", "Other"];
const GENDER_OPTIONS = ["Male", "Female", "Other"];
const KYC_STATUS_OPTIONS = ["Pending", "In progress", "Verified", "Rejected"];
const PROCESSING_STATUS_OPTIONS = [
  "Not started",
  "Logged in",
  "Under review",
  "Sanctioned",
  "Disbursed",
  "Rejected",
  "Withdrawn",
];
const ACCOUNT_TYPE_OPTIONS = ["Savings", "Current", "Salary"];

export const CRM_SECTIONS: CrmSectionDef[] = [
  {
    id: "personal",
    title: "Personal Details",
    fields: [
      { key: "applicant_name", label: "Full name", storage: "leads", type: "text", draftKey: "full_name" },
      { key: "full_phone", label: "Mobile", storage: "leads", type: "tel", readOnly: true },
      { key: "alternate_phone", label: "Alternate phone", storage: "leads", type: "tel" },
      { key: "email", label: "Email", storage: "leads", type: "email", draftKey: "email" },
      { key: "city", label: "City", storage: "leads", type: "text", draftKey: "city" },
      { key: "state", label: "State", storage: "leads", type: "text" },
      { key: "address", label: "Address", storage: "product_details", type: "textarea" },
      { key: "age", label: "Age", storage: "leads", type: "number", draftKey: "age" },
      { key: "gender", label: "Gender", storage: "leads", type: "select", options: GENDER_OPTIONS, draftKey: "gender" },
      { key: "family_members", label: "Family members", storage: "leads", type: "number" },
      { key: "dob", label: "Date of birth", storage: "crm_profile", type: "date" },
      { key: "marital_status", label: "Marital status", storage: "crm_profile", type: "select", options: ["Single", "Married", "Divorced", "Widowed"] },
    ],
  },
  {
    id: "employment",
    title: "Employment Details",
    fields: [
      {
        key: "employment_type",
        label: "Employment type",
        storage: "leads",
        type: "select",
        options: EMPLOYMENT_OPTIONS,
        draftKey: "employment_type",
      },
      { key: "company_name", label: "Company / business", storage: "leads", type: "text", draftKey: "company_name" },
      {
        key: "monthly_income",
        label: "Monthly income (₹)",
        storage: "leads",
        type: "number",
        draftKey: "monthly_income",
      },
      { key: "designation", label: "Designation", storage: "crm_profile", type: "text" },
      { key: "experience_years", label: "Years in current job", storage: "crm_profile", type: "number" },
      { key: "office_address", label: "Office address", storage: "crm_profile", type: "textarea" },
    ],
  },
  {
    id: "banking",
    title: "Banking Details",
    fields: [
      { key: "pan", label: "PAN", storage: "product_details", type: "text", draftKey: "pan", placeholder: "ABCDE1234F" },
      { key: "bank_name", label: "Bank name", storage: "crm_profile", type: "text" },
      { key: "ifsc", label: "IFSC", storage: "crm_profile", type: "text", placeholder: "HDFC0001234" },
      { key: "account_number", label: "Account number", storage: "crm_profile", type: "text" },
      { key: "account_holder_name", label: "Account holder name", storage: "crm_profile", type: "text" },
      { key: "account_type", label: "Account type", storage: "crm_profile", type: "select", options: ACCOUNT_TYPE_OPTIONS },
    ],
  },
  {
    id: "loan",
    title: "Loan Details",
    fields: [
      { key: "loan_amount", label: "Loan / ticket amount (₹)", storage: "leads", type: "number", draftKey: "loan_amount" },
      { key: "loan_type", label: "Loan type", storage: "product_details", type: "text" },
      { key: "product_subtype", label: "Product subtype", storage: "leads", type: "text" },
      { key: "tenure_months", label: "Tenure (months)", storage: "product_details", type: "number" },
      { key: "roi_percent", label: "ROI (%)", storage: "product_details", type: "number" },
      { key: "existing_emi", label: "Existing EMI (₹)", storage: "product_details", type: "number", draftKey: "existing_emi" },
      { key: "purpose", label: "Loan purpose", storage: "product_details", type: "text", draftKey: "purpose" },
      { key: "sum_insured", label: "Sum insured (₹)", storage: "leads", type: "number" },
      { key: "card_type", label: "Card type", storage: "leads", type: "text" },
      { key: "cibil_score", label: "CIBIL score", storage: "leads", type: "number", draftKey: "cibil_score" },
    ],
  },
  {
    id: "kyc",
    title: "KYC Details",
    fields: [
      { key: "kyc_status", label: "KYC status", storage: "crm_profile", type: "select", options: KYC_STATUS_OPTIONS },
      { key: "pan_verified", label: "PAN verified", storage: "crm_profile", type: "select", options: ["Yes", "No"] },
      { key: "aadhaar_verified", label: "Aadhaar verified", storage: "crm_profile", type: "select", options: ["Yes", "No"] },
      { key: "aadhaar_last4", label: "Aadhaar (last 4)", storage: "crm_profile", type: "text", placeholder: "1234" },
      { key: "ckyc_id", label: "CKYC ID", storage: "crm_profile", type: "text" },
    ],
  },
  {
    id: "processing",
    title: "Banker Processing",
    fields: [
      {
        key: "processing_status",
        label: "Processing status",
        storage: "crm_profile",
        type: "select",
        options: PROCESSING_STATUS_OPTIONS,
      },
      { key: "lender_name", label: "Lender / bank", storage: "crm_profile", type: "text" },
      { key: "login_id", label: "Login / file ID", storage: "crm_profile", type: "text" },
      { key: "login_date", label: "Login date", storage: "crm_profile", type: "date" },
      { key: "sanction_amount", label: "Sanction amount (₹)", storage: "crm_profile", type: "number" },
      { key: "sanctioned_roi", label: "Sanctioned ROI (%)", storage: "crm_profile", type: "number" },
      { key: "sanction_date", label: "Sanction date", storage: "crm_profile", type: "date" },
      { key: "disbursement_date", label: "Disbursement date", storage: "crm_profile", type: "date" },
      { key: "loan_account_no", label: "Loan account no.", storage: "crm_profile", type: "text" },
      { key: "file_ref", label: "File reference", storage: "crm_profile", type: "text" },
      { key: "rm_name", label: "RM / banker name", storage: "crm_profile", type: "text" },
      { key: "branch", label: "Branch", storage: "crm_profile", type: "text" },
      { key: "rejection_reason", label: "Rejection reason", storage: "crm_profile", type: "textarea" },
    ],
  },
];

const DRAFT_KIND = "application_draft";

export function extractApplicationDraft(
  notes: Array<{ kind?: string; data?: ApplicationDraft }>,
): ApplicationDraft | null {
  const draft = notes.find((n) => n.kind === DRAFT_KIND);
  return draft?.data ?? null;
}

export function getCrmFieldValue(
  field: CrmFieldDef,
  lead: LeadCrmLead,
  crmProfile: Record<string, unknown>,
  draft: ApplicationDraft | null,
): string {
  if (field.readOnly) {
    const v = (lead as Record<string, unknown>)[field.key];
    return v != null && v !== "" ? String(v) : "";
  }

  let raw: unknown;
  if (field.storage === "leads") {
    raw = (lead as Record<string, unknown>)[field.key];
  } else if (field.storage === "product_details") {
    raw = lead.product_details?.[field.key];
    if ((raw === null || raw === undefined || raw === "") && field.key === "loan_type") {
      raw = lead.product_subtype ?? lead.loan_type ?? null;
    }
  } else {
    raw = crmProfile[field.key];
  }

  if ((raw === null || raw === undefined || raw === "") && field.draftKey && draft) {
    raw = draft[field.draftKey as keyof ApplicationDraft];
  }

  if (raw === null || raw === undefined) return "";
  if (typeof raw === "boolean") return raw ? "Yes" : "No";
  return String(raw);
}

export function parseCrmFieldValue(field: CrmFieldDef, raw: string): unknown {
  const trimmed = raw.trim();
  if (!trimmed) return field.type === "number" ? null : "";
  if (field.type === "number") {
    const n = Number(trimmed.replace(/,/g, ""));
    return Number.isFinite(n) ? n : null;
  }
  return trimmed;
}

export function formatDisplayValue(field: CrmFieldDef, value: string): string {
  if (!value) return "";
  if (field.type === "number" && field.key !== "cibil_score" && field.key !== "age" && field.key !== "experience_years") {
    const n = Number(value.replace(/,/g, ""));
    if (Number.isFinite(n) && n >= 1000) return `₹${n.toLocaleString("en-IN")}`;
  }
  return value;
}
