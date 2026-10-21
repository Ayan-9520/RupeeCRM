import type { EligibilityEngineResult } from "./eligibility-types";
import type { CustomerProfile } from "./types";

export function buildEligibilitySnapshot(profile: CustomerProfile, result: EligibilityEngineResult) {
  const { financial: fin, metrics: m, risk, lenders, products, validations, primaryProduct } = result;
  const base = {
    customer_profile_id: profile.id,
    lead_purchase_id: profile.lead_purchase_id,
    dsa_id: profile.dsa_id,
  };

  const financial = {
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

  const riskProfile = {
    ...base,
    cibil_score: risk.cibilScore,
    risk_grade: risk.riskGrade,
    banking_stability: risk.bankingStability,
    foir_health: risk.foirHealth,
    eligibility_status: risk.eligibilityStatus,
    workflow_stage: risk.workflowStage,
    validation_issues: validations,
  };

  const report = {
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

  return { financial, riskProfile, report };
}

/** No eligibility snapshot API or table exists yet; the live calculation is not stored. */
export async function persistEligibilitySnapshot(
  _profile: CustomerProfile,
  _result: EligibilityEngineResult,
): Promise<{ ok: boolean; notStored?: boolean }> {
  return { ok: false, notStored: true };
}

export async function updateWorkflowStage(_profileId: string, _stage: string): Promise<boolean> {
  return false;
}
