import type { CustomerWorkspaceData } from "./types";
import type { EligibilityEngineResult } from "./eligibility-types";
import type { RISK_LEVELS } from "./phase5-constants";

export type RiskLevel = (typeof RISK_LEVELS)[number];

export type CustomerRiskScore = {
  level: RiskLevel;
  score: number;
  cibilFactor: number;
  foirFactor: number;
  incomeFactor: number;
  bankingFactor: number;
  obligationFactor: number;
  recommendations: string[];
  warnings: string[];
};

export function computeCustomerRisk(
  ws: CustomerWorkspaceData,
  eligibility: EligibilityEngineResult | null,
): CustomerRiskScore {
  const recommendations: string[] = [];
  const warnings: string[] = [];

  const cibil = eligibility?.risk.cibilScore ?? ws.purchase.lead?.cibil_score ?? null;
  let cibilFactor = 70;
  if (cibil != null) {
    if (cibil >= 750) cibilFactor = 95;
    else if (cibil >= 700) cibilFactor = 80;
    else if (cibil >= 650) cibilFactor = 60;
    else {
      cibilFactor = 35;
      warnings.push("CIBIL below 650 — high risk");
    }
  } else warnings.push("CIBIL not available");

  const foir = eligibility?.metrics.foirPercent ?? null;
  let foirFactor = 75;
  if (foir != null) {
    if (foir <= 40) foirFactor = 95;
    else if (foir <= 55) foirFactor = 70;
    else if (foir <= 65) {
      foirFactor = 45;
      warnings.push("FOIR elevated");
    } else {
      foirFactor = 25;
      warnings.push("FOIR too high for most lenders");
    }
  }

  const income = eligibility?.financial.householdIncome ?? (Number(ws.profile.monthly_income) || 0);
  let incomeFactor = income >= 50000 ? 90 : income >= 25000 ? 75 : income >= 15000 ? 55 : 35;
  if (income < 20000) warnings.push("Income below typical salaried PL threshold");

  const banking = eligibility?.financial;
  let bankingFactor = 70;
  if (banking) {
    if (banking.salaryCreditStable && banking.emiBounceCount === 0) bankingFactor = 92;
    else if (banking.emiBounceCount >= 2) {
      bankingFactor = 40;
      warnings.push("EMI bounce history");
    }
  }

  const oblCount = ws.obligations.length;
  let obligationFactor = oblCount === 0 ? 90 : oblCount <= 2 ? 75 : oblCount <= 4 ? 55 : 35;

  const score = Math.round((cibilFactor + foirFactor + incomeFactor + bankingFactor + obligationFactor) / 5);
  let level: RiskLevel = "medium";
  if (score >= 80) level = "low";
  else if (score < 50) level = "high";

  if (level === "low") recommendations.push("Eligible for premium lenders and faster processing");
  if (level === "medium") recommendations.push("Standard documentation and co-applicant may improve terms");
  if (level === "high") recommendations.push("Consider debt consolidation or co-applicant before bank login");

  return {
    level,
    score,
    cibilFactor,
    foirFactor,
    incomeFactor,
    bankingFactor,
    obligationFactor,
    recommendations,
    warnings,
  };
}

export const RISK_BADGE: Record<RiskLevel, string> = {
  low: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  medium: "bg-amber-500/15 text-amber-800 dark:text-amber-400",
  high: "bg-destructive/15 text-destructive",
};
