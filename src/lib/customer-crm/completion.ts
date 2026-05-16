import type { BankAccount, CoApplicant, CustomerProfile, LoanRequirement, Obligation } from "./types";

function filled(v: unknown): boolean {
  if (v === null || v === undefined) return false;
  if (typeof v === "string") return v.trim().length > 0;
  if (typeof v === "number") return !Number.isNaN(v);
  if (typeof v === "boolean") return true;
  return true;
}

const PERSONAL_KEYS: (keyof CustomerProfile)[] = [
  "full_name",
  "mobile",
  "email",
  "dob",
  "gender",
  "pan",
  "city",
  "state",
  "pincode",
  "current_address",
];

const EMPLOYMENT_KEYS: (keyof CustomerProfile)[] = [
  "employment_type",
  "monthly_income",
];

function pct(filledCount: number, total: number): number {
  if (total === 0) return 100;
  return Math.round((filledCount / total) * 100);
}

export function sectionCompletion(
  section: string,
  profile: CustomerProfile,
  banks: BankAccount[],
  obligations: Obligation[],
  coApps: CoApplicant[],
  loans: LoanRequirement[],
): number {
  switch (section) {
    case "personal": {
      const n = PERSONAL_KEYS.filter((k) => filled(profile[k])).length;
      return pct(n, PERSONAL_KEYS.length);
    }
    case "employment": {
      const keys = [...EMPLOYMENT_KEYS];
      if (profile.employment_type === "Salaried") keys.push("company_name", "net_salary");
      if (profile.employment_type === "Self-employed" || profile.employment_type === "Business")
        keys.push("business_name", "annual_turnover");
      const n = keys.filter((k) => filled(profile[k])).length;
      return pct(n, keys.length || 1);
    }
    case "banking":
      if (banks.length === 0) return 0;
      return pct(
        banks.filter((b) => filled(b.bank_name) && filled(b.account_type)).length,
        banks.length,
      );
    case "obligations":
      if (obligations.length === 0) return 50;
      return pct(
        obligations.filter((o) => filled(o.loan_type) && filled(o.emi)).length,
        obligations.length,
      );
    case "co-applicant":
      if (coApps.length === 0) return 0;
      return pct(coApps.filter((c) => filled(c.full_name) && filled(c.relation)).length, coApps.length);
    case "loan-requirements":
      if (loans.length === 0) return 0;
      return pct(loans.filter((l) => filled(l.product_type) && filled(l.loan_amount)).length, loans.length);
    default:
      return 0;
  }
}

export function overallCompletion(
  profile: CustomerProfile,
  banks: BankAccount[],
  obligations: Obligation[],
  coApps: CoApplicant[],
  loans: LoanRequirement[],
): number {
  const sections = ["personal", "employment", "banking", "obligations", "co-applicant", "loan-requirements"];
  const sum = sections.reduce(
    (acc, s) => acc + sectionCompletion(s, profile, banks, obligations, coApps, loans),
    0,
  );
  return Math.round(sum / sections.length);
}
