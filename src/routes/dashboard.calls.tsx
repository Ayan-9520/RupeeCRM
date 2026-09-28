import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Phone, MapPin, Banknote, Loader2, Search, MessageSquare, ArrowRight, ShoppingBag } from "lucide-react";
import { listMyLeads, patchMyLead } from "@/lib/python-api";

export const Route = createFileRoute("/dashboard/calls")({
  head: () => ({ meta: [{ title: "Call Queue — RupeeDial One" }] }),
  component: CallQueue,
});

type Row = {
  id: string;
  pipeline_stage: string;
  next_followup_at: string | null;
  notes: { at: string; text: string }[];
  leads: {
    id: string;
    applicant_name: string;
    full_phone: string;
    city: string;
    loan_amount: number;
    monthly_income: number | null;
    score: "cold" | "warm" | "hot";
    product_subtype: string | null;
  } | null;
};

const CALL_STAGES = ["new", "contacted"];

function CallQueue() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [stage, setStage] = useState<"all" | "new" | "contacted">("all");

  const load = async () => {
    setLoading(true);
    try {
      const data = await listMyLeads();
      const mapped: Row[] = (data.items ?? [])
        .filter((p) => CALL_STAGES.includes(p.pipeline_stage))
        .map((p) => ({
          id: p.id,
          pipeline_stage: p.pipeline_stage,
          next_followup_at: p.next_followup_at,
          notes: (p.notes ?? []).map((n) => ({ at: n.at, text: n.text })),
          leads: p.lead
            ? {
                id: p.lead.id,
                applicant_name: p.lead.applicant_name,
                full_phone: p.lead.full_phone,
                city: p.lead.city,
                loan_amount: p.lead.loan_amount,
                monthly_income: p.lead.monthly_income,
                score: (["hot", "warm", "cold"].includes(p.lead.score) ? p.lead.score : "cold") as "cold" | "warm" | "hot",
                product_subtype: p.lead.product_subtype,
              }
            : null,
        }));
      setRows(mapped);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load call queue");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = rows.filter((r) => {
    if (stage !== "all" && r.pipeline_stage !== stage) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        r.leads?.applicant_name.toLowerCase().includes(q) ||
        r.leads?.city.toLowerCase().includes(q) ||
        r.leads?.full_phone.includes(q)
      );
    }
    return true;
  });

  const advance = async (row: Row, next: string) => {
    try {
      await patchMyLead(row.id, { pipeline_stage: next });
      toast.success(`Moved to ${next}`);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    }
  };

  const addNote = async (row: Row, text: string) => {
    try {
      await patchMyLead(row.id, { notes_text: text });
      toast.success("Note added");
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to add note");
    }
  };

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-2xl lg:text-3xl font-bold">Call Queue</h1>
          <p className="text-muted-foreground mt-1">Customers you've purchased — waiting for the first or follow-up call.</p>
        </div>
        <Link to="/dashboard/leadboard" className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent text-accent-foreground font-semibold text-sm hover:opacity-90 transition-smooth">
          <ShoppingBag className="size-4" /> Buy more leads
        </Link>
      </div>

      <div className="rounded-2xl bg-card border border-border p-4 shadow-card flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name, city, or phone…" className="input-base pl-9 w-full" />
        </div>
        <select value={stage} onChange={(e) => setStage(e.target.value as typeof stage)} className="input-base">
          <option value="all">All stages</option>
          <option value="new">New (not called yet)</option>
          <option value="contacted">Contacted</option>
        </select>
      </div>

      {loading ? (
        <div className="grid place-items-center py-20"><Loader2 className="size-6 animate-spin text-accent" /></div>
      ) : filtered.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((r) => <CallCard key={r.id} row={r} onAdvance={advance} onNote={addNote} />)}
        </div>
      )}
    </div>
  );
}

function CallCard({ row, onAdvance, onNote }: { row: Row; onAdvance: (r: Row, next: string) => void; onNote: (r: Row, text: string) => void }) {
  const [noteText, setNoteText] = useState("");
  if (!row.leads) return null;
  const lead = row.leads;
  const scoreColor = lead.score === "hot" ? "bg-orange-500/15 text-orange-600" : lead.score === "warm" ? "bg-amber-500/15 text-amber-600" : "bg-blue-500/15 text-blue-600";
  return (
    <div className="rounded-2xl bg-card border border-border p-5 shadow-card flex flex-col gap-3">
      <div className="flex items-start justify-between">
        <div>
          <div className="font-display font-bold">{lead.applicant_name}</div>
          <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5"><MapPin className="size-3" />{lead.city}</div>
        </div>
        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${scoreColor}`}>{lead.score}</span>
      </div>
      <div className="text-sm space-y-1">
        <div className="flex items-center gap-2"><Phone className="size-3.5 text-accent" /><span className="font-mono">{lead.full_phone}</span></div>
        <div className="flex items-center gap-2"><Banknote className="size-3.5 text-accent" /><span>{lead.product_subtype ?? "Loan"} · ₹{Number(lead.loan_amount).toLocaleString("en-IN")}</span></div>
      </div>
      <div className="flex gap-2">
        <a href={`tel:${lead.full_phone}`} className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-accent text-accent-foreground text-sm font-bold hover:opacity-90"><Phone className="size-4" /> Call</a>
        <a href={`https://wa.me/${lead.full_phone.replace(/\D/g, "")}`} target="_blank" rel="noopener" className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-secondary text-secondary-foreground text-sm font-bold hover:opacity-80"><MessageSquare className="size-4" /></a>
      </div>
      <div className="flex flex-col gap-2 pt-2 border-t border-border">
        <input value={noteText} onChange={(e) => setNoteText(e.target.value)} placeholder="Quick note (e.g. 'Will call back at 5pm')" className="input-base text-xs" />
        <div className="flex gap-2">
          <button onClick={() => { if (noteText.trim()) { onNote(row, noteText.trim()); setNoteText(""); } }} className="flex-1 text-xs font-semibold px-3 py-1.5 rounded-md border border-border hover:bg-secondary">Save note</button>
          {row.pipeline_stage === "new" && <button onClick={() => onAdvance(row, "contacted")} className="text-xs font-bold px-3 py-1.5 rounded-md bg-amber-500 text-white">Mark contacted →</button>}
          {row.pipeline_stage === "contacted" && <button onClick={() => onAdvance(row, "docs_collected")} className="text-xs font-bold px-3 py-1.5 rounded-md bg-emerald-500 text-white">Move to docs →</button>}
        </div>
        {row.notes?.length > 0 && (
          <div className="text-[11px] text-muted-foreground line-clamp-2">📝 {row.notes[row.notes.length - 1].text}</div>
        )}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-3xl bg-card border border-dashed border-border p-12 text-center">
      <div className="size-14 mx-auto rounded-2xl bg-accent/15 grid place-items-center"><Phone className="size-6 text-accent" /></div>
      <h2 className="font-display text-xl font-bold mt-4">No leads to call yet</h2>
      <p className="text-muted-foreground mt-2 max-w-md mx-auto">Buy fresh leads from the Leadboard — they'll appear here automatically with a one-tap call button.</p>
      <Link to="/dashboard/leadboard" className="inline-flex items-center gap-2 mt-6 px-5 py-2.5 rounded-full bg-accent text-accent-foreground font-semibold hover:opacity-90">
        <ShoppingBag className="size-4" /> Open Leadboard <ArrowRight className="size-4" />
      </Link>
    </div>
  );
}
