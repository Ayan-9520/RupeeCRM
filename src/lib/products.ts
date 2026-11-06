import type { Database } from "@/integrations/supabase/types";

export type ProductCategory = Database["public"]["Enums"]["product_category"];
export type ProductType = Database["public"]["Tables"]["product_types"]["Row"];
export type PipelineStage = { key: string; label: string; color: string };
export type Pipeline = Omit<Database["public"]["Tables"]["product_pipelines"]["Row"], "stages"> & {
  stages: PipelineStage[];
};

export const CATEGORIES: { key: ProductCategory; label: string; color: string; icon: string; tagline: string }[] = [
  { key: "loan", label: "Loans", color: "green", icon: "Banknote", tagline: "Every retail & SME loan product" },
  { key: "insurance", label: "Insurance", color: "green", icon: "ShieldCheck", tagline: "Life, Health & General" },
  { key: "credit_card", label: "Credit Cards", color: "orange", icon: "CreditCard", tagline: "All major issuers" },
  { key: "investment", label: "Investments", color: "purple", icon: "LineChart", tagline: "Wealth & savings products" },
];

export const CATEGORY_META: Record<ProductCategory, { label: string; color: string; chipBg: string; chipText: string; cardAccent: string }> = {
  loan: {
    label: "Loan",
    color: "green",
    chipBg: "bg-[#E8F7EC]",
    chipText: "text-[#0e4d28]",
    cardAccent: "from-[#10662A]/15 to-[#E8F7EC]",
  },
  insurance: {
    label: "Insurance",
    color: "green",
    chipBg: "bg-emerald-500/15",
    chipText: "text-emerald-700 dark:text-emerald-300",
    cardAccent: "from-emerald-500/20 to-emerald-500/5",
  },
  credit_card: {
    label: "Card",
    color: "orange",
    chipBg: "bg-orange-500/15",
    chipText: "text-orange-700 dark:text-orange-300",
    cardAccent: "from-orange-500/20 to-orange-500/5",
  },
  investment: {
    label: "Investment",
    color: "purple",
    chipBg: "bg-[#F4F0FA]",
    chipText: "text-[#390A5D]",
    cardAccent: "from-[#390A5D]/12 to-[#F4F0FA]",
  },
};

export function payoutLabel(pt: Pick<ProductType, "category" | "commission_pct_min" | "commission_pct_max" | "commission_flat_min" | "commission_flat_max">) {
  if (pt.commission_pct_max > 0) {
    const lo = Number(pt.commission_pct_min);
    const hi = Number(pt.commission_pct_max);
    return lo === hi ? `${lo}% per ${pt.category === "insurance" ? "policy" : "deal"}` : `${lo}–${hi}% per ${pt.category === "insurance" ? "policy" : "deal"}`;
  }
  if (pt.commission_flat_max > 0) {
    const lo = Number(pt.commission_flat_min);
    const hi = Number(pt.commission_flat_max);
    return `₹${lo.toLocaleString("en-IN")}–₹${hi.toLocaleString("en-IN")} per card`;
  }
  return "—";
}

export function calcCommission(pt: Pick<ProductType, "commission_pct_min" | "commission_pct_max" | "commission_flat_min" | "commission_flat_max">, dealValue: number) {
  const pctAvg = (Number(pt.commission_pct_min) + Number(pt.commission_pct_max)) / 2;
  const flatAvg = (Number(pt.commission_flat_min) + Number(pt.commission_flat_max)) / 2;
  return Math.round(dealValue * (pctAvg / 100) + flatAvg);
}

/** Field schema for the dynamic lead form, by category */
export type LeadFieldType = "number" | "text" | "select";
export type LeadField = {
  key: string;
  label: string;
  type: LeadFieldType;
  options?: string[];
  required?: boolean;
  placeholder?: string;
};

export const LEAD_FIELDS: Record<ProductCategory, LeadField[]> = {
  loan: [
    { key: "loan_amount", label: "Loan amount (₹)", type: "number", required: true, placeholder: "500000" },
    { key: "monthly_income", label: "Monthly income (₹)", type: "number", placeholder: "50000" },
    { key: "employment_type", label: "Employment type", type: "select", options: ["Salaried", "Self-employed", "Business owner", "Freelancer"] },
    { key: "cibil", label: "CIBIL score (optional)", type: "number", placeholder: "750" },
  ],
  insurance: [
    { key: "age", label: "Age", type: "number", required: true, placeholder: "32" },
    { key: "gender", label: "Gender", type: "select", options: ["Male", "Female", "Other"], required: true },
    { key: "sum_insured", label: "Sum insured (₹)", type: "number", required: true, placeholder: "500000" },
    { key: "family_members", label: "Family members covered", type: "number", placeholder: "4" },
    { key: "existing_policy", label: "Existing policy?", type: "select", options: ["No", "Yes"] },
  ],
  credit_card: [
    { key: "monthly_income", label: "Monthly income (₹)", type: "number", required: true, placeholder: "50000" },
    { key: "employment_type", label: "Employment type", type: "select", options: ["Salaried", "Self-employed", "Business owner"] },
  ],
  investment: [
    { key: "investment_amount", label: "Investment amount (₹)", type: "number", required: true, placeholder: "100000" },
    { key: "risk_profile", label: "Risk profile", type: "select", options: ["Conservative", "Moderate", "Aggressive"], required: true },
  ],
};
