import { useEffect, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, BarChart3, Loader2 } from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { useAuth } from "@/lib/auth-context";
import { loadDsaReportMetrics, type LosReportMetrics } from "@/lib/customer-crm/phase5-api";
import { fmtInr } from "@/lib/customer-crm/finance-calculators";
import { stageLabel } from "@/lib/customer-crm/workflow-constants";

const COLORS = ["hsl(var(--accent))", "#8b5cf6", "#f59e0b", "#10b981", "#ef4444"];

export function LosAnalyticsDashboard() {
  const { user } = useAuth();
  const [metrics, setMetrics] = useState<LosReportMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const m = await loadDsaReportMetrics(user.id);
      setMetrics(m);
      setLoading(false);
    })();
  }, [user]);

  if (loading || !metrics) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="size-8 animate-spin text-accent" />
      </div>
    );
  }

  const kpis = [
    { label: "Login amount", value: fmtInr(metrics.totalLoginAmount) },
    { label: "Sanction", value: fmtInr(metrics.totalSanction) },
    { label: "Disbursed", value: fmtInr(metrics.totalDisbursal) },
    { label: "Payout received", value: fmtInr(metrics.totalPayoutReceived) },
    { label: "Conversion", value: `${metrics.conversionRatio}%` },
    { label: "Avg ROI", value: `${metrics.averageRoi.toFixed(1)}%` },
    { label: "Rejection", value: `${metrics.rejectionRatio}%` },
    { label: "Pending docs", value: String(metrics.pendingDocs) },
    { label: "Follow-ups due", value: String(metrics.followupsDue) },
    { label: "Active pipelines", value: String(metrics.activePipelines) },
  ];

  const funnel = metrics.stageFunnel.map((s) => ({
    stage: stageLabel(s.stage).slice(0, 14),
    count: s.count,
  }));

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/dashboard" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
          <ArrowLeft className="size-4" /> Dashboard
        </Link>
      </div>
      <div className="flex items-center gap-2">
        <BarChart3 className="size-7 text-accent" />
        <div>
          <h1 className="font-display text-2xl font-bold">LOS Analytics</h1>
          <p className="text-sm text-muted-foreground">Portfolio-wide disbursal, payout, and funnel metrics</p>
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-xl border border-border bg-card p-3 shadow-card">
            <p className="text-[10px] text-muted-foreground uppercase font-bold">{k.label}</p>
            <p className="font-bold text-sm mt-0.5">{k.value}</p>
          </div>
        ))}
      </div>
      <div className="grid lg:grid-cols-2 gap-6">
        <ChartCard title="Monthly disbursal trend">
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={metrics.monthlyDisbursal}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis dataKey="month" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip formatter={(v: number) => fmtInr(v)} />
              <Line type="monotone" dataKey="amount" stroke="hsl(var(--accent))" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Stage conversion funnel">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={funnel}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis dataKey="stage" tick={{ fontSize: 9 }} interval={0} angle={-20} textAnchor="end" height={50} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Bar dataKey="count" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        {metrics.byLender.length > 0 && (
          <ChartCard title="Lender comparison" className="lg:col-span-2">
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={metrics.byLender}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v: number) => fmtInr(v)} />
                <Bar dataKey="sanction" fill="hsl(var(--accent))" name="Sanction" radius={[4, 4, 0, 0]} />
                <Bar dataKey="disbursed" fill="#10b981" name="Disbursed" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        )}
        <ChartCard title="Pipeline distribution">
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={funnel.filter((f) => f.count > 0)} dataKey="count" nameKey="stage" cx="50%" cy="50%" outerRadius={80} label>
                {funnel.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  );
}

function ChartCard({ title, children, className = "" }: { title: string; children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-border bg-card p-4 shadow-card ${className}`}>
      <p className="text-sm font-semibold mb-3">{title}</p>
      {children}
    </div>
  );
}

