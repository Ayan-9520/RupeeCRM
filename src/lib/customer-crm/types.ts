/** Phase 1 LOS/CRM — local types (apply migration then regenerate Supabase types) */

export type CustomerSectionId =
  | "personal"
  | "employment"
  | "banking"
  | "obligations"
  | "co-applicants"
  | "loan-requirements"
  | "eligibility"
  | "documents"
  | "processing";

export type CustomerProfile = {
  id: string;
  lead_purchase_id: string;
  lead_id: string;
  dsa_id: string;
  workspace_id: string | null;
  full_name: string | null;
  mobile: string | null;
  alternate_mobile: string | null;
  email: string | null;
  dob: string | null;
  gender: string | null;
  marital_status: string | null;
  father_name: string | null;
  mother_name: string | null;
  pan: string | null;
  aadhaar: string | null;
  education: string | null;
  residence_type: string | null;
  current_address: string | null;
  permanent_address: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  family_members: number | null;
  employment_type: string | null;
  company_name: string | null;
  business_name: string | null;
  designation: string | null;
  industry_type: string | null;
  monthly_income: number | null;
  net_salary: number | null;
  annual_turnover: number | null;
  work_experience: string | null;
  business_vintage: string | null;
  salary_mode: string | null;
  gst_number: string | null;
  itr_filed: string | null;
  office_address: string | null;
  profile_completion: number;
  created_at: string;
  updated_at: string;
};

export type BankAccount = {
  id: string;
  customer_profile_id: string;
  lead_purchase_id: string;
  dsa_id: string;
  bank_name: string | null;
  account_type: string | null;
  account_vintage: string | null;
  average_balance: number | null;
  is_salary_account: boolean;
  emi_bounce_history: string | null;
  statement_available: boolean;
  is_primary: boolean;
  sort_order: number;
};

export type Obligation = {
  id: string;
  customer_profile_id: string;
  lead_purchase_id: string;
  dsa_id: string;
  loan_type: string | null;
  bank_name: string | null;
  emi: number | null;
  outstanding_amount: number | null;
  sanction_amount: number | null;
  remaining_tenure: number | null;
  start_date: string | null;
  overdue_status: string | null;
  sort_order: number;
};

export type CoApplicant = {
  id: string;
  customer_profile_id: string;
  lead_purchase_id: string;
  dsa_id: string;
  relation: string | null;
  full_name: string | null;
  mobile: string | null;
  pan: string | null;
  aadhaar: string | null;
  employment_type: string | null;
  income: number | null;
  obligations_summary: string | null;
  cibil_score: number | null;
  sort_order: number;
};

export type LoanRequirement = {
  id: string;
  customer_profile_id: string;
  lead_purchase_id: string;
  dsa_id: string;
  product_type: string | null;
  loan_amount: number | null;
  tenure_months: number | null;
  purpose: string | null;
  property_value: number | null;
  has_existing_loan: boolean;
  balance_transfer: boolean;
  top_up_required: boolean;
  insurance_type: string | null;
  roi_percent?: number | null;
  extra_fields?: Record<string, unknown>;
  sort_order: number;
};

export type PurchaseContext = {
  id: string;
  lead_id: string;
  pipeline_stage: string;
  price_paid: number;
  converted: boolean;
  next_followup_at: string | null;
  lead: {
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
    product_category: string;
    product_subtype: string | null;
    product_details: Record<string, unknown>;
  } | null;
};

export type CustomerWorkspaceData = {
  purchase: PurchaseContext;
  profile: CustomerProfile;
  bankAccounts: BankAccount[];
  obligations: Obligation[];
  coApplicants: CoApplicant[];
  loanRequirements: LoanRequirement[];
};
