import { useEffect, useState, memo, type ReactNode } from "react";
import { LayoutDashboard, Star, TrendingUp, Wallet, ListTodo, CalendarClock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { fmtInr } from "@/lib/customer-crm/finance-calculators";
import { loadDisbursals, loadPayouts, summarizeFinance } from "@/lib/customer-crm/phase5-api";
import { loadLenderCases, loadLosTasks } from "@/lib/customer-crm/phase4-api";
import { loadFollowups } from "@/lib/customer-crm/phase3-api";
import { computeCustomerRisk, RISK_BADGE } from "@/lib/customer-crm/risk-scoring";
import { stageLabel } from "@/lib/customer-crm/workflow-constants";
import type { CustomerWorkspaceData } from "@/lib/customer-crm/types";
import type { EligibilityEngineResult } from "@/lib/customer-crm/eligibility-types";

export const CaseSummaryPanel = memo(function CaseSummaryPanel({
  workspace,
  eligibility,
  pipelineStage,
}: {
  workspace: CustomerWorkspaceData;
  eligibility: EligibilityEngineResult | null;
  pipelineStage: string;
}) {
  const [finance, setFinance] = useState({ sanction: 0, disbursed: 0, payoutPending: 0 });
  const [bestLender, setBestLender] = useState("—");
  const [pendingTasks, setPendingTasks] = useState(0);
  const [latestFollowup, setLatestFollowup] = useState("—");

  const risk = computeCustomerRisk(workspace, eligibility);
  const score = eligibility?.metrics.approvalProbability;

  useEffect(() => {
    const pid = workspace.profile.lead_purchase_id;
    (async () => {
      const [d, p, l, t, f] = await Promise.all([
        loadDisbursals(pid),
        loadPayouts(pid),
        loadLenderCases(pid),
        loadLosTasks(pid),
        loadFollowups(pid),
      ]);
      const fin = summarizeFinance(d.rows, p.rows);
      setFinance({ sanction: fin.totalSanction, disbursed: fin.totalDisbursed, payoutPending: fin.totalPayoutPending });
      const best = l.rows.find((r) => r.is_best_offer) ?? l.rows[0];
      setBestLender(best?.lender_name ?? "—");
      setPendingTasks(t.rows.filter((x) => x.status !== "completed").length);
      const open = f.rows.filter((x) => !x.completed).sort((a, b) => (a.followup_date ?? "").localeCompare(b.followup_date ?? ""));
      setLatestFollowup(open[0]?.followup_date ?? "—");
    })();
  }, [workspace.profile.lead_purchase_id]);

  return (
    <div className="rounded-2xl border border-border bg-gradient-to-br from-card via-card to-accent/[0.04] shadow-card overflow-hidden print:hidden">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-2 bg-secondary/20">
        <div className="flex items-center gap-2">
          <LayoutDashboard className="size-4 text-accent" />
          <h2 className="font-display font-bold text-sm">Executive Summary</h2>
        </div>
        <Badge variant="outline" className="text-[10px] capitalize">
          {stageLabel(pipelineStage)}
        </Badge>
      </div>
      <div className="p-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <Kpi icon={TrendingUp} label="Approval" value={score != null ? `${Math.round(score)}%` : "—"} bar={score ?? 0} />
        <Kpi icon={Wallet} label="Sanction" value={fmtInr(finance.sanction)} />
        <Kpi icon={Wallet} label="Disbursed" value={fmtInr(finance.disbursed)} />
        <Kpi icon={Wallet} label="Payout pend." value={fmtInr(finance.payoutPending)} warn={finance.payoutPending > 0} />
        <Kpi icon={Star} label="Best lender" value={bestLender} small />
        <Kpi icon={ListTodo} label="Open tasks" value={String(pendingTasks)} warn={pendingTasks > 0} />
        <Kpi icon={CalendarClock} label="Next F/U" value={latestFollowup === "—" ? "—" : latestFollowup} small />
        <div className="col-span-2 sm:col-span-1 flex flex-col justify-center rounded-xl border border-border bg-secondary/20 px-3 py-2">
          <span className="text-[10px] uppercase font-bold text-muted-foreground">Risk</span>
          <Badge className={`${RISK_BADGE[risk.level]} border-0 text-[10px] capitalize mt-1 w-fit`}>{risk.level}</Badge>
        </div>
      </div>
    </div>
  );
});

function Kpi({
  icon: Icon,
  label,
  value,
  bar,
  warn,
  small,
}: {
  icon: typeof TrendingUp;
  label: string;
  value: string;
  bar?: number;
  warn?: boolean;
  small?: boolean;
}) {
  return (
    <div className={`rounded-xl border px-3 py-2.5 ${warn ? "border-amber-500/35 bg-amber-500/5" : "border-border bg-card/80"}`}>
      <div className="flex items-center gap-1 text-muted-foreground mb-0.5">
        <Icon className="size-3" />
        <span className="text-[10px] uppercase font-bold tracking-wide">{label}</span>
      </div>
      <p className={`font-bold tabular-nums truncate ${small ? "text-xs" : "text-sm"}`}>{value}</p>
      {bar != null && bar > 0 && <Progress value={bar} className="h-1 mt-1.5" />}
    </div>
  );
}
