import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { request } from "@/lib/python-api";

export const Route = createFileRoute("/dashboard/lenders")({
  head: () => ({ meta: [{ title: "Lenders — RupeeOne" }] }),
  component: LendersPage,
});

type Lender = { id: string; name: string; code: string; lender_type: string; branches: { name: string; city: string }[] };

function LendersPage() {
  const [rows, setRows] = useState<Lender[]>([]);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [kind, setKind] = useState("bank");

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
      <ul className="space-y-2">
        {rows.map((row) => (
          <li key={row.id} className="rounded-xl border border-[#d8ecdd] bg-white p-3">
            <div className="font-semibold text-[#390A5D]">{row.name} · {row.code} · {row.lender_type}</div>
            <div className="text-xs text-[#5c4d72]">{row.branches.length ? row.branches.map((b) => b.name).join(", ") : "No branch yet"}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}
