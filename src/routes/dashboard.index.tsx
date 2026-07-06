import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import {
  Wallet, Store, KanbanSquare, TrendingUp, Sparkles, Phone, Building2,
  IndianRupee, ArrowRight, GraduationCap, FileText,
} from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { CATEGORY_META, type ProductCategory } from "@/lib/products";
import {
  getDashboardConfig,
  getRoleLabel,
  hasRole,
  type RoleDashboardConfig,
} from "@/lib/role-access";
import type { AppRole } from "@/lib/auth-context";

export const Route = createFileRoute("/dashboard/")({
  component: DashboardHome,
});

type CatStats = Record<ProductCategory, { leads: number; spent: number }>;

const EMPTY: CatStats = {
  loan: { leads: 0, spent: 0 },
  insurance: { leads: 0, spent: 0 },
  credit_card: { leads: 0, spent: 0 },
  investment: { leads: 0, spent: 0 },
};

function DashboardHome() {
  const navigate = useNavigate();
  const { user, role, loading } = useAuth();
  const [stats, setStats] = useState({
    balance: 0,
    leadsBought: 0,
    available: 0,
    totalSpent: 0,
    callsPending: 0,
    casesOpen: 0,
    earnings: 0,
  });
  const [byCategory, setByCategory] = useState<CatStats>(EMPTY);
  const [profileName, setProfileName] = useState("");

  const config = getDashboardConfig(role);

  useEffect(() => {
    if (loading) return;
    if (!user) navigate({ to: "/auth" });
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!user || !role) return;
    (async () => {
      const profileRes = await supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle();
      setProfileName(profileRes.data?.full_name ?? "");

      const isDsaLike = hasRole(role, ["dsa", "ceo", "super_admin", "admin", "affiliate"]);
      const isMarketplace = hasRole(role, ["dsa", "ceo", "super_admin", "admin"]);

      const tasks: Promise<void>[] = [];

      if (isDsaLike || role === "affiliate") {
        tasks.push(
          supabase
            .from("wallets")
            .select("balance,total_spent")
            .eq("user_id", user.id)
            .maybeSingle()
            .then(({ data }) => {
              setStats((s) => ({
                ...s,
                balance: Number(data?.balance ?? 0),
                totalSpent: Number(data?.total_spent ?? 0),
              }));
            }),
        );
      }

      if (isMarketplace || role === "coordinator") {
        tasks.push(
          supabase
            .from("lead_purchases")
            .select("id", { count: "exact", head: true })
            .eq("dsa_id", user.id)
            .then(({ count }) => setStats((s) => ({ ...s, leadsBought: count ?? 0 }))),
        );
      }

      if (isMarketplace) {
        tasks.push(
          supabase
            .from("leads")
            .select("id", { count: "exact", head: true })
            .eq("status", "available")
            .then(({ count }) => setStats((s) => ({ ...s, available: count ?? 0 }))),
          supabase
            .from("lead_purchases")
            .select("price_paid,leads!inner(product_category)")
            .eq("dsa_id", user.id)
            .then(({ data }) => {
              const next: CatStats = JSON.parse(JSON.stringify(EMPTY));
              type Row = { price_paid: number; leads: { product_category: ProductCategory } | null };
              ((data ?? []) as unknown as Row[]).forEach((r) => {
                const cat = r.leads?.product_category;
                if (cat && next[cat]) {
                  next[cat].leads += 1;
                  next[cat].spent += Number(r.price_paid);
                }
              });
              setByCategory(next);
            }),
        );
      }

      if (role === "caller") {
        tasks.push(
          supabase
            .from("lead_purchases")
            .select("id", { count: "exact", head: true })
            .not("next_followup_at", "is", null)
            .then(({ count }) => setStats((s) => ({ ...s, callsPending: count ?? 0 }))),
        );
      }

      if (hasRole(role, ["lender", "coordinator", "dsa"])) {
        tasks.push(
          supabase
            .from("lead_purchases")
            .select("id", { count: "exact", head: true })
            .neq("pipeline_stage", "disbursed")
            .neq("pipeline_stage", "closed")
            .then(({ count }) => setStats((s) => ({ ...s, casesOpen: count ?? 0 }))),
        );
      }

      await Promise.all(tasks);
    })();
  }, [user, role]);

  const totalLeadsByCat = Object.values(byCategory).reduce((s, v) => s + v.leads, 0);
  const quickLinks = config.quickLinks.filter((l) => !role || l.roles.includes(role));

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="rounded-3xl wa-header-bar text-white p-6 lg:p-8 relative overflow-hidden shadow-elevated">
        <div className="absolute inset-0 wa-pattern opacity-[0.06]" />
        <div className="absolute -top-20 -right-20 size-64 rounded-full bg-[var(--wa-green)]/25 blur-3xl" />
        <div className="relative">
          <div className="inline-flex items-center gap-2 text-xs uppercase tracking-wider text-white/60 mb-2">
            <Sparkles className="size-3 text-[var(--wa-green)]" />
            {role ? getRoleLabel(role) : "Member"} workspace
          </div>
          <h1 className="font-display text-2xl lg:text-3xl font-bold">
            Welcome back{profileName ? `, ${profileName.split(" ")[0]}` : ""} 👋
          </h1>
          <p className="text-white/75 mt-1">{config.subtitle}</p>
        </div>
      </div>

      <RoleStats role={role} config={config} stats={stats} />

      {hasRole(role, ["dsa", "ceo", "super_admin", "admin"]) && (
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
                    ? "bg-[var(--wa-green)]"
                    : cat === "insurance"
                      ? "bg-emerald-400"
                      : cat === "credit_card"
                        ? "bg-amber-500"
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
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4 gap-4">
        {quickLinks.map((link) => (
          <QuickLinkCard key={link.url} title={link.title} desc={link.desc} url={link.url} />
        ))}
      </div>
    </div>
  );
}

function RoleStats({
  role,
  config,
  stats,
}: {
  role: AppRole | null;
  config: RoleDashboardConfig;
  stats: {
    balance: number;
    leadsBought: number;
    available: number;
    totalSpent: number;
    callsPending: number;
    casesOpen: number;
    earnings: number;
  };
}) {
  const cards: { key: string; icon: React.ComponentType<{ className?: string }>; label: string; value: string; accent?: boolean }[] = [];

  for (const key of config.stats) {
    switch (key) {
      case "wallet":
        cards.push({
          key: "wallet",
          icon: Wallet,
          label: "Wallet balance",
          value: `₹${stats.balance.toLocaleString("en-IN")}`,
          accent: true,
        });
        break;
      case "leads_available":
        cards.push({ key: "avail", icon: Store, label: "Leads available", value: stats.available.toString() });
        break;
      case "leads_purchased":
        cards.push({ key: "bought", icon: KanbanSquare, label: "Leads purchased", value: stats.leadsBought.toString() });
        break;
      case "spent":
        cards.push({
          key: "spent",
          icon: TrendingUp,
          label: "Total invested",
          value: `₹${stats.totalSpent.toLocaleString("en-IN")}`,
        });
        break;
      case "calls":
        cards.push({ key: "calls", icon: Phone, label: "Follow-ups due", value: stats.callsPending.toString() });
        break;
      case "cases":
        cards.push({ key: "cases", icon: Building2, label: "Open cases", value: stats.casesOpen.toString() });
        break;
      case "earnings":
        cards.push({
          key: "earn",
          icon: IndianRupee,
          label: "Total earnings",
          value: `₹${stats.earnings.toLocaleString("en-IN")}`,
        });
        break;
    }
  }

  if (cards.length === 0) {
    return (
      <div className="rounded-2xl bg-card border border-border p-6 text-center text-sm text-muted-foreground">
        Use the quick links below to get started with your {role ? getRoleLabel(role).toLowerCase() : ""} workspace.
      </div>
    );
  }

  return (
    <div className={`grid grid-cols-2 gap-4 ${cards.length > 2 ? "lg:grid-cols-4" : "lg:grid-cols-2"}`}>
      {cards.map((c) => (
        <StatCard key={c.key} icon={c.icon} label={c.label} value={c.value} accent={c.accent} />
      ))}
    </div>
  );
}

function QuickLinkCard({ title, desc, url }: { title: string; desc: string; url: string }) {
  const Icon =
    url.includes("leadboard") || url.includes("marketplace")
      ? Store
      : url.includes("wallet")
        ? Wallet
        : url.includes("learn") || url.includes("apply")
          ? GraduationCap
          : url.includes("calls")
            ? Phone
            : url.includes("submission")
              ? FileText
              : ArrowRight;

  return (
    <Link
      to={url}
      className="group rounded-2xl bg-card border border-border p-5 hover:border-[var(--wa-green)]/40 transition-smooth shadow-card flex flex-col"
    >
      <Icon className="size-7 text-[var(--wa-green)] mb-3" />
      <h3 className="font-display text-base font-semibold">{title}</h3>
      <p className="text-sm text-muted-foreground mt-1 flex-1">{desc}</p>
      <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-[var(--wa-green)] group-hover:underline">
        Open <ArrowRight className="size-3.5" />
      </span>
    </Link>
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
      className={`rounded-2xl p-5 border shadow-card ${
        accent ? "bg-[var(--wa-green)] border-transparent text-white" : "bg-card border-border"
      }`}
    >
      <Icon className={`size-5 ${accent ? "text-white/90" : "text-[var(--wa-green)]"}`} />
      <div className={`text-xs mt-3 uppercase tracking-wide ${accent ? "text-white/70" : "text-muted-foreground"}`}>
        {label}
      </div>
      <div className={`mt-1 text-2xl font-bold font-display ${accent ? "text-white" : "text-foreground"}`}>{value}</div>
    </div>
  );
}
