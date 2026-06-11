import { memo } from "react";
import { LayoutGrid } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { SectionShell } from "../shared/SectionShell";
import { fmtInr } from "@/lib/customer-crm/finance-calculators";
import { runEnhancedEligibility } from "@/lib/customer-crm/eligibility-v2";
import { RISK_BADGE } from "@/lib/customer-crm/risk-scoring";
import { computeCustomerRisk } from "@/lib/customer-crm/risk-scoring";
import { stageLabel } from "@/lib/customer-crm/workflow-constants";
import type { CustomerWorkspaceData } from "@/lib/customer-crm/types";
import type { EligibilityEngineResult } from "@/lib/customer-crm/eligibility-types";

export const Customer360View = memo(function Customer360View({
  workspace,
  eligibility,
  pipelineStage,
  pendingDocs,
  financeSummary,
}: {
  workspace: CustomerWorkspaceData;
  eligibility: EligibilityEngineResult | null;
  pipelineStage: string;
  pendingDocs: number;
  financeSummary?: { sanction: number; disbursed: number; payoutPending: number };
}) {
  const enhanced = eligibility
    ? runEnhancedEligibility({ ...workspace, leadCibil: workspace.purchase.lead?.cibil_score ?? null })
    : null;
  const risk = computeCustomerRisk(workspace, eligibility);

  return (
    <SectionShell title="Customer 360°" description="Unified case overview" icon={LayoutGrid}>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
        <Card title="Profile">
          <p className="font-bold">{workspace.profile.full_name}</p>
          <p className="text-muted-foreground text-xs">{workspace.profile.mobile}</p>
          <p className="text-xs mt-1 capitalize">{workspace.profile.employment_type ?? "—"}</p>
        </Card>
        <Card title="Pipeline">
          <p className="font-semibold">{stageLabel(pipelineStage)}</p>
          <Badge className={`mt-1 ${RISK_BADGE[risk.level]} border-0 capitalize`}>{risk.level} risk</Badge>
        </Card>
        <Card title="Eligibility">
          <p>FOIR: {eligibility?.metrics.foirPercent?.toFixed(1) ?? "—"}%</p>
          <p>Approval: {Math.round(enhanced?.metrics.approvalProbability ?? 0)}%</p>
          <p>Reject risk: {enhanced?.rejectionProbability ?? "—"}%</p>
        </Card>
        <Card title="Finance">
          <p>Sanction: {fmtInr(financeSummary?.sanction ?? 0)}</p>
          <p>Disbursed: {fmtInr(financeSummary?.disbursed ?? 0)}</p>
          <p>Payout pend.: {fmtInr(financeSummary?.payoutPending ?? 0)}</p>
        </Card>
        <Card title="Documents">
          <p>{pendingDocs} pending</p>
          <p className="text-xs text-muted-foreground">{workspace.bankAccounts.length} bank accounts</p>
        </Card>
        <Card title="Best lender">
          <p className="font-semibold">{enhanced?.bestLender?.lenderName ?? eligibility?.lenders[0]?.lenderName ?? "—"}</p>
          <p className="text-xs text-muted-foreground">{enhanced?.bestLender?.notes[0] ?? ""}</p>
        </Card>
      </div>
    </SectionShell>
  );
});

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-secondary/20 p-3">
      <p className="text-[10px] font-bold uppercase text-muted-foreground mb-1">{title}</p>
      {children}
    </div>
  );
}

