import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import {
  Wallet, Store, KanbanSquare, TrendingUp, Sparkles, Phone, Building2,
  IndianRupee, ArrowRight, GraduationCap, FileText, Globe, Users, Flame,
  Sun, Snowflake, RefreshCw, ExternalLink,
} from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { CATEGORY_META, type ProductCategory } from "@/lib/products";
import {
  getDashboardConfig,
  getRoleLabel,
  hasRole,
  isPlatformAdmin,
  type RoleDashboardConfig,
} from "@/lib/role-access";
import type { AppRole } from "@/lib/auth-context";
import {
  crmHealth,
  getCrmUser,
  listCrmLeads,
  listMyLeads,
  type CrmLead,
  type CrmPurchase,
} from "@/lib/python-api";
import { ConnectorCockpit } from "@/components/dashboard/ConnectorCockpit";
import { TeleSalesCockpit } from "@/components/dashboard/TeleSalesCockpit";
import { CustomerHome } from "@/components/dashboard/CustomerHome";

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

const CALL_STAGES = new Set(["new", "contacted"]);
const CASE_STAGES = new Set(["docs", "docs_pending", "submitted", "approved"]);

function scoreTone(score: string) {
  if (score === "hot") return "bg-red-50 text-red-600 border-red-200";
  if (score === "warm") return "bg-amber-50 text-amber-700 border-amber-200";
  return "bg-sky-50 text-sky-700 border-sky-200";
}

function ScoreIcon({ score }: { score: string }) {
  if (score === "hot") return <Flame className="size-3" />;
  if (score === "warm") return <Sun className="size-3" />;
  return <Snowflake className="size-3" />;
}

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
  const [webLeads, setWebLeads] = useState<CrmLead[]>([]);
  const [webTotal, setWebTotal] = useState(0);
  const [webLoading, setWebLoading] = useState(false);
  const [apiUp, setApiUp] = useState<boolean | null>(null);
  const [crmConnected, setCrmConnected] = useState(false);

  const config = getDashboardConfig(role);
  const admin = isPlatformAdmin(role);

  useEffect(() => {
    if (loading) return;
    if (!user) navigate({ to: "/auth" });
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!user || !role) return;
    const cached = getCrmUser();
    setProfileName(cached?.full_name ?? "");

    (async () => {
      try {
        const [mine, market] = await Promise.all([
          listMyLeads().catch(() => ({ items: [] as CrmPurchase[], total: 0, stages: [] as string[] })),
          listCrmLeads({ limit: 200 }).catch(() => ({ items: [] as CrmLead[], total: 0 })),
        ]);

        const purchases = mine.items ?? [];
        const totalSpent = purchases.reduce((s, p) => s + Number(p.price_paid || 0), 0);
        const earnings = purchases
          .filter((p) => p.converted)
          .reduce((s, p) => s + Number(p.deal_value || 0), 0);
        const callsPending = purchases.filter((p) => CALL_STAGES.has(p.pipeline_stage)).length;
        const casesOpen = purchases.filter((p) => CASE_STAGES.has(p.pipeline_stage)).length;
        const available = (market.items ?? []).filter(
          (l) => l.status === "available" || l.sale_available,
        ).length;

        const next: CatStats = JSON.parse(JSON.stringify(EMPTY));
        for (const p of purchases) {
          const cat = (p.lead?.product_category ?? "loan") as ProductCategory;
          if (next[cat]) {
            next[cat].leads += 1;
            next[cat].spent += Number(p.price_paid || 0);
          }
        }
        setByCategory(next);

        setStats({
          balance: Math.max(0, 10000 - totalSpent),
          leadsBought: purchases.length,
          available,
          totalSpent,
          callsPending,
          casesOpen,
          earnings,
        });
      } catch {
        /* keep zeros */
      }
    })();
  }, [user, role]);

  const loadWebLeads = async () => {
    if (!admin) return;
    setWebLoading(true);
    try {
      const up = await crmHealth();
      setApiUp(up);
      const connected = !!getCrmUser();
      setCrmConnected(connected);
      if (!up || !connected) {
        setWebLeads([]);
        setWebTotal(0);
        return;
      }
      const data = await listCrmLeads({ source: "website", limit: 8 });
      setWebLeads(data.items);
      setWebTotal(data.total);
    } catch {
      setApiUp(false);
      setWebLeads([]);
    } finally {
      setWebLoading(false);
    }
  };

  useEffect(() => {
    void loadWebLeads();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [admin]);

  const totalLeadsByCat = Object.values(byCategory).reduce((s, v) => s + v.leads, 0);
  const quickLinks = config.quickLinks.filter((l) => !role || l.roles.includes(role));

  const scoreCounts = useMemo(() => {
    const c = { hot: 0, warm: 0, cold: 0 };
    for (const l of webLeads) {
      if (l.score === "hot") c.hot += 1;
      else if (l.score === "warm") c.warm += 1;
      else c.cold += 1;
    }
    return c;
  }, [webLeads]);

  const firstName = profileName ? profileName.split(" ")[0] : "";

  if (role === "dsa") {
    return <ConnectorCockpit firstName={firstName} />;
  }

  if (role === "caller") {
    return <TeleSalesCockpit firstName={firstName} />;
  }

  if (role === "customer") {
    return <CustomerHome firstName={firstName} />;
  }

  return (
    <div className="space-y-5 max-w-7xl">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-[#10662A] mb-1.5">
            <Sparkles className="size-3.5" />
            {role ? getRoleLabel(role) : "Member"} · RupeeDial One
          </div>
          <h1 className="font-display text-2xl lg:text-[1.75rem] font-extrabold text-[#390A5D] tracking-tight">
            Welcome back{firstName ? `, ${firstName}` : ""}
          </h1>
          <p className="text-[#5c4d72] mt-1 text-sm max-w-xl">{config.subtitle}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {admin && (
            <Link
              to="/dashboard/website-leads"
              className="inline-flex items-center gap-2 rounded-xl bg-[#10662A] text-white px-4 py-2.5 text-sm font-semibold shadow-[0_8px_20px_rgba(16,102,42,0.22)] hover:bg-[#0D4F20] transition-colors"
            >
              <Globe className="size-4" /> Website Leads
            </Link>
          )}
          <Link
            to="/dashboard/leadboard"
            className="inline-flex items-center gap-2 rounded-xl border border-[#d8ecdd] bg-white text-[#390A5D] px-4 py-2.5 text-sm font-semibold hover:border-[#10662A]/40 hover:bg-[#E8F7EC] transition-colors"
          >
            <Store className="size-4 text-[#10662A]" /> Leadboard
          </Link>
          <Link
            to="/dashboard/my-leads"
            className="inline-flex items-center gap-2 rounded-xl border border-[#d8ecdd] bg-white text-[#390A5D] px-4 py-2.5 text-sm font-semibold hover:border-[#10662A]/40 hover:bg-[#E8F7EC] transition-colors"
          >
            <KanbanSquare className="size-4 text-[#10662A]" /> My Leads
          </Link>
        </div>
      </div>

      <RoleStats role={role} config={config} stats={stats} webTotal={admin ? webTotal : undefined} />

      <div className={`grid gap-5 ${admin ? "xl:grid-cols-5" : ""}`}>
        {admin && (
          <section className="xl:col-span-3 rounded-2xl border border-[#d8ecdd] bg-white shadow-[0_4px_24px_rgba(16,102,42,0.05)] overflow-hidden">
            <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-[#d8ecdd] bg-[#f8fcf9]">
              <div className="flex items-center gap-2 min-w-0">
                <div className="size-9 rounded-xl bg-[#E8F7EC] grid place-items-center shrink-0">
                  <Globe className="size-4 text-[#10662A]" />
                </div>
                <div className="min-w-0">
                  <h2 className="font-display font-bold text-[#390A5D] text-base">Recent website leads</h2>
                  <p className="text-xs text-[#5c4d72] truncate">
                    {apiUp === false
                      ? "CRM API offline — start Docker"
                      : !crmConnected
                        ? "Connect API on Website Leads page"
                        : `${webTotal} total · Hot ${scoreCounts.hot} · Warm ${scoreCounts.warm}`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => void loadWebLeads()}
                  className="size-9 rounded-xl border border-[#d8ecdd] grid place-items-center text-[#10662A] hover:bg-[#E8F7EC] cursor-pointer"
                  aria-label="Refresh"
                >
                  <RefreshCw className={`size-4 ${webLoading ? "animate-spin" : ""}`} />
                </button>
                <Link
                  to="/dashboard/website-leads"
                  className="inline-flex items-center gap-1 text-sm font-bold text-[#10662A] hover:underline px-2"
                >
                  View all <ExternalLink className="size-3.5" />
                </Link>
              </div>
            </div>

            {!crmConnected || apiUp === false ? (
              <div className="p-8 text-center">
                <p className="text-sm text-[#5c4d72] mb-4">
                  {apiUp === false
                    ? "The CRM server is not responding right now. Refresh in a minute."
                    : "Sign in again to stream rupeedial.com form leads here."}
                </p>
                <Link
                  to="/dashboard/website-leads"
                  className="inline-flex items-center gap-2 rounded-xl bg-[#10662A] text-white px-4 py-2.5 text-sm font-semibold"
                >
                  Open Website Leads
                </Link>
              </div>
            ) : webLoading && webLeads.length === 0 ? (
              <div className="p-10 text-center text-sm text-[#5c4d72]">Loading leads…</div>
            ) : webLeads.length === 0 ? (
              <div className="p-10 text-center text-sm text-[#5c4d72]">
                No website leads yet. Submit a form on rupeedial.com.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-wide text-[#5c4d72] border-b border-[#d8ecdd]">
                      <th className="px-5 py-2.5 font-semibold">Applicant</th>
                      <th className="px-3 py-2.5 font-semibold">Product</th>
                      <th className="px-3 py-2.5 font-semibold">Amount</th>
                      <th className="px-3 py-2.5 font-semibold">Score</th>
                      <th className="px-5 py-2.5 font-semibold text-right">When</th>
                    </tr>
                  </thead>
                  <tbody>
                    {webLeads.map((l) => (
                      <tr
                        key={l.id}
                        className="border-t border-[#d8ecdd] hover:bg-[#f5fcf7] cursor-pointer transition-colors"
                        onClick={() => navigate({ to: "/dashboard/website-leads" })}
                      >
                        <td className="px-5 py-3">
                          <div className="font-semibold text-[#390A5D]">{l.applicant_name}</div>
                          <div className="text-xs text-[#5c4d72]">{l.city || "—"} · {l.full_phone}</div>
                        </td>
                        <td className="px-3 py-3 text-[#5c4d72] capitalize">
                          <div>{l.product_category}</div>
                          <div className="text-xs">{l.product_subtype || "—"}</div>
                        </td>
                        <td className="px-3 py-3 font-medium text-[#390A5D] whitespace-nowrap">
                          ₹{Number(l.loan_amount || 0).toLocaleString("en-IN")}
                        </td>
                        <td className="px-3 py-3">
                          <span
                            className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${scoreTone(l.score)}`}
                          >
                            <ScoreIcon score={l.score} /> {l.score}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-right text-xs text-[#5c4d72] whitespace-nowrap">
                          {new Date(l.created_at).toLocaleString("en-IN", {
                            day: "numeric",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        <section className={`${admin ? "xl:col-span-2" : ""} space-y-5`}>
          {hasRole(role, ["dsa", "ceo", "super_admin", "admin"]) && (
            <div className="rounded-2xl bg-white border border-[#d8ecdd] p-5 shadow-[0_4px_20px_rgba(16,102,42,0.05)]">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-display text-base font-bold text-[#390A5D]">Leads by category</h2>
                <Link to="/dashboard/leadboard" className="text-xs font-bold text-[#10662A] hover:underline">
                  Browse →
                </Link>
              </div>
              {totalLeadsByCat === 0 ? (
                <div className="rounded-xl bg-[#f5fcf7] border border-dashed border-[#d8ecdd] p-5 text-center">
                  <p className="text-sm text-[#5c4d72] mb-3">No purchases yet. Buy leads from the marketplace.</p>
                  <Link
                    to="/dashboard/leadboard"
                    className="inline-flex items-center gap-1.5 text-sm font-bold text-[#10662A]"
                  >
                    Open Leadboard <ArrowRight className="size-3.5" />
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {(Object.keys(byCategory) as ProductCategory[]).map((cat) => {
                    const v = byCategory[cat];
                    const meta = CATEGORY_META[cat];
                    const pct = totalLeadsByCat > 0 ? (v.leads / totalLeadsByCat) * 100 : 0;
                    const barColor =
                      cat === "loan"
                        ? "bg-[#10662A]"
                        : cat === "insurance"
                          ? "bg-emerald-400"
                          : cat === "credit_card"
                            ? "bg-amber-500"
                            : "bg-violet-500";
                    return (
                      <Link key={cat} to="/dashboard/leadboard" className="block group">
                        <div className="flex items-center justify-between text-sm mb-1">
                          <div className="flex items-center gap-2">
                            <span className={`size-2 rounded-full ${barColor}`} />
                            <span className="font-medium text-[#390A5D] group-hover:text-[#10662A]">{meta.label}</span>
                          </div>
                          <div className="text-xs text-[#5c4d72]">
                            {v.leads} · ₹{v.spent.toLocaleString("en-IN")}
                          </div>
                        </div>
                        <div className="h-2 rounded-full bg-[#E8F7EC] overflow-hidden">
                          <div className={`h-full ${barColor}`} style={{ width: `${pct}%` }} />
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          <div className="rounded-2xl bg-white border border-[#d8ecdd] p-5 shadow-[0_4px_20px_rgba(16,102,42,0.05)]">
            <h2 className="font-display text-base font-bold text-[#390A5D] mb-3">Quick actions</h2>
            <div className="grid gap-2">
              {quickLinks.map((link) => (
                <Link
                  key={link.url}
                  to={link.url}
                  className="group flex items-center gap-3 rounded-xl border border-[#d8ecdd] px-3.5 py-3 hover:border-[#10662A]/35 hover:bg-[#E8F7EC]/60 transition-all"
                >
                  <QuickIcon url={link.url} />
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-sm text-[#390A5D]">{link.title}</div>
                    <div className="text-xs text-[#5c4d72] truncate">{link.desc}</div>
                  </div>
                  <ArrowRight className="size-4 text-[#10662A] opacity-50 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                </Link>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function QuickIcon({ url }: { url: string }) {
  const cls = "size-9 rounded-xl bg-[#E8F7EC] grid place-items-center shrink-0 text-[#10662A]";
  let Icon = ArrowRight;
  if (url.includes("ceo")) Icon = Building2;
  else if (url.includes("users")) Icon = Users;
  else if (url.includes("leadboard")) Icon = Store;
  else if (url.includes("wallet")) Icon = Wallet;
  else if (url.includes("website")) Icon = Globe;
  else if (url.includes("my-leads")) Icon = KanbanSquare;
  else if (url.includes("learn") || url.includes("apply")) Icon = GraduationCap;
  else if (url.includes("calls")) Icon = Phone;
  else if (url.includes("submission") || url.includes("los")) Icon = FileText;
  return (
    <div className={cls}>
      <Icon className="size-4" />
    </div>
  );
}

function RoleStats({
  role,
  config,
  stats,
  webTotal,
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
  webTotal?: number;
}) {
  const cards: {
    key: string;
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    value: string;
    accent?: boolean;
    href: string;
  }[] = [];

  for (const key of config.stats) {
    switch (key) {
      case "wallet":
        cards.push({
          key: "wallet",
          icon: Wallet,
          label: "Lead credits (demo)",
          value: `₹${stats.balance.toLocaleString("en-IN")}`,
          accent: true,
          href: "/dashboard/wallet",
        });
        break;
      case "leads_available":
        cards.push({
          key: "avail",
          icon: webTotal != null ? Globe : Store,
          label: webTotal != null ? "Website leads" : "Leads available",
          value: String(webTotal != null ? webTotal : stats.available),
          href: webTotal != null ? "/dashboard/website-leads" : "/dashboard/leadboard",
        });
        break;
      case "leads_purchased":
        cards.push({
          key: "bought",
          icon: KanbanSquare,
          label: "Leads purchased",
          value: stats.leadsBought.toString(),
          href: "/dashboard/my-leads",
        });
        break;
      case "spent":
        cards.push({
          key: "spent",
          icon: TrendingUp,
          label: "Total invested",
          value: `₹${stats.totalSpent.toLocaleString("en-IN")}`,
          href: "/dashboard/wallet",
        });
        break;
      case "calls":
        cards.push({
          key: "calls",
          icon: Phone,
          label: "Follow-ups due",
          value: stats.callsPending.toString(),
          href: "/dashboard/calls",
        });
        break;
      case "cases":
        cards.push({
          key: "cases",
          icon: Building2,
          label: "Open cases",
          value: stats.casesOpen.toString(),
          href: "/dashboard/cases",
        });
        break;
      case "earnings":
        cards.push({
          key: "earn",
          icon: IndianRupee,
          label: "Total earnings",
          value: `₹${stats.earnings.toLocaleString("en-IN")}`,
          href: "/dashboard/earnings",
        });
        break;
    }
  }

  if (cards.length === 0) {
    return (
      <div className="rounded-2xl bg-white border border-[#d8ecdd] p-6 text-center text-sm text-[#5c4d72]">
        Use the quick actions below to get started with your {role ? getRoleLabel(role).toLowerCase() : ""} workspace.
      </div>
    );
  }

  return (
    <div className={`grid grid-cols-2 gap-3 ${cards.length > 2 ? "lg:grid-cols-4" : "lg:grid-cols-2"}`}>
      {cards.map((c) => (
        <Link
          key={c.key}
          to={c.href}
          className={`rounded-2xl p-4 border transition-all block cursor-pointer group ${
            c.accent
              ? "bg-[#10662A] border-transparent text-white shadow-[0_8px_24px_rgba(16,102,42,0.22)] hover:bg-[#0D4F20] hover:-translate-y-0.5"
              : "bg-white border-[#d8ecdd] shadow-[0_2px_12px_rgba(16,102,42,0.04)] hover:border-[#10662A]/35 hover:shadow-[0_10px_24px_rgba(16,102,42,0.08)] hover:-translate-y-0.5"
          }`}
        >
          <div className="flex items-start justify-between">
            <c.icon className={`size-5 ${c.accent ? "text-white/90" : "text-[#10662A]"}`} />
            <ArrowRight
              className={`size-4 opacity-0 group-hover:opacity-100 transition-opacity ${
                c.accent ? "text-white/80" : "text-[#10662A]"
              }`}
            />
          </div>
          <div className={`text-[11px] mt-3 uppercase tracking-wide font-semibold ${c.accent ? "text-white/70" : "text-[#5c4d72]"}`}>
            {c.label}
          </div>
          <div className={`mt-0.5 text-2xl font-bold font-display ${c.accent ? "text-white" : "text-[#390A5D]"}`}>
            {c.value}
          </div>
        </Link>
      ))}
    </div>
  );
}
