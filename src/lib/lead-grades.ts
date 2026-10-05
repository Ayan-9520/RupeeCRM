export const GRADE_LABELS: Record<string, string> = {
  L0: "Raw",
  L1: "Contactable",
  L2: "Interested",
  L3: "Verified",
  L4: "Eligible",
  L5: "Document Ready",
  L6: "Application Ready",
  Login: "Login",
  Sanction: "Sanction",
  Disbursement: "Disbursement",
};

const PIPELINE_GRADE: Record<string, string> = {
  new: "L0",
  contacted: "L1",
  interested: "L2",
  verified: "L3",
  eligible: "L4",
  docs_collected: "L5",
  docs: "L5",
  application_ready: "L6",
  bank_submitted: "Login",
  submitted: "Login",
  sanctioned: "Sanction",
  approved: "Sanction",
  disbursed: "Disbursement",
};

export function gradeFromPipeline(stage: string | null | undefined) {
  const key = (stage || "").toLowerCase();
  if (key && key !== "new" && PIPELINE_GRADE[key]) return PIPELINE_GRADE[key];
  return null;
}

export function gradeCode(input: {
  pipeline_stage?: string | null;
  phone_verified?: boolean;
  monthly_income?: number | null;
  loan_amount?: number | null;
  employment_type?: string | null;
  score?: string | null;
  full_phone?: string | null;
  product_details?: Record<string, unknown> | null;
  lead_grade?: string | null;
}) {
  if (input.lead_grade && GRADE_LABELS[input.lead_grade]) return input.lead_grade;
  const fromStage = gradeFromPipeline(input.pipeline_stage);
  if (fromStage) return fromStage;
  if (input.product_details?.documents_ready) return "L5";
  if (input.phone_verified && input.monthly_income && input.loan_amount) return "L4";
  if (input.phone_verified || (input.monthly_income && input.employment_type)) return "L3";
  if (input.score === "warm" || input.score === "hot") return "L2";
  if (input.full_phone) return "L1";
  return "L0";
}

export function gradeText(code: string) {
  const label = GRADE_LABELS[code] || code;
  return code === label ? label : `${code} ${label}`;
}

export function listingType(price: number, details?: Record<string, unknown> | null, given?: string | null) {
  const raw = String(given || details?.listing_type || "").toLowerCase();
  if (raw === "shared" || raw === "exclusive") return raw;
  return price >= 299 ? "exclusive" : "shared";
}

export function ageLabel(iso: string | null | undefined, now = Date.now()) {
  if (!iso) return "—";
  const ms = now - new Date(iso).getTime();
  const mins = Math.max(1, Math.round(ms / 60000));
  if (mins < 60) return `${mins} min`;
  const hrs = Math.round(mins / 60);
  if (hrs < 48) return `${hrs} hrs`;
  return `${Math.round(hrs / 24)} days`;
}
