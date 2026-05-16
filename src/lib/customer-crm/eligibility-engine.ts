import type { BankAccount, CustomerProfile, LoanRequirement, Obligation } from "./types";
import type {
  EligibilityBadge,
  EligibilityEngineInput,
  EligibilityEngineResult,
  FinancialSummary,
  LenderRecommendation,
  ProductEligibility,
  RiskProfile,
  ValidationIssue,
  WorkflowStage,
} from "./eligibility-types";

const FOIR_CAP: Record<string, number> = {
  "home loan": 55,
  "personal loan": 50,
  "business loan": 65,
  lap: 60,
  "loan against property": 60,
  insurance: 20,
  "credit card": 40,
  od: 55,
  cc: 55,
  "auto loan": 50,
};

function normProduct(p: string | null | undefined): string {
  return (p ?? "personal loan").toLowerCase().trim();
}

function badgeFromScore(foir: number | null, cibil: number | null, bounces: number): EligibilityBadge {
  if (foir != null && foir > 70) return "reject";
  if (cibil != null && cibil < 600) return "reject";
  if (bounces >= 3) return "risky";
  if (foir != null && foir <= 40 && (cibil == null || cibil >= 750)) return "strong";
  if (foir != null && foir <= 55) return "moderate";
  return "risky";
}

function parseBounces(text: string | null): number {
  if (!text) return 0;
  const m = text.match(/\d+/);
  if (m) return Number(m[0]);
  if (/yes|bounce|default/i.test(text)) return 1;
  return 0;
}

function ageFromDob(dob: string | null): number | null {
  if (!dob) return null;
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return null;
  return Math.floor((Date.now() - d.getTime()) / (365.25 * 86400_000));
}

function maxTenureForAge(age: number | null, product: string): number {
  const p = normProduct(product);
  if (age == null) return p.includes("home") ? 240 : 60;
  if (p.includes("home") || p.includes("lap")) return Math.max(12, Math.min(240, (65 - age) * 12));
  if (p.includes("personal")) return Math.min(60, Math.max(12, (58 - age) * 12));
  return 60;
}

function parseCoObligationEmi(text: string | null): number {
  if (!text) return 0;
  const m = text.replace(/,/g, "").match(/[\d.]+/);
  if (!m) return 0;
  const n = Number(m[0]);
  return Number.isFinite(n) ? n : 0;
}

function buildFinancial(
  profile: CustomerProfile,
  obligations: Obligation[],
  banks: BankAccount[],
  coIncome: number,
  coObligationEmi: number,
): FinancialSummary {
  const gross = Number(profile.monthly_income) || Number(profile.annual_turnover) / 12 || 0;
  const net = Number(profile.net_salary) || Number(profile.monthly_income) || gross;
  const turnover = Number(profile.annual_turnover) || gross * 12;
  const household = net + coIncome;

  let totalEmi = 0;
  let ccEmi = 0;
  let odCc = 0;
  let other = 0;
  for (const o of obligations) {
    const emi = Number(o.emi) || 0;
    totalEmi += emi;
    const lt = (o.loan_type ?? "").toLowerCase();
    if (lt.includes("cc") || lt.includes("credit")) ccEmi += emi;
    else if (lt === "od" || lt === "cc") odCc += emi;
    else other += emi;
  }
  totalEmi += coObligationEmi;
  other += coObligationEmi;

  const primary = banks.find((b) => b.is_primary) ?? banks[0];
  const avgBalance =
    banks.length > 0
      ? banks.reduce((s, b) => s + (Number(b.average_balance) || 0), 0) / banks.length
      : 0;
  const salaryStable = banks.some((b) => b.is_salary_account) || Boolean(primary?.is_salary_account);
  const bounces = banks.reduce((s, b) => s + parseBounces(b.emi_bounce_history), 0);

  return {
    grossIncome: Math.round(gross),
    netIncome: Math.round(net),
    householdIncome: Math.round(household),
    coApplicantIncome: Math.round(coIncome),
    businessTurnover: Math.round(turnover),
    annualIncome: Math.round(household * 12),
    totalEmi: Math.round(totalEmi),
    creditCardEmi: Math.round(ccEmi),
    odCcObligations: Math.round(odCc),
    otherObligations: Math.round(other),
    avgBalance: Math.round(avgBalance),
    salaryCreditStable: salaryStable,
    emiBounceCount: bounces,
  };
}

function productEligibility(
  product: string,
  fin: FinancialSummary,
  foir: number | null,
  eligibleEmi: number | null,
  req: LoanRequirement | null,
  profile: CustomerProfile,
  age: number | null,
): ProductEligibility {
  const p = normProduct(product);
  const requested = req?.loan_amount != null ? Number(req.loan_amount) : null;
  const notes: string[] = [];
  let eligibleAmt: number | null = null;
  let ltv: number | null = null;
  let maxTenure = maxTenureForAge(age, p);
  let passed = true;

  const tenure = req?.tenure_months ? Number(req.tenure_months) : maxTenure;
  const roi = req?.roi_percent != null ? Number(req.roi_percent) : 10.5;

  if (p.includes("home") || p.includes("lap")) {
    const propVal = Number(req?.property_value) || Number(req?.loan_amount) * 1.2 || 0;
    ltv = propVal > 0 && requested ? Math.min(90, (requested / propVal) * 100) : 75;
    eligibleAmt = propVal > 0 ? Math.round(propVal * 0.8) : eligibleEmi ? Math.round(eligibleEmi * tenure) : null;
    if (ltv && ltv > 85) {
      notes.push("LTV above 85% — may need higher down payment");
      passed = false;
    }
    const extra = req?.extra_fields as Record<string, unknown> | undefined;
    if (extra?.occupancy) notes.push(`Occupancy: ${extra.occupancy}`);
  } else if (p.includes("business")) {
    const mult = profile.gst_number && profile.itr_filed === "Yes" ? 0.25 : 0.18;
    eligibleAmt = Math.round(fin.businessTurnover * mult);
    if (fin.businessTurnover < 300_000) {
      notes.push("Low annual turnover for BL");
      passed = false;
    }
    const vintage = Number(profile.business_vintage);
    if (vintage && vintage < 2) notes.push("Business vintage under 2 years");
  } else if (p.includes("personal")) {
    const mult = fin.netIncome >= 50_000 ? 18 : fin.netIncome >= 30_000 ? 15 : 12;
    eligibleAmt = Math.round(fin.netIncome * mult);
    if (fin.netIncome < 20_000) {
      notes.push("Income below typical PL threshold");
      passed = false;
    }
  } else if (p.includes("credit card") || p === "cc") {
    eligibleAmt = Math.round(fin.netIncome * (fin.netIncome >= 50_000 ? 3 : 2));
    notes.push("Limit based on net monthly income multiplier");
  } else if (p.includes("insurance")) {
    const affordable = fin.householdIncome * 0.1 * 12;
    eligibleAmt = Math.round(Math.min(Number(req?.property_value) || 5_000_000, affordable * 10));
    notes.push("Premium affordability ~10% of annual household income");
  } else {
    eligibleAmt = eligibleEmi ? Math.round(eligibleEmi * tenure) : null;
  }

  if (foir != null && foir > (FOIR_CAP[p] ?? 55)) {
    notes.push(`FOIR ${foir.toFixed(1)}% exceeds typical ${FOIR_CAP[p] ?? 55}% cap`);
    passed = false;
  }
  if (requested && eligibleAmt && requested > eligibleAmt * 1.05) {
    notes.push("Requested amount exceeds estimated eligibility");
    passed = false;
  }

  return {
    productType: product,
    requestedAmount: requested,
    eligibleAmount: eligibleAmt,
    maxTenure: tenure || maxTenure,
    ltvPercent: ltv,
    notes,
    passed,
  };
}

function recommendLenders(
  product: string,
  fin: FinancialSummary,
  cibil: number | null,
  city: string | null,
  badge: EligibilityBadge,
): LenderRecommendation[] {
  if (badge === "reject") {
    return [{ lenderName: "—", product, approvalChance: 15, reason: "High risk profile — consider co-applicant or debt consolidation", priority: "low" }];
  }
  const p = normProduct(product);
  const pool: LenderRecommendation[] = [];
  const add = (name: string, chance: number, reason: string, priority: LenderRecommendation["priority"]) => {
    pool.push({ lenderName: name, product, approvalChance: chance, reason, priority });
  };

  if (p.includes("home") || p.includes("lap")) {
    add("HDFC Bank", cibil && cibil >= 750 ? 82 : 68, "Strong HL/LAP franchise", "high");
    add("SBI Home Loans", 75, "Competitive rates for salaried", "high");
    add("ICICI Bank", 70, "Good for metro salaried profiles", "medium");
    add("LIC Housing Finance", 72, "Flexible LTV in select cities", "medium");
  } else if (p.includes("business")) {
    add("HDFC Bank", 70, "BL for GST-registered businesses", "high");
    add("Axis Bank", 65, "Working capital & BL", "medium");
    add("Bajaj Finserv", 68, "Unsecured BL up to limits", "medium");
  } else if (p.includes("personal")) {
    add("HDFC Bank", fin.netIncome >= 40_000 ? 78 : 62, "PL for salaried", "high");
    add("ICICI Bank", 72, "Quick PL for existing customers", "high");
    add("Bajaj Finserv", 75, "Digital PL", "medium");
    add("KreditBee / App-based", 55, "Thin file fallback", "low");
  } else if (p.includes("credit card")) {
    add("HDFC Bank", 70, "Premium cards for high income", "high");
    add("SBI Card", 65, "Wide acceptance", "medium");
    add("Axis Bank", 68, "Rewards cards", "medium");
  } else {
    add("HDFC Bank", 65, "General retail lending", "medium");
    add("ICICI Bank", 62, "Metro focus", "medium");
  }

  if (fin.salaryCreditStable) pool.forEach((l) => (l.approvalChance = Math.min(95, l.approvalChance + 5)));
  if (city && /mumbai|delhi|bangalore|bengaluru|hyderabad|pune|chennai/i.test(city)) {
    pool.forEach((l) => (l.approvalChance = Math.min(95, l.approvalChance + 3)));
  }
  return pool.sort((a, b) => b.approvalChance - a.approvalChance).slice(0, 5);
}

function validate(profile: CustomerProfile, fin: FinancialSummary, age: number | null): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!profile.full_name) issues.push({ code: "name", message: "Applicant name required", severity: "error" });
  if (!profile.mobile) issues.push({ code: "mobile", message: "Mobile number required", severity: "error" });
  if (fin.netIncome < 15_000) issues.push({ code: "income", message: "Income below ₹15,000 — limited eligibility", severity: "warning" });
  if (age != null && age < 21) issues.push({ code: "age_min", message: "Applicant under 21", severity: "error" });
  if (age != null && age > 62) issues.push({ code: "age_max", message: "Age may limit tenure", severity: "warning" });
  if (!profile.pan) issues.push({ code: "pan", message: "PAN recommended before bank login", severity: "warning" });
  return issues;
}

function inferWorkflow(
  badge: EligibilityBadge,
  validations: ValidationIssue[],
  coIncome: number,
  hasCoApp: boolean,
): WorkflowStage {
  if (validations.some((v) => v.severity === "error")) return "profile_completed";
  if (badge === "reject") return "not_eligible";
  if (badge === "risky" && !hasCoApp && coIncome === 0) return "need_co_applicant";
  if (badge === "strong" || badge === "moderate") return "eligibility_checked";
  return "eligibility_checked";
}

export function runEligibilityEngine(input: EligibilityEngineInput): EligibilityEngineResult {
  const { profile, obligations, bankAccounts, coApplicants, loanRequirements, purchase } = input;
  const coIncome = coApplicants.reduce((s, c) => s + (Number(c.income) || 0), 0);
  const coObligationEmi = coApplicants.reduce((s, c) => s + parseCoObligationEmi(c.obligations_summary), 0);
  const fin = buildFinancial(profile, obligations, bankAccounts, coIncome, coObligationEmi);

  const primaryReq = loanRequirements[0];
  const primaryProduct =
    primaryReq?.product_type ??
    purchase.lead?.product_subtype ??
    purchase.lead?.product_category ??
    "Personal Loan";

  const effectiveIncome = fin.householdIncome || fin.netIncome;
  const totalOutstanding = obligations.reduce((s, o) => s + (Number(o.outstanding_amount) || 0), 0);

  const foirPercent = effectiveIncome > 0 ? (fin.totalEmi / effectiveIncome) * 100 : null;
  const dbrPercent = effectiveIncome > 0 ? (totalOutstanding / (effectiveIncome * 12)) * 100 : null;
  const emiIncomeRatio = foirPercent;

  const cap = FOIR_CAP[normProduct(primaryProduct)] ?? 55;
  const eligibleEmi =
    effectiveIncome > 0 ? Math.max(0, effectiveIncome * (cap / 100) - fin.totalEmi) : null;

  const tenure =
    primaryReq?.tenure_months != null
      ? Number(primaryReq.tenure_months)
      : maxTenureForAge(ageFromDob(profile.dob), primaryProduct);

  const roi = primaryReq?.roi_percent != null ? Number(primaryReq.roi_percent) : 10.75;
  const eligibleAmount =
    eligibleEmi != null && tenure > 0
      ? Math.round(eligibleEmi * tenure * (1 + roi / 100 / 2))
      : null;

  const cibil =
    input.leadCibil ??
    coApplicants.find((c) => c.cibil_score != null)?.cibil_score ??
    null;

  const age = ageFromDob(profile.dob) ?? purchase.lead?.age ?? null;
  const badge = badgeFromScore(foirPercent, cibil, fin.emiBounceCount);

  const bankingStability: EligibilityBadge =
    fin.salaryCreditStable && fin.emiBounceCount === 0
      ? "strong"
      : fin.emiBounceCount >= 2
        ? "risky"
        : "moderate";

  const foirHealth: EligibilityBadge =
    foirPercent == null ? "moderate" : foirPercent <= 40 ? "strong" : foirPercent <= 55 ? "moderate" : "risky";

  const products: ProductEligibility[] =
    loanRequirements.length > 0
      ? loanRequirements.map((r) =>
          productEligibility(r.product_type ?? primaryProduct, fin, foirPercent, eligibleEmi, r, profile, age),
        )
      : [productEligibility(primaryProduct, fin, foirPercent, eligibleEmi, null, profile, age)];

  const validations = validate(profile, fin, age);
  const workflowStage = inferWorkflow(badge, validations, coIncome, coApplicants.length > 0);

  const risk: RiskProfile = {
    cibilScore: cibil,
    riskGrade: badge,
    bankingStability,
    foirHealth,
    eligibilityStatus: badge,
    workflowStage,
  };

  const approvalProbability = Math.max(
    10,
    Math.min(
      95,
      (badge === "strong" ? 85 : badge === "moderate" ? 65 : badge === "risky" ? 40 : 15) -
        (foirPercent && foirPercent > 55 ? 15 : 0) +
        (cibil && cibil >= 750 ? 8 : 0),
    ),
  );

  const lenders = recommendLenders(primaryProduct, fin, cibil, profile.city, badge);

  return {
    primaryProduct,
    financial: fin,
    metrics: {
      foirPercent,
      dbrPercent,
      emiIncomeRatio,
      eligibleEmi: eligibleEmi != null ? Math.round(eligibleEmi) : null,
      eligibleAmount,
      estimatedRoi: roi,
      recommendedTenure: tenure,
      ltvPercent: products[0]?.ltvPercent ?? null,
      approvalProbability,
    },
    products,
    risk,
    lenders,
    validations,
    computedAt: new Date().toISOString(),
  };
}
