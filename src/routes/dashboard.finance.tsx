import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { getFinanceReport, request, requestBlob, type FinanceRow } from "@/lib/python-api";

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
  const [schemes, setSchemes] = useState<{ name: string; bonus_amount: number }[]>([]);

  useEffect(() => {
    void getFinanceReport()
      .then((report) => {
        setRows(report.rows);
        setTotals(report);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load the report"))
      .finally(() => setLoading(false));
    void request<{ schemes: { name: string; bonus_amount: number }[] }>("/api/los/schemes")
      .then((data) => setSchemes(data.schemes))
      .catch(() => setSchemes([]));
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
  const receivedPct = totals.receivable > 0 ? Math.min(100, Math.round((totals.collected / totals.receivable) * 100)) : 0;

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
      <BooksPanel />
      <section className="flex flex-wrap items-center gap-6 rounded-2xl border border-[#d8ecdd] bg-white p-4">
        <div
          className="grid size-28 place-items-center rounded-full"
          style={{ background: `conic-gradient(#10662A ${receivedPct * 3.6}deg, #E8F7EC 0deg)` }}
        >
          <div className="grid size-20 place-items-center rounded-full bg-white text-center">
            <div>
              <p className="font-display text-xl font-bold text-[#10662A]">{receivedPct}%</p>
              <p className="text-[10px] text-[#5c4d72]">collected</p>
            </div>
          </div>
        </div>
        <div>
          <p className="font-display text-lg font-bold text-[#390A5D]">{rows.length} case files</p>
          <p className="text-sm text-[#5c4d72]">Collected {inr(totals.collected)} of {inr(totals.receivable)} expected from lenders.</p>
        </div>
      </section>
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
        <h2 className="font-display text-lg font-bold text-[#390A5D]">Schemes</h2>
        <div className="mt-3 space-y-3">
          {schemes.map((scheme) => {
            const got = rows.filter((row) => (row.bonus_name || "") === scheme.name).reduce((sum, row) => sum + Number(row.bonus_amount || 0), 0);
            const pct = scheme.bonus_amount > 0 ? Math.min(100, Math.round((got / scheme.bonus_amount) * 100)) : 0;
            return (
              <div key={scheme.name}>
                <div className="flex justify-between text-sm"><span className="font-semibold text-[#390A5D]">{scheme.name}</span><span className="text-[#10662A]">{scheme.bonus_amount > 0 ? `${pct}%` : "No target"}</span></div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-[#E8F7EC]"><div className="h-full rounded-full bg-[#10662A]" style={{ width: `${scheme.bonus_amount > 0 ? Math.max(pct, 4) : 0}%` }} /></div>
                <p className="mt-1 text-xs text-[#5c4d72]">Booked {inr(got)} of scheme {inr(scheme.bonus_amount)}. The case bonus name must match the scheme name.</p>
              </div>
            );
          })}
          {schemes.length === 0 ? <p className="text-sm text-[#5c4d72]">No scheme saved yet.</p> : null}
        </div>
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

type Books = {
  filtered_on: string;
  from: string;
  to: string;
  generated_note: string;
  cases: number;
  counted: number;
  frozen: number;
  legacy: number;
  open: number;
  disbursement_base: number;
  snapshot_receivable: number;
  snapshot_payable: number;
  calculated_receivable: number;
  calculated_payable: number;
  unlinked_lender_cases: number;
  invoice_pending: number;
  invoice_approved: number;
  invoice_paid: number;
  recorded_paid: number;
  open_invoice_net: number;
  stages: Record<string, { count: number; disbursement_base: number }>;
  lenders: { lender: string; cases: number; disbursement: number; receivable: number }[];
  invoices: { number: string; status: string; gst_lines: string; net: number | null; paid_amount: number | null; utr: string }[];
  schemes: { period: string; target: number; achieved: number; percent: number | null; remaining: number | null; note: string }[];
};

function moneyOrBlank(value: number | null) {
  return value == null ? "Not recorded" : inr(value);
}

function BooksPanel() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [books, setBooks] = useState<Books | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = (start: string, end: string) => {
    setLoading(true);
    const query = new URLSearchParams();
    if (start) query.set("date_from", start);
    if (end) query.set("date_to", end);
    void request<Books>(`/api/cases/books${query.toString() ? `?${query}` : ""}`)
      .then((data) => {
        setBooks(data);
        setError("");
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load books"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load("", "");
  }, []);

  return (
    <section className="space-y-3 rounded-2xl border border-[#d8ecdd] bg-white p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-bold text-[#390A5D]">Books</h2>
          <p className="text-xs text-[#5c4d72]">Read only. Filtered on case opened date. Paid figures are recorded settlements, not approvals.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} className="rounded-lg border border-[#d8ecdd] px-2 py-1" />
          <input type="date" value={to} onChange={(event) => setTo(event.target.value)} className="rounded-lg border border-[#d8ecdd] px-2 py-1" />
          <button type="button" onClick={() => load(from, to)} className="rounded-lg bg-[#10662A] px-3 py-1.5 font-semibold text-white">Apply</button>
          <button
            type="button"
            className="rounded-lg border border-[#d8ecdd] px-3 py-1.5 font-semibold text-[#390A5D]"
            onClick={() => {
              const query = new URLSearchParams();
              if (from) query.set("date_from", from);
              if (to) query.set("date_to", to);
              void requestBlob(`/api/cases/books.csv${query.toString() ? `?${query}` : ""}`).then((blob) => {
                const url = URL.createObjectURL(blob);
                const link = document.createElement("a");
                link.href = url;
                link.download = "rupeedial-books.csv";
                link.click();
                URL.revokeObjectURL(url);
              });
            }}
          >
            CSV
          </button>
        </div>
      </div>
      {loading ? <Loader2 className="size-5 animate-spin text-[#10662A]" /> : null}
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      {books ? (
        <>
          <p className="text-xs text-[#5c4d72]">{books.generated_note}</p>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Tile label="Visible cases" value={String(books.cases)} hint={`${books.counted} counted · ${books.open} still open`} tone="bg-[#f7fbf8]" />
            <Tile label="Snapshot receivable" value={inr(books.snapshot_receivable)} hint={`${books.frozen} frozen files. Not a new calculation.`} tone="bg-[#f7fbf8]" />
            <Tile label="Calculated receivable" value={inr(books.calculated_receivable)} hint={`${books.legacy} legacy counted files plus open files`} tone="bg-[#f7fbf8]" />
            <Tile label="Recorded paid" value={inr(books.recorded_paid)} hint={`${books.invoice_paid} settled · ${inr(books.open_invoice_net)} stored net still open`} tone="bg-[#f7fbf8]" />
          </div>
          <p className="text-xs text-[#5c4d72]">Lender totals include linked lenders only. {books.unlinked_lender_cases} cases have no lender link and stay out of those totals.</p>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-[#5c4d72]">
                <tr>
                  <th className="py-2">Invoice</th>
                  <th>Status</th>
                  <th>GST lines</th>
                  <th className="text-right">Stored net</th>
                  <th className="text-right">Paid</th>
                </tr>
              </thead>
              <tbody>
                {books.invoices.map((row, index) => (
                  <tr key={`${row.number}-${index}`} className="border-t border-[#eef6f0]">
                    <td className="py-2">{row.number || "—"}</td>
                    <td>{row.status}</td>
                    <td>{row.gst_lines}</td>
                    <td className="text-right">{moneyOrBlank(row.net)}</td>
                    <td className="text-right">{moneyOrBlank(row.paid_amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {books.schemes.length ? (
            <ul className="space-y-1 text-xs text-[#5c4d72]">
              {books.schemes.map((scheme) => (
                <li key={scheme.period}>
                  {scheme.period}: {scheme.note || `${scheme.percent ?? 0}% of target`} · achieved {scheme.achieved} · remaining {scheme.remaining ?? "—"}
                </li>
              ))}
            </ul>
          ) : null}
        </>
      ) : null}
    </section>
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
