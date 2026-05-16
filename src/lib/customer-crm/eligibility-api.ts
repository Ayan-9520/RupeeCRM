import { supabase } from "@/integrations/supabase/client";
import type { EligibilityEngineResult } from "./eligibility-types";
import type { CustomerProfile } from "./types";

function isMissingTableError(message: string): boolean {
  return /does not exist|relation.*not found|42P01/i.test(message);
}

export async function persistEligibilitySnapshot(
  profile: CustomerProfile,
  result: EligibilityEngineResult,
): Promise<{ ok: boolean; migrationRequired?: boolean }> {
  const { financial: fin, metrics: m, risk, lenders, products, validations, primaryProduct } = result;
  const base = {
    customer_profile_id: profile.id,
    lead_purchase_id: profile.lead_purchase_id,
    dsa_id: profile.dsa_id,
  };

  const finRow = {
    ...base,
    gross_income: fin.grossIncome,
    net_income: fin.netIncome,
    household_income: fin.householdIncome,
    co_applicant_income: fin.coApplicantIncome,
    business_turnover: fin.businessTurnover,
    annual_income: fin.annualIncome,
    total_emi: fin.totalEmi,
    credit_card_emi: fin.creditCardEmi,
    od_cc_obligations: fin.odCcObligations,
    other_obligations: fin.otherObligations,
    avg_balance: fin.avgBalance,
    salary_credit_stable: fin.salaryCreditStable,
    emi_bounce_count: fin.emiBounceCount,
    computed_at: result.computedAt,
  };

  const riskRow = {
    ...base,
    cibil_score: risk.cibilScore,
    risk_grade: risk.riskGrade,
    banking_stability: risk.bankingStability,
    foir_health: risk.foirHealth,
    eligibility_status: risk.eligibilityStatus,
    workflow_stage: risk.workflowStage,
    validation_issues: validations,
  };

  const reportRow = {
    ...base,
    primary_product_type: primaryProduct,
    foir_percent: m.foirPercent,
    dbr_percent: m.dbrPercent,
    emi_income_ratio: m.emiIncomeRatio,
    eligible_emi: m.eligibleEmi,
    eligible_amount: m.eligibleAmount,
    estimated_roi: m.estimatedRoi,
    recommended_tenure: m.recommendedTenure,
    ltv_percent: m.ltvPercent,
    approval_probability: m.approvalProbability,
    product_calculations: products,
    lender_recommendations: lenders,
    snapshot: result,
    computed_at: result.computedAt,
  };

  const { error: e1 } = await supabase.from("customer_financial_summary").upsert(finRow, { onConflict: "customer_profile_id" });
  if (e1) {
    if (isMissingTableError(e1.message)) return { ok: false, migrationRequired: true };
    console.warn("financial summary save:", e1.message);
    return { ok: false };
  }

  const { error: e2 } = await supabase.from("customer_risk_profiles").upsert(riskRow, { onConflict: "customer_profile_id" });
  if (e2) {
    if (isMissingTableError(e2.message)) return { ok: false, migrationRequired: true };
    console.warn("risk profile save:", e2.message);
    return { ok: false };
  }

  const { error: e3 } = await supabase.from("customer_eligibility_reports").upsert(reportRow, { onConflict: "customer_profile_id" });
  if (e3) {
    if (isMissingTableError(e3.message)) return { ok: false, migrationRequired: true };
    console.warn("eligibility report save:", e3.message);
    return { ok: false };
  }

  return { ok: true };
}

export async function updateWorkflowStage(
  profileId: string,
  stage: string,
): Promise<boolean> {
  const { error } = await supabase
    .from("customer_risk_profiles")
    .update({ workflow_stage: stage })
    .eq("customer_profile_id", profileId);
  if (error && isMissingTableError(error.message)) return false;
  return !error;
}
