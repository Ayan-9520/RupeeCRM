import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { listMyLeads, patchMyLead } from "@/lib/python-api";
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
import { insertFollowup, loadFollowups, loadTimeline, type TimelineEntry } from "@/lib/customer-crm/phase3-api";
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

  const visibleNote = (note: Note) => !note.kind || note.kind === "note";

  const loadAll = useCallback(async () => {
    const [leadList, tl, fu] = await Promise.all([
      listMyLeads().catch(() => null),
      loadTimeline(purchaseId),
      loadFollowups(purchaseId),
    ]);
    const purchase = leadList?.items.find((item) => item.id === purchaseId);
    setNotes((purchase?.notes ?? []).filter(visibleNote));
    if (tl.error) toast.error(tl.error);
    if (fu.error) toast.error(fu.error);
    setTimeline(tl.entries);
    const today = new Date().toISOString().slice(0, 10);
    const due =
      (purchase?.next_followup_at && purchase.next_followup_at.slice(0, 10) <= today) ||
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
    try {
      const updated = await patchMyLead(purchaseId, { notes_text: txt });
      setNotes((updated.notes ?? []).filter(visibleNote));
      setNoteText("");
      toast.success("Note saved");
      void loadAll();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save note");
    } finally {
      setBusy(false);
    }
  };

  const saveFollowup = async () => {
    if (!user) return;
    setBusy(true);
    const iso = followupDate
      ? new Date(`${followupDate}T${followupTime || "10:00"}:00`).toISOString()
      : null;
    const detail = [outcome, nextAction, noteText.trim()].filter(Boolean).join(" · ");
    try {
      if (detail || followupDate) {
        const saved = await insertFollowup({
          customer_profile_id: profile.id,
          lead_purchase_id: purchaseId,
          dsa_id: user.id,
          followup_date: followupDate || null,
          followup_time: followupTime || null,
          priority,
          assigned_user_id: user.id,
          discussion_notes: detail || null,
          outcome: outcome || null,
          next_action: nextAction || null,
          completed: false,
          note_type: "other",
        });
        if (saved.error) {
          toast.error(saved.error.message);
          return;
        }
      }
      await patchMyLead(purchaseId, iso ? { next_followup_at: iso } : { clear_followup: true });
      toast.success("Follow-up saved");
      onFollowupSaved();
      void loadAll();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save follow-up");
    } finally {
      setBusy(false);
    }
  };

  const logCall = async () => {
    if (!user || !noteText.trim()) return;
    setBusy(true);
    try {
      await patchMyLead(purchaseId, { notes_text: `Call: ${noteText.trim()}` });
      setNoteText("");
      toast.success("Call logged");
      void loadAll();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not log call");
    } finally {
      setBusy(false);
    }
  };

  const merged = useMemo(() => {
    const items = timeline
      .map((t) => ({
        at: t.created_at,
        text: t.body ? (t.title ? `${t.title}: ${t.body}` : t.body) : (t.title ?? ""),
        type: t.activity_type ?? "note",
        id: t.id,
      }))
      .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
    if (filter === "all") return items;
    return items.filter((t) => t.type === filter);
  }, [timeline, filter]);

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
    <aside className="w-full xl:w-96 shrink-0 border-t xl:border-t-0 xl:border-l border-[#cfe6d6] bg-white xl:shadow-[-8px_0_24px_rgba(16,102,42,0.07)] flex flex-col ws-col">
      <div className="px-4 py-3 shrink-0 bg-gradient-to-r from-[#10662A] to-[#1b8a3d] text-white">
        <h3 className="font-display font-bold text-sm">Activity & Follow-up</h3>
        <p className="text-xs text-white/80 mt-0.5 capitalize flex flex-wrap items-center gap-1">
          {pipelineStage.replace(/_/g, " ")}
          {hasDueFollowup && (
            <Badge variant="outline" className="text-[10px] border-amber-300 bg-amber-100 text-amber-800">
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

      <div className="mx-4 mt-3 rounded-xl border border-[#cfe6d6] bg-[#EEF8F1] p-3 shrink-0">
        <p className="text-[10px] font-bold uppercase text-[#10662A] flex items-center gap-1 mb-1">
          <Bot className="size-3 text-accent" /> Suggested next step
        </p>
        <p className="text-xs leading-relaxed">{aiSuggestion ?? "Complete profile and schedule follow-up to improve conversion."}</p>
      </div>

      <button
        type="button"
        className="mt-3 flex items-center justify-between px-4 py-2.5 border-y border-[#e3f1e7] text-xs font-semibold text-[#10662A] hover:bg-[#f5fbf7] shrink-0"
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
                  outcome === chip ? "bg-[#10662A] text-white border-[#10662A]" : "border-[#cfe6d6] text-[#3d3550] hover:bg-[#EEF8F1]"
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

      <div className="px-4 py-2 border-b border-[#e3f1e7] bg-[#f8fcf9] flex items-center gap-2 shrink-0">
        <Filter className="size-3.5 text-[#10662A]" />
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
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#10662A]/80 mb-2 sticky top-0 bg-white/95 py-1 z-10">
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
