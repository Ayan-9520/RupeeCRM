/** Website form → CRM field map (auto-fill + editable). */

export type FormFieldType = "text" | "number" | "email" | "tel" | "select" | "textarea";

export type FormFieldDef = {
  /** Canonical key stored in form state / product_details */
  key: string;
  label: string;
  /** lead column OR product_details key */
  source: "lead" | "details" | "purchase";
  type: FormFieldType;
  options?: string[];
  /** Alternate keys to read from (website camelCase / snake_case) */
  aliases?: string[];
};

export type FormSectionDef = {
  id: string;
  title: string;
  fields: FormFieldDef[];
};

const EMPLOYMENT = ["Salaried", "Self-employed", "Business owner", "Freelancer", "Other"];

/** Sections matching personal-loan website form + ops fields */
export const CRM_FORM_SECTIONS: FormSectionDef[] = [
  {
    id: "personal",
    title: "Personal details",
    fields: [
      { key: "applicant_name", label: "Full name", source: "lead", type: "text", aliases: ["fullName", "full_name"] },
      { key: "motherName", label: "Mother's name", source: "details", type: "text", aliases: ["mother_name"] },
      { key: "full_phone", label: "Mobile", source: "lead", type: "tel", aliases: ["mobile"] },
      { key: "email", label: "Email", source: "lead", type: "email" },
      { key: "officialEmail", label: "Official email", source: "details", type: "email", aliases: ["official_email"] },
      { key: "city", label: "City", source: "lead", type: "text" },
      { key: "state", label: "State", source: "lead", type: "text" },
    ],
  },
  {
    id: "employment",
    title: "Employment & income",
    fields: [
      { key: "employment_type", label: "Employment type", source: "lead", type: "select", options: EMPLOYMENT, aliases: ["employmentType"] },
      { key: "company_name", label: "Company / business", source: "lead", type: "text", aliases: ["companyType", "company_type"] },
      { key: "companyType", label: "Company type", source: "details", type: "text", aliases: ["company_type"] },
      { key: "workExperience", label: "Work experience", source: "details", type: "text", aliases: ["work_experience"] },
      { key: "monthly_income", label: "Monthly income (₹)", source: "lead", type: "number", aliases: ["formMonthlyIncome", "form_monthly_income"] },
      { key: "calcMonthlyIncome", label: "Calculated income (₹)", source: "details", type: "number", aliases: ["calc_monthly_income"] },
      { key: "existingEmi", label: "Existing EMI (₹)", source: "details", type: "number", aliases: ["existing_emi"] },
    ],
  },
  {
    id: "loan",
    title: "Loan requirement",
    fields: [
      { key: "loan_amount", label: "Loan amount (₹)", source: "lead", type: "number", aliases: ["loanAmount"] },
      { key: "loanType", label: "Loan type", source: "details", type: "text", aliases: ["loan_type"] },
      { key: "product_subtype", label: "Product", source: "lead", type: "text" },
      { key: "purpose", label: "Purpose", source: "details", type: "text" },
      { key: "score", label: "Lead score", source: "lead", type: "select", options: ["cold", "warm", "hot"] },
      { key: "deal_value", label: "Deal value (₹)", source: "purchase", type: "number" },
      { key: "next_followup_at", label: "Next follow-up", source: "purchase", type: "text" },
    ],
  },
  {
    id: "kyc",
    title: "KYC",
    fields: [
      { key: "pan", label: "PAN", source: "details", type: "text" },
      { key: "aadhaar", label: "Aadhaar", source: "details", type: "text" },
    ],
  },
  {
    id: "banking",
    title: "Bank / offer selected",
    fields: [
      { key: "primary_bank", label: "Primary bank", source: "details", type: "text", aliases: ["selectedBank", "selected_bank"] },
      { key: "interest_rate", label: "Interest rate (%)", source: "details", type: "number", aliases: ["selectedRate", "interestRate"] },
      { key: "emi", label: "EMI (₹)", source: "details", type: "number", aliases: ["selectedEmi"] },
    ],
  },
];

export function stringifyVal(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

/** Read first non-empty value from details bag using key + aliases */
export function readDetail(details: Record<string, unknown>, key: string, aliases?: string[]): string {
  for (const k of [key, ...(aliases || [])]) {
    if (k in details && details[k] !== null && details[k] !== undefined && details[k] !== "") {
      return stringifyVal(details[k]);
    }
  }
  return "";
}

export function getKnownDetailKeys(): Set<string> {
  const keys = new Set<string>();
  for (const s of CRM_FORM_SECTIONS) {
    for (const f of s.fields) {
      if (f.source === "details") {
        keys.add(f.key);
        for (const a of f.aliases || []) keys.add(a);
      }
    }
  }
  keys.add("lead_id");
  keys.add("form_source");
  keys.add("selected_banks");
  keys.add("documents");
  keys.add("banks");
  keys.add("formMonthlyIncome");
  keys.add("form_monthly_income");
  return keys;
}
