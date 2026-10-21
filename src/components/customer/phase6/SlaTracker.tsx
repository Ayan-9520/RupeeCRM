import { useEffect, useState } from "react";
import { Clock, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { SectionShell } from "../shared/SectionShell";
import { SLA_TYPES, SLA_STATUS_COLORS } from "@/lib/customer-crm/phase6-constants";
import { loadSlaEvents } from "@/lib/customer-crm/phase6-api";
import type { CustomerProfile } from "@/lib/customer-crm/types";

export function SlaTracker({ profile, pipelineStage }: { profile: CustomerProfile; pipelineStage: string }) {
  const [rows, setRows] = useState<Awaited<ReturnType<typeof loadSlaEvents>>["rows"]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const res = await loadSlaEvents(profile.lead_purchase_id);
      setRows(res.rows);
      setLoading(false);
    })();
  }, [profile.lead_purchase_id, pipelineStage]);

  return (
    <SectionShell title="SLA & TAT" description="Turnaround time monitoring" icon={Clock}>
      {loading ? (
        <Loader2 className="size-6 animate-spin mx-auto py-8" />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {SLA_TYPES.map((def) => {
            const row = rows.find((r) => r.sla_type === def.key);
            const status = row?.status;
            const color = status ? SLA_STATUS_COLORS[status] ?? SLA_STATUS_COLORS.on_track : "bg-secondary text-muted-foreground";
            return (
              <div key={def.key} className="rounded-xl border border-border p-3">
                <div className="flex justify-between items-start gap-2">
                  <p className="text-xs font-bold">{def.label}</p>
                  <Badge className={`${color} border-0 text-[9px] capitalize`}>{status ? status.replace(/_/g, " ") : "Not tracked"}</Badge>
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">Target: {def.hours}h</p>
                {row?.started_at && (
                  <p className="text-[10px] text-muted-foreground">Since {new Date(row.started_at).toLocaleDateString("en-IN")}</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </SectionShell>
  );
}

