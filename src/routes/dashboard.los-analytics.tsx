import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Activity,
  BadgeCheck,
  BarChart3,
  Briefcase,
  CircleDollarSign,
  Filter,
  KanbanSquare,
  Loader2,
  Percent,
  PieChart as PieIcon,
  Store,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { getCrmUser, listCaseFiles, listCrmLeads, listMyLeads, type LoanCaseFile } from "@/lib/python-api";
import { isPlatformAdmin } from "@/lib/role-access";
import type { AppRole } from "@/lib/auth-context";
import { BusinessScopeSwitch, useBusinessScope } from "@/components/dashboard/BusinessScopeSwitch";

export const Route = createFileRoute("/dashboard/los-analytics")({
  head: () => ({ meta: [{ title: "LOS Analytics — RupeeOne" }] }),
  component: LosAnalyticsPage,
});

const GREEN = "#087A35";
const PURPLE = "#390A5D";
const PIE = ["#087A35", "#390A5D", "#34a853", "#7c4dab", "#9fd8b0", "#c9b3e0", "#0b4f24"];
const DISBURSED = ["disbursed", "disbursed_confirmed", "disbursed_hold", "collected", "partially_collected", "counted", "counted_pod_pending"];
const CLOSED = [...DISBURSED, "rejected", "cancelled", "dropped"];

type Purchase = Awaited<ReturnType<typeof listMyLeads>>["items"][number];

const inr = (value: number) => `₹${Math.round(value).toLocaleString("en-IN")}`;
const monthKey = (iso?: string) => (iso && !Number.isNaN(Date.parse(iso)) ? iso.slice(0, 7) : "");
const monthLabel = (key: string) => new Date(`${key}-01`).toLocaleString("en-IN", { month: "short", year: "2-digit" });

function disbursedAmount(row: LoanCaseFile) {
  const parts = (row.disbursements ?? []).reduce((sum, d) => sum + Number(d.amount || 0), 0);
  return parts || Number(row.sanctioned_amount || 0) || Number(row.loan_amount || 0);
}

function LosAnalyticsPage() {
  const role = (getCrmUser()?.role as AppRole) || null;
  const admin = isPlatformAdmin(role);
  const partner = role === "dsa" || role === "affiliate";
  const [loading, setLoading] = useState(true);
  const [marketplace, setMarketplace] = useState<number | null>(null);
  const [purchases, setPurchases] = useState<Purchase[] | null>(null);
  const [cases, setCases] = useState<LoanCaseFile[] | null>(null);
  const [revenue, setRevenue] = useState(0);
  const [scope, setScope] = useBusinessScope();
  const [hasTeam, setHasTeam] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [leads, mine, files] = await Promise.all([
          listCrmLeads({ limit: 1 }).catch(() => null),
          listMyLeads().catch(() => null),
          listCaseFiles("all", "", "", { scope }).catch(() => null),
        ]);
        if (leads) setMarketplace(leads.total ?? leads.items?.length ?? 0);
        if (mine) setPurchases(mine.items ?? []);
        if (files) {
          setCases(files.items ?? []);
          setRevenue(Number(files.revenue || 0));
          setHasTeam(Boolean(files.business?.has_team));
          if (files.business && !files.business.has_team && scope === "team") setScope("combined");
        }
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope]);

  const data = useMemo(() => {
    const files = cases ?? [];
    const bought = purchases ?? [];
    const disbursed = files.filter((row) => DISBURSED.includes(row.stage));
    const active = files.filter((row) => !CLOSED.includes(row.stage) && row.stage !== "draft");
    const converted = bought.filter((p) => p.converted).length;

    const months = new Map<string, { cases: number; disbursed: number }>();
    for (const row of files) {
      const key = monthKey(row.submitted_on);
      if (key) months.set(key, { ...(months.get(key) ?? { cases: 0, disbursed: 0 }), cases: (months.get(key)?.cases ?? 0) + 1 });
    }
    for (const row of disbursed) {
      for (const part of row.disbursements ?? []) {
        const key = monthKey(part.date);
        if (!key) continue;
        const current = months.get(key) ?? { cases: 0, disbursed: 0 };
        months.set(key, { ...current, disbursed: current.disbursed + Number(part.amount || 0) });
      }
    }
    const monthly = [...months.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(-6).map(([key, v]) => ({ month: monthLabel(key), ...v }));

    const group = (list: LoanCaseFile[], pick: (row: LoanCaseFile) => string) => {
      const out = new Map<string, number>();
      for (const row of list) out.set(pick(row) || "Other", (out.get(pick(row) || "Other") ?? 0) + 1);
      return [...out.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
    };

    const recent = [...files]
      .filter((row) => row.submitted_on)
      .sort((a, b) => (b.submitted_on ?? "").localeCompare(a.submitted_on ?? ""))
      .slice(0, 6);

    return {
      disbursed,
      active,
      converted,
      monthly,
      byLoan: group(files, (row) => row.loan_type),
      byStatus: group(files, (row) => row.stage_label || row.status_label || row.stage),
      pipelineValue: active.reduce((sum, row) => sum + Number(row.loan_amount || 0), 0),
      disbursedValue: disbursed.reduce((sum, row) => sum + disbursedAmount(row), 0),
      earnings: files.reduce((sum, row) => sum + Number(row.payable_amount || 0), 0),
      spend: bought.reduce((sum, p) => sum + Number(p.price_paid || 0), 0),
      funnel: [
        ["Purchased", bought.length],
        ["Converted", converted],
        ["Cases", files.filter((row) => row.stage !== "draft").length],
        ["Disbursed", disbursed.length],
      ] as [string, number][],
      recent,
    };
  }, [cases, purchases]);

  if (loading) {
    return (
      <div className="grid place-items-center py-20">
        <Loader2 className="size-6 animate-spin text-[#087A35]" />
      </div>
    );
  }

  const bought = purchases?.length ?? 0;
  const kpis: { label: string; value: string; icon: typeof Store; to: string; tone: "green" | "purple" }[] = [];
  if (marketplace !== null) kpis.push({ label: "Marketplace Leads", value: marketplace.toLocaleString("en-IN"), icon: Store, to: "/dashboard/leadboard", tone: "green" });
  if (purchases) {
    kpis.push({ label: "My Purchases", value: String(bought), icon: KanbanSquare, to: "/dashboard/my-leads", tone: "purple" });
    kpis.push({ label: "Converted Leads", value: String(data.converted), icon: BadgeCheck, to: "/dashboard/my-leads", tone: "green" });
  }
  if (cases) {
    kpis.push({ label: admin ? "All Cases" : "My Cases", value: String(cases.length), icon: Briefcase, to: "/dashboard/cases", tone: "purple" });
    kpis.push({ label: "Active Pipeline", value: inr(data.pipelineValue), icon: TrendingUp, to: "/dashboard/cases", tone: "green" });
    kpis.push({ label: "Disbursed Amount", value: inr(data.disbursedValue), icon: CircleDollarSign, to: "/dashboard/cases", tone: "purple" });
    kpis.push(
      partner
        ? { label: "My Earnings", value: inr(data.earnings), icon: Wallet, to: "/dashboard/earnings", tone: "green" }
        : { label: "Commission Revenue", value: inr(revenue), icon: Wallet, to: "/dashboard/cases", tone: "green" },
    );
  }
  if (purchases) {
    kpis.push({ label: "Lead Spend", value: inr(data.spend), icon: Store, to: "/dashboard/wallet", tone: "purple" });
    if (bought) kpis.push({ label: "Conversion Rate", value: `${Math.round((data.converted / bought) * 100)}%`, icon: Percent, to: "/dashboard/my-leads", tone: "green" });
  }

  const funnelTop = Math.max(1, ...data.funnel.map(([, n]) => n));
  const disbursedPct = cases?.length ? Math.round((data.disbursed.length / cases.length) * 100) : 0;

  return (
    <div className="space-y-4 rounded-3xl bg-gradient-to-br from-[#f2faf4] via-white to-[#f6f0fb] p-4 lg:p-5">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="flex items-center gap-2 font-display text-2xl font-bold text-[#390A5D]">
            <BarChart3 className="size-6 text-[#087A35]" /> LOS Analytics
          </h1>
          <p className="text-xs text-[#5c4d72]">
            {admin ? "Organisation-wide numbers from live CRM data." : partner ? "Only your own leads, cases and earnings." : "Only the leads and cases assigned to you."}
          </p>
        </div>
        <BusinessScopeSwitch value={scope} hasTeam={hasTeam} onChange={setScope} />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {kpis.map((k) => (
          <Link key={k.label} to={k.to} className="group rounded-2xl border border-[#d8ecdd] bg-white p-3 shadow-[0_4px_18px_rgba(8,122,53,0.06)] transition hover:-translate-y-0.5 hover:border-[#087A35]/40">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wide text-[#5c4d72]">{k.label}</span>
              <span className={`grid size-7 place-items-center rounded-lg ${k.tone === "green" ? "bg-[#e6f4ea] text-[#087A35]" : "bg-[#efe7f7] text-[#390A5D]"}`}>
                <k.icon className="size-3.5" />
              </span>
            </div>
            <div className="mt-1.5 font-display text-xl font-bold text-[#390A5D]">{k.value}</div>
          </Link>
        ))}
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <Panel title="Monthly performance" icon={BarChart3} className="lg:col-span-2">
          {data.monthly.length ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={data.monthly}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e8f1ea" />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                <YAxis yAxisId="l" tick={{ fontSize: 10 }} allowDecimals={false} />
                <YAxis yAxisId="r" orientation="right" tick={{ fontSize: 10 }} tickFormatter={(v: number) => `${Math.round(v / 100000)}L`} />
                <Tooltip formatter={(v: number, name: string) => (name === "Disbursed" ? inr(v) : v)} />
                <Bar yAxisId="l" dataKey="cases" name="Cases" fill={PURPLE} radius={[4, 4, 0, 0]} />
                <Bar yAxisId="r" dataKey="disbursed" name="Disbursed" fill={GREEN} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <Empty text="No dated cases yet." />
          )}
        </Panel>

        <Panel title="Lead-to-conversion funnel" icon={Filter}>
          <div className="space-y-2.5 pt-1">
            {data.funnel.map(([label, n], i) => (
              <div key={label}>
                <div className="flex justify-between text-xs">
                  <span className="font-medium text-[#390A5D]">{label}</span>
                  <span className="font-bold text-[#087A35]">{n}</span>
                </div>
                <div className="mt-1 h-2 rounded-full bg-[#eef6f0]">
                  <div className="h-2 rounded-full" style={{ width: `${(n / funnelTop) * 100}%`, background: i % 2 ? PURPLE : GREEN }} />
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Loan type breakdown" icon={PieIcon}>
          {data.byLoan.length ? (
            <div className="flex items-center gap-3">
              <ResponsiveContainer width="50%" height={150}>
                <PieChart>
                  <Pie data={data.byLoan} dataKey="value" nameKey="name" innerRadius={38} outerRadius={62} paddingAngle={2}>
                    {data.byLoan.map((_, i) => (
                      <Cell key={i} fill={PIE[i % PIE.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <Legend rows={data.byLoan} />
            </div>
          ) : (
            <Empty text="No cases yet." />
          )}
        </Panel>

        <Panel title="Case status breakdown" icon={KanbanSquare}>
          {data.byStatus.length ? (
            <ul className="max-h-[150px] space-y-1.5 overflow-y-auto pr-1 text-xs">
              {data.byStatus.map((s) => (
                <li key={s.name} className="flex items-center justify-between rounded-lg bg-[#f6fbf7] px-2.5 py-1.5">
                  <span className="text-[#390A5D]">{s.name}</span>
                  <span className="font-bold text-[#087A35]">{s.value}</span>
                </li>
              ))}
            </ul>
          ) : (
            <Empty text="No cases yet." />
          )}
        </Panel>

        <Panel title="Disbursement & earnings" icon={CircleDollarSign}>
          <div className="space-y-2 text-xs">
            <Stat label="Disbursed files" value={`${data.disbursed.length} of ${cases?.length ?? 0}`} />
            <div className="h-2 rounded-full bg-[#eef6f0]">
              <div className="h-2 rounded-full bg-[#087A35]" style={{ width: `${disbursedPct}%` }} />
            </div>
            <Stat label="Disbursed amount" value={inr(data.disbursedValue)} />
            <Stat label="Pipeline value" value={inr(data.pipelineValue)} />
            <Stat label={partner ? "My earnings" : "Commission revenue"} value={inr(partner ? data.earnings : revenue)} strong />
          </div>
        </Panel>
      </div>

      <Panel title="Recent activity" icon={Activity}>
        {data.recent.length ? (
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {data.recent.map((row) => (
              <li key={row.id} className="flex items-center justify-between gap-2 rounded-xl border border-[#eef6f0] bg-[#fbfdfb] px-3 py-2 text-xs">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-[#390A5D]">{row.client_name || row.deal_no}</p>
                  <p className="text-[#5c4d72]">
                    {row.loan_type} · {inr(Number(row.loan_amount || 0))}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-[#e6f4ea] px-2 py-0.5 text-[10px] font-semibold text-[#087A35]">{row.stage_label || row.stage}</span>
              </li>
            ))}
          </ul>
        ) : (
          <Empty text="No recent case activity." />
        )}
      </Panel>
    </div>
  );
}

function Panel({ title, icon: Icon, className = "", children }: { title: string; icon: typeof Store; className?: string; children: ReactNode }) {
  return (
    <section className={`rounded-2xl border border-[#d8ecdd] bg-white p-4 shadow-[0_4px_18px_rgba(8,122,53,0.05)] ${className}`}>
      <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-[#390A5D]">
        <Icon className="size-4 text-[#087A35]" /> {title}
      </h2>
      {children}
    </section>
  );
}

function Legend({ rows }: { rows: { name: string; value: number }[] }) {
  return (
    <ul className="flex-1 space-y-1 text-xs">
      {rows.slice(0, 6).map((r, i) => (
        <li key={r.name} className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 truncate text-[#390A5D]">
            <span className="size-2 rounded-full" style={{ background: PIE[i % PIE.length] }} /> {r.name}
          </span>
          <span className="font-bold text-[#087A35]">{r.value}</span>
        </li>
      ))}
    </ul>
  );
}

function Stat({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className="text-[#5c4d72]">{label}</span>
      <span className={strong ? "font-bold text-[#087A35]" : "font-semibold text-[#390A5D]"}>{value}</span>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="py-6 text-center text-xs text-[#5c4d72]">{text}</p>;
}
