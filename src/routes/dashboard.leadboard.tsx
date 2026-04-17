import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import { Filter, Loader2, Phone, MapPin, Banknote, Flame, Snowflake, Sun, ShoppingCart, Sparkles, Wallet, Layers, ShoppingBag, ArrowUpDown } from "lucide-react";
import { CATEGORY_META, type ProductCategory, type ProductType } from "@/lib/products";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/dashboard/leadboard")({
  head: () => ({ meta: [{ title: "Leadboard Marketplace — LeadMines" }] }),
  component: Leadboard,
});

type Lead = {
  id: string;
  applicant_name: string;
  masked_phone: string;
  city: string;
  loan_amount: number;
  monthly_income: number | null;
  score: "cold" | "warm" | "hot";
  price: number;
  status: string;
  product_category: ProductCategory;
  product_subtype: string | null;
  product_type_id: string | null;
};

const SCORES = ["all", "hot", "warm", "cold"];
const SORTS = [
  { key: "score", label: "Hottest first" },
  { key: "newest", label: "Latest leads" },
  { key: "price_asc", label: "Price: low to high" },
  { key: "price_desc", label: "Price: high to low" },
] as const;
type SortKey = (typeof SORTS)[number]["key"];

function Leadboard() {
  const { user } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [productTypes, setProductTypes] = useState<ProductType[]>([]);
  const [loading, setLoading] = useState(true);
  const [city, setCity] = useState("");
  const [category, setCategory] = useState<"all" | ProductCategory>("all");
  const [productTypeId, setProductTypeId] = useState<"all" | string>("all");
  const [score, setScore] = useState("all");
  const [maxBudget, setMaxBudget] = useState<string>("");
  const [sort, setSort] = useState<SortKey>("score");
  const [buying, setBuying] = useState<string | null>(null);
  const [stats, setStats] = useState({ total: 0, hot: 0, purchases: 0, balance: 0 });

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("product_types").select("*").eq("enabled", true).order("display_order");
      setProductTypes((data ?? []) as ProductType[]);
    })();
  }, []);

  const filteredTypes = useMemo(
    () => (category === "all" ? productTypes : productTypes.filter((p) => p.category === category)),
    [productTypes, category],
  );

  const load = async () => {
    setLoading(true);
    let q = supabase
      .from("leads")
      .select("id,applicant_name,masked_phone,city,loan_amount,monthly_income,score,price,status,product_category,product_subtype,product_type_id")
      .eq("status", "available");
    if (sort === "score") q = q.order("score", { ascending: false }).order("created_at", { ascending: false });
    else if (sort === "newest") q = q.order("created_at", { ascending: false });
    else if (sort === "price_asc") q = q.order("price", { ascending: true });
    else if (sort === "price_desc") q = q.order("price", { ascending: false });
    if (city.trim()) q = q.ilike("city", `%${city.trim()}%`);
    if (category !== "all") q = q.eq("product_category", category);
    if (productTypeId !== "all") q = q.eq("product_type_id", productTypeId);
    if (score !== "all") q = q.eq("score", score as "cold" | "warm" | "hot");
    if (maxBudget && Number(maxBudget) > 0) q = q.lte("price", Number(maxBudget));
    const { data, error } = await q;
    if (error) toast.error(error.message);
    else setLeads((data ?? []) as Lead[]);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [city, category, productTypeId, score, maxBudget, sort]);

  // Load top stats
  useEffect(() => {
    if (!user) return;
    (async () => {
      const [totalRes, hotRes, purchRes, walletRes] = await Promise.all([
        supabase.from("leads").select("id", { count: "exact", head: true }).eq("status", "available"),
        supabase.from("leads").select("id", { count: "exact", head: true }).eq("status", "available").eq("score", "hot"),
        supabase.from("lead_purchases").select("id", { count: "exact", head: true }).eq("dsa_id", user.id),
        supabase.from("wallets").select("balance").eq("user_id", user.id).maybeSingle(),
      ]);
      setStats({
        total: totalRes.count ?? 0,
        hot: hotRes.count ?? 0,
        purchases: purchRes.count ?? 0,
        balance: Number(walletRes.data?.balance ?? 0),
      });
    })();
  }, [user, leads.length]);

  // reset sub-type when category changes
  useEffect(() => { setProductTypeId("all"); }, [category]);

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

  const typeMap = useMemo(() => Object.fromEntries(productTypes.map((p) => [p.id, p])) as Record<string, ProductType>, [productTypes]);

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-2xl lg:text-3xl font-bold">Leadboard Marketplace</h1>
          <p className="text-muted-foreground mt-1">Loans · Insurance · Credit Cards · Investments — all in one feed.</p>
        </div>
        <Link
          to="/dashboard/wallet"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent text-accent-foreground font-semibold text-sm hover:opacity-90 transition-smooth"
        >
          <Wallet className="size-4" /> Add money
        </Link>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={Layers} label="Total leads" value={stats.total.toLocaleString("en-IN")} tone="default" />
        <StatCard icon={Flame} label="Hot leads" value={stats.hot.toLocaleString("en-IN")} tone="hot" />
        <StatCard icon={ShoppingBag} label="My purchases" value={stats.purchases.toLocaleString("en-IN")} tone="default" />
        <StatCard icon={Wallet} label="Wallet balance" value={`₹${stats.balance.toLocaleString("en-IN")}`} tone="accent" />
      </div>

      <div className="rounded-2xl bg-card border border-border p-4 shadow-card sticky top-2 z-10">
        <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Filter className="size-4 text-accent" /> Filters
          </div>
          <div className="flex items-center gap-2">
            <ArrowUpDown className="size-4 text-muted-foreground" />
            <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className="input-base !h-8 !py-0 text-xs">
              {SORTS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
          </div>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <select value={category} onChange={(e) => setCategory(e.target.value as typeof category)} className="input-base">
            <option value="all">All categories</option>
            <option value="loan">Loans</option>
            <option value="insurance">Insurance</option>
            <option value="credit_card">Credit Cards</option>
            <option value="investment">Investments</option>
          </select>
          <select value={productTypeId} onChange={(e) => setProductTypeId(e.target.value)} className="input-base">
            <option value="all">All sub-types</option>
            {filteredTypes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="City…" className="input-base" />
          <input value={maxBudget} onChange={(e) => setMaxBudget(e.target.value)} type="number" placeholder="Max ₹ price" className="input-base" />
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
            <LeadCard key={lead.id} lead={lead} type={lead.product_type_id ? typeMap[lead.product_type_id] : undefined} onBuy={buy} buying={buying === lead.id} />
          ))}
        </div>
      )}
    </div>
  );
}

function LeadCard({ lead, type, onBuy, buying }: { lead: Lead; type?: ProductType; onBuy: (l: Lead) => void; buying: boolean }) {
  const ScoreIcon = lead.score === "hot" ? Flame : lead.score === "warm" ? Sun : Snowflake;
  const scoreColor =
    lead.score === "hot" ? "bg-orange-500/15 text-orange-600 dark:text-orange-400" :
    lead.score === "warm" ? "bg-amber-500/15 text-amber-600 dark:text-amber-400" :
    "bg-blue-500/15 text-blue-600 dark:text-blue-400";

  const meta = CATEGORY_META[lead.product_category];

  return (
    <div className={`relative rounded-2xl bg-card border p-5 shadow-card transition-smooth flex flex-col ${
      lead.score === "hot"
        ? "border-orange-500/60 ring-1 ring-orange-500/30 hover:ring-orange-500/60"
        : "border-border hover:border-accent/50"
    }`}>
      {lead.score === "hot" && (
        <div className="absolute -top-2 -right-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-orange-500 text-white shadow-md">
          <Flame className="size-3" /> Hot lead
        </div>
      )}
      <div className="flex items-center gap-1.5 flex-wrap mb-3">
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${meta.chipBg} ${meta.chipText}`}>
          {meta.label}
        </span>
        {type && (
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-secondary text-foreground/70 border border-border">
            {type.name}
          </span>
        )}
        {type?.high_demand && (
          <span className="inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-orange-500/15 text-orange-600 dark:text-orange-400">
            <Sparkles className="size-2.5" /> Hot
          </span>
        )}
      </div>

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
        <Row icon={Banknote} text={`Ticket: ₹${lead.loan_amount.toLocaleString("en-IN")}`} />
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
