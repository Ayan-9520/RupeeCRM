import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LosPipelineSection } from "./LosPipelineSection";
import { LenderCasesSection } from "./LenderCasesSection";
import { BankerAssignmentPanel } from "./BankerAssignmentPanel";
import { TasksSection } from "./TasksSection";
import { SanctionDisbursalSection } from "./SanctionDisbursalSection";
import { JourneyTimeline } from "./JourneyTimeline";
import { FollowUpEngine } from "./FollowUpEngine";
import type { CustomerProfile } from "@/lib/customer-crm/types";
import { Workflow } from "lucide-react";

export function LosOperationsHub({
  profile,
  dsaId,
  onPipelineStage,
  onLenderCount,
}: {
  profile: CustomerProfile;
  dsaId: string;
  onPipelineStage?: (stage: string) => void;
  onLenderCount?: (n: number) => void;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center gap-2 bg-secondary/30">
        <Workflow className="size-5 text-accent" />
        <div>
          <h2 className="font-display font-bold text-base">LOS Operations</h2>
          <p className="text-[10px] text-muted-foreground">Pipeline · lenders · tasks · sanction</p>
        </div>
      </div>
      <Tabs defaultValue="pipeline" className="p-4">
        <TabsList className="flex flex-wrap h-auto gap-1 bg-secondary/50 p-1 mb-4">
          <TabsTrigger value="pipeline" className="text-xs">
            Pipeline
          </TabsTrigger>
          <TabsTrigger value="lenders" className="text-xs">
            Lenders
          </TabsTrigger>
          <TabsTrigger value="assignment" className="text-xs">
            Assignment
          </TabsTrigger>
          <TabsTrigger value="followups" className="text-xs">
            Follow-ups
          </TabsTrigger>
          <TabsTrigger value="tasks" className="text-xs">
            Tasks
          </TabsTrigger>
          <TabsTrigger value="sanction" className="text-xs">
            Sanction
          </TabsTrigger>
          <TabsTrigger value="timeline" className="text-xs">
            Journey
          </TabsTrigger>
        </TabsList>
        <TabsContent value="pipeline" className="mt-0">
          <LosPipelineSection profile={profile} onStageChange={onPipelineStage} />
        </TabsContent>
        <TabsContent value="lenders" className="mt-0">
          <LenderCasesSection profile={profile} dsaId={dsaId} onCountChange={onLenderCount} />
        </TabsContent>
        <TabsContent value="assignment" className="mt-0">
          <BankerAssignmentPanel profile={profile} />
        </TabsContent>
        <TabsContent value="followups" className="mt-0">
          <FollowUpEngine profile={profile} />
        </TabsContent>
        <TabsContent value="tasks" className="mt-0">
          <TasksSection profile={profile} />
        </TabsContent>
        <TabsContent value="sanction" className="mt-0">
          <SanctionDisbursalSection profile={profile} dsaId={dsaId} />
        </TabsContent>
        <TabsContent value="timeline" className="mt-0">
          <JourneyTimeline purchaseId={profile.lead_purchase_id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

