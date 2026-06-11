import { Suspense, lazy } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Bot } from "lucide-react";
import type { CustomerProfile, CustomerWorkspaceData } from "@/lib/customer-crm/types";
import type { EligibilityEngineResult } from "@/lib/customer-crm/eligibility-types";
import type { CustomerDocument } from "@/lib/customer-crm/phase3-api";

const AiFollowUpPanel = lazy(() => import("./AiFollowUpPanel").then((m) => ({ default: m.AiFollowUpPanel })));
const CommunicationHub = lazy(() => import("./CommunicationHub").then((m) => ({ default: m.CommunicationHub })));
const SlaTracker = lazy(() => import("./SlaTracker").then((m) => ({ default: m.SlaTracker })));
const Customer360View = lazy(() => import("./Customer360View").then((m) => ({ default: m.Customer360View })));

function TabFallback() {
  return (
    <div className="space-y-3 py-8">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-32 w-full" />
    </div>
  );
}

export function Phase6Hub({
  profile,
  workspace,
  eligibility,
  pipelineStage,
  pendingDocs,
  phone,
  documents,
}: {
  profile: CustomerProfile;
  workspace: CustomerWorkspaceData;
  eligibility: EligibilityEngineResult | null;
  pipelineStage: string;
  pendingDocs: number;
  phone: string;
  documents: CustomerDocument[];
}) {
  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center gap-2 bg-secondary/30">
        <Bot className="size-5 text-accent" />
        <div>
          <h2 className="font-display font-bold text-base">AI & Automation</h2>
          <p className="text-[10px] text-muted-foreground">Follow-ups · communications · SLA · 360° view</p>
        </div>
      </div>
      <Tabs defaultValue="ai" className="p-4">
        <TabsList className="flex flex-wrap h-auto gap-1 bg-secondary/50 p-1 mb-4">
          <TabsTrigger value="ai" className="text-xs">
            AI Follow-up
          </TabsTrigger>
          <TabsTrigger value="comms" className="text-xs">
            Communications
          </TabsTrigger>
          <TabsTrigger value="sla" className="text-xs">
            SLA / TAT
          </TabsTrigger>
          <TabsTrigger value="360" className="text-xs">
            360° View
          </TabsTrigger>
        </TabsList>
        <TabsContent value="ai" className="mt-0">
          <Suspense fallback={<TabFallback />}>
            <AiFollowUpPanel
              profile={profile}
              workspace={workspace}
              eligibility={eligibility}
              pipelineStage={pipelineStage}
              pendingDocs={pendingDocs}
            />
          </Suspense>
        </TabsContent>
        <TabsContent value="comms" className="mt-0">
          <Suspense fallback={<TabFallback />}>
            <CommunicationHub profile={profile} workspace={workspace} phone={phone} />
          </Suspense>
        </TabsContent>
        <TabsContent value="sla" className="mt-0">
          <Suspense fallback={<TabFallback />}>
            <SlaTracker profile={profile} pipelineStage={pipelineStage} />
          </Suspense>
        </TabsContent>
        <TabsContent value="360" className="mt-0">
          <Suspense fallback={<TabFallback />}>
            <Customer360View
              workspace={workspace}
              eligibility={eligibility}
              pipelineStage={pipelineStage}
              pendingDocs={pendingDocs}
            />
          </Suspense>
        </TabsContent>
      </Tabs>
    </div>
  );
}

