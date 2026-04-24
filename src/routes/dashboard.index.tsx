import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Wallet, Store, KanbanSquare, TrendingUp, Sparkles } from "lucide-react";
import { CATEGORY_META, type ProductCategory } from "@/lib/products";
import { useNavigate } from "@tanstack/react-router";
export const Route = createFileRoute("/dashboard/")({
  component: DashboardHome,
});
const navigate = useNavigate();
const { user, role, loading } = useAuth();
type CatStats = Record<ProductCategory, { leads: number; spent: number }>;

const EMPTY: CatStats = {
  loan: { leads: 0, spent: 0 },
  insurance: { leads: 0, spent: 0 },
  credit_card: { leads: 0, spent: 0 },
  investment: { leads: 0, spent: 0 },
};

function DashboardHome() {
  const { user, role } = useAuth();
  const [stats, setStats] = useState({ balance: 0, leadsBought: 0, available: 0, totalSpent: 0 });
  const [byCategory, setByCategory] = useState<CatStats>(EMPTY);
  const [profileName, setProfileName] = useState("");
  useEffect(() => {
    if (loading) return;

    if (!user) {
      navigate({ to: "/auth" });
    }
  }, [user, loading]);
  useEffect(() => {
    if (!user) return;
    (async () => {
      const [walletRes, purchasesRes, leadsRes, profileRes, breakdownRes] = await Promise.all([
        supabase.from("wallets").select("balance,total_spent").eq("user_id", user.id).maybeSingle(),
        supabase.from("lead_purchases").select("id", { count: "exact", head: true }).eq("dsa_id", user.id),
        supabase.from("leads").select("id", { count: "exact", head: true }).eq("status", "available"),
        supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
        supabase.from("lead_purchases").select("price_paid,leads!inner(product_category)").eq("dsa_id", user.id),
      ]);
      setStats({
        balance: Number(walletRes.data?.balance ?? 0),
        totalSpent: Number(walletRes.data?.total_spent ?? 0),
        leadsBought: purchasesRes.count ?? 0,
        available: leadsRes.count ?? 0,
      });
      setProfileName(profileRes.data?.full_name ?? "");

      const next: CatStats = JSON.parse(JSON.stringify(EMPTY));
      type Row = { price_paid: number; leads: { product_category: ProductCategory } | null };
      ((breakdownRes.data ?? []) as unknown as Row[]).forEach((r) => {
        const cat = r.leads?.product_category;
        if (cat && next[cat]) {
          next[cat].leads += 1;
          next[cat].spent += Number(r.price_paid);
        }
      });
      setByCategory(next);
    })();
  }, [user]);

  const totalLeadsByCat = Object.values(byCategory).reduce((s, v) => s + v.leads, 0);

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="rounded-3xl bg-hero-gradient text-white p-6 lg:p-8 relative overflow-hidden shadow-elevated">
        <div className="absolute inset-0 grid-bg opacity-20" />
        <div className="absolute -top-20 -right-20 size-64 rounded-full bg-[oklch(0.78_0.16_165_/_0.3)] blur-3xl" />
        <div className="relative">
          <div className="inline-flex items-center gap-2 text-xs uppercase tracking-wider text-white/60 mb-2">
            <Sparkles className="size-3" /> {role ?? "member"} workspace
          </div>
          <h1 className="font-display text-2xl lg:text-3xl font-bold">
            Welcome back{profileName ? `, ${profileName.split(" ")[0]}` : ""} 👋
          </h1>
          <p className="text-white/75 mt-1">Multi-product overview · Loans · Insurance · Cards · Investments.</p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Wallet} label="Wallet balance" value={`₹${stats.balance.toLocaleString("en-IN")}`} accent />
        <StatCard icon={Store} label="Leads available" value={stats.available.toString()} />
        <StatCard icon={KanbanSquare} label="Leads purchased" value={stats.leadsBought.toString()} />
        <StatCard icon={TrendingUp} label="Total invested" value={`₹${stats.totalSpent.toLocaleString("en-IN")}`} />
      </div>

      <div className="rounded-2xl bg-card border border-border p-5 shadow-card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-lg font-semibold">Leads by category</h2>
          <span className="text-xs text-muted-foreground">{totalLeadsByCat} total</span>
        </div>
        {totalLeadsByCat === 0 ? (
          <p className="text-sm text-muted-foreground py-4">
            No purchases yet — your category breakdown will appear here.
          </p>
        ) : (
          <div className="space-y-3">
            {(Object.keys(byCategory) as ProductCategory[]).map((cat) => {
              const v = byCategory[cat];
              const meta = CATEGORY_META[cat];
              const pct = totalLeadsByCat > 0 ? (v.leads / totalLeadsByCat) * 100 : 0;
              const barColor =
                cat === "loan"
                  ? "bg-blue-500"
                  : cat === "insurance"
                    ? "bg-emerald-500"
                    : cat === "credit_card"
                      ? "bg-orange-500"
                      : "bg-violet-500";
              return (
                <div key={cat}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <div className="flex items-center gap-2">
                      <span className={`size-2 rounded-full ${barColor}`} />
                      <span className="font-medium">{meta.label}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {v.leads} leads · ₹{v.spent.toLocaleString("en-IN")}
                    </div>
                  </div>
                  <div className="h-2 rounded-full bg-secondary overflow-hidden">
                    <div className={`h-full ${barColor} transition-all`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Link
          to="/dashboard/leadboard"
          className="group rounded-2xl bg-card border border-border p-6 hover:border-accent transition-smooth shadow-card"
        >
          <Store className="size-8 text-accent mb-3" />
          <h3 className="font-display text-lg font-semibold">Browse Leadboard</h3>
          <p className="text-sm text-muted-foreground mt-1">
            {stats.available} verified leads — filter by category, sub-type, city & budget.
          </p>
          <span className="mt-3 inline-block text-sm font-semibold text-accent group-hover:underline">
            Open marketplace →
          </span>
        </Link>
        <Link
          to="/dashboard/wallet"
          className="group rounded-2xl bg-card border border-border p-6 hover:border-accent transition-smooth shadow-card"
        >
          <Wallet className="size-8 text-accent mb-3" />
          <h3 className="font-display text-lg font-semibold">Recharge wallet</h3>
          <p className="text-sm text-muted-foreground mt-1">Add funds to buy premium hot leads. Razorpay-ready.</p>
          <span className="mt-3 inline-block text-sm font-semibold text-accent group-hover:underline">Add funds →</span>
        </Link>
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  accent = false,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl p-5 border shadow-card ${accent ? "bg-mint-gradient border-transparent" : "bg-card border-border"}`}
    >
      <Icon className={`size-5 ${accent ? "text-primary" : "text-accent"}`} />
      <div className={`text-xs mt-3 uppercase tracking-wide ${accent ? "text-primary/70" : "text-muted-foreground"}`}>
        {label}
      </div>
      <div className={`mt-1 text-2xl font-bold font-display ${accent ? "text-primary" : "text-foreground"}`}>
        {value}
      </div>
    </div>
  );
}
