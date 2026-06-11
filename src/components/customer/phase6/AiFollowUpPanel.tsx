import { useCallback, useEffect, useState } from "react";
import { Bot, Loader2, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SectionShell } from "../shared/SectionShell";
import { generateAiInsights, generateCallNotes, generateMessageDraft } from "@/lib/customer-crm/ai-intelligence";
import { dismissAiInsight, loadAiInsights, persistAiInsights } from "@/lib/customer-crm/phase6-api";
import { loadLenderCases } from "@/lib/customer-crm/phase4-api";
import { loadFollowups } from "@/lib/customer-crm/phase3-api";
import type { CustomerProfile } from "@/lib/customer-crm/types";
import type { CustomerWorkspaceData } from "@/lib/customer-crm/types";
import type { EligibilityEngineResult } from "@/lib/customer-crm/eligibility-types";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import type { CommChannel } from "@/lib/customer-crm/phase6-constants";

export function AiFollowUpPanel({
  profile,
  workspace,
  eligibility,
  pipelineStage,
  pendingDocs,
}: {
  profile: CustomerProfile;
  workspace: CustomerWorkspaceData;
  eligibility: EligibilityEngineResult | null;
  pipelineStage: string;
  pendingDocs: number;
}) {
  const { user } = useAuth();
  const [insights, setInsights] = useState<Awaited<ReturnType<typeof loadAiInsights>>["rows"]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [draftChannel, setDraftChannel] = useState<CommChannel>("whatsapp");

  const loadOnly = useCallback(async () => {
    setLoading(true);
    const ins = await loadAiInsights(profile.lead_purchase_id);
    setInsights(ins.rows);
    setLoading(false);
  }, [profile.lead_purchase_id]);

  const refresh = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const [lenders, fu] = await Promise.all([
      loadLenderCases(profile.lead_purchase_id),
      loadFollowups(profile.lead_purchase_id),
    ]);
    const generated = generateAiInsights({
      workspace,
      eligibility,
      pipelineStage,
      pendingDocs,
      lenderCases: lenders.rows,
      latestFollowupNote: fu.rows[0]?.discussion_notes ?? undefined,
    });
    if (generated.length) {
      await persistAiInsights(profile.id, profile.lead_purchase_id, profile.dsa_id, user.id, generated);
    }
    await loadOnly();
  }, [profile, workspace, eligibility, pipelineStage, pendingDocs, user, loadOnly]);

  useEffect(() => {
    loadOnly();
  }, [loadOnly]);

  const genDraft = (ch: CommChannel, purpose: string) => {
    setDraftChannel(ch);
    setDraft(generateMessageDraft(ch, workspace, purpose));
  };

  return (
    <SectionShell title="AI Follow-up Engine" description="Smart suggestions & message drafts" icon={Bot}>
      <div className="flex flex-wrap gap-2 mb-4">
        <Button type="button" size="sm" variant="outline" onClick={() => genDraft("whatsapp", "followup")}>
          WhatsApp draft
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => genDraft("sms", "followup")}>
          SMS draft
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => setDraft(generateCallNotes(workspace, eligibility))}>
          Call notes
        </Button>
        <Button type="button" size="sm" onClick={refresh}>
          <Sparkles className="size-4 mr-1" /> Refresh AI
        </Button>
      </div>
      {draft && (
        <div className="mb-4 rounded-xl border border-accent/30 bg-accent/5 p-3 text-sm">
          <p className="text-[10px] font-bold uppercase text-accent mb-1">{draftChannel} draft</p>
          <pre className="whitespace-pre-wrap text-xs">{draft}</pre>
          <Button type="button" size="sm" variant="ghost" className="mt-2" onClick={() => navigator.clipboard.writeText(draft).then(() => toast.success("Copied"))}>
            Copy
          </Button>
        </div>
      )}
      {loading ? (
        <Loader2 className="size-6 animate-spin mx-auto py-8" />
      ) : insights.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">No AI suggestions yet — refresh to generate</p>
      ) : (
        <ul className="space-y-2">
          {insights.map((ins) => (
            <li key={ins.id} className="rounded-xl border border-border p-3 flex gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-sm">{ins.title}</span>
                  <Badge variant="secondary" className="text-[10px]">
                    P{ins.priority_score}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1">{ins.content}</p>
                <div className="flex flex-wrap gap-1 mt-2">
                  {ins.intent_tags?.map((t) => (
                    <Badge key={t} variant="outline" className="text-[9px] capitalize">
                      {t.replace(/_/g, " ")}
                    </Badge>
                  ))}
                </div>
              </div>
              <Button type="button" size="icon" variant="ghost" className="shrink-0" onClick={() => dismissAiInsight(ins.id).then(refresh)}>
                <X className="size-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </SectionShell>
  );
}


