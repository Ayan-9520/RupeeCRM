import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { getFinanceReport, request, type FinanceRow } from "@/lib/python-api";

export const Route = createFileRoute("/dashboard/lenders")({
  head: () => ({ meta: [{ title: "Lenders — RupeeOne" }] }),
  component: LendersPage,
});

type Lender = { id: string; name: string; code: string; lender_type: string; branches: { name: string; city: string }[] };

function inr(n: number) {
  return `₹${Math.round(n || 0).toLocaleString("en-IN")}`;
}

function LenderBook({ name, rows }: { name: string; rows: FinanceRow[] }) {
  const expected = rows.reduce((sum, row) => sum + Number(row.receivable_amount || 0), 0);
  const received = rows.reduce((sum, row) => sum + Number(row.collected_amount || 0), 0);
  return (
    <section className="rounded-2xl border border-[#d8ecdd] bg-white p-4">
      <h2 className="font-display text-lg font-bold text-[#390A5D]">{name}</h2>
      <p className="text-sm text-[#5c4d72]">CRM book versus what Accounts has marked collected. A lender dump does not keep a second total.</p>
      <table className="mt-3 w-full text-left text-sm">
        <thead className="text-[11px] uppercase text-[#5c4d72]">
          <tr><th className="py-2">Line</th><th>On the case</th><th>Collected</th><th>Still open</th></tr>
        </thead>
        <tbody>
          <tr className="border-t border-[#eef6f0] font-semibold">
            <td className="py-2">Lender payout</td>
            <td>{inr(expected)}</td>
            <td>{inr(received)}</td>
            <td className="text-[#10662A]">{inr(expected - received)}</td>
          </tr>
          {rows.map((row) => (
            <tr key={row.deal_no} className="border-t border-[#eef6f0]">
              <td className="py-2">{row.deal_no}</td>
              <td>{inr(row.receivable_amount)}</td>
              <td>{inr(row.collected_amount)}</td>
              <td>{inr(row.outstanding)}</td>
            </tr>
          ))}
          {rows.length === 0 ? <tr><td colSpan={4} className="py-3 text-[#5c4d72]">No case file uses this lender name yet.</td></tr> : null}
        </tbody>
      </table>
    </section>
  );
}

function LendersPage() {
  const [rows, setRows] = useState<Lender[]>([]);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [kind, setKind] = useState("bank");
  const [picked, setPicked] = useState("");
  const [files, setFiles] = useState<FinanceRow[]>([]);

  useEffect(() => {
    void getFinanceReport().then((report) => setFiles(report.rows)).catch(() => setFiles([]));
  }, []);

  const load = () => {
    void request<{ lenders: Lender[] }>("/api/los/lenders").then((data) => setRows(data.lenders)).catch((error) => toast.error(error instanceof Error ? error.message : "Could not load lenders"));
  };
  useEffect(() => { load(); }, []);

  return (
    <div className="space-y-4 p-4">
      <h1 className="font-display text-2xl font-bold text-[#390A5D]">Lenders</h1>
      <form className="flex flex-wrap gap-2" onSubmit={(event) => {
        event.preventDefault();
        void request("/api/los/lenders", { method: "POST", body: JSON.stringify({ name, code, lender_type: kind }) })
          .then(() => { setName(""); setCode(""); toast.success("Lender saved"); load(); })
          .catch((error) => toast.error(error instanceof Error ? error.message : "Could not save the lender"));
      }}>
        <input className="h-10 rounded-lg border border-[#d8ecdd] px-3" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
        <input className="h-10 rounded-lg border border-[#d8ecdd] px-3" placeholder="Code" value={code} onChange={(e) => setCode(e.target.value)} />
        <select className="h-10 rounded-lg border border-[#d8ecdd] px-3" value={kind} onChange={(e) => setKind(e.target.value)}>
          <option value="bank">Bank</option>
          <option value="nbfc">NBFC</option>
        </select>
        <button className="h-10 rounded-lg bg-[#10662A] px-4 text-sm font-semibold text-white" type="submit">Add lender</button>
      </form>
      <div className="grid gap-3 sm:grid-cols-2">
        {rows.map((row) => (
          <article key={row.id} className={`cursor-pointer rounded-2xl border bg-white p-4 ${picked === row.name ? "border-[#10662A] ring-1 ring-[#10662A]" : "border-[#d8ecdd]"}`} onClick={() => setPicked(row.name)}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-display text-lg font-bold text-[#390A5D]">{row.name}</p>
                <p className="text-xs font-semibold uppercase tracking-wide text-[#10662A]">{row.code}</p>
              </div>
              <span className="rounded-full bg-[#E8F7EC] px-2 py-1 text-[11px] font-semibold capitalize text-[#0D4F20]">{row.lender_type}</span>
            </div>
            <p className="mt-3 text-sm text-[#5c4d72]">{row.branches.length ? `${row.branches.length} branches · ${row.branches.map((branch) => branch.name).join(", ")}` : "No branch yet"}</p>
          </article>
        ))}
      </div>
      {picked ? <LenderBook name={picked} rows={files.filter((row) => (row.bank_name || "Bank not set") === picked)} /> : null}
    </div>
  );
}
