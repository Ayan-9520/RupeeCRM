import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Clock,
  FileUp,
  GitBranch,
  Loader2,
  Phone,
  MessageSquare,
  Banknote,
  CheckCircle,
  UserPlus,
  ListTodo,
  StickyNote,
  Search,
  Wallet,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SectionShell } from "../shared/SectionShell";
import { loadTimeline, type TimelineEntry } from "@/lib/customer-crm/phase3-api";
import { loadPipelineHistory } from "@/lib/customer-crm/phase4-api";
import { loadAuditLogs } from "@/lib/customer-crm/phase5-api";
import { TIMELINE_FILTERS } from "@/lib/customer-crm/phase5-constants";

const ICONS: Record<string, typeof Clock> = {
  call: Phone,
  whatsapp: MessageSquare,
  docs: FileUp,
  document: FileUp,
  login: GitBranch,
  sanction: Banknote,
  disbursal: Banknote,
  payout: Wallet,
  followup: Clock,
  task: ListTodo,
  note: StickyNote,
  banker: UserPlus,
  banker_assigned: UserPlus,
  stage_changed: GitBranch,
  disbursed: CheckCircle,
};

const COLORS: Record<string, string> = {
  call: "bg-blue-500/15 text-blue-600",
  whatsapp: "bg-emerald-500/15 text-emerald-700",
  docs: "bg-amber-500/15 text-amber-800",
  sanction: "bg-violet-500/15 text-violet-800",
  disbursal: "bg-green-500/15 text-green-700",
  payout: "bg-cyan-500/15 text-cyan-800",
  stage_changed: "bg-purple-500/15 text-purple-800",
  followup: "bg-orange-500/15 text-orange-800",
};

function dayKey(iso: string) {
  return iso.slice(0, 10);
}

export function AdvancedTimeline({ purchaseId }: { purchaseId: string }) {
  const [entries, setEntries] = useState<TimelineEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [tl, hist, audit] = await Promise.all([
      loadTimeline(purchaseId),
      loadPipelineHistory(purchaseId),
      loadAuditLogs(purchaseId, { limit: 50 }),
    ]);
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
      ...audit.rows.map((a) => ({
        id: `audit-${a.id}`,
        activity_type: a.action_type,
        title: a.section_name ?? "Audit",
        body: a.field_name ? `${a.field_name}: ${a.old_value ?? "—"} → ${a.new_value ?? "—"}` : (a.new_value ?? a.action_type),
        metadata: {},
        created_by: a.action_by,
        created_at: a.created_at,
      })),
    ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    setEntries(merged);
    setLoading(false);
  }, [purchaseId]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return entries.filter((e) => {
      if (filter !== "all" && e.activity_type !== filter) return false;
      if (!q) return true;
      return `${e.title} ${e.body} ${e.activity_type}`.toLowerCase().includes(q);
    });
  }, [entries, filter, query]);

  const grouped = useMemo(() => {
    const map = new Map<string, TimelineEntry[]>();
    for (const e of filtered) {
      const k = dayKey(e.created_at);
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(e);
    }
    return Array.from(map.entries()).sort(([a], [b]) => b.localeCompare(a));
  }, [filtered]);

  return (
    <SectionShell title="Activity Timeline" description="Grouped feed with filters" icon={Clock}>
      <div className="flex flex-wrap gap-2 mb-4">
        <div className="relative flex-1 min-w-[160px]">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search timeline…" className="pl-9 h-9" />
        </div>
        <div className="flex flex-wrap gap-1">
          {TIMELINE_FILTERS.map((f) => (
            <Button
              key={f}
              type="button"
              size="sm"
              variant={filter === f ? "default" : "outline"}
              className="text-[10px] h-7 capitalize"
              onClick={() => setFilter(f)}
            >
              {f.replace(/_/g, " ")}
            </Button>
          ))}
        </div>
      </div>
      {loading ? (
        <Loader2 className="size-6 animate-spin mx-auto py-8" />
      ) : grouped.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">No activity</p>
      ) : (
        <div className="space-y-6">
          {grouped.map(([day, items]) => (
            <div key={day}>
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
                {new Date(day + "T12:00:00").toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
              </p>
              <ol className="space-y-2">
                {items.map((e) => {
                  const Icon = ICONS[e.activity_type] ?? Clock;
                  const color = COLORS[e.activity_type] ?? "bg-secondary text-muted-foreground";
                  const open = expanded === e.id;
                  return (
                    <li key={e.id}>
                      <button
                        type="button"
                        onClick={() => setExpanded(open ? null : e.id)}
                        className="w-full text-left rounded-xl border border-border p-3 hover:bg-secondary/40 transition flex gap-3"
                      >
                        <div className={`size-9 rounded-full flex items-center justify-center shrink-0 ${color}`}>
                          <Icon className="size-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex justify-between gap-2">
                            <span className="text-sm font-semibold capitalize">{e.title ?? e.activity_type.replace(/_/g, " ")}</span>
                            <span className="text-[10px] text-muted-foreground shrink-0">
                              {new Date(e.created_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                            </span>
                          </div>
                          <p className={`text-xs text-muted-foreground mt-0.5 ${open ? "" : "line-clamp-2"}`}>{e.body}</p>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ol>
            </div>
          ))}
        </div>
      )}
    </SectionShell>
  );
}




