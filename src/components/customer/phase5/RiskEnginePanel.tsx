import { useMemo } from "react";
import { AlertTriangle, ShieldCheck } from "lucide-react";
import { SectionShell } from "../shared/SectionShell";
import { Badge } from "@/components/ui/badge";
import { computeCustomerRisk, RISK_BADGE } from "@/lib/customer-crm/risk-scoring";
import type { CustomerWorkspaceData } from "@/lib/customer-crm/types";
import type { EligibilityEngineResult } from "@/lib/customer-crm/eligibility-types";

export function RiskEnginePanel({
  workspace,
  eligibility,
}: {
  workspace: CustomerWorkspaceData;
  eligibility: EligibilityEngineResult | null;
}) {
  const risk = useMemo(() => computeCustomerRisk(workspace, eligibility), [workspace, eligibility]);

  return (
    <SectionShell title="Risk Engine" description="CIBIL, FOIR, and obligation scoring" icon={ShieldCheck}>
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <Badge className={`${RISK_BADGE[risk.level]} border-0 text-sm px-3 py-1 capitalize`}>{risk.level} risk</Badge>
        <span className="text-2xl font-display font-bold">{risk.score}</span>
        <span className="text-xs text-muted-foreground">/ 100 composite</span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-4">
        {[
          ["CIBIL", risk.cibilFactor],
          ["FOIR", risk.foirFactor],
          ["Income", risk.incomeFactor],
          ["Banking", risk.bankingFactor],
          ["Obligations", risk.obligationFactor],
        ].map(([l, v]) => (
          <div key={l as string} className="rounded-lg border border-border p-2 text-center">
            <p className="text-[10px] text-muted-foreground uppercase font-bold">{l}</p>
            <p className="text-sm font-bold">{v}</p>
          </div>
        ))}
      </div>
      {risk.warnings.length > 0 && (
        <ul className="space-y-1 mb-3">
          {risk.warnings.map((w) => (
            <li key={w} className="text-xs flex items-start gap-2 text-amber-800 dark:text-amber-400">
              <AlertTriangle className="size-3.5 shrink-0 mt-0.5" />
              {w}
            </li>
          ))}
        </ul>
      )}
      <ul className="space-y-1">
        {risk.recommendations.map((r) => (
          <li key={r} className="text-xs text-muted-foreground">
            • {r}
          </li>
        ))}
      </ul>
    </SectionShell>
  );
}



