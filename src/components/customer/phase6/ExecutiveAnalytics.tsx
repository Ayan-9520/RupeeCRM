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
import { loadExecutiveMetrics, type ExecutiveMetrics } from "@/lib/customer-crm/phase6-api";
import { fmtInr } from "@/lib/customer-crm/finance-calculators";
import { stageLabel } from "@/lib/customer-crm/workflow-constants";

const COLORS = ["hsl(var(--accent))", "#8b5cf6", "#10b981", "#f59e0b"];

export function ExecutiveAnalytics() {
  const { user } = useAuth();
  const [m, setM] = useState<ExecutiveMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    loadExecutiveMetrics(user.id).then((data) => {
      setM(data);
      setLoading(false);
    });
  }, [user]);

  if (loading || !m) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="size-8 animate-spin text-accent" />
      </div>
    );
  }

  const funnel = m.stageFunnel.map((s) => ({ stage: stageLabel(s.stage).slice(0, 12), count: s.count }));

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <Link to="/dashboard/los-analytics" className="text-sm text-muted-foreground inline-flex items-center gap-1">
        <ArrowLeft className="size-4" /> LOS Analytics
      </Link>
      <div className="flex items-center gap-2">
        <BarChart3 className="size-7 text-accent" />
        <div>
          <h1 className="font-display text-2xl font-bold">Executive LOS Analytics</h1>
          <p className="text-sm text-muted-foreground">DSA performance, TAT, conversion, and trends</p>
        </div>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {m.dsaPerformance.map((k) => (
          <div key={k.label} className="rounded-xl border border-border bg-card p-3 shadow-card">
            <p className="text-[10px] uppercase font-bold text-muted-foreground">{k.label}</p>
            <p className="font-bold text-lg">{k.label.includes("₹") ? fmtInr(k.value) : k.value.toLocaleString("en-IN")}</p>
          </div>
        ))}
        <div className="rounded-xl border border-border bg-card p-3">
          <p className="text-[10px] uppercase font-bold text-muted-foreground">Avg TAT</p>
          <p className="font-bold text-lg">{m.avgTatHours}h</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-3">
          <p className="text-[10px] uppercase font-bold text-muted-foreground">Login → Disbursal</p>
          <p className="font-bold text-lg">{m.loginToDisbursalRatio}%</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-3">
          <p className="text-[10px] uppercase font-bold text-muted-foreground">Approval ratio</p>
          <p className="font-bold text-lg">{m.approvalRatio}%</p>
        </div>
      </div>
      <div className="grid lg:grid-cols-2 gap-6">
        <ChartCard title="Stage funnel">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={funnel}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis dataKey="stage" tick={{ fontSize: 9 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Bar dataKey="count" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Lender conversion">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={m.lenderConversion}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis dataKey="name" tick={{ fontSize: 9 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Bar dataKey="logins" fill="#8b5cf6" name="Logins" />
              <Bar dataKey="sanctions" fill="#10b981" name="Sanctions" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Monthly growth" className="lg:col-span-2">
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={m.monthlyGrowth}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis dataKey="month" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip formatter={(v: number) => fmtInr(v)} />
              <Line type="monotone" dataKey="disbursed" stroke="hsl(var(--accent))" name="Disbursed" />
              <Line type="monotone" dataKey="payout" stroke="#10b981" name="Payout" />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
        {m.rejectionReasons.length > 0 && (
          <ChartCard title="Rejection reasons">
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={m.rejectionReasons} dataKey="count" nameKey="reason" cx="50%" cy="50%" outerRadius={80}>
                  {m.rejectionReasons.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>
        )}
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

