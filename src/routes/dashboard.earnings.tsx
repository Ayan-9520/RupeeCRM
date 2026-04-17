import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import {
  Loader2, TrendingUp, IndianRupee, Wallet, Clock, CheckCircle2, BadgeCheck,
  Filter, X, Download, ArrowUpRight, Banknote,
} from "lucide-react";
import { WithdrawDialog } from "@/components/dashboard/WithdrawDialog";
import { CATEGORY_META, calcCommission, type ProductCategory, type ProductType } from "@/lib/products";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip as RTooltip, CartesianGrid,
  PieChart, Pie, Cell, Legend,
} from "recharts";

export const Route = createFileRoute("/dashboard/earnings")({
  head: () => ({ meta: [{ title: "Earnings — LeadMines" }] }),
  component: Earnings,
});

type Row = {
  id: string;
  pipeline_stage: string;
  price_paid: number;
  deal_value: number;
  converted: boolean;
  created_at: string;
  updated_at: string;
  leads: {
    id: string;
    applicant_name: string;
    product_category: ProductCategory;
    product_type_id: string | null;
    product_subtype: string | null;
    loan_amount: number;
  } | null;
};

type CommissionStatus = "pending" | "approved" | "paid";
type DateRange = "all" | "7d" | "30d" | "90d" | "ytd";

const APPROVED_STAGES = new Set([
  "approved", "disbursed", "issued", "policy_issued", "delivered",
  "invested", "payment", "payment_done",
]);
const PAID_STAGES = new Set(["disbursed", "policy_issued", "delivered", "invested"]);

function statusFor(r: Row): CommissionStatus {
  if (PAID_STAGES.has(r.pipeline_stage) || r.converted) return "paid";
  if (APPROVED_STAGES.has(r.pipeline_stage)) return "approved";
  return "pending";
}

function dealValueFor(r: Row): number {
  if (!r.leads) return 0;
  return Number(r.deal_value) > 0 ? Number(r.deal_value) : Number(r.leads.loan_amount);
}

function Earnings() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [types, setTypes] = useState<ProductType[]>([]);
  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [withdrawable, setWithdrawable] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [withdrawOpen, setWithdrawOpen] = useState(false);

  const [dateRange, setDateRange] = useState<DateRange>("all");
  const [catFilter, setCatFilter] = useState<"all" | ProductCategory>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | CommissionStatus>("all");

  const loadAll = async () => {
    if (!user) return;
    setLoading(true);
    const [purchasesRes, typesRes, walletRes, withdrawRes] = await Promise.all([
      supabase
        .from("lead_purchases")
        .select("id,pipeline_stage,price_paid,deal_value,converted,created_at,updated_at,leads!inner(id,applicant_name,product_category,product_type_id,product_subtype,loan_amount)")
        .eq("dsa_id", user.id)
        .order("created_at", { ascending: false }),
      supabase.from("product_types").select("*"),
      supabase.from("wallets").select("balance").eq("user_id", user.id).maybeSingle(),
      supabase.rpc("user_withdrawable", { _user_id: user.id }),
    ]);
    setRows((purchasesRes.data ?? []) as unknown as Row[]);
    setTypes((typesRes.data ?? []) as ProductType[]);
    setWalletBalance(Number(walletRes.data?.balance ?? 0));
    setWithdrawable(Number(withdrawRes.data ?? 0));
    setLoading(false);
  };

  useEffect(() => { loadAll(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [user]);

  const typeMap = useMemo(
    () => Object.fromEntries(types.map((t) => [t.id, t])) as Record<string, ProductType>,
    [types],
  );

  // Enrich each row with status, commission, deal value
  const enriched = useMemo(() => {
    return rows.map((r) => {
      const status = statusFor(r);
      const t = r.leads?.product_type_id ? typeMap[r.leads.product_type_id] : undefined;
      const dv = dealValueFor(r);
      const commission = t ? calcCommission(t, dv) : 0;
      const pctAvg = t ? (Number(t.commission_pct_min) + Number(t.commission_pct_max)) / 2 : 0;
      return { ...r, status, commission, dealValue: dv, productType: t, pctAvg };
    });
  }, [rows, typeMap]);

  // Filter
  const filtered = useMemo(() => {
    const cutoff = (() => {
      if (dateRange === "all") return null;
      if (dateRange === "ytd") return new Date(new Date().getFullYear(), 0, 1).getTime();
      const days = dateRange === "7d" ? 7 : dateRange === "30d" ? 30 : 90;
      return Date.now() - days * 86400_000;
    })();
    return enriched.filter((r) => {
      if (!r.leads) return false;
      if (catFilter !== "all" && r.leads.product_category !== catFilter) return false;
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (cutoff && new Date(r.created_at).getTime() < cutoff) return false;
      return true;
    });
  }, [enriched, dateRange, catFilter, statusFilter]);

  // KPI totals (always over filtered set)
  const kpi = useMemo(() => {
    const monthStart = new Date();
    monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
    let total = 0, paid = 0, approved = 0, pending = 0, thisMonth = 0;
    for (const r of filtered) {
      total += r.commission;
      if (r.status === "paid") paid += r.commission;
      else if (r.status === "approved") approved += r.commission;
      else pending += r.commission;
      if (new Date(r.updated_at).getTime() >= monthStart.getTime() && r.status !== "pending") {
        thisMonth += r.commission;
      }
    }
    return { total, paid, approved, pending, thisMonth };
  }, [filtered]);

  // Category breakdown
  const breakdown = useMemo(() => {
    const init = { count: 0, dealAmount: 0, commission: 0, paid: 0, pending: 0 };
    const out: Record<ProductCategory, typeof init> = {
      loan: { ...init }, insurance: { ...init }, credit_card: { ...init }, investment: { ...init },
    };
    for (const r of filtered) {
      if (!r.leads) continue;
      const cat = r.leads.product_category;
      out[cat].count += 1;
      out[cat].dealAmount += r.dealValue;
      out[cat].commission += r.commission;
      if (r.status === "paid") out[cat].paid += r.commission;
      else if (r.status === "pending") out[cat].pending += r.commission;
    }
    return out;
  }, [filtered]);

  // Monthly trend (last 6 months)
  const trend = useMemo(() => {
    const buckets = new Map<string, { label: string; ts: number; commission: number; paid: number }>();
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      buckets.set(key, {
        label: d.toLocaleDateString("en-IN", { month: "short" }),
        ts: d.getTime(),
        commission: 0,
        paid: 0,
      });
    }
    for (const r of filtered) {
      const d = new Date(r.updated_at);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      const b = buckets.get(key);
      if (!b) continue;
      b.commission += r.commission;
      if (r.status === "paid") b.paid += r.commission;
    }
    return Array.from(buckets.values());
  }, [filtered]);

  // Pie data
  const pieData = useMemo(() => {
    return (Object.keys(breakdown) as ProductCategory[])
      .map((cat) => ({ name: CATEGORY_META[cat].label, value: breakdown[cat].commission, cat }))
      .filter((d) => d.value > 0);
  }, [breakdown]);

  const exportCsv = () => {
    const header = ["Lead ID", "Customer", "Category", "Sub-product", "Deal Amount", "Commission %", "Commission", "Status", "Date"];
    const lines = filtered.map((r) => [
      r.leads?.id ?? "", r.leads?.applicant_name ?? "",
      r.leads ? CATEGORY_META[r.leads.product_category].label : "",
      r.leads?.product_subtype ?? r.productType?.name ?? "",
      r.dealValue, r.pctAvg.toFixed(2), r.commission, r.status,
      new Date(r.created_at).toISOString().slice(0, 10),
    ].join(","));
    const blob = new Blob([[header.join(","), ...lines].join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `earnings-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  if (loading) {
    return <div className="grid place-items-center py-20"><Loader2 className="size-6 animate-spin text-accent" /></div>;
  }

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-display text-2xl lg:text-3xl font-bold">Earnings & Commissions</h1>
          <p className="text-muted-foreground mt-1">Track every commission across loans, insurance, cards & investments.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-sm">
            <span className="text-[11px] uppercase tracking-wide text-emerald-700 dark:text-emerald-300 font-semibold">Withdrawable</span>
            <span className="font-display font-bold text-emerald-700 dark:text-emerald-300">₹{withdrawable.toLocaleString("en-IN")}</span>
          </div>
          <button
            onClick={() => setWithdrawOpen(true)}
            disabled={withdrawable < 500}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold shadow-sm"
          >
            <Banknote className="size-4" /> Withdraw
          </button>
          <Link
            to="/dashboard/wallet"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border bg-card hover:border-accent/50 text-sm font-semibold"
          >
            <Wallet className="size-4 text-accent" />
            ₹{walletBalance.toLocaleString("en-IN")}
            <ArrowUpRight className="size-3.5 text-muted-foreground" />
          </Link>
          <button
            onClick={exportCsv}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border bg-card hover:border-accent/50 text-sm font-semibold"
          >
            <Download className="size-4" /> Export
          </button>
        </div>
      </div>

      <WithdrawDialog open={withdrawOpen} onOpenChange={setWithdrawOpen} onSuccess={loadAll} />

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi icon={IndianRupee} label="Total earnings" value={kpi.total} tone="default" />
        <Kpi icon={TrendingUp} label="This month" value={kpi.thisMonth} tone="accent" />
        <Kpi icon={Clock} label="Pending" value={kpi.pending} tone="amber" />
        <Kpi icon={CheckCircle2} label="Paid" value={kpi.paid} tone="success" />
      </div>

      {/* Filters */}
      <div className="rounded-2xl bg-card border border-border p-4 shadow-card">
        <div className="grid sm:grid-cols-3 gap-3">
          <select value={dateRange} onChange={(e) => setDateRange(e.target.value as DateRange)} className="input-base">
            <option value="all">Any time</option>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
            <option value="ytd">Year to date</option>
          </select>
          <select value={catFilter} onChange={(e) => setCatFilter(e.target.value as "all" | ProductCategory)} className="input-base">
            <option value="all">All products</option>
            <option value="loan">Loans</option>
            <option value="insurance">Insurance</option>
            <option value="credit_card">Credit Cards</option>
            <option value="investment">Investments</option>
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as "all" | CommissionStatus)} className="input-base">
            <option value="all">All statuses</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="paid">Paid</option>
          </select>
        </div>
        <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
          <Filter className="size-3.5" />
          <span>{filtered.length} of {rows.length} entries shown</span>
          {(dateRange !== "all" || catFilter !== "all" || statusFilter !== "all") && (
            <button onClick={() => { setDateRange("all"); setCatFilter("all"); setStatusFilter("all"); }} className="ml-auto inline-flex items-center gap-1 hover:text-accent">
              <X className="size-3" /> Clear
            </button>
          )}
        </div>
      </div>

      {/* Charts */}
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 rounded-2xl bg-card border border-border p-5 shadow-card">
          <h2 className="font-display text-lg font-semibold mb-4">Earnings over time</h2>
          <div className="h-64">
            <ResponsiveContainer>
              <LineChart data={trend} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <RTooltip
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 12 }}
                  formatter={(v: number) => `₹${v.toLocaleString("en-IN")}`}
                />
                <Line type="monotone" dataKey="commission" stroke="#10b981" strokeWidth={2.5} dot={{ r: 3 }} name="Total commission" />
                <Line type="monotone" dataKey="paid" stroke="#3b82f6" strokeWidth={2.5} dot={{ r: 3 }} name="Paid" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="rounded-2xl bg-card border border-border p-5 shadow-card">
          <h2 className="font-display text-lg font-semibold mb-4">By product</h2>
          {pieData.length === 0 ? (
            <div className="h-64 grid place-items-center text-sm text-muted-foreground">No earnings yet</div>
          ) : (
            <div className="h-64">
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={45} outerRadius={80} paddingAngle={2}>
                    {pieData.map((d) => (
                      <Cell key={d.cat} fill={CAT_COLOR[d.cat]} />
                    ))}
                  </Pie>
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <RTooltip formatter={(v: number) => `₹${v.toLocaleString("en-IN")}`} contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* Category breakdown */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {(Object.keys(breakdown) as ProductCategory[]).map((cat) => {
          const v = breakdown[cat];
          const meta = CATEGORY_META[cat];
          const unit = cat === "loan" ? "disbursals"
            : cat === "insurance" ? "policies"
            : cat === "credit_card" ? "cards approved"
            : "investments";
          return (
            <div key={cat} className="rounded-2xl bg-card border border-border p-5 shadow-card">
              <div className="flex items-center gap-2 mb-3">
                <span className="size-2.5 rounded-full" style={{ background: CAT_COLOR[cat] }} />
                <span className={`text-xs font-bold uppercase px-2 py-0.5 rounded-full ${meta.chipBg} ${meta.chipText}`}>{meta.label}</span>
              </div>
              <div className="text-2xl font-display font-bold">₹{v.commission.toLocaleString("en-IN")}</div>
              <div className="text-xs text-muted-foreground mt-0.5">Commission earned</div>
              <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <div className="text-muted-foreground">{unit}</div>
                  <div className="font-semibold text-foreground">{v.count}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Volume</div>
                  <div className="font-semibold text-foreground">₹{v.dealAmount.toLocaleString("en-IN")}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Commission table */}
      <div className="rounded-2xl bg-card border border-border shadow-card overflow-hidden">
        <div className="p-5 border-b border-border flex items-center justify-between gap-3">
          <h2 className="font-display text-lg font-semibold">Commission details</h2>
          <span className="text-xs text-muted-foreground">{filtered.length} entries</span>
        </div>
        {filtered.length === 0 ? (
          <div className="p-12 text-center text-sm text-muted-foreground">No commissions match these filters.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary/40 text-[11px] uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="text-left font-semibold py-2.5 px-4">Customer</th>
                  <th className="text-left font-semibold py-2.5 px-4">Product</th>
                  <th className="text-right font-semibold py-2.5 px-4">Deal amount</th>
                  <th className="text-right font-semibold py-2.5 px-4">Commission</th>
                  <th className="text-left font-semibold py-2.5 px-4">Status</th>
                  <th className="text-left font-semibold py-2.5 px-4">Date</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id} className="border-t border-border hover:bg-secondary/30">
                    <td className="py-3 px-4">
                      <div className="font-medium truncate max-w-[180px]">{r.leads?.applicant_name ?? "—"}</div>
                      <div className="text-[11px] text-muted-foreground font-mono truncate max-w-[180px]">{r.leads?.id.slice(0, 8)}</div>
                    </td>
                    <td className="py-3 px-4">
                      {r.leads && (
                        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${CATEGORY_META[r.leads.product_category].chipBg} ${CATEGORY_META[r.leads.product_category].chipText}`}>
                          {CATEGORY_META[r.leads.product_category].label}
                        </span>
                      )}
                      <div className="text-[11px] text-muted-foreground mt-0.5 truncate max-w-[180px]">
                        {r.leads?.product_subtype ?? r.productType?.name ?? "—"}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right font-mono">₹{r.dealValue.toLocaleString("en-IN")}</td>
                    <td className="py-3 px-4 text-right">
                      <div className="font-mono font-bold text-emerald-600 dark:text-emerald-400">₹{r.commission.toLocaleString("en-IN")}</div>
                      {r.pctAvg > 0 && <div className="text-[10px] text-muted-foreground">{r.pctAvg.toFixed(1)}%</div>}
                    </td>
                    <td className="py-3 px-4"><StatusBadge status={r.status} /></td>
                    <td className="py-3 px-4 text-muted-foreground text-[12px] whitespace-nowrap">
                      {new Date(r.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="text-[11px] text-muted-foreground">
        * Commission is the configured average % per product applied to the deal value (or flat per card). Marked <strong>Paid</strong> once disbursed/issued; <strong>Approved</strong> when the lender confirms; otherwise <strong>Pending</strong>. Final settlement happens via partner payouts.
      </p>
    </div>
  );
}

const CAT_COLOR: Record<ProductCategory, string> = {
  loan: "#3b82f6",
  insurance: "#10b981",
  credit_card: "#f97316",
  investment: "#8b5cf6",
};

function Kpi({
  icon: Icon, label, value, tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  tone: "default" | "success" | "amber" | "accent";
}) {
  const cls =
    tone === "success" ? "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/30"
    : tone === "amber" ? "text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/30"
    : tone === "accent" ? "text-accent bg-accent/10 border-accent/30"
    : "text-foreground bg-secondary border-border";
  return (
    <div className="rounded-2xl bg-card border border-border p-4 shadow-card">
      <div className={`size-9 rounded-xl border grid place-items-center mb-3 ${cls}`}>
        <Icon className="size-4" />
      </div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-display text-2xl font-bold mt-0.5">₹{value.toLocaleString("en-IN")}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: CommissionStatus }) {
  const map = {
    pending: { label: "Pending", cls: "bg-amber-500/15 text-amber-700 dark:text-amber-300", Icon: Clock },
    approved: { label: "Approved", cls: "bg-blue-500/15 text-blue-700 dark:text-blue-300", Icon: BadgeCheck },
    paid: { label: "Paid", cls: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300", Icon: CheckCircle2 },
  } as const;
  const m = map[status];
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${m.cls}`}>
      <m.Icon className="size-2.5" /> {m.label}
    </span>
  );
}
