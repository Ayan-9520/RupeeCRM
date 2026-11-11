import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Calculator, Copy } from "lucide-react";
import { calculateEmi, fmtInr } from "@/lib/customer-crm/finance-calculators";

export const Route = createFileRoute("/dashboard/emi")({
  head: () => ({ meta: [{ title: "EMI calculator — RupeeOne" }] }),
  component: EmiCalculatorPage,
});

const PRODUCTS = [
  { id: "personal", label: "Personal", rate: "12", months: "60" },
  { id: "home", label: "Home", rate: "8.5", months: "240" },
  { id: "business", label: "Business", rate: "14", months: "48" },
  { id: "lap", label: "Loan against property", rate: "10", months: "120" },
  { id: "auto", label: "Vehicle", rate: "9.5", months: "60" },
];

const TENURES = [12, 24, 36, 48, 60, 84, 120, 180, 240];
const COMPARE = [36, 60, 84, 120, 180, 240];

type YearRow = { year: number; principal: number; interest: number; balance: number };

function yearlyBreakup(principal: number, annualRoi: number, months: number, emi: number): YearRow[] {
  const monthlyRate = annualRoi / 100 / 12;
  let balance = principal;
  const rows: YearRow[] = [];
  const years = Math.ceil(months / 12);
  for (let year = 1; year <= years; year += 1) {
    const monthsThisYear = Math.min(12, months - (year - 1) * 12);
    let principalPaid = 0;
    let interestPaid = 0;
    for (let month = 0; month < monthsThisYear; month += 1) {
      const interest = Math.round(balance * monthlyRate);
      const isLast = year === years && month === monthsThisYear - 1;
      const principalPart = isLast ? balance : Math.min(balance, Math.max(0, emi - interest));
      principalPaid += principalPart;
      interestPaid += isLast ? Math.max(0, emi - principalPart) : interest;
      balance = Math.max(0, balance - principalPart);
    }
    rows.push({ year, principal: principalPaid, interest: interestPaid, balance });
  }
  return rows;
}

function fieldClass() {
  return "mt-1 h-11 w-full rounded-lg border border-[#d8ecdd] bg-[#F7FBF8] px-3 text-sm font-semibold text-[#14281c] outline-none focus:border-[#10662A]";
}

function EmiCalculatorPage() {
  const [product, setProduct] = useState("personal");
  const [amount, setAmount] = useState("500000");
  const [rate, setRate] = useState("12");
  const [months, setMonths] = useState("60");
  const [feePercent, setFeePercent] = useState("1");
  const [income, setIncome] = useState("");

  const principal = Number(amount) || 0;
  const roi = Number(rate) || 0;
  const tenure = Math.min(360, Number(months) || 0);
  const feePct = Number(feePercent) || 0;
  const monthlyIncome = Number(income) || 0;

  const emi = useMemo(() => calculateEmi(principal, roi, tenure), [principal, roi, tenure]);
  const total = emi != null ? emi * tenure : null;
  const interest = total != null ? Math.max(0, total - principal) : null;
  const fee = Math.round((principal * feePct) / 100);
  const inHand = Math.max(0, principal - fee);
  const interestShare = total && interest != null && total > 0 ? Math.round((interest / total) * 100) : 0;
  const incomeShare = emi != null && monthlyIncome > 0 ? Math.round((emi / monthlyIncome) * 100) : null;
  const rows = useMemo(
    () => (emi != null ? yearlyBreakup(principal, roi, tenure, emi) : []),
    [emi, principal, roi, tenure],
  );

  function pickProduct(next: (typeof PRODUCTS)[number]) {
    setProduct(next.id);
    setRate(next.rate);
    setMonths(next.months);
  }

  async function copySummary() {
    if (emi == null) return;
    const years = tenure % 12 === 0 ? `${tenure / 12} years` : `${tenure} months`;
    const text = [
      `Loan ${fmtInr(principal)}`,
      `Interest ${roi}% a year for ${years}`,
      `Monthly EMI ${fmtInr(emi)}`,
      `Total interest ${fmtInr(interest)}`,
      fee > 0 ? `Processing fee ${fmtInr(fee)}. Amount in hand ${fmtInr(inHand)}.` : "",
      "Figures are an estimate. The lender confirms the final EMI.",
    ].filter(Boolean).join("\n");
    try {
      await navigator.clipboard.writeText(text);
      toast.success("EMI copied. Paste it in WhatsApp.");
    } catch {
      toast.error("Could not copy. Select the EMI and copy it yourself.");
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#10662A]">On a call</p>
          <h1 className="mt-1 flex items-center gap-2 font-display text-2xl font-bold text-[#390A5D]">
            <Calculator className="size-6 text-[#10662A]" /> EMI calculator
          </h1>
          <p className="mt-1 max-w-xl text-sm leading-6 text-[#5c4d72]">
            Quote the instalment, compare tenures, and send the figure on WhatsApp. Nothing here is saved on the lead.
          </p>
        </div>
        <button type="button" onClick={copySummary} className="inline-flex items-center gap-2 rounded-xl bg-[#10662A] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#0D4F20]">
          <Copy className="size-4" /> Copy for WhatsApp
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <section className="rounded-3xl border border-[#d8ecdd] bg-white p-5 shadow-[0_12px_30px_rgba(16,102,42,0.05)]">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#5c4d72]">Product</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {PRODUCTS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => pickProduct(item)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold ${product === item.id ? "bg-[#0D4F20] text-white" : "bg-[#E8F7EC] text-[#0D4F20] hover:bg-[#0D4F20] hover:text-white"}`}
              >
                {item.label}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-[#5c4d72]">These rates are a starting point. Change them to the rate the lender quoted.</p>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className="text-xs font-semibold text-[#5c4d72]">
              Loan amount (₹)
              <input className={fieldClass()} inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, "").slice(0, 9))} />
            </label>
            <label className="text-xs font-semibold text-[#5c4d72]">
              Interest per year (%)
              <input className={fieldClass()} inputMode="decimal" value={rate} onChange={(e) => { setRate(e.target.value.replace(/[^\d.]/g, "").slice(0, 5)); setProduct("custom"); }} />
            </label>
            <label className="text-xs font-semibold text-[#5c4d72]">
              Tenure (months)
              <input className={fieldClass()} inputMode="numeric" value={months} onChange={(e) => { setMonths(e.target.value.replace(/[^\d]/g, "").slice(0, 3)); setProduct("custom"); }} />
            </label>
            <label className="text-xs font-semibold text-[#5c4d72]">
              Processing fee (%)
              <input className={fieldClass()} inputMode="decimal" value={feePercent} onChange={(e) => setFeePercent(e.target.value.replace(/[^\d.]/g, "").slice(0, 4))} />
            </label>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {TENURES.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => { setMonths(String(item)); setProduct("custom"); }}
                className={`rounded-full px-3 py-1 text-xs font-semibold ${months === String(item) ? "bg-[#0D4F20] text-white" : "bg-[#F4FBF6] text-[#0D4F20] ring-1 ring-[#d8ecdd] hover:bg-[#0D4F20] hover:text-white"}`}
              >
                {item % 12 === 0 ? `${item / 12} yr` : `${item} mo`}
              </button>
            ))}
          </div>
          <label className="mt-4 block text-xs font-semibold text-[#5c4d72]">
            Customer’s monthly income (₹), optional
            <input className={fieldClass()} inputMode="numeric" placeholder="Used only to show EMI as a share of income" value={income} onChange={(e) => setIncome(e.target.value.replace(/[^\d]/g, "").slice(0, 8))} />
          </label>
        </section>

        <section className="flex flex-col justify-between rounded-3xl bg-gradient-to-br from-[#0D4F20] to-[#10662A] p-6 text-white shadow-[0_16px_40px_rgba(13,79,32,0.22)]">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#B7E4C7]">Monthly EMI</p>
            <p className="mt-2 font-display text-4xl font-bold sm:text-5xl">{fmtInr(emi)}</p>
            <p className="mt-2 text-sm text-white/75">{fmtInr(principal)} · {roi}% · {tenure > 0 && tenure % 12 === 0 ? `${tenure / 12} years` : `${tenure || 0} months`}</p>
          </div>
          <div className="mt-6 space-y-4">
            <div>
              <div className="mb-1 flex justify-between text-xs text-white/75">
                <span>Principal {100 - interestShare}%</span>
                <span>Interest {interestShare}%</span>
              </div>
              <div className="flex h-2 overflow-hidden rounded-full bg-white/20">
                <div className="bg-white" style={{ width: `${Math.max(0, 100 - interestShare)}%` }} />
                <div className="bg-[#B7E4C7]" style={{ width: `${interestShare}%` }} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-white/70">Total payable</p>
                <p className="mt-1 text-lg font-semibold">{fmtInr(total)}</p>
              </div>
              <div>
                <p className="text-white/70">Total interest</p>
                <p className="mt-1 text-lg font-semibold">{fmtInr(interest)}</p>
              </div>
              <div>
                <p className="text-white/70">Processing fee</p>
                <p className="mt-1 text-lg font-semibold">{fmtInr(fee)}</p>
              </div>
              <div>
                <p className="text-white/70">Amount in hand</p>
                <p className="mt-1 text-lg font-semibold">{fmtInr(inHand)}</p>
              </div>
            </div>
            {incomeShare != null && (
              <p className={`rounded-xl px-3 py-2 text-sm font-semibold ${incomeShare > 50 ? "bg-white text-[#0D4F20]" : "bg-white/15 text-white"}`}>
                EMI is {incomeShare}% of the income you entered.
              </p>
            )}
          </div>
        </section>
      </div>

      <section>
        <h2 className="font-display text-lg font-bold text-[#390A5D]">Same loan, other tenures</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-3 xl:grid-cols-6">
          {COMPARE.map((item) => {
            const value = calculateEmi(principal, roi, item);
            const active = item === tenure;
            return (
              <button
                key={item}
                type="button"
                onClick={() => { setMonths(String(item)); setProduct("custom"); }}
                className={`rounded-2xl border p-3 text-left ${active ? "border-[#0D4F20] bg-[#0D4F20] text-white" : "border-[#d8ecdd] bg-white text-[#14281c] hover:border-[#10662A]"}`}
              >
                <p className={`text-xs font-semibold ${active ? "text-[#B7E4C7]" : "text-[#5c4d72]"}`}>{item / 12} years</p>
                <p className="mt-1 text-lg font-bold">{fmtInr(value)}</p>
              </button>
            );
          })}
        </div>
      </section>

      {rows.length > 0 && (
        <section className="overflow-hidden rounded-3xl border border-[#d8ecdd] bg-white">
          <div className="border-b border-[#d8ecdd] px-5 py-4">
            <h2 className="font-display text-lg font-bold text-[#390A5D]">Year-wise breakup</h2>
            <p className="mt-1 text-sm text-[#5c4d72]">How much of each year’s EMI goes to the loan, and how much is interest.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="bg-[#F4FBF6] text-xs uppercase tracking-wide text-[#390A5D]">
                <tr>
                  <th className="px-5 py-3 font-semibold">Year</th>
                  <th className="px-5 py-3 font-semibold">Principal paid</th>
                  <th className="px-5 py-3 font-semibold">Interest paid</th>
                  <th className="px-5 py-3 font-semibold">Balance left</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.year} className="border-t border-[#eef6f0]">
                    <td className="px-5 py-3 font-semibold text-[#14281c]">{row.year}</td>
                    <td className="px-5 py-3 text-[#14281c]">{fmtInr(row.principal)}</td>
                    <td className="px-5 py-3 text-[#14281c]">{fmtInr(row.interest)}</td>
                    <td className="px-5 py-3 text-[#5c4d72]">{fmtInr(row.balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
