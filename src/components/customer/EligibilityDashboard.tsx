import { useMemo } from "react";
import { AlertTriangle, Building2, Calculator, CheckCircle2, Shield, TrendingUp, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { SectionShell } from "./shared/SectionShell";
import type { EligibilityEngineResult, EligibilityBadge, WorkflowStage } from "@/lib/customer-crm/eligibility-types";
import { WORKFLOW_STAGES } from "@/lib/customer-crm/eligibility-types";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
  PieChart,
  Pie,
} from "recharts";

const BADGE_STYLES: Record<EligibilityBadge, string> = {
  strong: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  moderate: "bg-amber-500/15 text-amber-800 dark:text-amber-400 border-amber-500/30",
  risky: "bg-orange-500/15 text-orange-800 dark:text-orange-400 border-orange-500/30",
  reject: "bg-destructive/15 text-destructive border-destructive/30",
};

const CHART_COLORS = ["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))"];

function fmt(n: number | null | undefined, opts?: { pct?: boolean }) {
  if (n == null || Number.isNaN(n)) return "—";
  if (opts?.pct) return `${n.toFixed(1)}%`;
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}

function StatusBadge({ badge, label }: { badge: EligibilityBadge; label?: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${BADGE_STYLES[badge]}`}
    >
      {label ?? badge}
    </span>
  );
}

function MetricCard({
  label,
  value,
  sub,
  highlight,
}: {
  label: string;
  value: string;
  sub?: string;
  highlight?: boolean;
}) {
  return (
    <div className={`rounded-xl border p-4 ${highlight ? "border-accent/40 bg-accent/5" : "border-border bg-secondary/30"}`}>
      <div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="font-display text-lg font-bold mt-1 tabular-nums">{value}</div>
      {sub && <div className="text-[10px] text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  );
}

export function EligibilityStickySummary({ result }: { result: EligibilityEngineResult }) {
  const { metrics, risk } = result;
  return (
    <div className="rounded-xl border border-border bg-card p-3 space-y-2 text-xs">
      <div className="font-bold text-muted-foreground uppercase tracking-wide text-[10px]">Eligibility</div>
      <div className="flex items-center justify-between gap-2">
        <StatusBadge badge={risk.eligibilityStatus} />
        <span className="font-bold tabular-nums">{metrics.approvalProbability ?? "—"}%</span>
      </div>
      <div className="grid grid-cols-2 gap-1 text-[10px]">
        <span className="text-muted-foreground">FOIR</span>
        <span className="text-right font-semibold">{fmt(metrics.foirPercent, { pct: true })}</span>
        <span className="text-muted-foreground">Eligible</span>
        <span className="text-right font-semibold truncate">{fmt(metrics.eligibleAmount)}</span>
      </div>
    </div>
  );
}

export function EligibilityDashboard({
  result,
  cibilFromLead,
  workflowStage,
  onWorkflowChange,
  phase2MigrationHint,
}: {
  result: EligibilityEngineResult;
  cibilFromLead: number | null;
  workflowStage: WorkflowStage;
  onWorkflowChange: (stage: WorkflowStage) => void;
  phase2MigrationHint?: boolean;
}) {
  const { financial: fin, metrics: m, risk, lenders, products, validations } = result;

  const incomeChart = useMemo(
    () => [
      { name: "Net", value: fin.netIncome },
      { name: "Co-app", value: fin.coApplicantIncome },
      { name: "Gross", value: fin.grossIncome },
    ],
    [fin],
  );

  const obligationChart = useMemo(
    () => [
      { name: "EMI", value: fin.totalEmi },
      { name: "CC", value: fin.creditCardEmi },
      { name: "OD/CC", value: fin.odCcObligations },
      { name: "Other", value: fin.otherObligations },
    ],
    [fin],
  );

  const foirVsCap = useMemo(() => {
    const cap = 55;
    return [
      { name: "FOIR", value: m.foirPercent ?? 0 },
      { name: "Headroom", value: Math.max(0, cap - (m.foirPercent ?? 0)) },
    ];
  }, [m.foirPercent]);

  return (
    <SectionShell
      title="Eligibility Summary"
      description="Auto-calculated from income, obligations, banking & product"
      icon={Calculator}
    >
      {phase2MigrationHint && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-900 dark:text-amber-200">
          <AlertTriangle className="size-4 shrink-0 mt-0.5" />
          <p>
            Run <code className="bg-background/60 px-1 rounded">20260518100000_customer_eligibility_phase2.sql</code> to persist
            eligibility snapshots. Live calculations still work.
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 mb-5">
        <StatusBadge badge={risk.eligibilityStatus} label={risk.eligibilityStatus} />
        <StatusBadge badge={risk.foirHealth} label={`FOIR ${risk.foirHealth}`} />
        <StatusBadge badge={risk.bankingStability} label={`Banking ${risk.bankingStability}`} />
        {cibilFromLead != null && (
          <span className="text-xs font-semibold text-muted-foreground ml-auto">CIBIL (lead): {cibilFromLead}</span>
        )}
      </div>

      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3 mb-6">
        <MetricCard label="FOIR" value={fmt(m.foirPercent, { pct: true })} sub="Fixed obligation / income" highlight />
        <MetricCard label="DBR" value={fmt(m.dbrPercent, { pct: true })} sub="Outstanding / annual income" />
        <MetricCard label="Eligible EMI" value={fmt(m.eligibleEmi)} sub="At product FOIR cap" highlight />
        <MetricCard label="Est. eligible amount" value={fmt(m.eligibleAmount)} sub={`${m.recommendedTenure ?? "—"} mo · ${m.estimatedRoi ?? "—"}% ROI`} />
      </div>

      <div className="rounded-xl border border-border p-4 mb-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
          <span className="text-sm font-semibold flex items-center gap-2">
            <TrendingUp className="size-4 text-accent" /> Approval probability
          </span>
          <span className="font-display text-2xl font-bold text-accent tabular-nums">{m.approvalProbability ?? "—"}%</span>
        </div>
        <Progress value={m.approvalProbability ?? 0} className="h-2.5" />
      </div>

      <div className="grid lg:grid-cols-2 gap-6 mb-8">
        <div className="rounded-xl border border-border p-4">
          <h3 className="text-sm font-bold mb-3">Income breakdown</h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={incomeChart}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => fmt(v)} />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {incomeChart.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <dl className="grid grid-cols-2 gap-2 mt-3 text-xs">
            <dt className="text-muted-foreground">Household income</dt>
            <dd className="font-semibold text-right">{fmt(fin.householdIncome)}</dd>
            <dt className="text-muted-foreground">Annual income</dt>
            <dd className="font-semibold text-right">{fmt(fin.annualIncome)}</dd>
            <dt className="text-muted-foreground">Business turnover</dt>
            <dd className="font-semibold text-right">{fmt(fin.businessTurnover)}</dd>
          </dl>
        </div>

        <div className="rounded-xl border border-border p-4">
          <h3 className="text-sm font-bold mb-3">Obligations & FOIR headroom</h3>
          <div className="grid grid-cols-2 gap-4 h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={obligationChart} layout="vertical" margin={{ left: 8 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="name" width={40} tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v: number) => fmt(v)} />
                <Bar dataKey="value" fill="hsl(var(--chart-2))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={foirVsCap} dataKey="value" innerRadius={36} outerRadius={52} paddingAngle={2}>
                  {foirVsCap.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => `${v.toFixed(1)}%`} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <dl className="grid grid-cols-2 gap-2 mt-3 text-xs">
            <dt className="text-muted-foreground">Avg balance</dt>
            <dd className="font-semibold text-right">{fmt(fin.avgBalance)}</dd>
            <dt className="text-muted-foreground">Salary credit stable</dt>
            <dd className="font-semibold text-right">{fin.salaryCreditStable ? "Yes" : "No"}</dd>
            <dt className="text-muted-foreground">EMI bounces</dt>
            <dd className="font-semibold text-right">{fin.emiBounceCount}</dd>
          </dl>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6 mb-8">
        <div className="rounded-xl border border-border p-4">
          <h3 className="text-sm font-bold flex items-center gap-2 mb-3">
            <Shield className="size-4" /> Risk profile
          </h3>
          <ul className="space-y-2 text-sm">
            <li className="flex justify-between items-center">
              <span className="text-muted-foreground">CIBIL score</span>
              <span className="font-bold">{risk.cibilScore ?? "Not set"}</span>
            </li>
            <li className="flex justify-between items-center">
              <span className="text-muted-foreground">Risk grade</span>
              <StatusBadge badge={risk.riskGrade} />
            </li>
            <li className="flex justify-between items-center">
              <span className="text-muted-foreground">EMI / income ratio</span>
              <span className="font-bold">{fmt(m.emiIncomeRatio, { pct: true })}</span>
            </li>
            <li className="flex justify-between items-center">
              <span className="text-muted-foreground">LTV (primary)</span>
              <span className="font-bold">{fmt(m.ltvPercent, { pct: true })}</span>
            </li>
          </ul>
        </div>

        <div className="rounded-xl border border-border p-4">
          <h3 className="text-sm font-bold mb-3">CRM workflow stage</h3>
          <div className="flex flex-wrap gap-2">
            {WORKFLOW_STAGES.map((s) => (
              <Button
                key={s.value}
                type="button"
                size="sm"
                variant={workflowStage === s.value ? "default" : "outline"}
                className="text-[10px] h-8"
                onClick={() => onWorkflowChange(s.value)}
              >
                {s.label}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {validations.length > 0 && (
        <div className="mb-6 space-y-2">
          <h3 className="text-sm font-bold">Validation</h3>
          {validations.map((v) => (
            <div
              key={v.code}
              className={`flex items-start gap-2 rounded-lg border p-2 text-xs ${
                v.severity === "error" ? "border-destructive/40 bg-destructive/5" : "border-amber-500/30 bg-amber-500/5"
              }`}
            >
              {v.severity === "error" ? <XCircle className="size-3.5 text-destructive shrink-0" /> : <AlertTriangle className="size-3.5 text-amber-600 shrink-0" />}
              <span>{v.message}</span>
            </div>
          ))}
        </div>
      )}

      <div className="mb-8">
        <h3 className="text-sm font-bold mb-3">Product-wise eligibility</h3>
        <div className="space-y-3">
          {products.map((p) => (
            <div
              key={p.productType}
              className={`rounded-xl border p-4 ${p.passed ? "border-border" : "border-destructive/40 bg-destructive/5"}`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <span className="font-semibold">{p.productType}</span>
                {p.passed ? (
                  <CheckCircle2 className="size-4 text-emerald-500" />
                ) : (
                  <XCircle className="size-4 text-destructive" />
                )}
              </div>
              <div className="grid sm:grid-cols-3 gap-2 text-xs">
                <div>
                  <span className="text-muted-foreground">Requested</span>
                  <div className="font-bold">{fmt(p.requestedAmount)}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Eligible est.</span>
                  <div className="font-bold">{fmt(p.eligibleAmount)}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Tenure / LTV</span>
                  <div className="font-bold">
                    {p.maxTenure ?? "—"} mo{p.ltvPercent != null ? ` · LTV ${p.ltvPercent.toFixed(0)}%` : ""}
                  </div>
                </div>
              </div>
              {p.notes.length > 0 && (
                <ul className="mt-2 text-[10px] text-muted-foreground list-disc pl-4 space-y-0.5">
                  {p.notes.map((n, i) => (
                    <li key={i}>{n}</li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-bold flex items-center gap-2 mb-3">
          <Building2 className="size-4" /> Recommended banks / lenders
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-[10px] uppercase text-muted-foreground">
                <th className="py-2 pr-4">Lender</th>
                <th className="py-2 pr-4">Product</th>
                <th className="py-2 pr-4">Approval chance</th>
                <th className="py-2">Notes</th>
              </tr>
            </thead>
            <tbody>
              {lenders.map((l) => (
                <tr key={l.lenderName} className="border-b border-border/60">
                  <td className="py-3 pr-4 font-semibold">{l.lenderName}</td>
                  <td className="py-3 pr-4 text-muted-foreground">{l.product}</td>
                  <td className="py-3 pr-4">
                    <div className="flex items-center gap-2 min-w-[100px]">
                      <Progress value={l.approvalChance} className="h-1.5 flex-1" />
                      <span className="text-xs font-bold tabular-nums w-8">{l.approvalChance}%</span>
                    </div>
                  </td>
                  <td className="py-3 text-xs text-muted-foreground">{l.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-[10px] text-muted-foreground mt-6">
        Indicative only — final eligibility depends on lender policy, bureau data, and property/legal checks. Last computed{" "}
        {new Date(result.computedAt).toLocaleString("en-IN")}.
      </p>
    </SectionShell>
  );
}
