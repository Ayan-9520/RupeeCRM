import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { FileText, Loader2, MapPin, Building2, ArrowRight, ShoppingBag } from "lucide-react";
import { listMyLeads, patchMyLead } from "@/lib/python-api";

export const Route = createFileRoute("/dashboard/submissions")({
  head: () => ({ meta: [{ title: "Submissions — RupeeDial One" }] }),
  component: Submissions,
});

type Row = {
  id: string;
  pipeline_stage: string;
  deal_value: number | null;
  notes: { at: string; text: string }[];
  leads: {
    applicant_name: string;
    full_phone: string;
    city: string;
    loan_amount: number;
    product_subtype: string | null;
  } | null;
};

/** Backend stages for docs → disbursal (UI labels below) */
const SUBMISSION_STAGES = ["docs_collected", "bank_submitted", "sanctioned", "disbursed"] as const;
const STAGE_LABEL: Record<string, string> = {
  docs_collected: "docs",
  bank_submitted: "submitted",
  sanctioned: "approved",
  disbursed: "disbursed",
};
const LENDERS = ["HDFC Bank", "ICICI Bank", "Axis Bank", "Bajaj Finserv", "Tata Capital", "IDFC First", "Kotak Mahindra"];

function Submissions() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [stage, setStage] = useState<"all" | string>("all");

  const load = async () => {
    setLoading(true);
    try {
      const data = await listMyLeads();
      const mapped: Row[] = (data.items ?? [])
        .filter((p) => (SUBMISSION_STAGES as readonly string[]).includes(p.pipeline_stage))
        .map((p) => ({
          id: p.id,
          pipeline_stage: p.pipeline_stage,
          deal_value: p.deal_value,
          notes: (p.notes ?? []).map((n) => ({ at: n.at, text: n.text })),
          leads: p.lead
            ? {
                applicant_name: p.lead.applicant_name,
                full_phone: p.lead.full_phone,
                city: p.lead.city,
                loan_amount: p.lead.loan_amount,
                product_subtype: p.lead.product_subtype,
              }
            : null,
        }));
      setRows(mapped);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load submissions");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = stage === "all" ? rows : rows.filter((r) => r.pipeline_stage === stage);

  const counts = SUBMISSION_STAGES.reduce<Record<string, number>>((acc, s) => {
    acc[s] = rows.filter((r) => r.pipeline_stage === s).length;
    return acc;
  }, {});

  const advance = async (row: Row, next: string, lender?: string) => {
    try {
      await patchMyLead(row.id, {
        pipeline_stage: next,
        ...(lender ? { notes_text: `Assigned to ${lender}` } : {}),
      });
      toast.success(`Updated → ${STAGE_LABEL[next] ?? next}`);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    }
  };

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-2xl lg:text-3xl font-bold">Lender Submissions</h1>
          <p className="text-muted-foreground mt-1">Track each case from documents to disbursal across your lender partners.</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {SUBMISSION_STAGES.map((s) => (
          <button key={s} onClick={() => setStage(stage === s ? "all" : s)}
            className={`rounded-xl bg-card border p-3 text-left transition-smooth ${stage === s ? "border-accent ring-1 ring-accent/30" : "border-border hover:border-accent/50"}`}>
            <div className="text-xs text-muted-foreground uppercase tracking-wide">{STAGE_LABEL[s]}</div>
            <div className="text-2xl font-display font-bold mt-1">{counts[s] ?? 0}</div>
          </button>
        ))}
      </div>

      {stage !== "all" && (
        <button onClick={() => setStage("all")} className="text-xs text-accent hover:underline">← Show all stages</button>
      )}

      {loading ? (
        <div className="grid place-items-center py-20"><Loader2 className="size-6 animate-spin text-accent" /></div>
      ) : filtered.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="rounded-2xl bg-card border border-border overflow-hidden shadow-card">
          <table className="w-full text-sm">
            <thead className="bg-secondary/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-3">Applicant</th>
                <th className="text-left px-4 py-3 hidden md:table-cell">Product</th>
                <th className="text-left px-4 py-3 hidden lg:table-cell">Loan amount</th>
                <th className="text-left px-4 py-3">Stage</th>
                <th className="text-left px-4 py-3">Lender</th>
                <th className="text-left px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => <SubmissionRow key={r.id} row={r} onAdvance={advance} />)}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function SubmissionRow({ row, onAdvance }: { row: Row; onAdvance: (r: Row, next: string, lender?: string) => void }) {
  if (!row.leads) return null;
  const lead = row.leads;
  const lastLender = [...(row.notes ?? [])]
    .reverse()
    .find((n) => n.text?.startsWith("Assigned to "))
    ?.text?.replace(/^Assigned to /, "");
  const displayStage = STAGE_LABEL[row.pipeline_stage] ?? row.pipeline_stage;
  const stageColor = row.pipeline_stage === "disbursed" ? "bg-emerald-500/15 text-emerald-600"
    : row.pipeline_stage === "sanctioned" ? "bg-blue-500/15 text-blue-600"
    : row.pipeline_stage === "bank_submitted" ? "bg-amber-500/15 text-amber-600"
    : "bg-secondary text-muted-foreground";
  const next = row.pipeline_stage === "docs_collected" ? "bank_submitted"
    : row.pipeline_stage === "bank_submitted" ? "sanctioned"
    : row.pipeline_stage === "sanctioned" ? "disbursed" : null;

  return (
    <tr className="border-t border-border hover:bg-secondary/30">
      <td className="px-4 py-3">
        <div className="font-semibold">{lead.applicant_name}</div>
        <div className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="size-3" />{lead.city}</div>
      </td>
      <td className="px-4 py-3 hidden md:table-cell">{lead.product_subtype ?? "—"}</td>
      <td className="px-4 py-3 hidden lg:table-cell font-semibold">₹{Number(lead.loan_amount).toLocaleString("en-IN")}</td>
      <td className="px-4 py-3"><span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${stageColor}`}>{displayStage}</span></td>
      <td className="px-4 py-3">
        {lastLender ? (
          <span className="text-xs inline-flex items-center gap-1"><Building2 className="size-3" />{lastLender}</span>
        ) : (
          <select
            onChange={(e) => {
              if (e.target.value) {
                onAdvance(row, row.pipeline_stage === "docs_collected" ? "bank_submitted" : row.pipeline_stage, e.target.value);
              }
            }}
            className="input-base !h-8 !py-0 text-xs"
          >
            <option value="">Assign…</option>
            {LENDERS.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
        )}
      </td>
      <td className="px-4 py-3">
        {next ? (
          <button onClick={() => onAdvance(row, next)} className="text-xs font-bold px-2.5 py-1 rounded-md bg-accent text-accent-foreground hover:opacity-90">
            → {STAGE_LABEL[next] ?? next}
          </button>
        ) : (
          <span className="text-xs text-muted-foreground">Done ✓</span>
        )}
      </td>
    </tr>
  );
}

function EmptyState() {
  return (
    <div className="rounded-3xl bg-card border border-dashed border-border p-12 text-center">
      <div className="size-14 mx-auto rounded-2xl bg-accent/15 grid place-items-center"><FileText className="size-6 text-accent" /></div>
      <h2 className="font-display text-xl font-bold mt-4">No submissions yet</h2>
      <p className="text-muted-foreground mt-2 max-w-md mx-auto">Move leads to the "Docs" stage from the Call Queue or My Leads to start tracking lender submissions here.</p>
      <Link to="/dashboard/calls" className="inline-flex items-center gap-2 mt-6 px-5 py-2.5 rounded-full bg-accent text-accent-foreground font-semibold hover:opacity-90">
        <ShoppingBag className="size-4" /> Open Call Queue <ArrowRight className="size-4" />
      </Link>
    </div>
  );
}
