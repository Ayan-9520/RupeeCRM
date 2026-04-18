import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import { FileText, Loader2, MapPin, Banknote, Building2, ArrowRight, ShoppingBag } from "lucide-react";

export const Route = createFileRoute("/dashboard/submissions")({
  head: () => ({ meta: [{ title: "Submissions — LeadMines" }] }),
  component: Submissions,
});

type Row = {
  id: string;
  pipeline_stage: string;
  deal_value: number;
  notes: { at: string; text: string; lender?: string }[];
  updated_at: string;
  leads: {
    applicant_name: string;
    full_phone: string;
    city: string;
    loan_amount: number;
    product_subtype: string | null;
  } | null;
};

const SUBMISSION_STAGES = ["docs", "submitted", "approved", "disbursed"];
const LENDERS = ["HDFC Bank", "ICICI Bank", "Axis Bank", "Bajaj Finserv", "Tata Capital", "IDFC First", "Kotak Mahindra"];

function Submissions() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [stage, setStage] = useState<"all" | string>("all");

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("lead_purchases")
      .select("id,pipeline_stage,deal_value,notes,updated_at,leads:leads(applicant_name,full_phone,city,loan_amount,product_subtype)")
      .eq("dsa_id", user.id)
      .in("pipeline_stage", SUBMISSION_STAGES)
      .order("updated_at", { ascending: false });
    if (error) toast.error(error.message);
    else setRows((data ?? []) as unknown as Row[]);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [user]);

  const filtered = stage === "all" ? rows : rows.filter((r) => r.pipeline_stage === stage);

  const counts = SUBMISSION_STAGES.reduce<Record<string, number>>((acc, s) => {
    acc[s] = rows.filter((r) => r.pipeline_stage === s).length;
    return acc;
  }, {});

  const advance = async (row: Row, next: string, lender?: string) => {
    const newNote = lender ? { at: new Date().toISOString(), text: `Assigned to ${lender}`, lender } : null;
    const updates: { pipeline_stage: string; updated_at: string; notes?: unknown } = {
      pipeline_stage: next,
      updated_at: new Date().toISOString(),
    };
    if (newNote) updates.notes = [...(row.notes ?? []), newNote];
    const { error } = await supabase.from("lead_purchases").update(updates as never).eq("id", row.id);
    if (error) { toast.error(error.message); return; }
    toast.success(`Updated → ${next}`);
    load();
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
            <div className="text-xs text-muted-foreground uppercase tracking-wide">{s}</div>
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
  const lastLender = [...(row.notes ?? [])].reverse().find((n) => n.lender)?.lender;
  const stageColor = row.pipeline_stage === "disbursed" ? "bg-emerald-500/15 text-emerald-600"
    : row.pipeline_stage === "approved" ? "bg-blue-500/15 text-blue-600"
    : row.pipeline_stage === "submitted" ? "bg-amber-500/15 text-amber-600"
    : "bg-secondary text-muted-foreground";
  const next = row.pipeline_stage === "docs" ? "submitted"
    : row.pipeline_stage === "submitted" ? "approved"
    : row.pipeline_stage === "approved" ? "disbursed" : null;

  return (
    <tr className="border-t border-border hover:bg-secondary/30">
      <td className="px-4 py-3">
        <div className="font-semibold">{lead.applicant_name}</div>
        <div className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="size-3" />{lead.city}</div>
      </td>
      <td className="px-4 py-3 hidden md:table-cell">{lead.product_subtype ?? "—"}</td>
      <td className="px-4 py-3 hidden lg:table-cell font-semibold">₹{Number(lead.loan_amount).toLocaleString("en-IN")}</td>
      <td className="px-4 py-3"><span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${stageColor}`}>{row.pipeline_stage}</span></td>
      <td className="px-4 py-3">
        {lastLender ? (
          <span className="text-xs inline-flex items-center gap-1"><Building2 className="size-3" />{lastLender}</span>
        ) : (
          <select onChange={(e) => { if (e.target.value) onAdvance(row, row.pipeline_stage === "docs" ? "submitted" : row.pipeline_stage, e.target.value); }} className="input-base !h-8 !py-0 text-xs">
            <option value="">Assign…</option>
            {LENDERS.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
        )}
      </td>
      <td className="px-4 py-3">
        {next ? (
          <button onClick={() => onAdvance(row, next)} className="text-xs font-bold px-2.5 py-1 rounded-md bg-accent text-accent-foreground hover:opacity-90">
            → {next}
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
