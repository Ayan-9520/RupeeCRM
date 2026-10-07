import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { BriefcaseBusiness, Loader2, RefreshCw, Search } from "lucide-react";
import { listBusinessCases, type BusinessCaseSummary } from "@/lib/python-api";
import { STAGES, shortINR } from "@/lib/business-fields";

export const Route = createFileRoute("/dashboard/business/")({
  head: () => ({ meta: [{ title: "Business Cases — RupeeDial One" }] }),
  component: BusinessCasesPage,
});

const GRADE_CLASS: Record<string, string> = {
  A: "bg-emerald-500/15 text-emerald-700",
  B: "bg-sky-500/15 text-sky-700",
  C: "bg-amber-500/15 text-amber-700",
  D: "bg-red-500/15 text-red-700",
};

function BusinessCasesPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<BusinessCaseSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [stage, setStage] = useState("");
  const [caseRef, setCaseRef] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const data = await listBusinessCases({ q: q.trim() || undefined, stage: stage || undefined });
      setItems(data.items);
      setTotal(data.total);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load cases");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage]);

  const openCase = (e: React.FormEvent) => {
    e.preventDefault();
    const ref = caseRef.trim().toUpperCase();
    if (!ref) return;
    navigate({ to: "/dashboard/business/$ref", params: { ref } });
  };

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-2xl lg:text-3xl font-bold flex items-center gap-2">
            <BriefcaseBusiness className="size-7 text-accent" /> Business Cases
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Business loan checks from rupeedial.com. Open a case by its ID, call the customer and complete each step.
          </p>
        </div>
        <form onSubmit={openCase} className="flex items-center gap-2">
          <input
            value={caseRef}
            onChange={(e) => setCaseRef(e.target.value)}
            placeholder="BIZ-261007-12345"
            className="input-base w-56 font-mono uppercase"
          />
          <button type="submit" className="rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground hover:opacity-90">
            Open case
          </button>
        </form>
      </div>

      <div className="rounded-2xl bg-card border border-border p-4 shadow-card space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void load()}
              placeholder="Search case ID, company, name, phone, city…"
              className="input-base pl-9 w-full"
            />
          </div>
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-border px-4 py-2 text-sm font-semibold hover:bg-secondary"
          >
            <RefreshCw className="size-4" /> Refresh
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {[{ key: "", label: "All" }, ...STAGES].map((s) => (
            <button
              key={s.key || "all"}
              type="button"
              onClick={() => setStage(s.key)}
              className={`rounded-full px-3 py-1 text-xs font-semibold border transition ${
                stage === s.key ? "bg-accent text-accent-foreground border-accent" : "border-border text-muted-foreground hover:bg-secondary"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-2xl bg-card border border-border shadow-card overflow-hidden">
        {loading ? (
          <div className="grid place-items-center py-20">
            <Loader2 className="size-6 animate-spin text-accent" />
          </div>
        ) : items.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground text-sm">
            No business cases yet. They appear here when a customer submits the Business Loan check on rupeedial.com.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <div className="px-4 py-2 text-xs text-muted-foreground border-b border-border">{total} case{total === 1 ? "" : "s"}</div>
            <table className="w-full text-sm">
              <thead className="bg-secondary/40 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-3">Case</th>
                  <th className="text-left px-4 py-3">Business</th>
                  <th className="text-left px-4 py-3">Facility</th>
                  <th className="text-left px-4 py-3">Asked / Eligible</th>
                  <th className="text-left px-4 py-3">Grade</th>
                  <th className="text-left px-4 py-3">Stage</th>
                  <th className="text-left px-4 py-3">Created</th>
                </tr>
              </thead>
              <tbody>
                {items.map((c) => (
                  <tr key={c.id} className="border-t border-border hover:bg-secondary/30">
                    <td className="px-4 py-3">
                      <Link to="/dashboard/business/$ref" params={{ ref: c.case_id }} className="font-mono text-xs font-semibold text-accent hover:underline">
                        {c.case_id}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold">{c.company_name || c.applicant_name}</div>
                      <div className="text-xs text-muted-foreground">
                        {c.applicant_name} · {c.full_phone} · {c.city}
                      </div>
                    </td>
                    <td className="px-4 py-3">{c.facility ?? "—"}</td>
                    <td className="px-4 py-3 tabular-nums">
                      {shortINR(c.required_amount)} / <span className="font-semibold text-emerald-700">{shortINR(c.eligible_amount)}</span>
                    </td>
                    <td className="px-4 py-3">
                      {c.grade ? (
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${GRADE_CLASS[c.grade] ?? ""}`}>{c.grade}</span>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-3 text-xs">{STAGES.find((s) => s.key === c.stage)?.label ?? c.stage}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {c.created_at ? new Date(c.created_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
