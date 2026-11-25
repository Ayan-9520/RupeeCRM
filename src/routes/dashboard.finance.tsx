import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { getFinanceReport, type FinanceRow } from "@/lib/python-api";

export const Route = createFileRoute("/dashboard/finance")({
  head: () => ({ meta: [{ title: "Finance report — RupeeOne" }] }),
  component: FinancePage,
});

function inr(n: number) {
  return `₹${Math.round(Number(n) || 0).toLocaleString("en-IN")}`;
}

function FinancePage() {
  const [rows, setRows] = useState<FinanceRow[]>([]);
  const [totals, setTotals] = useState({ receivable: 0, collected: 0, outstanding: 0, bonus: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    void getFinanceReport()
      .then((report) => {
        setRows(report.rows);
        setTotals(report);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load the report"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-4 p-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-[#10662A]">Finance</p>
        <h1 className="font-display text-2xl font-bold text-[#390A5D]">Case report</h1>
      </div>
      <div className="grid gap-3 sm:grid-cols-4">
        {[
          ["Lender receivable", totals.receivable],
          ["Collected", totals.collected],
          ["Outstanding", totals.outstanding],
          ["Bonus", totals.bonus],
        ].map(([label, value]) => (
          <div key={String(label)} className="rounded-2xl border border-[#d8ecdd] bg-white p-4">
            <div className="text-xs text-[#5c4d72]">{label}</div>
            <div className="mt-1 text-lg font-bold text-[#10662A]">{inr(Number(value))}</div>
          </div>
        ))}
      </div>
      {loading ? <Loader2 className="size-5 animate-spin text-[#10662A]" /> : null}
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      <div className="overflow-x-auto rounded-2xl border border-[#d8ecdd] bg-white">
        <table className="min-w-[980px] w-full text-left text-sm">
          <thead className="bg-[#390A5D] text-white">
            <tr>
              {["Deal", "Partner", "Lender", "Product", "Base", "Receivable", "Partner share", "Bonus", "Collected", "Outstanding", "Invoice"].map((head) => (
                <th key={head} className="px-3 py-3 text-[11px] font-semibold uppercase">{head}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.deal_no} className="border-t border-[#eef6f0]">
                <td className="px-3 py-3 font-semibold text-[#10662A]">{row.deal_no}</td>
                <td className="px-3 py-3">{row.partner_name || "—"}</td>
                <td className="px-3 py-3">{row.bank_name || "—"}</td>
                <td className="px-3 py-3">{row.loan_type}</td>
                <td className="px-3 py-3 text-right">{inr(row.base_amount)}</td>
                <td className="px-3 py-3 text-right">{inr(row.receivable_amount)}</td>
                <td className="px-3 py-3 text-right">{inr(row.payable_amount)}</td>
                <td className="px-3 py-3 text-right">{inr(row.bonus_amount)}</td>
                <td className="px-3 py-3 text-right">{inr(row.collected_amount)}</td>
                <td className="px-3 py-3 text-right font-semibold">{inr(row.outstanding)}</td>
                <td className="px-3 py-3">{row.invoice_number ? `${row.invoice_number} · ${row.invoice_status}` : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
