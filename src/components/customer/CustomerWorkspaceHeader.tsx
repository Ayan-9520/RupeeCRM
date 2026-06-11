import { Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  Phone,
  MessageSquare,
  Mail,
  FileText,
  StickyNote,
  UserPlus,
  IndianRupee,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { stageMeta } from "@/lib/customer-crm/workflow-constants";
import { RISK_BADGE } from "@/lib/customer-crm/risk-scoring";
import type { RiskLevel } from "@/lib/customer-crm/risk-scoring";
import type { CustomerWorkspaceData } from "@/lib/customer-crm/types";
import type { EligibilityEngineResult } from "@/lib/customer-crm/eligibility-types";

export function CustomerWorkspaceHeader({
  purchaseId,
  workspace,
  pipelineStage,
  eligibility,
  pendingDocs,
  activeLenders,
  pendingFollowups,
  riskLevel,
  onAddNote,
}: {
  purchaseId: string;
  workspace: CustomerWorkspaceData;
  pipelineStage: string;
  eligibility: EligibilityEngineResult | null;
  pendingDocs: number;
  activeLenders: number;
  pendingFollowups: boolean;
  riskLevel: RiskLevel;
  onAddNote?: () => void;
}) {
  const { purchase, profile } = workspace;
  const lead = purchase.lead;
  const phone = lead?.full_phone ?? profile.mobile ?? "";
  const name = profile.full_name || lead?.applicant_name || "Customer";
  const stage = stageMeta(pipelineStage);
  const approval = eligibility?.metrics.approvalProbability;
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-md supports-[backdrop-filter]:bg-background/85">
      <div className="px-4 lg:px-6 py-3 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <Link
            to="/dashboard/my-leads"
            className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground shrink-0"
          >
            <ArrowLeft className="size-3.5" /> My Leads
          </Link>
          <div className="h-4 w-px bg-border hidden sm:block" />
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="size-11 rounded-xl bg-gradient-to-br from-accent/30 to-accent/5 border border-accent/20 grid place-items-center font-display font-bold text-sm text-accent shrink-0">
              {initials}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-display text-lg font-bold truncate">{name}</h1>
                <Badge className={`${stage.color} border-0 text-[10px] capitalize`}>{stage.label}</Badge>
                <Badge className={`${RISK_BADGE[riskLevel]} border-0 text-[10px] capitalize`}>{riskLevel} risk</Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5 flex flex-wrap gap-x-3 gap-y-0">
                {phone && <span>{phone}</span>}
                {profile.city && <span>{profile.city}</span>}
                <span className="inline-flex items-center gap-0.5">
                  <IndianRupee className="size-3" />
                  {purchase.price_paid} paid
                </span>
                {lead?.product_category && <span className="capitalize">{lead.product_category}</span>}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap ml-auto">
            <QuickBtn href={`tel:${phone}`} icon={Phone} label="Call" primary />
            <QuickBtn href={`https://wa.me/${phone.replace(/\D/g, "")}`} icon={MessageSquare} label="WA" external />
            <QuickBtn href={`mailto:${profile.email ?? ""}`} icon={Mail} label="Email" disabled={!profile.email} />
            <Button type="button" size="sm" variant="outline" className="h-8 text-xs" onClick={onAddNote}>
              <StickyNote className="size-3.5 mr-1" /> Note
            </Button>
            <Link
              to="/dashboard/my-leads/$id/apply"
              params={{ id: purchaseId }}
              className="inline-flex items-center h-8 px-3 rounded-md border border-border text-xs font-semibold hover:bg-secondary"
            >
              <FileText className="size-3.5 mr-1" /> Apply
            </Link>
            <Button type="button" size="sm" variant="outline" className="h-8 text-xs" disabled title="Assign from LOS Operations">
              <UserPlus className="size-3.5 mr-1" /> Banker
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <StatChip label="Eligibility" value={approval != null ? `${Math.round(approval)}%` : "—"} highlight />
          <StatChip label="Pending docs" value={String(pendingDocs)} warn={pendingDocs > 0} />
          <StatChip label="Lenders" value={String(activeLenders)} />
          <StatChip label="Follow-up" value={pendingFollowups ? "Due" : "OK"} warn={pendingFollowups} />
          <StatChip label="FOIR" value={eligibility?.metrics.foirPercent != null ? `${eligibility.metrics.foirPercent.toFixed(0)}%` : "—"} />
        </div>
      </div>
    </header>
  );
}

function QuickBtn({
  href,
  icon: Icon,
  label,
  primary,
  external,
  disabled,
}: {
  href: string;
  icon: typeof Phone;
  label: string;
  primary?: boolean;
  external?: boolean;
  disabled?: boolean;
}) {
  if (disabled) {
    return (
      <span className="inline-flex items-center h-8 px-2.5 rounded-md border border-border/50 text-xs text-muted-foreground opacity-50">
        <Icon className="size-3.5 mr-1" /> {label}
      </span>
    );
  }
  const cls = primary
    ? "inline-flex items-center h-8 px-2.5 rounded-md bg-accent text-accent-foreground text-xs font-semibold"
    : "inline-flex items-center h-8 px-2.5 rounded-md border border-border text-xs font-semibold hover:bg-secondary";
  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener" className={cls}>
        <Icon className="size-3.5 mr-1" /> {label}
      </a>
    );
  }
  return (
    <a href={href} className={cls}>
      <Icon className="size-3.5 mr-1" /> {label}
    </a>
  );
}

function StatChip({ label, value, warn, highlight }: { label: string; value: string; warn?: boolean; highlight?: boolean }) {
  return (
    <div
      className={`rounded-lg border px-2.5 py-1 text-[10px] ${
        warn ? "border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-200" : highlight ? "border-accent/30 bg-accent/5" : "border-border bg-secondary/30"
      }`}
    >
      <span className="text-muted-foreground uppercase font-bold tracking-wide">{label}</span>
      <span className="ml-1.5 font-bold">{value}</span>
    </div>
  );
}

