import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import { Filter, Loader2, Phone, MapPin, Banknote, Flame, Snowflake, Sun, ShoppingCart } from "lucide-react";

export const Route = createFileRoute("/dashboard/leadboard")({
  head: () => ({ meta: [{ title: "Leadboard Marketplace — LeadMines" }] }),
  component: Leadboard,
});

type Lead = {
  id: string;
  applicant_name: string;
  masked_phone: string;
  city: string;
  loan_type: string;
  loan_amount: number;
  monthly_income: number | null;
  score: "cold" | "warm" | "hot";
  price: number;
  source: string | null;
  status: string;
};

const LOAN_TYPES = ["all", "personal", "home", "business", "credit_card", "insurance", "mutual_fund"];
const SCORES = ["all", "hot", "warm", "cold"];

export default function Leadboard() {
  const { user } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [city, setCity] = useState("");
  const [type, setType] = useState("all");
  const [score, setScore] = useState("all");
  const [buying, setBuying] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    let q = supabase.from("leads").select("*").eq("status", "available").order("score", { ascending: false }).order("created_at", { ascending: false });
    if (city.trim()) q = q.ilike("city", `%${city.trim()}%`);
    if (type !== "all") q = q.eq("loan_type", type as Lead["loan_type"]);
    if (score !== "all") q = q.eq("score", score as Lead["score"]);
    const { data, error } = await q;
    if (error) toast.error(error.message);
    else setLeads((data ?? []) as Lead[]);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [city, type, score]);

  const buy = async (lead: Lead) => {
    if (!user) return;
    setBuying(lead.id);
    const { data, error } = await supabase.rpc("purchase_lead", { _lead_id: lead.id });
    setBuying(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    const result = data as { success: boolean; full_phone: string; new_balance: number };
    toast.success(`Lead purchased! Phone: ${result.full_phone}`, { duration: 6000 });
    load();
  };

  return (
    <div className="space-y-6 max-w-7xl">
      <div>
        <h1 className="font-display text-2xl lg:text-3xl font-bold">Leadboard Marketplace</h1>
        <p className="text-muted-foreground mt-1">AI-verified financial leads. Filter, preview, and purchase with your wallet.</p>
      </div>

      <div className="rounded-2xl bg-card border border-border p-4 shadow-card">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground mb-3">
          <Filter className="size-4 text-accent" /> Filters
        </div>
        <div className="grid sm:grid-cols-3 gap-3">
          <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Filter by city…" className="input-base" />
          <select value={type} onChange={(e) => setType(e.target.value)} className="input-base">
            {LOAN_TYPES.map((t) => <option key={t} value={t}>{t === "all" ? "All loan types" : labelize(t)}</option>)}
          </select>
          <select value={score} onChange={(e) => setScore(e.target.value)} className="input-base">
            {SCORES.map((s) => <option key={s} value={s}>{s === "all" ? "All scores" : s.toUpperCase()}</option>)}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="grid place-items-center py-20"><Loader2 className="size-6 animate-spin text-accent" /></div>
      ) : leads.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center text-muted-foreground">
          No leads match your filters. Try clearing them.
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {leads.map((lead) => (
            <LeadCard key={lead.id} lead={lead} onBuy={buy} buying={buying === lead.id} />
          ))}
        </div>
      )}
    </div>
  );
}

function LeadCard({ lead, onBuy, buying }: { lead: Lead; onBuy: (l: Lead) => void; buying: boolean }) {
  const ScoreIcon = lead.score === "hot" ? Flame : lead.score === "warm" ? Sun : Snowflake;
  const scoreColor =
    lead.score === "hot" ? "bg-orange-500/15 text-orange-600 dark:text-orange-400" :
    lead.score === "warm" ? "bg-amber-500/15 text-amber-600 dark:text-amber-400" :
    "bg-blue-500/15 text-blue-600 dark:text-blue-400";

  return (
    <div className="rounded-2xl bg-card border border-border p-5 shadow-card hover:border-accent/50 transition-smooth flex flex-col">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-semibold truncate">{lead.applicant_name}</h3>
          <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
            <Phone className="size-3" /> {lead.masked_phone}
          </div>
        </div>
        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold uppercase ${scoreColor}`}>
          <ScoreIcon className="size-3" /> {lead.score}
        </span>
      </div>

      <div className="mt-4 space-y-1.5 text-sm">
        <Row icon={MapPin} text={lead.city} />
        <Row icon={Banknote} text={`${labelize(lead.loan_type)} • ₹${lead.loan_amount.toLocaleString("en-IN")}`} />
        {lead.monthly_income && <Row icon={Banknote} text={`Income: ₹${lead.monthly_income.toLocaleString("en-IN")}/mo`} />}
      </div>

      <div className="mt-auto pt-4 flex items-center justify-between border-t border-border mt-4">
        <div>
          <div className="text-xs text-muted-foreground">Lead price</div>
          <div className="font-display text-xl font-bold">₹{lead.price}</div>
        </div>
        <button
          onClick={() => onBuy(lead)}
          disabled={buying}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-accent text-accent-foreground font-semibold text-sm hover:opacity-90 transition-smooth disabled:opacity-60"
        >
          {buying ? <Loader2 className="size-4 animate-spin" /> : <ShoppingCart className="size-4" />}
          Buy
        </button>
      </div>
    </div>
  );
}

function Row({ icon: Icon, text }: { icon: React.ComponentType<{ className?: string }>; text: string }) {
  return (
    <div className="flex items-center gap-2 text-foreground/80">
      <Icon className="size-3.5 text-muted-foreground shrink-0" />
      <span className="truncate">{text}</span>
    </div>
  );
}

function labelize(s: string) {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
