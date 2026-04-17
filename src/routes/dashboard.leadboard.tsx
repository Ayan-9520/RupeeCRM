import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import { Filter, Loader2, Phone, MapPin, Banknote, Flame, Snowflake, Sun, ShoppingCart, Sparkles, Wallet, Layers, ShoppingBag, ArrowUpDown, AlertTriangle, X, Check, ArrowRight } from "lucide-react";
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

const QUICK_RECHARGE = [500, 1000, 2500, 5000];
const LOW_BALANCE_THRESHOLD = 300;

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

  // purchased leads in this session: id -> { full_phone }
  const [purchased, setPurchased] = useState<Record<string, { full_phone: string }>>({});

  // insufficient balance modal
  const [shortfallLead, setShortfallLead] = useState<Lead | null>(null);

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

  const refreshStats = async () => {
    if (!user) return;
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
  };

  useEffect(() => { refreshStats(); /* eslint-disable-next-line */ }, [user, leads.length]);

  // reset sub-type when category changes
  useEffect(() => { setProductTypeId("all"); }, [category]);

  const buy = async (lead: Lead) => {
    if (!user) return;
    if (purchased[lead.id]) return; // already bought in this session
    // Pre-flight balance check for nicer UX
    if (stats.balance < lead.price) {
      setShortfallLead(lead);
      return;
    }
    setBuying(lead.id);
    const { data, error } = await supabase.rpc("purchase_lead", { _lead_id: lead.id });
    setBuying(null);
    if (error) {
      // Server-side guard: balance changed under us
      if (/insufficient/i.test(error.message)) {
        setShortfallLead(lead);
      } else if (/no longer available/i.test(error.message)) {
        toast.error("This lead was just sold. Refreshing list.");
        load();
      } else {
        toast.error(error.message);
      }
      return;
    }
    const result = data as { success: boolean; full_phone: string; new_balance: number };
    setPurchased((prev) => ({ ...prev, [lead.id]: { full_phone: result.full_phone } }));
    setStats((s) => ({ ...s, balance: result.new_balance, purchases: s.purchases + 1 }));
    toast.success(`Lead unlocked! ₹${lead.price} debited. New balance ₹${result.new_balance.toLocaleString("en-IN")}`);
  };

  const recharge = async (amount: number) => {
    if (amount <= 0) return;
    const { data, error } = await supabase.rpc("recharge_wallet", { _amount: amount });
    if (error) { toast.error(error.message); return; }
    const res = data as { success: boolean; new_balance: number };
    setStats((s) => ({ ...s, balance: Number(res.new_balance) }));
    toast.success(`₹${amount.toLocaleString("en-IN")} added. Balance ₹${Number(res.new_balance).toLocaleString("en-IN")}`);
  };

  const typeMap = useMemo(() => Object.fromEntries(productTypes.map((p) => [p.id, p])) as Record<string, ProductType>, [productTypes]);

  const lowBalance = stats.balance < LOW_BALANCE_THRESHOLD;

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-2xl lg:text-3xl font-bold">Leadboard Marketplace</h1>
          <p className="text-muted-foreground mt-1">Loans · Insurance · Credit Cards · Investments — all in one feed.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="inline-flex items-center gap-2 px-3 py-2 rounded-full bg-card border border-border shadow-card">
            <Wallet className="size-4 text-accent" />
            <span className="text-xs text-muted-foreground">Balance</span>
            <span className="font-display font-bold">₹{stats.balance.toLocaleString("en-IN")}</span>
          </div>
          <Link
            to="/dashboard/wallet"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent text-accent-foreground font-semibold text-sm hover:opacity-90 transition-smooth"
          >
            <Wallet className="size-4" /> Add money
          </Link>
        </div>
      </div>

      {lowBalance && (
        <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300 px-4 py-3 flex items-center gap-3 flex-wrap">
          <AlertTriangle className="size-4 shrink-0" />
          <p className="text-sm flex-1 min-w-[200px]">
            <strong>Low wallet balance.</strong> Add funds to keep buying premium leads without interruption.
          </p>
          <div className="flex items-center gap-2">
            {[500, 1000].map((a) => (
              <button key={a} onClick={() => recharge(a)} className="text-xs font-bold px-3 py-1.5 rounded-full bg-amber-500 text-white hover:opacity-90">
                +₹{a}
              </button>
            ))}
            <Link to="/dashboard/wallet" className="text-xs font-bold px-3 py-1.5 rounded-full border border-amber-500/50 hover:bg-amber-500/20">
              Wallet →
            </Link>
          </div>
        </div>
      )}

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
            <LeadCard
              key={lead.id}
              lead={lead}
              type={lead.product_type_id ? typeMap[lead.product_type_id] : undefined}
              onBuy={buy}
              buying={buying === lead.id}
              purchased={purchased[lead.id]}
            />
          ))}
        </div>
      )}

      {shortfallLead && (
        <InsufficientBalanceModal
          lead={shortfallLead}
          balance={stats.balance}
          onClose={() => setShortfallLead(null)}
          onRecharge={async (amt) => { await recharge(amt); }}
          onRetry={async () => {
            const lead = shortfallLead;
            setShortfallLead(null);
            await buy(lead);
          }}
        />
      )}
    </div>
  );
}

function LeadCard({
  lead, type, onBuy, buying, purchased,
}: {
  lead: Lead;
  type?: ProductType;
  onBuy: (l: Lead) => void;
  buying: boolean;
  purchased?: { full_phone: string };
}) {
  const ScoreIcon = lead.score === "hot" ? Flame : lead.score === "warm" ? Sun : Snowflake;
  const scoreColor =
    lead.score === "hot" ? "bg-orange-500/15 text-orange-600 dark:text-orange-400" :
    lead.score === "warm" ? "bg-amber-500/15 text-amber-600 dark:text-amber-400" :
    "bg-blue-500/15 text-blue-600 dark:text-blue-400";

  const meta = CATEGORY_META[lead.product_category];
  const isPurchased = !!purchased;

  return (
    <div className={`relative rounded-2xl bg-card border p-5 shadow-card transition-smooth flex flex-col ${
      isPurchased
        ? "border-emerald-500/60 ring-1 ring-emerald-500/30"
        : lead.score === "hot"
          ? "border-orange-500/60 ring-1 ring-orange-500/30 hover:ring-orange-500/60"
          : "border-border hover:border-accent/50"
    }`}>
      {isPurchased ? (
        <div className="absolute -top-2 -right-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-500 text-white shadow-md">
          <Check className="size-3" /> Purchased
        </div>
      ) : lead.score === "hot" && (
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
        {type?.high_demand && !isPurchased && (
          <span className="inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-orange-500/15 text-orange-600 dark:text-orange-400">
            <Sparkles className="size-2.5" /> Hot
          </span>
        )}
      </div>

      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-semibold truncate">{lead.applicant_name}</h3>
          <div className="flex items-center gap-1 text-xs mt-0.5">
            <Phone className="size-3 text-muted-foreground" />
            {isPurchased ? (
              <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">{purchased.full_phone}</span>
            ) : (
              <span className="text-muted-foreground">{lead.masked_phone}</span>
            )}
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
          <div className="text-xs text-muted-foreground">{isPurchased ? "Paid" : "Lead price"}</div>
          <div className="font-display text-xl font-bold">₹{lead.price}</div>
        </div>
        {isPurchased ? (
          <Link
            to="/dashboard/my-leads"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-emerald-500 text-white font-semibold text-sm hover:opacity-90 transition-smooth"
          >
            View in My Leads <ArrowRight className="size-4" />
          </Link>
        ) : (
          <button
            onClick={() => onBuy(lead)}
            disabled={buying}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-accent text-accent-foreground font-semibold text-sm hover:opacity-90 transition-smooth disabled:opacity-60"
          >
            {buying ? <Loader2 className="size-4 animate-spin" /> : <ShoppingCart className="size-4" />}
            Buy
          </button>
        )}
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

function StatCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  tone: "default" | "hot" | "accent";
}) {
  const toneClass =
    tone === "hot"
      ? "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/30"
      : tone === "accent"
        ? "bg-accent/10 text-accent border-accent/30"
        : "bg-secondary text-foreground border-border";
  return (
    <div className="rounded-2xl bg-card border border-border p-4 shadow-card flex items-center gap-3">
      <div className={`size-10 rounded-xl border grid place-items-center ${toneClass}`}>
        <Icon className="size-5" />
      </div>
      <div className="min-w-0">
        <div className="text-xs text-muted-foreground truncate">{label}</div>
        <div className="font-display text-lg font-bold leading-tight truncate">{value}</div>
      </div>
    </div>
  );
}

function InsufficientBalanceModal({
  lead, balance, onClose, onRecharge, onRetry,
}: {
  lead: Lead;
  balance: number;
  onClose: () => void;
  onRecharge: (amount: number) => Promise<void>;
  onRetry: () => Promise<void>;
}) {
  const shortfall = Math.max(lead.price - balance, 0);
  const [custom, setCustom] = useState<string>(String(Math.max(500, Math.ceil(shortfall / 100) * 100)));
  const [busy, setBusy] = useState<number | "custom" | null>(null);

  const doRecharge = async (amt: number, key: number | "custom") => {
    if (amt <= 0) return;
    setBusy(key);
    await onRecharge(amt);
    setBusy(null);
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-3xl bg-card border border-border shadow-elevated overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 bg-gradient-to-br from-amber-500/15 to-orange-500/10 border-b border-border relative">
          <button onClick={onClose} className="absolute top-3 right-3 size-8 rounded-full grid place-items-center hover:bg-secondary">
            <X className="size-4" />
          </button>
          <div className="size-12 rounded-2xl bg-amber-500 text-white grid place-items-center mb-3">
            <AlertTriangle className="size-6" />
          </div>
          <h3 className="font-display text-xl font-bold">Insufficient balance</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Lead costs <strong className="text-foreground">₹{lead.price}</strong> but your wallet has only{" "}
            <strong className="text-foreground">₹{balance.toLocaleString("en-IN")}</strong>.
            You need <strong className="text-foreground">₹{shortfall.toLocaleString("en-IN")}</strong> more.
          </p>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <div className="text-xs font-semibold text-muted-foreground uppercase mb-2">Quick recharge</div>
            <div className="grid grid-cols-2 gap-2">
              {QUICK_RECHARGE.map((a) => (
                <button
                  key={a}
                  onClick={() => doRecharge(a, a)}
                  disabled={busy !== null}
                  className="px-4 py-2.5 rounded-xl border border-border hover:border-accent hover:bg-accent/5 transition-smooth font-semibold text-sm disabled:opacity-60 inline-flex items-center justify-center gap-1.5"
                >
                  {busy === a ? <Loader2 className="size-4 animate-spin" /> : null}
                  ₹{a.toLocaleString("en-IN")}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="text-xs font-semibold text-muted-foreground uppercase mb-2">Custom amount</div>
            <div className="flex gap-2">
              <input
                type="number"
                min={1}
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
                className="input-base flex-1"
                placeholder="Enter amount"
              />
              <button
                onClick={() => doRecharge(Number(custom) || 0, "custom")}
                disabled={busy !== null || !Number(custom)}
                className="px-4 py-2 rounded-xl bg-accent text-accent-foreground font-semibold text-sm hover:opacity-90 disabled:opacity-60 inline-flex items-center gap-1.5"
              >
                {busy === "custom" ? <Loader2 className="size-4 animate-spin" /> : null}
                Add
              </button>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1.5">Razorpay integration coming soon — demo recharge instantly credits your wallet.</p>
          </div>

          <div className="flex items-center gap-2 pt-2 border-t border-border">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-xl border border-border font-medium text-sm hover:bg-secondary"
            >
              Cancel
            </button>
            <button
              onClick={onRetry}
              disabled={balance < lead.price || busy !== null}
              className="flex-1 px-4 py-2.5 rounded-xl bg-accent text-accent-foreground font-semibold text-sm hover:opacity-90 disabled:opacity-50 inline-flex items-center justify-center gap-1.5"
            >
              <ShoppingCart className="size-4" /> Retry buy
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
