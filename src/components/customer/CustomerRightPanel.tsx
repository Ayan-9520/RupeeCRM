import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import {
  Bot,
  CalendarClock,
  ChevronDown,
  ChevronRight,
  Clock,
  Filter,
  Loader2,
  Phone,
  StickyNote,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Json } from "@/integrations/supabase/types";
import {
  addTimelineEntry,
  insertFollowup,
  loadFollowups,
  loadTimeline,
  type TimelineEntry,
} from "@/lib/customer-crm/phase3-api";
import type { CustomerProfile } from "@/lib/customer-crm/types";

type Note = { at: string; text: string; by?: string; kind?: string };

const OUTCOME_CHIPS = ["Connected", "Callback", "Not reachable", "Interested", "Not interested", "Docs pending"] as const;

const TYPE_STYLES: Record<string, string> = {
  note: "bg-blue-500",
  call: "bg-emerald-500",
  followup: "bg-amber-500",
  stage: "bg-violet-500",
  email: "bg-cyan-500",
  whatsapp: "bg-green-600",
};

export function CustomerRightPanel({
  purchaseId,
  profile,
  pipelineStage,
  nextFollowup,
  onFollowupSaved,
  focusNote,
  aiSuggestion,
}: {
  purchaseId: string;
  profile: CustomerProfile;
  pipelineStage: string;
  nextFollowup: string | null;
  onFollowupSaved: () => void;
  focusNote?: boolean;
  aiSuggestion?: string;
}) {
  const { user } = useAuth();
  const [notes, setNotes] = useState<Note[]>([]);
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [logs, setLogs] = useState<{ at: string; text: string }[]>([]);
  const [noteText, setNoteText] = useState("");
  const [followupDate, setFollowupDate] = useState(nextFollowup?.slice(0, 10) ?? "");
  const [followupTime, setFollowupTime] = useState("10:00");
  const [priority, setPriority] = useState("medium");
  const [outcome, setOutcome] = useState("");
  const [nextAction, setNextAction] = useState("");
  const [busy, setBusy] = useState(false);
  const [hasDueFollowup, setHasDueFollowup] = useState(false);
  const [filter, setFilter] = useState<string>("all");
  const [formOpen, setFormOpen] = useState(true);

  useEffect(() => {
    setFollowupDate(nextFollowup?.slice(0, 10) ?? "");
  }, [nextFollowup]);

  useEffect(() => {
    if (focusNote) setFormOpen(true);
  }, [focusNote]);

  const loadAll = useCallback(async () => {
    const [p, l, tl, fu] = await Promise.all([
      supabase.from("lead_purchases").select("notes,created_at").eq("id", purchaseId).single(),
      supabase
        .from("case_status_logs")
        .select("from_stage,to_stage,created_at")
        .eq("lead_purchase_id", purchaseId)
        .order("created_at", { ascending: false })
        .limit(20),
      loadTimeline(purchaseId),
      loadFollowups(purchaseId),
    ]);
    const raw = p.data?.notes;
    setNotes(Array.isArray(raw) ? (raw as Note[]).filter((n) => !n.kind) : []);
    setTimeline(tl.entries);
    setLogs(
      (l.data ?? []).map((x) => ({
        at: x.created_at,
        text: `Stage: ${x.from_stage ? `${x.from_stage} → ` : ""}${x.to_stage}`,
      })),
    );
    if (p.data?.created_at) {
      setLogs((prev) => [{ at: p.data!.created_at, text: "Lead purchased" }, ...prev]);
    }
    const today = new Date().toISOString().slice(0, 10);
    const due =
      (nextFollowup && nextFollowup.slice(0, 10) <= today) ||
      fu.rows.some((f) => !f.completed && f.followup_date && f.followup_date <= today);
    setHasDueFollowup(Boolean(due));
  }, [purchaseId, nextFollowup]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const pinnedNote = notes.length > 0 ? [...notes].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())[0] : null;

  const addNote = async () => {
    const txt = noteText.trim();
    if (!txt || !user) return;
    setBusy(true);
    const { data: row } = await supabase.from("lead_purchases").select("notes").eq("id", purchaseId).single();
    const prev = Array.isArray(row?.notes) ? (row!.notes as Note[]) : [];
    const next = [...prev, { at: new Date().toISOString(), text: txt, by: user.email }];
    const { error } = await supabase.from("lead_purchases").update({ notes: next as unknown as Json }).eq("id", purchaseId);
    if (!error && user) {
      await addTimelineEntry({
        customer_profile_id: profile.id,
        lead_purchase_id: purchaseId,
        dsa_id: user.id,
        activity_type: "note",
        title: "Note",
        body: txt,
        created_by: user.id,
      });
    }
    setBusy(false);
    if (error) toast.error(error.message);
    else {
      setNotes(next.filter((n) => !n.kind));
      setNoteText("");
      toast.success("Note saved");
      loadAll();
    }
  };

  const saveFollowup = async () => {
    if (!user) return;
    setBusy(true);
    const iso = followupDate
      ? new Date(`${followupDate}T${followupTime || "10:00"}:00`).toISOString()
      : null;
    const { error } = await supabase.from("lead_purchases").update({ next_followup_at: iso }).eq("id", purchaseId);
    if (!error) {
      await insertFollowup({
        customer_profile_id: profile.id,
        lead_purchase_id: purchaseId,
        dsa_id: user.id,
        followup_date: followupDate || null,
        followup_time: followupTime || null,
        priority,
        assigned_user_id: user.id,
        discussion_notes: noteText.trim() || null,
        outcome: outcome || null,
        next_action: nextAction || null,
        completed: false,
      });
      await addTimelineEntry({
        customer_profile_id: profile.id,
        lead_purchase_id: purchaseId,
        dsa_id: user.id,
        activity_type: "followup",
        title: "Follow-up scheduled",
        body: [followupDate, outcome, nextAction].filter(Boolean).join(" · "),
        created_by: user.id,
      });
    }
    setBusy(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Follow-up saved");
      onFollowupSaved();
      loadAll();
    }
  };

  const logCall = async () => {
    if (!user || !noteText.trim()) return;
    setBusy(true);
    await addTimelineEntry({
      customer_profile_id: profile.id,
      lead_purchase_id: purchaseId,
      dsa_id: user.id,
      activity_type: "call",
      title: "Call log",
      body: noteText.trim(),
      created_by: user.id,
    });
    setBusy(false);
    setNoteText("");
    toast.success("Call logged");
    loadAll();
  };

  const merged = useMemo(() => {
    const items = [
      ...timeline.map((t) => ({
        at: t.created_at,
        text: t.body ? (t.title ? `${t.title}: ${t.body}` : t.body) : (t.title ?? ""),
        type: t.activity_type ?? "note",
        id: t.id,
      })),
      ...logs.map((l, i) => ({ ...l, type: "stage", id: `log-${i}` })),
      ...notes.map((n, i) => ({ at: n.at, text: n.text, type: "note", id: `note-${i}` })),
    ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
    if (filter === "all") return items;
    return items.filter((t) => t.type === filter);
  }, [timeline, logs, notes, filter]);

  const groupedByDay = useMemo(() => {
    const map = new Map<string, typeof merged>();
    for (const item of merged) {
      const day = new Date(item.at).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
      const list = map.get(day) ?? [];
      list.push(item);
      map.set(day, list);
    }
    return [...map.entries()];
  }, [merged]);

  return (
    <aside className="w-full lg:w-[min(100%,22rem)] xl:w-96 shrink-0 border-t lg:border-t-0 lg:border-l border-border bg-card/60 flex flex-col lg:sticky lg:top-[8.5rem] lg:self-start lg:max-h-[calc(100vh-9.5rem)]">
      <div className="p-4 border-b border-border shrink-0">
        <h3 className="font-display font-bold text-sm">Activity & Follow-up</h3>
        <p className="text-xs text-muted-foreground mt-0.5 capitalize flex flex-wrap items-center gap-1">
          {pipelineStage.replace(/_/g, " ")}
          {hasDueFollowup && (
            <Badge variant="outline" className="text-[10px] border-amber-500/50 text-amber-700 dark:text-amber-300">
              Due today
            </Badge>
          )}
        </p>
      </div>

      {pinnedNote && (
        <div className="mx-4 mt-3 rounded-xl border border-accent/25 bg-accent/5 p-3 shrink-0">
          <p className="text-[10px] font-bold uppercase text-accent mb-1 flex items-center gap-1">
            <StickyNote className="size-3" /> Latest note
          </p>
          <p className="text-xs whitespace-pre-wrap line-clamp-4">{pinnedNote.text}</p>
          <p className="text-[10px] text-muted-foreground mt-1">
            {new Date(pinnedNote.at).toLocaleString("en-IN")}
          </p>
        </div>
      )}

      <div className="mx-4 mt-3 rounded-xl border border-border bg-secondary/30 p-3 shrink-0">
        <p className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-1 mb-1">
          <Bot className="size-3 text-accent" /> Suggested next step
        </p>
        <p className="text-xs leading-relaxed">{aiSuggestion ?? "Complete profile and schedule follow-up to improve conversion."}</p>
      </div>

      <button
        type="button"
        className="flex items-center justify-between px-4 py-2.5 border-b border-border text-xs font-semibold hover:bg-secondary/40 shrink-0"
        onClick={() => setFormOpen((o) => !o)}
      >
        <span className="flex items-center gap-1.5">
          <CalendarClock className="size-3.5" /> Schedule follow-up
        </span>
        {formOpen ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
      </button>

      {formOpen && (
        <div className="p-4 border-b border-border space-y-3 shrink-0 max-h-[50vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">Date</Label>
              <Input type="date" value={followupDate} onChange={(e) => setFollowupDate(e.target.value)} className="h-9 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">Time</Label>
              <Input type="time" value={followupTime} onChange={(e) => setFollowupTime(e.target.value)} className="h-9 text-sm" />
            </div>
          </div>
          <Select value={priority} onValueChange={setPriority}>
            <SelectTrigger className="h-9 text-xs">
              <SelectValue placeholder="Priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="high">High</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex flex-wrap gap-1">
            {OUTCOME_CHIPS.map((chip) => (
              <button
                key={chip}
                type="button"
                onClick={() => setOutcome(chip)}
                className={`text-[10px] px-2 py-0.5 rounded-full border transition ${
                  outcome === chip ? "bg-accent text-accent-foreground border-accent" : "border-border hover:bg-secondary"
                }`}
              >
                {chip}
              </button>
            ))}
          </div>
          <Input placeholder="Next action" value={nextAction} onChange={(e) => setNextAction(e.target.value)} className="h-9 text-sm" />
          <Textarea
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder="Discussion notes / call summary…"
            rows={4}
            className="text-sm resize-none min-h-[88px]"
          />
          <div className="flex gap-2">
            <Button size="sm" className="flex-1 h-9" onClick={saveFollowup} disabled={busy}>
              {busy ? <Loader2 className="size-3.5 animate-spin" /> : "Save follow-up"}
            </Button>
            <Button size="sm" variant="outline" className="h-9 px-2.5" onClick={logCall} disabled={busy || !noteText.trim()} title="Log call">
              <Phone className="size-3.5" />
            </Button>
          </div>
          <Button size="sm" variant="secondary" className="w-full h-9" onClick={addNote} disabled={busy || !noteText.trim()}>
            <StickyNote className="size-3.5 mr-1" /> Add note only
          </Button>
        </div>
      )}

      <div className="px-4 py-2 border-b border-border flex items-center gap-2 shrink-0">
        <Filter className="size-3.5 text-muted-foreground" />
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="text-xs bg-transparent border-0 font-medium focus:outline-none"
        >
          <option value="all">All activity</option>
          <option value="note">Notes</option>
          <option value="call">Calls</option>
          <option value="followup">Follow-ups</option>
          <option value="stage">Stage changes</option>
        </select>
      </div>

      <div className="flex-1 overflow-y-auto p-4 min-h-[160px]">
        {groupedByDay.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-8">No activity yet</p>
        ) : (
          <div className="space-y-5">
            {groupedByDay.map(([day, items]) => (
              <div key={day}>
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2 sticky top-0 bg-card/95 py-1 z-10">
                  {day}
                </p>
                <ol className="space-y-3">
                  {items.map((t) => (
                    <li key={t.id} className="relative pl-5">
                      <span
                        className={`absolute left-0 top-1.5 size-2 rounded-full ${TYPE_STYLES[t.type] ?? "bg-muted-foreground"}`}
                      />
                      <div className="text-[10px] text-muted-foreground flex items-center gap-1 capitalize">
                        <Clock className="size-3" />
                        {new Date(t.at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })} · {t.type}
                      </div>
                      <p className="text-xs mt-0.5 whitespace-pre-wrap leading-relaxed">{t.text}</p>
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}
