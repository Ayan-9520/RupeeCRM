import { useCallback, useEffect, useState } from "react";
import { CalendarClock, Loader2, MessageSquare, Phone, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SectionShell } from "../shared/SectionShell";
import { FOLLOWUP_NOTE_TYPES } from "@/lib/customer-crm/workflow-constants";
import { addTimelineEntry, insertFollowup, loadFollowups, type CustomerFollowup } from "@/lib/customer-crm/phase3-api";
import { supabase } from "@/integrations/supabase/client";
import type { CustomerProfile } from "@/lib/customer-crm/types";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";

export function FollowUpEngine({ profile }: { profile: CustomerProfile }) {
  const { user } = useAuth();
  const [rows, setRows] = useState<CustomerFollowup[]>([]);
  const [loading, setLoading] = useState(true);
  const [noteType, setNoteType] = useState<string>("call");
  const [notes, setNotes] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [priority, setPriority] = useState("medium");
  const [outcome, setOutcome] = useState("");
  const [nextAction, setNextAction] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    const res = await loadFollowups(profile.lead_purchase_id);
    setRows(res.rows);
    setLoading(false);
  }, [profile.lead_purchase_id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const latest = rows[0];

  const save = async () => {
    if (!user || !notes.trim()) return;
    await insertFollowup({
      customer_profile_id: profile.id,
      lead_purchase_id: profile.lead_purchase_id,
      dsa_id: user.id,
      followup_date: date || null,
      followup_time: time || null,
      priority,
      assigned_user_id: user.id,
      discussion_notes: notes.trim(),
      outcome: outcome || null,
      next_action: nextAction || null,
      completed: false,
      note_type: noteType,
    } as never);
    const iso = date ? new Date(`${date}T${time || "10:00"}`).toISOString() : null;
    if (iso) {
      await supabase.from("lead_purchases").update({ next_followup_at: iso }).eq("id", profile.lead_purchase_id);
    }
    await addTimelineEntry({
      customer_profile_id: profile.id,
      lead_purchase_id: profile.lead_purchase_id,
      dsa_id: user.id,
      activity_type: noteType,
      title: `${noteType} follow-up`,
      body: notes.trim(),
      metadata: { outcome, next_action: nextAction },
      created_by: user.id,
    });
    toast.success("Follow-up saved");
    setNotes("");
    refresh();
  };

  return (
    <SectionShell title="Follow-up Engine" icon={CalendarClock}>
      {latest && (
        <div className="mb-4 rounded-lg border border-accent/30 bg-accent/5 p-3 text-xs sticky top-0 z-10">
          <span className="font-bold text-accent">Latest: </span>
          {latest.discussion_notes?.slice(0, 120) ?? "—"}
          {latest.followup_date && (
            <span className="text-muted-foreground ml-2">· {latest.followup_date}</span>
          )}
        </div>
      )}
      <div className="grid sm:grid-cols-2 gap-3 mb-3">
        <Select value={noteType} onValueChange={setNoteType}>
          <SelectTrigger className="h-9 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FOLLOWUP_NOTE_TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="text-sm" />
        <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="text-sm" />
        <Input placeholder="Outcome" value={outcome} onChange={(e) => setOutcome(e.target.value)} className="text-sm sm:col-span-2" />
        <Input placeholder="Next action" value={nextAction} onChange={(e) => setNextAction(e.target.value)} className="text-sm sm:col-span-2" />
      </div>
      <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Call / WhatsApp / meeting notes…" rows={4} className="text-sm mb-3" />
      <Button type="button" onClick={save} disabled={!notes.trim()} className="w-full sm:w-auto">
        <Phone className="size-4 mr-1" /> Log follow-up
      </Button>
      {loading ? (
        <Loader2 className="size-5 animate-spin mx-auto mt-6" />
      ) : (
        <ul className="mt-6 space-y-2 max-h-48 overflow-y-auto">
          {rows.map((r) => (
            <li key={r.id} className="text-xs border-b border-border/60 pb-2">
              <span className="text-muted-foreground">{r.followup_date ?? "—"}</span> · {(r as { note_type?: string }).note_type ?? "note"}
              <p className="mt-0.5">{r.discussion_notes}</p>
            </li>
          ))}
        </ul>
      )}
    </SectionShell>
  );
}

