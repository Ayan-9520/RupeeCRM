import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import {
  Filter,
  Loader2,
  Phone,
  MapPin,
  Flame,
  Snowflake,
  Sun,
  ShoppingCart,
  Wallet,
  Layers,
  ShoppingBag,
  ArrowUpDown,
  AlertTriangle,
  X,
  Check,
  ArrowRight,
  Clock,
  Zap,
  RefreshCw,
} from "lucide-react";
import { CATEGORY_META, type ProductCategory, type ProductType } from "@/lib/products";
import { Link } from "@tanstack/react-router";
import { useQuota } from "@/hooks/use-subscription";
import { PlanQuotaBanner } from "@/components/dashboard/PlanQuotaBanner";
import { listCrmLeads, purchaseCrmLead, type CrmLead } from "@/lib/python-api";
import { ageLabel, gradeCode, gradeText, listingType } from "@/lib/lead-grades";

export const Route = createFileRoute("/dashboard/leadboard")({
  head: () => ({ meta: [{ title: "RupeeDial Lead - Marketplace" }] }),
  component: Leadboard,
});

type Lead = {
  id: string;
  applicant_name: string;
  masked_phone: string;
  full_phone?: string;
  city: string;
  loan_amount: number;
  monthly_income: number | null;
  score: "cold" | "warm" | "hot";
  price: number;
  status: string;
  product_category: ProductCategory;
  product_subtype: string | null;
  product_type_id: string | null;
  employment_type: string | null;
  phone_verified: boolean;
  product_details: Record<string, unknown>;
  lead_grade?: string;
  listing_type?: string;
  created_at: string;
  updated_at: string;
};

function mapCrmLead(l: CrmLead): Lead {
  const score = (["hot", "warm", "cold"].includes(l.score) ? l.score : "cold") as Lead["score"];
  const cat = (["loan", "insurance", "credit_card", "investment"].includes(l.product_category)
    ? l.product_category
    : "loan") as ProductCategory;
  return {
    id: l.id,
    applicant_name: l.applicant_name,
    masked_phone: l.masked_phone || l.full_phone,
    full_phone: l.full_phone,
    city: l.city,
    loan_amount: Number(l.loan_amount || 0),
    monthly_income: l.monthly_income,
    score,
    price: Number(l.price || 0),
    status: l.status || "available",
    product_category: cat,
    product_subtype: l.product_subtype,
    product_type_id: null,
    employment_type: l.employment_type,
    phone_verified: !!l.phone_verified,
    product_details: l.product_details || {},
    lead_grade: l.lead_grade,
    listing_type: l.listing_type,
    created_at: l.created_at,
    updated_at: l.created_at,
  };
}

const SCORES = ["all", "hot", "warm", "cold"];
const SORTS = [
  { key: "newest", label: "Latest leads" },
  { key: "oldest", label: "Oldest leads" },
  { key: "score", label: "Hottest first" },
  { key: "price_asc", label: "Price: low to high" },
  { key: "price_desc", label: "Price: high to low" },
] as const;
type SortKey = (typeof SORTS)[number]["key"];

const TIME_RANGES = [
  { key: "all", label: "Any time", hours: 0 },
  { key: "1h", label: "Last 1 hour", hours: 1 },
  { key: "24h", label: "Last 24 hours", hours: 24 },
  { key: "3d", label: "Last 3 days", hours: 72 },
  { key: "7d", label: "Last 7 days", hours: 168 },
] as const;
type TimeRangeKey = (typeof TIME_RANGES)[number]["key"];

const QUICK_RECHARGE = [500, 1000, 2500, 5000];
const LOW_BALANCE_THRESHOLD = 300;

function Leadboard() {
  const { user } = useAuth();
  const { quota: leadQuota } = useQuota("leads");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [productTypes] = useState<ProductType[]>([]);
  const [loading, setLoading] = useState(true);
  const [city, setCity] = useState("");
  const [category, setCategory] = useState<"all" | ProductCategory>("all");
  const [productTypeId, setProductTypeId] = useState<"all" | string>("all");
  const [score, setScore] = useState("all");
  const [maxBudget, setMaxBudget] = useState<string>("");
  const [sort, setSort] = useState<SortKey>("newest");
  const [timeRange, setTimeRange] = useState<TimeRangeKey>("all");
  const [buying, setBuying] = useState<string | null>(null);
  const [stats, setStats] = useState({ total: 0, hot: 0, purchases: 0, balance: 0 });
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const [purchased, setPurchased] = useState<Record<string, { full_phone: string }>>({});
  const [shortfallLead, setShortfallLead] = useState<Lead | null>(null);

  const filteredTypes = useMemo(
    () => (category === "all" ? productTypes : productTypes.filter((p) => p.category === category)),
    [productTypes, category],
  );

  const load = async () => {
    setLoading(true);
    try {
      const data = await listCrmLeads({ limit: 200 });
      let rows = data.items.map(mapCrmLead);

      if (city.trim()) {
        const c = city.trim().toLowerCase();
        rows = rows.filter((l) => l.city.toLowerCase().includes(c));
      }
      if (category !== "all") rows = rows.filter((l) => l.product_category === category);
      if (score !== "all") rows = rows.filter((l) => l.score === score);
      if (maxBudget && Number(maxBudget) > 0) {
        rows = rows.filter((l) => l.price <= Number(maxBudget));
      }
      const tr = TIME_RANGES.find((r) => r.key === timeRange);
      if (tr && tr.hours > 0) {
        const since = Date.now() - tr.hours * 3600_000;
        rows = rows.filter((l) => new Date(l.created_at).getTime() >= since);
      }

      const scoreRank = { hot: 3, warm: 2, cold: 1 } as const;
      rows = [...rows].sort((a, b) => {
        if (sort === "oldest") return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        if (sort === "score") return scoreRank[b.score] - scoreRank[a.score];
        if (sort === "price_asc") return a.price - b.price;
        if (sort === "price_desc") return b.price - a.price;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });

      setLeads(rows);
      setStats({
        total: data.total,
        hot: data.items.filter((l) => l.score === "hot").length,
        purchases: Object.keys(purchased).length,
        balance: 0,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not load CRM leads");
      setLeads([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [city, category, productTypeId, score, maxBudget, sort, timeRange]);

  useEffect(() => {
    setProductTypeId("all");
  }, [category]);

  const buy = async (lead: Lead) => {
    if (!user) return;
    if (purchased[lead.id]) return;
    setBuying(lead.id);
    try {
      const res = await purchaseCrmLead(lead.id);
      setPurchased((prev) => ({
        ...prev,
        [lead.id]: { full_phone: res.full_phone },
      }));
      setLeads((prev) =>
        prev.map((l) => (l.id === lead.id ? { ...l, status: "sold", full_phone: res.full_phone } : l)),
      );
      toast.success("Lead purchased — open My Leads for pipeline");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Purchase failed");
    } finally {
      setBuying(null);
    }
  };

  const recharge = async (_amount: number) => {
    toast.info("Wallet recharge will move to Python CRM next.");
  };

  const typeMap = useMemo(
    () => Object.fromEntries(productTypes.map((p) => [p.id, p])) as Record<string, ProductType>,
    [productTypes],
  );

  const lowBalance = stats.balance < LOW_BALANCE_THRESHOLD;

  return (
    <div className="space-y-5 max-w-7xl">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-[#390A5D] tracking-tight">Leadboard</h1>
          <p className="text-[#5c4d72] mt-0.5 text-sm">
            Product, city, amount and grade. Name and phone unlock after purchase.
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {(
              [
                { to: "/dashboard/my-leads", label: "My Leads" },
                { to: "/dashboard/leadboard", label: "Available" },
                { to: "/dashboard/my-leads", label: "Purchased" },
                { to: "/dashboard/wallet", label: "Lead Wallet" },
                { to: "/dashboard/los-analytics", label: "Performance" },
              ] as const
            ).map(({ to, label }) => (
              <Link
                key={label}
                to={to}
                className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${
                  label === "Available"
                    ? "border-[#10662A] bg-[#10662A] text-white"
                    : "border-[#d8ecdd] bg-white text-[#390A5D]"
                }`}
              >
                {label}
              </Link>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white border border-[#d8ecdd] shadow-[0_2px_8px_rgba(16,102,42,0.04)]">
            <Wallet className="size-3.5 text-[#10662A]" />
            <span className="text-[11px] text-[#5c4d72]">Balance</span>
            <span className="font-display font-bold text-sm text-[#390A5D]">₹{stats.balance.toLocaleString("en-IN")}</span>
          </div>
          <Link
            to="/dashboard/wallet"
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#10662A] text-white font-semibold text-sm hover:bg-[#0D4F20] transition-colors"
          >
            <Wallet className="size-3.5" /> Add money
          </Link>
        </div>
      </div>

      {lowBalance && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 text-amber-800 px-3.5 py-2.5 flex items-center gap-3 flex-wrap text-sm">
          <AlertTriangle className="size-4 shrink-0" />
          <p className="flex-1 min-w-[180px]">
            <strong>Low wallet balance.</strong> Add funds to buy leads.
          </p>
          <div className="flex items-center gap-1.5">
            {[500, 1000].map((a) => (
              <button
                key={a}
                onClick={() => recharge(a)}
                className="text-xs font-bold px-2.5 py-1 rounded-lg bg-amber-500 text-white hover:opacity-90 cursor-pointer"
              >
                +₹{a}
              </button>
            ))}
            <Link
              to="/dashboard/wallet"
              className="text-xs font-bold px-2.5 py-1 rounded-lg border border-amber-300 hover:bg-amber-100"
            >
              Wallet →
            </Link>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        <StatCard icon={Layers} label="Total leads" value={stats.total.toLocaleString("en-IN")} tone="default" />
        <StatCard icon={Flame} label="Hot leads" value={stats.hot.toLocaleString("en-IN")} tone="hot" />
        <StatCard
          icon={ShoppingBag}
          label="My purchases"
          value={stats.purchases.toLocaleString("en-IN")}
          tone="default"
        />
        <StatCard
          icon={Wallet}
          label="Wallet balance"
          value={`₹${stats.balance.toLocaleString("en-IN")}`}
          tone="accent"
        />
      </div>

      <PlanQuotaBanner quota={leadQuota} kind="leads" />

      <div className="rounded-xl bg-white border border-[#d8ecdd] p-3 shadow-[0_2px_12px_rgba(16,102,42,0.04)] sticky top-2 z-10">
        <div className="flex items-center justify-between gap-3 mb-2.5 flex-wrap">
          <div className="flex items-center gap-1.5 text-xs font-bold text-[#390A5D] uppercase tracking-wide">
            <Filter className="size-3.5 text-[#10662A]" /> Filters
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => void load()}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-2.5 h-8 rounded-lg border border-[#d8ecdd] bg-white hover:bg-[#E8F7EC] text-xs font-semibold text-[#390A5D] transition-colors disabled:opacity-50 cursor-pointer"
              title="Refresh leads"
            >
              <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
            </button>
            <ArrowUpDown className="size-3.5 text-[#5c4d72]" />
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="input-base !h-8 !py-0 text-xs !rounded-lg"
            >
              {SORTS.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-6 gap-2">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as typeof category)}
            className="input-base !h-9 !rounded-lg text-sm"
          >
            <option value="all">All categories</option>
            <option value="loan">Loans</option>
            <option value="insurance">Insurance</option>
            <option value="credit_card">Credit Cards</option>
            <option value="investment">Investments</option>
          </select>
          <select value={productTypeId} onChange={(e) => setProductTypeId(e.target.value)} className="input-base !h-9 !rounded-lg text-sm">
            <option value="all">All sub-types</option>
            {filteredTypes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="City…" className="input-base !h-9 !rounded-lg text-sm" />
          <input
            value={maxBudget}
            onChange={(e) => setMaxBudget(e.target.value)}
            type="number"
            placeholder="Max ₹ price"
            className="input-base !h-9 !rounded-lg text-sm"
          />
          <select value={score} onChange={(e) => setScore(e.target.value)} className="input-base !h-9 !rounded-lg text-sm">
            {SCORES.map((s) => (
              <option key={s} value={s}>
                {s === "all" ? "All scores" : s.toUpperCase()}
              </option>
            ))}
          </select>
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value as TimeRangeKey)}
            className="input-base !h-9 !rounded-lg text-sm"
          >
            {TIME_RANGES.map((r) => (
              <option key={r.key} value={r.key}>
                {r.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <LeadCardSkeleton key={i} />
          ))}
        </div>
      ) : leads.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#d8ecdd] bg-white p-10 text-center text-[#5c4d72] space-y-3">
          <p className="text-sm">No leads match your filters.</p>
          <button
            onClick={() => void load()}
            className="inline-flex items-center gap-2 px-4 h-9 rounded-xl bg-[#10662A] text-white text-sm font-semibold hover:bg-[#0D4F20] cursor-pointer"
          >
            <RefreshCw className="size-4" /> Refresh now
          </button>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {leads.map((lead) => (
            <LeadCard
              key={lead.id}
              lead={lead}
              type={lead.product_type_id ? typeMap[lead.product_type_id] : undefined}
              onBuy={buy}
              buying={buying === lead.id}
              purchased={purchased[lead.id]}
              now={now}
            />
          ))}
        </div>
      )}

      {shortfallLead && (
        <InsufficientBalanceModal
          lead={shortfallLead}
          balance={stats.balance}
          onClose={() => setShortfallLead(null)}
          onRecharge={async (amt) => {
            await recharge(amt);
          }}
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

function formatRelative(iso: string, nowMs: number = Date.now()): string {
  const then = new Date(iso).getTime();
  const diffMs = Math.max(0, nowMs - then);
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });
}

function LeadCard({
  lead,
  type,
  onBuy,
  buying,
  purchased,
  now,
}: {
  lead: Lead;
  type?: ProductType;
  onBuy: (l: Lead) => void;
  buying: boolean;
  purchased?: { full_phone: string };
  now: number;
}) {
  const ScoreIcon = lead.score === "hot" ? Flame : lead.score === "warm" ? Sun : Snowflake;
  const scoreColor =
    lead.score === "hot"
      ? "bg-red-50 text-red-600 border-red-200"
      : lead.score === "warm"
        ? "bg-amber-50 text-amber-700 border-amber-200"
        : "bg-sky-50 text-sky-700 border-sky-200";

  const meta = CATEGORY_META[lead.product_category as keyof typeof CATEGORY_META] || {
    label: "Other",
    chipBg: "bg-gray-100",
    chipText: "text-gray-600",
  };
  const isPurchased = !!purchased;
  const isSold = lead.status === "sold";
  const ageHours = (now - new Date(lead.created_at).getTime()) / 36e5;
  const isFresh = ageHours < 12;

  return (
    <article
      className={`relative rounded-xl bg-white border p-3.5 flex flex-col gap-2.5 transition-all hover:-translate-y-0.5 hover:shadow-[0_10px_24px_rgba(16,102,42,0.1)] ${
        isPurchased
          ? "border-emerald-300 shadow-[0_2px_10px_rgba(16,185,129,0.12)]"
          : lead.score === "hot"
            ? "border-red-200 shadow-[0_2px_10px_rgba(239,68,68,0.08)]"
            : isFresh
              ? "border-[#10662A]/25 shadow-[0_2px_10px_rgba(16,102,42,0.06)]"
              : "border-[#d8ecdd] shadow-[0_2px_8px_rgba(16,102,42,0.04)]"
      }`}
    >
      {(isSold || isPurchased) && (
        <span
          className={`absolute top-2 right-2 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[9px] font-bold uppercase text-white ${
            isSold ? "bg-red-500" : "bg-emerald-500"
          }`}
        >
          {isPurchased && !isSold ? <Check className="size-2.5" /> : null}
          {isSold ? "Sold" : "Bought"}
        </span>
      )}

      <div className="flex items-center justify-between gap-2 pr-10">
        <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
          <span
            className={`inline-flex px-1.5 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wide ${meta.chipBg} ${meta.chipText}`}
          >
            {meta.label}
          </span>
          {(lead.product_subtype || type?.name) && (
            <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-md bg-[#f5fcf7] text-[#5c4d72] border border-[#d8ecdd] truncate max-w-[110px]">
              {type?.name || lead.product_subtype}
            </span>
          )}
          {ageHours < 1 && (
            <span className="inline-flex items-center gap-0.5 text-[9px] font-bold uppercase text-[#10662A] bg-[#E8F7EC] px-1.5 py-0.5 rounded-md">
              <Zap className="size-2.5" /> New
            </span>
          )}
        </div>
        <span
          className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[9px] font-bold uppercase border shrink-0 ${scoreColor}`}
        >
          <ScoreIcon className="size-2.5" /> {lead.score}
        </span>
      </div>

      <div className="min-w-0">
        <h3 className="font-display font-bold text-[15px] text-[#390A5D] truncate leading-tight capitalize">
          {type?.name || lead.product_subtype || lead.product_category}
        </h3>
        <div className="mt-1 grid grid-cols-2 gap-x-2 gap-y-0.5 text-[11px] text-[#5c4d72]">
          <span className="inline-flex items-center gap-1"><MapPin className="size-3" /> {lead.city || "—"}</span>
          <span>₹{lead.loan_amount.toLocaleString("en-IN")}</span>
          <span className="capitalize">{lead.employment_type || "Profile hidden"}</span>
          <span>{String(lead.product_details.property_type || lead.product_details.property || "—")}</span>
          <span className="font-semibold text-[#10662A]">
            {gradeText(gradeCode(lead))}
          </span>
          <span className="capitalize">{listingType(lead.price, lead.product_details, lead.listing_type)} · {ageLabel(lead.created_at, now)}</span>
        </div>
        {isPurchased ? (
          <p className="mt-1 inline-flex items-center gap-1 text-[11px] font-mono font-semibold text-emerald-600">
            <Phone className="size-3" /> {purchased.full_phone}
          </p>
        ) : (
          <p className="mt-1 text-[11px] text-slate-400">Name and phone unlock after purchase</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-1.5">
        <div className="rounded-lg bg-[#f5fcf7] border border-[#d8ecdd] px-2 py-1.5">
          <div className="text-[9px] uppercase tracking-wide font-semibold text-[#5c4d72]">Ticket</div>
          <div className="text-xs font-bold text-[#390A5D] truncate">
            ₹{lead.loan_amount.toLocaleString("en-IN")}
          </div>
        </div>
        <div className="rounded-lg bg-[#f5fcf7] border border-[#d8ecdd] px-2 py-1.5">
          <div className="text-[9px] uppercase tracking-wide font-semibold text-[#5c4d72]">Income</div>
          <div className="text-xs font-bold text-[#390A5D] truncate">
            {lead.monthly_income ? `₹${lead.monthly_income.toLocaleString("en-IN")}` : "—"}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 pt-0.5 mt-auto">
        <div className="min-w-0">
          <div className="text-[10px] text-[#5c4d72] flex items-center gap-1">
            <Clock className="size-3" />
            {formatRelative(lead.created_at, now)}
          </div>
          <div className="font-display text-lg font-extrabold text-[#390A5D] leading-none mt-0.5">
            ₹{lead.price}
          </div>
        </div>
        {isPurchased ? (
          <Link
            to="/dashboard/my-leads"
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-500 text-white font-semibold text-xs hover:bg-emerald-600 shrink-0"
          >
            My Leads <ArrowRight className="size-3" />
          </Link>
        ) : (
          <button
            type="button"
            onClick={() => onBuy(lead)}
            disabled={buying || isSold}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#10662A] text-white font-semibold text-xs hover:bg-[#0D4F20] disabled:opacity-50 cursor-pointer shrink-0"
          >
            {buying ? <Loader2 className="size-3.5 animate-spin" /> : <ShoppingCart className="size-3.5" />}
            Buy
          </button>
        )}
      </div>
    </article>
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
      ? "bg-red-50 text-red-600 border-red-200"
      : tone === "accent"
        ? "bg-[#E8F7EC] text-[#10662A] border-[#d8ecdd]"
        : "bg-[#f5fcf7] text-[#390A5D] border-[#d8ecdd]";
  return (
    <div className="rounded-xl bg-white border border-[#d8ecdd] px-3 py-2.5 shadow-[0_2px_8px_rgba(16,102,42,0.04)] flex items-center gap-2.5">
      <div className={`size-8 rounded-lg border grid place-items-center shrink-0 ${toneClass}`}>
        <Icon className="size-3.5" />
      </div>
      <div className="min-w-0">
        <div className="text-[10px] text-[#5c4d72] font-semibold uppercase tracking-wide truncate">{label}</div>
        <div className="font-display text-base font-bold text-[#390A5D] leading-tight truncate">{value}</div>
      </div>
    </div>
  );
}

function InsufficientBalanceModal({
  lead,
  balance,
  onClose,
  onRecharge,
  onRetry,
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
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl bg-white border border-[#d8ecdd] shadow-[0_16px_40px_rgba(16,102,42,0.12)] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 bg-amber-50 border-b border-amber-100 relative">
          <button
            type="button"
            onClick={onClose}
            className="absolute top-3 right-3 size-8 rounded-lg grid place-items-center hover:bg-amber-100 cursor-pointer"
          >
            <X className="size-4" />
          </button>
          <div className="size-10 rounded-xl bg-amber-500 text-white grid place-items-center mb-2.5">
            <AlertTriangle className="size-5" />
          </div>
          <h3 className="font-display text-lg font-bold text-[#390A5D]">Insufficient balance</h3>
          <p className="text-sm text-[#5c4d72] mt-1">
            Lead costs <strong className="text-[#390A5D]">₹{lead.price}</strong> · wallet has{" "}
            <strong className="text-[#390A5D]">₹{balance.toLocaleString("en-IN")}</strong> · need{" "}
            <strong className="text-[#390A5D]">₹{shortfall.toLocaleString("en-IN")}</strong> more.
          </p>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <div className="text-[10px] font-bold text-[#5c4d72] uppercase mb-2">Quick recharge</div>
            <div className="grid grid-cols-2 gap-2">
              {QUICK_RECHARGE.map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => doRecharge(a, a)}
                  disabled={busy !== null}
                  className="px-3 py-2 rounded-xl border border-[#d8ecdd] hover:border-[#10662A]/40 hover:bg-[#E8F7EC] font-semibold text-sm disabled:opacity-60 inline-flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {busy === a ? <Loader2 className="size-4 animate-spin" /> : null}₹{a.toLocaleString("en-IN")}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="text-[10px] font-bold text-[#5c4d72] uppercase mb-2">Custom amount</div>
            <div className="flex gap-2">
              <input
                type="number"
                min={1}
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
                className="input-base flex-1 !h-9 !rounded-lg"
                placeholder="Enter amount"
              />
              <button
                type="button"
                onClick={() => doRecharge(Number(custom) || 0, "custom")}
                disabled={busy !== null || !Number(custom)}
                className="px-4 py-2 rounded-xl bg-[#10662A] text-white font-semibold text-sm hover:bg-[#0D4F20] disabled:opacity-60 inline-flex items-center gap-1.5 cursor-pointer"
              >
                {busy === "custom" ? <Loader2 className="size-4 animate-spin" /> : null}
                Add
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2 border-t border-[#d8ecdd]">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 rounded-xl border border-[#d8ecdd] font-medium text-sm hover:bg-[#f5fcf7] cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onRetry}
              disabled={balance < lead.price || busy !== null}
              className="flex-1 px-4 py-2 rounded-xl bg-[#10662A] text-white font-semibold text-sm hover:bg-[#0D4F20] disabled:opacity-50 inline-flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <ShoppingCart className="size-4" /> Retry buy
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function LeadCardSkeleton() {
  return (
    <div className="rounded-xl border border-[#d8ecdd] bg-white p-3.5 animate-pulse space-y-2.5">
      <div className="flex items-center justify-between">
        <div className="h-4 w-20 rounded bg-[#E8F7EC]" />
        <div className="h-4 w-12 rounded bg-[#E8F7EC]" />
      </div>
      <div className="h-4 w-28 rounded bg-[#E8F7EC]" />
      <div className="grid grid-cols-2 gap-1.5">
        <div className="h-10 rounded-lg bg-[#f5fcf7]" />
        <div className="h-10 rounded-lg bg-[#f5fcf7]" />
      </div>
      <div className="h-8 rounded-lg bg-[#E8F7EC]" />
    </div>
  );
}
