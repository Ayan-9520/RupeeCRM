import { useCallback, useEffect, useState } from "react";
import { UserCog, Loader2 } from "lucide-react";
import { SectionShell } from "../shared/SectionShell";
import { CrmFormGrid, type CrmFieldConfig } from "../shared/CrmFormGrid";
import { useAuth } from "@/lib/auth-context";
import { ensureLosPipeline, updatePipelineAssignment, type LosPipeline } from "@/lib/customer-crm/phase4-api";
import type { CustomerProfile } from "@/lib/customer-crm/types";
import { toast } from "sonner";
import { useDebouncedCallback } from "@/hooks/useDebouncedCallback";

const FIELDS: CrmFieldConfig[] = [
  { key: "banker_name", label: "Banker Name" },
  { key: "banker_mobile", label: "Banker Mobile", type: "tel" },
  { key: "banker_email", label: "Banker Email", type: "email" },
  { key: "priority", label: "Priority", type: "select", options: ["low", "medium", "high", "urgent"] },
  { key: "sla_target_date", label: "SLA Target", type: "date" },
  { key: "reminder_at", label: "Reminder", type: "date" },
];

export function BankerAssignmentPanel({ profile }: { profile: CustomerProfile }) {
  const { user } = useAuth();
  const [pipeline, setPipeline] = useState<LosPipeline | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const res = await ensureLosPipeline(profile.id, profile.lead_purchase_id, user.id);
    setPipeline(res.pipeline);
    setLoading(false);
  }, [user, profile.id, profile.lead_purchase_id]);

  useEffect(() => {
    load();
  }, [load]);

  const save = useDebouncedCallback(async (patch: Partial<LosPipeline>) => {
    if (!pipeline) return;
    const next = { ...patch };
    if (user?.id && patch.case_owner_id === undefined) {
      next.assigned_dsa_id = user.id;
    }
    const { error } = await updatePipelineAssignment(pipeline.id, next);
    if (error) toast.error(error);
    else setPipeline((p) => (p ? { ...p, ...next } : p));
  }, 700);

  const onField = (key: string, value: unknown) => {
    const patch = { [key]: value === "" ? null : value } as Partial<LosPipeline>;
    if (key === "reminder_at" && value) {
      patch.reminder_at = new Date(String(value)).toISOString();
    }
    setPipeline((p) => (p ? { ...p, ...patch } : p));
    save(patch);
  };

  const transferOwner = () => {
    if (!user) return;
    onField("case_owner_id", user.id);
    toast.success("You are now case owner");
  };

  if (loading) {
    return (
      <SectionShell title="Banker Assignment" icon={UserCog}>
        <Loader2 className="size-6 animate-spin mx-auto py-8" />
      </SectionShell>
    );
  }

  return (
    <SectionShell title="Banker Assignment" description="RM / DSA ownership, SLA & reminders" icon={UserCog}>
      <CrmFormGrid
        fields={FIELDS}
        values={(pipeline ?? {}) as Record<string, unknown>}
        onChange={onField}
      />
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={transferOwner}
          className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-border hover:bg-secondary"
        >
          Assign case to me
        </button>
        <span className="text-[10px] text-muted-foreground self-center">
          Case owner: {pipeline?.case_owner_id ? pipeline.case_owner_id.slice(0, 8) + "…" : "Unassigned"}
        </span>
      </div>
    </SectionShell>
  );
}

