import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Calculator } from "lucide-react";
import { calculateEmi, fmtInr } from "@/lib/customer-crm/finance-calculators";

export const Route = createFileRoute("/dashboard/emi")({
  head: () => ({ meta: [{ title: "EMI calculator — RupeeOne" }] }),
  component: EmiCalculatorPage,
});

const TENURES = [12, 24, 36, 48, 60, 84, 120, 180, 240];

function EmiCalculatorPage() {
  const [amount, setAmount] = useState("500000");
  const [rate, setRate] = useState("10.5");
  const [months, setMonths] = useState("60");

  const principal = Number(amount) || 0;
  const roi = Number(rate) || 0;
  const tenure = Number(months) || 0;
  const emi = useMemo(() => calculateEmi(principal, roi, tenure), [principal, roi, tenure]);
  const total = emi != null ? emi * tenure : null;
  const interest = total != null ? total - principal : null;

  return (
    <div className="max-w-3xl space-y-5">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#10662A]">On a call</p>
        <h1 className="mt-1 flex items-center gap-2 font-display text-2xl font-bold text-[#390A5D]">
          <Calculator className="size-6 text-[#10662A]" /> EMI calculator
        </h1>
        <p className="mt-1 max-w-xl text-sm leading-6 text-[#5c4d72]">
          Tell the customer the monthly instalment before you ask for documents. This does not save anything on the lead.
        </p>
      </div>

      <div className="grid gap-4 rounded-2xl border border-[#d8ecdd] bg-white p-5 sm:grid-cols-3">
        <label className="text-xs font-semibold text-[#5c4d72]">
          Loan amount (₹)
          <input className="mt-1 h-11 w-full rounded-lg border border-[#d8ecdd] px-3 text-sm text-[#14281c]" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ""))} />
        </label>
        <label className="text-xs font-semibold text-[#5c4d72]">
          Interest per year (%)
          <input className="mt-1 h-11 w-full rounded-lg border border-[#d8ecdd] px-3 text-sm text-[#14281c]" inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value.replace(/[^\d.]/g, ""))} />
        </label>
        <label className="text-xs font-semibold text-[#5c4d72]">
          Tenure (months)
          <input className="mt-1 h-11 w-full rounded-lg border border-[#d8ecdd] px-3 text-sm text-[#14281c]" inputMode="numeric" value={months} onChange={(e) => setMonths(e.target.value.replace(/[^\d]/g, "").slice(0, 3))} />
        </label>
        <div className="sm:col-span-3 flex flex-wrap gap-2">
          {TENURES.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setMonths(String(item))}
              className={`rounded-full px-3 py-1 text-xs font-semibold ${months === String(item) ? "bg-[#0D4F20] text-white" : "bg-[#E8F7EC] text-[#0D4F20]"}`}
            >
              {item >= 12 && item % 12 === 0 ? `${item / 12} yr` : `${item} mo`}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-3xl bg-gradient-to-br from-[#0D4F20] to-[#10662A] p-6 text-white">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#B7E4C7]">Monthly EMI</p>
        <p className="mt-2 font-display text-4xl font-bold">{fmtInr(emi)}</p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <div>
            <p className="text-xs text-white/70">Total payable</p>
            <p className="mt-1 text-lg font-semibold">{fmtInr(total)}</p>
          </div>
          <div>
            <p className="text-xs text-white/70">Interest over the tenure</p>
            <p className="mt-1 text-lg font-semibold">{fmtInr(interest)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
