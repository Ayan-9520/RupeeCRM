import { useCallback, useEffect, useState } from "react";
import { Plus, CheckSquare, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { SectionShell } from "../shared/SectionShell";
import { TASK_STATUSES, TASK_TYPES } from "@/lib/customer-crm/workflow-constants";
import { insertLosTask, loadLosTasks, updateLosTask, type LosTask } from "@/lib/customer-crm/phase4-api";
import type { CustomerProfile } from "@/lib/customer-crm/types";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";

const TYPE_LABELS: Record<string, string> = {
  collect_docs: "Collect docs",
  call_customer: "Call customer",
  bank_login: "Bank login",
  eligibility_check: "Eligibility check",
  verify_profile: "Verify profile",
  send_sanction: "Send sanction",
  disbursal_followup: "Disbursal follow-up",
  general: "General",
};

export function TasksSection({ profile }: { profile: CustomerProfile }) {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<LosTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    const res = await loadLosTasks(profile.lead_purchase_id);
    setTasks(res.rows);
    setLoading(false);
  }, [profile.lead_purchase_id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const addTask = async () => {
    if (!user || !title.trim()) return;
    const { error } = await insertLosTask({
      customer_profile_id: profile.id,
      lead_purchase_id: profile.lead_purchase_id,
      dsa_id: user.id,
      title: title.trim(),
      task_type: "general",
      assigned_user_id: user.id,
    });
    if (error) toast.error(error.message);
    else {
      setTitle("");
      refresh();
    }
  };

  const setStatus = async (task: LosTask, status: string) => {
    const { error } = await updateLosTask(task.id, { status: status as LosTask["status"] });
    if (error) toast.error(error.message);
    else refresh();
  };

  return (
    <SectionShell title="Tasks" description="LOS task engine with due dates" icon={CheckSquare}>
      <div className="flex gap-2 mb-4">
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="New task…" className="text-sm" />
        <Button type="button" size="sm" onClick={addTask}>
          <Plus className="size-4" />
        </Button>
      </div>
      {loading ? (
        <Loader2 className="size-6 animate-spin mx-auto py-6" />
      ) : tasks.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">No tasks</p>
      ) : (
        <ul className="space-y-2">
          {tasks.map((t) => (
            <li key={t.id} className="rounded-xl border border-border p-3 flex flex-wrap items-center gap-2">
              <div className="flex-1 min-w-[140px]">
                <p className="text-sm font-semibold">{t.title}</p>
                <p className="text-[10px] text-muted-foreground">{TYPE_LABELS[t.task_type] ?? t.task_type}</p>
              </div>
              <Select value={t.status} onValueChange={(v) => setStatus(t, v)}>
                <SelectTrigger className="h-8 w-[120px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TASK_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s.replace(/_/g, " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Badge variant="outline" className="text-[9px] capitalize">
                {t.status.replace(/_/g, " ")}
              </Badge>
            </li>
          ))}
        </ul>
      )}
    </SectionShell>
  );
}

