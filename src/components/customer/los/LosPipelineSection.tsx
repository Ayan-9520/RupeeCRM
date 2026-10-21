import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { GitBranch, Loader2, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SectionShell } from "../shared/SectionShell";
import { LOS_PIPELINE_STAGES, stageMeta } from "@/lib/customer-crm/workflow-constants";
import {
  ensureLosPipeline,
  loadPipelineHistory,
  updatePipelineStage,
  type LosPipeline,
  type PipelineHistoryRow,
} from "@/lib/customer-crm/phase4-api";
import type { CustomerProfile } from "@/lib/customer-crm/types";
import { toast } from "sonner";

export function LosPipelineSection({
  profile,
  onStageChange,
}: {
  profile: CustomerProfile;
  onStageChange?: (stage: string) => void;
}) {
  const { user } = useAuth();
  const [pipeline, setPipeline] = useState<LosPipeline | null>(null);
  const [history, setHistory] = useState<PipelineHistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const res = await ensureLosPipeline(profile.id, profile.lead_purchase_id, user.id);
    const hist = await loadPipelineHistory(profile.lead_purchase_id);
    setLoadError(res.error ?? hist.error ?? null);
    setPipeline(res.pipeline);
    setHistory(hist.rows);
    setLoading(false);
  }, [user, profile.id, profile.lead_purchase_id]);

  useEffect(() => {
    load();
  }, [load]);

  const onStage = async (stage: string) => {
    if (!pipeline || !user) return;
    setBusy(true);
    const { error } = await updatePipelineStage(pipeline, stage, user.id, profile.id);
    setBusy(false);
    if (error) toast.error(error);
    else {
      toast.success("Stage updated");
      onStageChange?.(stage);
      load();
    }
  };

  const meta = pipeline ? stageMeta(pipeline.current_stage) : stageMeta("lead_purchased");

  return (
    <SectionShell title="LOS Pipeline" description="Case stage tracking with audit history" icon={GitBranch}>
      {loadError && (
        <div className="mb-4 flex gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs">
          <AlertTriangle className="size-4 shrink-0" />
          {loadError}
        </div>
      )}
      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-3">
            <Badge className={`${meta.color} border-0 text-xs font-bold`}>{meta.label}</Badge>
            <Select value={pipeline?.current_stage ?? "lead_purchased"} onValueChange={onStage} disabled={busy}>
              <SelectTrigger className="w-[220px] h-9">
                <SelectValue placeholder="Change stage" />
              </SelectTrigger>
              <SelectContent>
                {LOS_PIPELINE_STAGES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {pipeline?.last_stage_changed_at && (
              <span className="text-[10px] text-muted-foreground ml-auto">
                Updated {new Date(pipeline.last_stage_changed_at).toLocaleString("en-IN")}
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {LOS_PIPELINE_STAGES.map((s) => (
              <button
                key={s.value}
                type="button"
                onClick={() => onStage(s.value)}
                className={`text-[9px] px-2 py-1 rounded-full font-semibold border transition ${
                  pipeline?.current_stage === s.value ? s.color + " ring-2 ring-accent/30" : "bg-secondary/50 text-muted-foreground"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
          <div>
            <h4 className="text-xs font-bold text-muted-foreground uppercase mb-2">Stage history</h4>
            {history.length === 0 ? (
              <p className="text-xs text-muted-foreground">No transitions yet</p>
            ) : (
              <ol className="space-y-2 border-l border-border ml-2 pl-4">
                {history.map((h) => (
                  <li key={h.id} className="text-xs">
                    <span className="text-muted-foreground">{new Date(h.created_at).toLocaleString("en-IN")}</span>
                    <p className="font-medium mt-0.5">
                      {h.from_stage ? `${h.from_stage.replace(/_/g, " ")} → ` : ""}
                      {h.to_stage.replace(/_/g, " ")}
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      )}
    </SectionShell>
  );
}

