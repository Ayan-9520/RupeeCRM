import { useCallback, useEffect, useMemo, useState } from "react";
import { Shield, Loader2, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SectionShell } from "../shared/SectionShell";
import { loadAuditLogs, type AuditLogRow } from "@/lib/customer-crm/phase5-api";

const SECTIONS = ["All", "Disbursal", "Payout", "Pipeline", "Lender", "Documents", "Follow-up"];

export function AuditLogPanel({ purchaseId }: { purchaseId: string }) {
  const [rows, setRows] = useState<AuditLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [section, setSection] = useState("All");
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const res = await loadAuditLogs(purchaseId, { limit: 200 });
    setRows(res.rows);
    setLoading(false);
  }, [purchaseId]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (section !== "All" && r.section_name !== section) return false;
      if (!q) return true;
      const hay = `${r.action_type} ${r.section_name} ${r.field_name} ${r.old_value} ${r.new_value}`.toLowerCase();
      return hay.includes(q);
    });
  }, [rows, section, query]);

  return (
    <SectionShell title="Audit Trail" description="Immutable change log" icon={Shield}>
      <div className="flex flex-wrap gap-2 mb-4">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search audit…" className="pl-9" />
        </div>
        <Select value={section} onValueChange={setSection}>
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SECTIONS.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {loading ? (
        <Loader2 className="size-6 animate-spin mx-auto py-8" />
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">No audit entries</p>
      ) : (
        <ul className="space-y-2 max-h-[480px] overflow-y-auto">
          {filtered.map((r) => (
            <li key={r.id} className="rounded-lg border border-border px-3 py-2 text-sm">
              <div className="flex justify-between gap-2">
                <span className="font-semibold capitalize">{r.section_name ?? r.action_type}</span>
                <span className="text-[10px] text-muted-foreground shrink-0">
                  {new Date(r.created_at).toLocaleString("en-IN")}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {r.field_name
                  ? `${r.field_name}: ${r.old_value ?? "—"} → ${r.new_value ?? "—"}`
                  : r.new_value ?? r.action_type}
              </p>
            </li>
          ))}
        </ul>
      )}
    </SectionShell>
  );
}




