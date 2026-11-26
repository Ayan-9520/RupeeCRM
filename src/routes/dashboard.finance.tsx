import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
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

  const disbursed = rows.reduce((sum, row) => sum + Number(row.base_amount || 0), 0);
  const lenders = useMemo(() => {
    const map = new Map<string, { cases: number; base: number; receivable: number; collected: number }>();
    for (const row of rows) {
      const name = row.bank_name || "Bank not set";
      const current = map.get(name) || { cases: 0, base: 0, receivable: 0, collected: 0 };
      current.cases += 1;
      current.base += Number(row.base_amount || 0);
      current.receivable += Number(row.receivable_amount || 0);
      current.collected += Number(row.collected_amount || 0);
      map.set(name, current);
    }
    return [...map.entries()].sort((a, b) => b[1].receivable - a[1].receivable);
  }, [rows]);
  const widest = Math.max(1, ...lenders.map(([, row]) => row.receivable));

  return (
    <div className="max-w-6xl space-y-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-[#10662A]">Cases and money</p>
        <h1 className="font-display text-2xl font-bold text-[#390A5D]">Lender performance</h1>
        <p className="mt-1 text-sm text-[#5c4d72]">Live case files only. A lender with no file does not appear.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Tile label="Case files" value={String(rows.length)} hint="Rows in this report" tone="bg-gradient-to-br from-[#E8F7EC] to-white" />
        <Tile label="Disbursed base" value={inr(disbursed)} hint="Sanctioned or loan, as booked" tone="bg-gradient-to-br from-[#f3fff8] to-white" />
        <Tile label="Expected from lenders" value={inr(totals.receivable)} hint="Lender payout on these files" tone="bg-gradient-to-br from-[#fff8ea] to-white" />
        <Tile label="Received" value={inr(totals.collected)} hint={`${inr(totals.outstanding)} still outstanding`} tone="bg-gradient-to-br from-[#f7f0fb] to-white" />
      </div>
      {loading ? <Loader2 className="size-5 animate-spin text-[#10662A]" /> : null}
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      <section className="grid gap-3 sm:grid-cols-3">
        {[
          ["On an invoice", rows.filter((row) => row.invoice_number).length],
          ["Paid invoice", rows.filter((row) => row.invoice_status === "paid").length],
          ["Not invoiced", rows.filter((row) => !row.invoice_number).length],
        ].map(([label, value]) => (
          <div key={String(label)} className="rounded-2xl border border-[#d8ecdd] bg-white p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[#5c4d72]">{label}</p>
            <p className="mt-1 font-display text-2xl font-bold text-[#10662A]">{value}</p>
          </div>
        ))}
      </section>
      <section className="rounded-2xl border border-[#d8ecdd] bg-white p-4">
        <h2 className="font-display text-lg font-bold text-[#390A5D]">By lender</h2>
        <div className="mt-3 space-y-3">
          {lenders.map(([name, row]) => (
            <div key={name}>
              <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                <span className="font-semibold text-[#390A5D]">{name}</span>
                <span className="text-[#5c4d72]">{row.cases} files · base {inr(row.base)} · received {inr(row.collected)}</span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-[#E8F7EC]">
                <div className="h-full rounded-full bg-[#10662A]" style={{ width: `${Math.max(4, (row.receivable / widest) * 100)}%` }} />
              </div>
              <p className="mt-1 text-xs text-[#10662A]">Expected {inr(row.receivable)}</p>
            </div>
          ))}
          {lenders.length === 0 && !loading ? <p className="text-sm text-[#5c4d72]">No case files yet.</p> : null}
        </div>
      </section>
      <div className="overflow-x-auto rounded-2xl border border-[#d8ecdd] bg-white">
        <table className="min-w-[980px] w-full text-left text-sm">
          <thead className="bg-[#10662A] text-white">
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

function Tile({ label, value, hint, tone }: { label: string; value: string; hint: string; tone: string }) {
  return (
    <div className={`rounded-2xl border border-[#d8ecdd] p-4 ${tone}`}>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-[#5c4d72]">{label}</p>
      <p className="mt-1 font-display text-2xl font-bold text-[#390A5D]">{value}</p>
      <p className="mt-1 text-xs text-[#5c4d72]">{hint}</p>
    </div>
  );
}
