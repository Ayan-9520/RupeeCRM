import { Suspense, lazy } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Banknote, BarChart3 } from "lucide-react";
import type { CustomerProfile } from "@/lib/customer-crm/types";
import type { CustomerWorkspaceData } from "@/lib/customer-crm/types";
import type { EligibilityEngineResult } from "@/lib/customer-crm/eligibility-types";

const DisbursalsSection = lazy(() => import("./DisbursalsSection").then((m) => ({ default: m.DisbursalsSection })));
const PayoutsSection = lazy(() => import("./PayoutsSection").then((m) => ({ default: m.PayoutsSection })));
const LenderComparisonGrid = lazy(() => import("./LenderComparisonGrid").then((m) => ({ default: m.LenderComparisonGrid })));
const AdvancedTimeline = lazy(() => import("./AdvancedTimeline").then((m) => ({ default: m.AdvancedTimeline })));
const AuditLogPanel = lazy(() => import("./AuditLogPanel").then((m) => ({ default: m.AuditLogPanel })));
const CaseReportsSection = lazy(() => import("./CaseReportsSection").then((m) => ({ default: m.CaseReportsSection })));
const RiskEnginePanel = lazy(() => import("./RiskEnginePanel").then((m) => ({ default: m.RiskEnginePanel })));
const ExportToolbar = lazy(() => import("./ExportToolbar").then((m) => ({ default: m.ExportToolbar })));

function TabFallback() {
  return (
    <div className="space-y-3 py-8">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-32 w-full" />
    </div>
  );
}

export function Phase5Hub({
  profile,
  userId,
  workspace,
  eligibility,
  pipelineStage,
}: {
  profile: CustomerProfile;
  userId: string;
  workspace: CustomerWorkspaceData;
  eligibility: EligibilityEngineResult | null;
  pipelineStage: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center gap-2 bg-secondary/30">
        <Banknote className="size-5 text-accent" />
        <div>
          <h2 className="font-display font-bold text-base">Finance & Intelligence</h2>
          <p className="text-[10px] text-muted-foreground">Disbursals · payouts · audit · reports · risk</p>
        </div>
      </div>
      <Tabs defaultValue="disbursals" className="p-4">
        <TabsList className="flex flex-wrap h-auto gap-1 bg-secondary/50 p-1 mb-4">
          <TabsTrigger value="disbursals" className="text-xs">
            Disbursals
          </TabsTrigger>
          <TabsTrigger value="payouts" className="text-xs">
            Payouts
          </TabsTrigger>
          <TabsTrigger value="compare" className="text-xs">
            Compare
          </TabsTrigger>
          <TabsTrigger value="timeline" className="text-xs">
            Timeline
          </TabsTrigger>
          <TabsTrigger value="audit" className="text-xs">
            Audit
          </TabsTrigger>
          <TabsTrigger value="reports" className="text-xs">
            <BarChart3 className="size-3 mr-1 inline" /> Reports
          </TabsTrigger>
          <TabsTrigger value="risk" className="text-xs">
            Risk
          </TabsTrigger>
          <TabsTrigger value="export" className="text-xs">
            Export
          </TabsTrigger>
        </TabsList>
        <TabsContent value="disbursals" className="mt-0">
          <Suspense fallback={<TabFallback />}>
            <DisbursalsSection profile={profile} userId={userId} />
          </Suspense>
        </TabsContent>
        <TabsContent value="payouts" className="mt-0">
          <Suspense fallback={<TabFallback />}>
            <PayoutsSection profile={profile} userId={userId} />
          </Suspense>
        </TabsContent>
        <TabsContent value="compare" className="mt-0">
          <Suspense fallback={<TabFallback />}>
            <LenderComparisonGrid profile={profile} />
          </Suspense>
        </TabsContent>
        <TabsContent value="timeline" className="mt-0">
          <Suspense fallback={<TabFallback />}>
            <AdvancedTimeline purchaseId={profile.lead_purchase_id} />
          </Suspense>
        </TabsContent>
        <TabsContent value="audit" className="mt-0">
          <Suspense fallback={<TabFallback />}>
            <AuditLogPanel purchaseId={profile.lead_purchase_id} />
          </Suspense>
        </TabsContent>
        <TabsContent value="reports" className="mt-0">
          <Suspense fallback={<TabFallback />}>
            <CaseReportsSection profile={profile} />
          </Suspense>
        </TabsContent>
        <TabsContent value="risk" className="mt-0">
          <Suspense fallback={<TabFallback />}>
            <RiskEnginePanel workspace={workspace} eligibility={eligibility} />
          </Suspense>
        </TabsContent>
        <TabsContent value="export" className="mt-0">
          <Suspense fallback={<TabFallback />}>
            <ExportToolbar workspace={workspace} eligibility={eligibility} pipelineStage={pipelineStage} />
          </Suspense>
        </TabsContent>
      </Tabs>
    </div>
  );
}


