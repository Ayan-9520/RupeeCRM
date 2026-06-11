import { useMemo, useState } from "react";
import { Bot, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { buildAssistantReply } from "@/lib/customer-crm/ai-intelligence";
import { loadLenderCases } from "@/lib/customer-crm/phase4-api";
import { useEffect } from "react";
import type { CustomerWorkspaceData } from "@/lib/customer-crm/types";
import type { EligibilityEngineResult } from "@/lib/customer-crm/eligibility-types";
import type { CustomerDocument } from "@/lib/customer-crm/phase3-api";

export function CrmAssistant({
  workspace,
  eligibility,
  pipelineStage,
  pendingDocs,
  documents,
}: {
  workspace: CustomerWorkspaceData;
  eligibility: EligibilityEngineResult | null;
  pipelineStage: string;
  pendingDocs: number;
  documents: CustomerDocument[];
}) {
  const [open, setOpen] = useState(false);
  const [lenders, setLenders] = useState<Awaited<ReturnType<typeof loadLenderCases>>["rows"]>([]);

  useEffect(() => {
    loadLenderCases(workspace.profile.lead_purchase_id).then((r) => setLenders(r.rows));
  }, [workspace.profile.lead_purchase_id]);

  const reply = useMemo(
    () =>
      buildAssistantReply({
        workspace,
        eligibility,
        pipelineStage,
        pendingDocs,
        lenderCases: lenders,
        documents,
      }),
    [workspace, eligibility, pipelineStage, pendingDocs, lenders, documents],
  );

  return (
    <div className="fixed bottom-[4.5rem] right-4 z-30 max-w-sm print:hidden">
      {open && (
        <div className="mb-2 rounded-2xl border border-accent/30 bg-card shadow-xl p-4 max-h-[60vh] overflow-y-auto">
          <div className="flex items-center gap-2 mb-2">
            <Bot className="size-5 text-accent" />
            <h3 className="font-display font-bold text-sm">CRM Assistant</h3>
          </div>
          <p className="text-xs text-muted-foreground mb-3">{reply.summary}</p>
          <p className="text-xs mb-2">
            <span className="font-semibold">Approval:</span> {Math.round(reply.approvalProbability)}%
          </p>
          <p className="text-xs text-amber-800 dark:text-amber-400 mb-2">{reply.riskNote}</p>
          <p className="text-xs mb-2">{reply.lenderTip}</p>
          {reply.missingDocs.length > 0 && (
            <p className="text-xs mb-2">
              <span className="font-semibold">Missing docs:</span> {reply.missingDocs.join(", ")}
            </p>
          )}
          <ul className="text-xs space-y-1">
            {reply.nextActions.map((a) => (
              <li key={a}>• {a}</li>
            ))}
          </ul>
        </div>
      )}
      <Button
        type="button"
        size="lg"
        className="rounded-full shadow-lg h-12 px-4"
        onClick={() => setOpen((o) => !o)}
      >
        <Bot className="size-5 mr-2" />
        AI Assistant
        {open ? <ChevronDown className="size-4 ml-1" /> : <ChevronUp className="size-4 ml-1" />}
      </Button>
    </div>
  );
}

