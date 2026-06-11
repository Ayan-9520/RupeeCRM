import { runEligibilityEngine } from "./eligibility-engine";
import type { EligibilityEngineInput, EligibilityEngineResult } from "./eligibility-types";

export type LenderWiseEligibility = {
  lenderName: string;
  product: string;
  approvalProbability: number;
  eligibleAmount: number | null;
  rejectionProbability: number;
  incomeMultiplier: number;
  notes: string[];
};

export type EnhancedEligibilityResult = EligibilityEngineResult & {
  lenderWiseEligibility: LenderWiseEligibility[];
  rejectionProbability: number;
  incomeMultiplier: number;
  riskAdjustedEligibleAmount: number | null;
  bestLender: LenderWiseEligibility | null;
};

const INCOME_MULTIPLIER: Record<string, number> = {
  "home loan": 60,
  "personal loan": 18,
  "business loan": 0.22,
  lap: 55,
  "loan against property": 55,
  "auto loan": 15,
  "credit card": 3,
  insurance: 10,
  od: 12,
  cc: 3,
};

function normProduct(p: string): string {
  return (p ?? "personal loan").toLowerCase().trim();
}

function multiplierFor(product: string, netIncome: number): number {
  const key = Object.keys(INCOME_MULTIPLIER).find((k) => normProduct(product).includes(k)) ?? "personal loan";
  const m = INCOME_MULTIPLIER[key];
  if (key === "business loan") return m;
  return m;
}

export function runEnhancedEligibility(input: EligibilityEngineInput): EnhancedEligibilityResult {
  const base = runEligibilityEngine(input);
  const product = base.primaryProduct;
  const net = base.financial.netIncome;
  const mult = multiplierFor(product, net);
  const incomeBased =
    normProduct(product).includes("business")
      ? Math.round(base.financial.businessTurnover * mult)
      : Math.round(net * mult);

  const rejectionProbability = Math.max(
    5,
    Math.min(
      95,
      100 -
        (base.metrics.approvalProbability ?? 50) +
        (base.metrics.foirPercent && base.metrics.foirPercent > 60 ? 20 : 0) +
        (base.risk.cibilScore != null && base.risk.cibilScore < 650 ? 15 : 0),
    ),
  );

  const riskAdj =
    base.metrics.eligibleAmount != null
      ? Math.round(base.metrics.eligibleAmount * (1 - rejectionProbability / 200))
      : incomeBased;

  const lenderWiseEligibility: LenderWiseEligibility[] = base.lenders.map((l) => ({
    lenderName: l.lenderName,
    product: l.product,
    approvalProbability: l.approvalChance,
    eligibleAmount: base.metrics.eligibleAmount,
    rejectionProbability: Math.round(100 - l.approvalChance),
    incomeMultiplier: mult,
    notes: [l.reason],
  }));

  const bestLender = lenderWiseEligibility[0] ?? null;

  return {
    ...base,
    lenderWiseEligibility,
    rejectionProbability,
    incomeMultiplier: mult,
    riskAdjustedEligibleAmount: riskAdj,
    bestLender,
  };
}
