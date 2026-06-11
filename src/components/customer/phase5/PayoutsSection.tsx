import { useCallback, useEffect, useRef, useState } from "react";
import { Plus, Wallet, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SectionShell } from "../shared/SectionShell";
import { CrmFormGrid, type CrmFieldConfig } from "../shared/CrmFormGrid";
import { RepeatableBlock } from "../shared/RepeatableBlock";
import { PAYOUT_STATUSES, PAYOUT_TYPES } from "@/lib/customer-crm/phase5-constants";
import {
  deletePayout,
  insertPayout,
  loadPayouts,
  updatePayout,
  type CustomerPayout,
} from "@/lib/customer-crm/phase5-api";
import { toNumberOrNull } from "@/lib/customer-crm/normalize";
import { fmtInr } from "@/lib/customer-crm/finance-calculators";
import type { CustomerProfile } from "@/lib/customer-crm/types";
import { toast } from "sonner";

const FIELDS: CrmFieldConfig[] = [
  { key: "payout_status", label: "Status", type: "select", options: PAYOUT_STATUSES.map((s) => s.label) },
  { key: "payout_type", label: "Type", type: "select", options: [...PAYOUT_TYPES] },
  { key: "payout_amount", label: "Amount (₹)", type: "number" },
  { key: "expected_date", label: "Expected Date", type: "date" },
  { key: "received_date", label: "Received Date", type: "date" },
  { key: "payout_reference", label: "Reference" },
  { key: "payout_notes", label: "Notes", type: "textarea", colSpan: 2 },
];

function statusToDb(label: string) {
  const found = PAYOUT_STATUSES.find((s) => s.label === label);
  return found?.value ?? label.toLowerCase().replace(/\s+/g, "_");
}

function rowValues(r: CustomerPayout) {
  const st = PAYOUT_STATUSES.find((s) => s.value === r.payout_status);
  return { ...r, payout_status: st?.label ?? r.payout_status };
}

export function PayoutsSection({ profile, userId }: { profile: CustomerProfile; userId: string }) {
  const [rows, setRows] = useState<CustomerPayout[]>([]);
  const [loading, setLoading] = useState(true);
  const [migrationHint, setMigrationHint] = useState(false);
  const queues = useRef(new Map<string, Partial<CustomerPayout>>());
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const refresh = useCallback(async () => {
    setLoading(true);
    const res = await loadPayouts(profile.lead_purchase_id);
    setRows(res.rows);
    if (res.migrationRequired) setMigrationHint(true);
    setLoading(false);
  }, [profile.lead_purchase_id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const flush = async (id: string) => {
    const patch = queues.current.get(id);
    queues.current.delete(id);
    timers.current.delete(id);
    if (!patch) return;
    const { data, error } = await updatePayout(id, patch, {
      profileId: profile.id,
      purchaseId: profile.lead_purchase_id,
      dsaId: profile.dsa_id,
      userId,
    });
    if (error) toast.error(error.message);
    else if (data) setRows((p) => p.map((r) => (r.id === id ? (data as CustomerPayout) : r)));
  };

  const onChange = (row: CustomerPayout, key: string, value: unknown) => {
    let patch: Partial<CustomerPayout> = { [key]: value === "" ? null : value } as Partial<CustomerPayout>;
    if (key === "payout_status") patch = { payout_status: statusToDb(String(value)) };
    if (key === "payout_amount") patch = { payout_amount: toNumberOrNull(value) };
    setRows((p) => p.map((r) => (r.id === row.id ? { ...r, ...patch } : r)));
    queues.current.set(row.id, { ...(queues.current.get(row.id) ?? {}), ...patch });
    const t = timers.current.get(row.id);
    if (t) clearTimeout(t);
    timers.current.set(row.id, setTimeout(() => void flush(row.id), 650));
  };

  const onAdd = async () => {
    const { data, error } = await insertPayout(
      {
        customer_profile_id: profile.id,
        lead_purchase_id: profile.lead_purchase_id,
        lender_case_id: null,
        dsa_id: profile.dsa_id,
        payout_amount: null,
        payout_type: "commission",
        payout_status: "expected",
        expected_date: null,
        received_date: null,
        payout_reference: null,
        payout_notes: null,
        created_by: userId,
      },
      userId,
    );
    if (error) toast.error(error.message);
    else if (data) setRows((p) => [data as CustomerPayout, ...p]);
  };

  const received = rows.filter((r) => r.payout_status === "received").reduce((s, r) => s + (Number(r.payout_amount) || 0), 0);
  const expected = rows.reduce((s, r) => s + (Number(r.payout_amount) || 0), 0);
  const pending = rows.filter((r) => !["received", "rejected"].includes(r.payout_status)).length;

  return (
    <SectionShell
      title="Payout Ledger"
      description="Commission and incentive tracking"
      icon={Wallet}
      action={
        <Button type="button" size="sm" onClick={onAdd}>
          <Plus className="size-4 mr-1" /> Add Payout
        </Button>
      }
    >
      {migrationHint && (
        <p className="text-xs text-amber-700 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2 mb-4">
          Run migration <code className="text-[10px]">20260521100000_customer_los_phase5.sql</code> to persist payouts.
        </p>
      )}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          ["Expected", expected],
          ["Received", received],
          ["Pending rows", pending],
        ].map(([l, v]) => (
          <div key={l as string} className="rounded-xl border border-border bg-secondary/30 p-3">
            <div className="text-[10px] text-muted-foreground uppercase font-bold">{l}</div>
            <div className="font-bold text-sm">{typeof v === "number" && l !== "Pending rows" ? fmtInr(v) : v}</div>
          </div>
        ))}
      </div>
      {loading ? (
        <Loader2 className="size-6 animate-spin mx-auto py-8" />
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">No payout entries yet</p>
      ) : (
        <div className="space-y-4">
          {rows.map((row, i) => (
            <RepeatableBlock key={row.id} title="Payout" index={i} onRemove={() => deletePayout(row.id).then(refresh)}>
              <Badge variant="secondary" className="mb-3 capitalize">
                {row.payout_status.replace(/_/g, " ")}
              </Badge>
              <CrmFormGrid fields={FIELDS} values={rowValues(row)} onChange={(k, v) => onChange(row, k, v)} />
            </RepeatableBlock>
          ))}
        </div>
      )}
    </SectionShell>
  );
}




