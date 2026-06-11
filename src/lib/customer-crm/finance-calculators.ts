/** EMI and disbursal financial helpers */

export function calculateEmi(principal: number, annualRoiPercent: number, tenureMonths: number): number | null {
  if (principal <= 0 || tenureMonths <= 0) return null;
  const r = annualRoiPercent / 100 / 12;
  if (r === 0) return Math.round(principal / tenureMonths);
  const emi = (principal * r * Math.pow(1 + r, tenureMonths)) / (Math.pow(1 + r, tenureMonths) - 1);
  return Math.round(emi);
}

export function calculateNetDisbursal(
  sanctioned: number,
  processingFee: number,
  insurance: number,
  deductions: number,
): number {
  return Math.max(0, sanctioned - processingFee - insurance - deductions);
}

export function calculatePayoutPending(expected: number, received: number): number {
  return Math.max(0, expected - received);
}

export function fmtInr(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}
