import { useCallback, useEffect, useState } from "react";
import {
  Clock,
  FileUp,
  GitBranch,
  Loader2,
  Phone,
  ShoppingBag,
  UserPlus,
  Banknote,
  CheckCircle,
} from "lucide-react";
import { SectionShell } from "../shared/SectionShell";
import { loadTimeline, type TimelineEntry } from "@/lib/customer-crm/phase3-api";
import { loadPipelineHistory } from "@/lib/customer-crm/phase4-api";

const ICONS: Record<string, typeof Clock> = {
  stage_changed: GitBranch,
  document: FileUp,
  call: Phone,
  followup: Clock,
  note: Clock,
  purchased: ShoppingBag,
  banker_assigned: UserPlus,
  sanction: Banknote,
  disbursed: CheckCircle,
};

export function JourneyTimeline({ purchaseId }: { purchaseId: string }) {
  const [entries, setEntries] = useState<TimelineEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [tl, hist] = await Promise.all([loadTimeline(purchaseId), loadPipelineHistory(purchaseId)]);
    const merged: TimelineEntry[] = [
      ...tl.entries,
      ...hist.rows.map((h) => ({
        id: h.id,
        activity_type: "stage_changed",
        title: "Pipeline",
        body: `${h.from_stage ?? "—"} → ${h.to_stage}`,
        metadata: {},
        created_by: h.changed_by,
        created_at: h.created_at,
      })),
    ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    setEntries(merged);
    setLoading(false);
  }, [purchaseId]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <SectionShell title="Customer Journey" description="Chronological activity feed" icon={Clock}>
      {loading ? (
        <Loader2 className="size-6 animate-spin mx-auto py-8" />
      ) : entries.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">No activity</p>
      ) : (
        <ol className="space-y-3">
          {entries.map((e) => {
            const Icon = ICONS[e.activity_type] ?? Clock;
            const open = expanded === e.id;
            return (
              <li key={e.id}>
                <button
                  type="button"
                  onClick={() => setExpanded(open ? null : e.id)}
                  className="w-full text-left rounded-xl border border-border p-3 hover:bg-secondary/40 transition flex gap-3"
                >
                  <div className="size-9 rounded-full bg-accent/15 flex items-center justify-center shrink-0">
                    <Icon className="size-4 text-accent" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex justify-between gap-2">
                      <span className="text-sm font-semibold capitalize">{e.title ?? e.activity_type.replace(/_/g, " ")}</span>
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        {new Date(e.created_at).toLocaleString("en-IN")}
                      </span>
                    </div>
                    <p className={`text-xs text-muted-foreground mt-0.5 ${open ? "" : "line-clamp-1"}`}>{e.body}</p>
                  </div>
                </button>
              </li>
            );
          })}
        </ol>
      )}
    </SectionShell>
  );
}

