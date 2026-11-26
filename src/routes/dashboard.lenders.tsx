import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { getFinanceReport, listDumpHistory, request, type FinanceRow } from "@/lib/python-api";

export const Route = createFileRoute("/dashboard/lenders")({
  head: () => ({ meta: [{ title: "Lenders — RupeeOne" }] }),
  component: LendersPage,
});

type Lender = {
  id: string;
  name: string;
  code: string;
  lender_type: string;
  active: boolean;
  phone?: string;
  website?: string;
  branches: { id: string; name: string; city: string; active?: boolean }[];
  products?: { id: string; name: string; category: string; active: boolean }[];
  contacts?: { id: string; name: string; designation: string; phone: string; active: boolean }[];
};

function inr(n: number) {
  return `₹${Math.round(n || 0).toLocaleString("en-IN")}`;
}

function LenderBook({ name, rows, dumpAmount }: { name: string; rows: FinanceRow[]; dumpAmount: number }) {
  const expected = rows.reduce((sum, row) => sum + Number(row.receivable_amount || 0), 0);
  const received = rows.reduce((sum, row) => sum + Number(row.collected_amount || 0), 0);
  return (
    <section className="rounded-2xl border border-[#d8ecdd] bg-white p-4">
      <h2 className="font-display text-lg font-bold text-[#390A5D]">{name}</h2>
      <p className="text-sm text-[#5c4d72]">CRM book versus collected, and the saved dump total for this lender name. Type the same bank name when you import the file.</p>
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
          <tr className="border-t border-[#eef6f0]">
            <td className="py-2">Saved dumps</td>
            <td>{inr(dumpAmount)}</td>
            <td>{inr(received)}</td>
            <td>{inr(dumpAmount - received)}</td>
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

function LenderDesk({ lender, reload }: { lender: Lender; reload: () => void }) {
  const [product, setProduct] = useState("");
  const [branch, setBranch] = useState("");
  const [city, setCity] = useState("");
  const [person, setPerson] = useState("");
  const [role, setRole] = useState("Relationship Manager");
  const save = (path: string, body: object) => {
    void request(path, { method: "POST", body: JSON.stringify(body) })
      .then(() => { toast.success("Saved"); reload(); })
      .catch((error) => toast.error(error instanceof Error ? error.message : "Could not save"));
  };
  return (
    <section className="space-y-3 rounded-2xl border border-[#d8ecdd] bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-lg font-bold text-[#390A5D]">{lender.name}</h2>
        <button type="button" className="rounded-lg bg-[#E8F7EC] px-3 py-1.5 text-sm font-semibold text-[#0D4F20]" onClick={() => {
          void request(`/api/los/lenders/${lender.id}`, { method: "PATCH", body: JSON.stringify({ name: lender.name, code: lender.code, lender_type: lender.lender_type, active: !lender.active, phone: lender.phone || "", website: lender.website || "" }) })
            .then(() => { toast.success(lender.active ? "Lender marked inactive" : "Lender marked active"); reload(); })
            .catch((error) => toast.error(error instanceof Error ? error.message : "Could not update the lender"));
        }}>{lender.active ? "Mark inactive" : "Mark active"}</button>
      </div>
      <form className="flex flex-wrap gap-2" onSubmit={(event) => { event.preventDefault(); save(`/api/los/lenders/${lender.id}/products`, { name: product, category: product }); setProduct(""); }}>
        <input className="h-10 rounded-lg border border-[#d8ecdd] px-3" placeholder="Product name" value={product} onChange={(event) => setProduct(event.target.value)} />
        <button className="h-10 rounded-lg bg-[#10662A] px-3 text-sm font-semibold text-white" type="submit">Add product</button>
      </form>
      <p className="text-sm text-[#5c4d72]">{(lender.products || []).map((item) => item.name).join(", ") || "No product yet"}</p>
      <form className="flex flex-wrap gap-2" onSubmit={(event) => { event.preventDefault(); save(`/api/los/lenders/${lender.id}/branches`, { name: branch, city }); setBranch(""); setCity(""); }}>
        <input className="h-10 rounded-lg border border-[#d8ecdd] px-3" placeholder="Branch" value={branch} onChange={(event) => setBranch(event.target.value)} />
        <input className="h-10 rounded-lg border border-[#d8ecdd] px-3" placeholder="City" value={city} onChange={(event) => setCity(event.target.value)} />
        <button className="h-10 rounded-lg bg-[#10662A] px-3 text-sm font-semibold text-white" type="submit">Add branch</button>
      </form>
      <form className="flex flex-wrap gap-2" onSubmit={(event) => { event.preventDefault(); save(`/api/los/lenders/${lender.id}/contacts`, { name: person, designation: role }); setPerson(""); }}>
        <input className="h-10 rounded-lg border border-[#d8ecdd] px-3" placeholder="Banker name" value={person} onChange={(event) => setPerson(event.target.value)} />
        <input className="h-10 rounded-lg border border-[#d8ecdd] px-3" placeholder="Designation" value={role} onChange={(event) => setRole(event.target.value)} />
        <button className="h-10 rounded-lg bg-[#10662A] px-3 text-sm font-semibold text-white" type="submit">Add banker</button>
      </form>
      <p className="text-sm text-[#5c4d72]">{(lender.contacts || []).map((item) => `${item.name} (${item.designation || "contact"})`).join(", ") || "No banker yet"}</p>
    </section>
  );
}

function SchemeBoard() {
  const [schemes, setSchemes] = useState<{ id: string; name: string; current: boolean; start_on: string; end_on: string }[]>([]);
  const [targets, setTargets] = useState<{ id: string; metric: string; start_on: string; end_on: string; target_value: number; achieved: number; percent: number | null; cases: number; remaining: number | null }[]>([]);
  const [name, setName] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [goal, setGoal] = useState("");
  const [schemeId, setSchemeId] = useState("");
  const load = () => {
    void request<{ schemes: typeof schemes }>("/api/los/schemes").then((data) => setSchemes(data.schemes)).catch(() => setSchemes([]));
    void request<{ targets: typeof targets }>("/api/los/targets").then((data) => setTargets(data.targets)).catch(() => setTargets([]));
  };
  useEffect(() => { load(); }, []);
  return (
    <section className="space-y-3 rounded-2xl border border-[#d8ecdd] bg-white p-4">
      <h2 className="font-display text-lg font-bold text-[#390A5D]">Schemes and targets</h2>
      <p className="text-sm text-[#5c4d72]">Achievement uses counted cases only. A disbursement line counts when its date is inside the target period. Cancelled and on-hold files are left out. A scheme does not change commission.</p>
      <form className="flex flex-wrap gap-2" onSubmit={(event) => {
        event.preventDefault();
        void request("/api/los/schemes", { method: "POST", body: JSON.stringify({ name, start_on: start, end_on: end }) })
          .then(() => { setName(""); toast.success("Scheme saved"); load(); })
          .catch((error) => toast.error(error instanceof Error ? error.message : "Could not save the scheme"));
      }}>
        <input className="h-10 rounded-lg border border-[#d8ecdd] px-3" placeholder="Scheme name" value={name} onChange={(event) => setName(event.target.value)} />
        <input className="h-10 rounded-lg border border-[#d8ecdd] px-3" type="date" value={start} onChange={(event) => setStart(event.target.value)} />
        <input className="h-10 rounded-lg border border-[#d8ecdd] px-3" type="date" value={end} onChange={(event) => setEnd(event.target.value)} />
        <button className="h-10 rounded-lg bg-[#10662A] px-3 text-sm font-semibold text-white" type="submit">Add scheme</button>
      </form>
      <p className="text-sm text-[#5c4d72]">{schemes.map((row) => `${row.name}${row.current ? "" : " (not current)"}`).join(", ") || "No scheme yet"}</p>
      <form className="flex flex-wrap gap-2" onSubmit={(event) => {
        event.preventDefault();
        void request("/api/los/targets", { method: "POST", body: JSON.stringify({ scheme_id: schemeId || null, period_kind: "custom", start_on: start, end_on: end, metric: "disbursement_amount", target_value: Number(goal || 0) }) })
          .then(() => { setGoal(""); toast.success("Target saved"); load(); })
          .catch((error) => toast.error(error instanceof Error ? error.message : "Could not save the target"));
      }}>
        <select className="h-10 rounded-lg border border-[#d8ecdd] px-3" value={schemeId} onChange={(event) => setSchemeId(event.target.value)}>
          <option value="">All linked cases</option>
          {schemes.filter((row) => row.current).map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}
        </select>
        <input className="h-10 w-36 rounded-lg border border-[#d8ecdd] px-3" placeholder="Target amount" value={goal} onChange={(event) => setGoal(event.target.value)} />
        <button className="h-10 rounded-lg bg-[#10662A] px-3 text-sm font-semibold text-white" type="submit">Add disbursement target</button>
      </form>
      {targets.map((row) => (
        <div key={row.id}>
          <div className="flex justify-between text-sm"><span className="font-semibold text-[#390A5D]">{row.start_on} to {row.end_on}</span><span className="text-[#10662A]">{row.percent == null ? "No target" : `${row.percent}%`}</span></div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-[#E8F7EC]"><div className="h-full rounded-full bg-[#10662A]" style={{ width: `${Math.min(row.percent || 0, 100)}%` }} /></div>
          <p className="mt-1 text-xs text-[#5c4d72]">Achieved {row.metric === "case_count" ? row.achieved : inr(row.achieved)} of {row.metric === "case_count" ? row.target_value : inr(row.target_value)}. {row.cases} cases. {row.remaining == null ? "" : `Remaining ${inr(row.remaining)}.`} The bar stops at 100%. The percent does not.</p>
        </div>
      ))}
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
  const [dumps, setDumps] = useState<{ lender: string; dump_amount: number; status: string }[]>([]);

  useEffect(() => {
    void getFinanceReport().then((report) => setFiles(report.rows)).catch(() => setFiles([]));
    void listDumpHistory().then((data) => setDumps(data.items.filter((item) => item.status === "applied"))).catch(() => setDumps([]));
  }, []);

  const load = () => {
    void request<{ lenders: Lender[] }>("/api/los/lenders").then((data) => setRows(data.lenders)).catch((error) => toast.error(error instanceof Error ? error.message : "Could not load lenders"));
  };
  useEffect(() => { load(); }, []);

  return (
    <div className="space-y-4 p-4">
      <h1 className="font-display text-2xl font-bold text-[#390A5D]">Lenders</h1>
      <SchemeBoard />
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
          <option value="other">Other</option>
        </select>
        <button className="h-10 rounded-lg bg-[#10662A] px-4 text-sm font-semibold text-white" type="submit">Add lender</button>
      </form>
      <div className="grid gap-3 sm:grid-cols-2">
        {rows.map((row) => (
          <article key={row.id} className={`cursor-pointer rounded-2xl border bg-white p-4 ${picked === row.id ? "border-[#10662A] ring-1 ring-[#10662A]" : "border-[#d8ecdd]"}`} onClick={() => setPicked(row.id)}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-display text-lg font-bold text-[#390A5D]">{row.name}</p>
                <p className="text-xs font-semibold uppercase tracking-wide text-[#10662A]">{row.code}</p>
              </div>
              <span className="rounded-full bg-[#E8F7EC] px-2 py-1 text-[11px] font-semibold capitalize text-[#0D4F20]">{row.lender_type}</span>
            </div>
            <p className="mt-3 text-sm text-[#5c4d72]">{row.active ? "Active" : "Inactive"} · {(row.products || []).length} products · {row.branches.length} branches · {(row.contacts || []).length} bankers</p>
          </article>
        ))}
      </div>
      {rows.find((row) => row.id === picked) ? <LenderDesk lender={rows.find((row) => row.id === picked)!} reload={load} /> : null}
      {picked ? <LenderBook name={rows.find((row) => row.id === picked)?.name || ""} rows={files.filter((row) => (row.bank_name || "Bank not set") === (rows.find((item) => item.id === picked)?.name || ""))} dumpAmount={dumps.filter((item) => item.lender === (rows.find((row) => row.id === picked)?.name || "")).reduce((sum, item) => sum + item.dump_amount, 0)} /> : null}
    </div>
  );
}
