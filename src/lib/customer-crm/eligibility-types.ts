import type { CustomerWorkspaceData } from "./types";

export type EligibilityBadge = "strong" | "moderate" | "risky" | "reject";

export type WorkflowStage =
  | "profile_completed"
  | "eligibility_checked"
  | "approved_for_login"
  | "not_eligible"
  | "need_co_applicant";

export const WORKFLOW_STAGES: { value: WorkflowStage; label: string }[] = [
  { value: "profile_completed", label: "Profile Completed" },
  { value: "eligibility_checked", label: "Eligibility Checked" },
  { value: "approved_for_login", label: "Approved for Login" },
  { value: "not_eligible", label: "Not Eligible" },
  { value: "need_co_applicant", label: "Need Co-applicant" },
];

export type FinancialSummary = {
  grossIncome: number;
  netIncome: number;
  householdIncome: number;
  coApplicantIncome: number;
  businessTurnover: number;
  annualIncome: number;
  totalEmi: number;
  creditCardEmi: number;
  odCcObligations: number;
  otherObligations: number;
  avgBalance: number;
  salaryCreditStable: boolean;
  emiBounceCount: number;
};

export type EligibilityMetrics = {
  foirPercent: number | null;
  dbrPercent: number | null;
  emiIncomeRatio: number | null;
  eligibleEmi: number | null;
  eligibleAmount: number | null;
  estimatedRoi: number | null;
  recommendedTenure: number | null;
  ltvPercent: number | null;
  approvalProbability: number | null;
};

export type ProductEligibility = {
  productType: string;
  requestedAmount: number | null;
  eligibleAmount: number | null;
  maxTenure: number | null;
  ltvPercent: number | null;
  notes: string[];
  passed: boolean;
};

export type RiskProfile = {
  cibilScore: number | null;
  riskGrade: EligibilityBadge;
  bankingStability: EligibilityBadge;
  foirHealth: EligibilityBadge;
  eligibilityStatus: EligibilityBadge;
  workflowStage: WorkflowStage;
};

export type LenderRecommendation = {
  lenderName: string;
  product: string;
  approvalChance: number;
  reason: string;
  priority: "high" | "medium" | "low";
};

export type ValidationIssue = {
  code: string;
  message: string;
  severity: "error" | "warning";
};

export type EligibilityEngineResult = {
  primaryProduct: string;
  financial: FinancialSummary;
  metrics: EligibilityMetrics;
  products: ProductEligibility[];
  risk: RiskProfile;
  lenders: LenderRecommendation[];
  validations: ValidationIssue[];
  computedAt: string;
};

export type EligibilityEngineInput = CustomerWorkspaceData & {
  leadCibil?: number | null;
};
