import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import { CalendarClock, Clock, Loader2, StickyNote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { Json } from "@/integrations/supabase/types";

type Note = { at: string; text: string; by?: string; kind?: string };

export function CustomerRightPanel({
  purchaseId,
  pipelineStage,
  nextFollowup,
  onFollowupSaved,
}: {
  purchaseId: string;
  pipelineStage: string;
  nextFollowup: string | null;
  onFollowupSaved: () => void;
}) {
  const { user } = useAuth();
  const [notes, setNotes] = useState<Note[]>([]);
  const [logs, setLogs] = useState<{ at: string; text: string }[]>([]);
  const [noteText, setNoteText] = useState("");
  const [followup, setFollowup] = useState(nextFollowup?.slice(0, 10) ?? "");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setFollowup(nextFollowup?.slice(0, 10) ?? "");
  }, [nextFollowup]);

  useEffect(() => {
    (async () => {
      const [p, l] = await Promise.all([
        supabase.from("lead_purchases").select("notes,created_at").eq("id", purchaseId).single(),
        supabase
          .from("case_status_logs")
          .select("from_stage,to_stage,created_at")
          .eq("lead_purchase_id", purchaseId)
          .order("created_at", { ascending: false })
          .limit(20),
      ]);
      const raw = p.data?.notes;
      setNotes(Array.isArray(raw) ? (raw as Note[]).filter((n) => !n.kind) : []);
      setLogs(
        (l.data ?? []).map((x) => ({
          at: x.created_at,
          text: `Stage: ${x.from_stage ? `${x.from_stage} → ` : ""}${x.to_stage}`,
        })),
      );
      if (p.data?.created_at) {
        setLogs((prev) => [{ at: p.data!.created_at, text: "Lead purchased" }, ...prev]);
      }
    })();
  }, [purchaseId]);

  const addNote = async () => {
    const txt = noteText.trim();
    if (!txt) return;
    setBusy(true);
    const { data: row } = await supabase.from("lead_purchases").select("notes").eq("id", purchaseId).single();
    const prev = Array.isArray(row?.notes) ? (row!.notes as Note[]) : [];
    const next = [...prev, { at: new Date().toISOString(), text: txt, by: user?.email }];
    const { error } = await supabase.from("lead_purchases").update({ notes: next as unknown as Json }).eq("id", purchaseId);
    setBusy(false);
    if (error) toast.error(error.message);
    else {
      setNotes(next.filter((n) => !n.kind));
      setNoteText("");
      toast.success("Note saved");
    }
  };

  const saveFollowup = async () => {
    setBusy(true);
    const { error } = await supabase
      .from("lead_purchases")
      .update({ next_followup_at: followup ? new Date(followup).toISOString() : null })
      .eq("id", purchaseId);
    setBusy(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Follow-up updated");
      onFollowupSaved();
    }
  };

  const timeline = [
    ...logs,
    ...notes.map((n) => ({ at: n.at, text: n.text, type: "note" as const })),
  ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  return (
    <aside className="w-full lg:w-80 xl:w-96 shrink-0 border-l border-border bg-card/50 flex flex-col min-h-0">
      <div className="p-4 border-b border-border">
        <h3 className="font-display font-bold text-sm">Timeline & Notes</h3>
        <p className="text-xs text-muted-foreground mt-0.5 capitalize">Stage: {pipelineStage.replace(/_/g, " ")}</p>
      </div>
      <div className="p-4 border-b border-border space-y-3">
        <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
          <CalendarClock className="size-3.5" /> Next follow-up
        </label>
        <div className="flex gap-2">
          <input type="date" value={followup} onChange={(e) => setFollowup(e.target.value)} className="input-base flex-1 text-sm" />
          <Button size="sm" onClick={saveFollowup} disabled={busy}>
            Save
          </Button>
        </div>
        <Textarea
          value={noteText}
          onChange={(e) => setNoteText(e.target.value)}
          placeholder="Add internal note…"
          rows={3}
          className="text-sm resize-none"
        />
        <Button size="sm" className="w-full" onClick={addNote} disabled={busy || !noteText.trim()}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : <StickyNote className="size-4 mr-1" />}
          Add note
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        {timeline.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-8">No activity yet</p>
        ) : (
          <ol className="space-y-3 border-l border-border ml-2 pl-4">
            {timeline.map((t, i) => (
              <li key={i} className="text-sm">
                <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <Clock className="size-3" />
                  {new Date(t.at).toLocaleString("en-IN")}
                </div>
                <p className="mt-0.5 whitespace-pre-wrap">{t.text}</p>
              </li>
            ))}
          </ol>
        )}
      </div>
    </aside>
  );
}
