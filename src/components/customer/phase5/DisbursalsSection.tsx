import { useCallback, useEffect, useRef, useState } from "react";
import { Plus, Banknote, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SectionShell } from "../shared/SectionShell";
import { CrmFormGrid, type CrmFieldConfig } from "../shared/CrmFormGrid";
import { RepeatableBlock } from "../shared/RepeatableBlock";
import { DISBURSAL_STATUSES, disbursalStatusMeta } from "@/lib/customer-crm/phase5-constants";
import {
  deleteDisbursal,
  insertDisbursal,
  loadDisbursals,
  loadPayouts,
  summarizeFinance,
  updateDisbursal,
  type CustomerDisbursal,
} from "@/lib/customer-crm/phase5-api";
import { toNumberOrNull } from "@/lib/customer-crm/normalize";
import { fmtInr } from "@/lib/customer-crm/finance-calculators";
import type { CustomerProfile } from "@/lib/customer-crm/types";
import { toast } from "sonner";

const FIELDS: CrmFieldConfig[] = [
  {
    key: "disbursal_status",
    label: "Status",
    type: "select",
    options: DISBURSAL_STATUSES.map((s) => s.label),
  },
  { key: "sanctioned_amount", label: "Sanctioned (₹)", type: "number" },
  { key: "disbursed_amount", label: "Disbursed (₹)", type: "number" },
  { key: "roi", label: "ROI (%)", type: "number" },
  { key: "tenure", label: "Tenure (mo)", type: "number" },
  { key: "emi", label: "EMI (₹)", type: "number" },
  { key: "processing_fee", label: "Processing Fee", type: "number" },
  { key: "insurance_amount", label: "Insurance", type: "number" },
  { key: "deductions", label: "Deductions", type: "number" },
  { key: "net_disbursal", label: "Net Disbursal", type: "number", readOnly: true },
  { key: "payout_expected", label: "Payout Expected", type: "number" },
  { key: "payout_received", label: "Payout Received", type: "number" },
  { key: "payout_pending", label: "Payout Pending", type: "number", readOnly: true },
  { key: "disbursal_date", label: "Disbursal Date", type: "date" },
  { key: "utr_number", label: "UTR" },
  { key: "credited_bank_name", label: "Credited Bank" },
  { key: "credited_account_number", label: "Account No." },
  { key: "credited_ifsc", label: "IFSC" },
  { key: "first_emi_date", label: "First EMI", type: "date" },
  { key: "disbursal_notes", label: "Notes", type: "textarea", colSpan: 2 },
];

const NUM = new Set([
  "sanctioned_amount",
  "disbursed_amount",
  "roi",
  "tenure",
  "emi",
  "processing_fee",
  "insurance_amount",
  "deductions",
  "payout_expected",
  "payout_received",
]);

function statusToDb(label: string) {
  const found = DISBURSAL_STATUSES.find((s) => s.label === label);
  return found?.value ?? label.toLowerCase().replace(/\s+/g, "_");
}

function rowValues(r: CustomerDisbursal) {
  const meta = disbursalStatusMeta(r.disbursal_status);
  return {
    ...r,
    disbursal_status: meta.label,
  };
}

function patchRow(_r: CustomerDisbursal, key: string, value: unknown): Partial<CustomerDisbursal> {
  if (key === "disbursal_status") return { disbursal_status: statusToDb(String(value)) };
  if (NUM.has(key)) return { [key]: toNumberOrNull(value) } as Partial<CustomerDisbursal>;
  return { [key]: value === "" ? null : value } as Partial<CustomerDisbursal>;
}

export function DisbursalsSection({ profile, userId }: { profile: CustomerProfile; userId: string }) {
  const [rows, setRows] = useState<CustomerDisbursal[]>([]);
  const [payouts, setPayouts] = useState<Awaited<ReturnType<typeof loadPayouts>>["rows"]>([]);
  const [loading, setLoading] = useState(true);
  const [migrationHint, setMigrationHint] = useState(false);
  const queues = useRef(new Map<string, Partial<CustomerDisbursal>>());
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const refresh = useCallback(async () => {
    setLoading(true);
    const [d, p] = await Promise.all([loadDisbursals(profile.lead_purchase_id), loadPayouts(profile.lead_purchase_id)]);
    setRows(d.rows);
    setPayouts(p.rows);
    if (d.migrationRequired || p.migrationRequired) setMigrationHint(true);
    setLoading(false);
  }, [profile.lead_purchase_id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const flush = async (id: string, old: CustomerDisbursal) => {
    const patch = queues.current.get(id);
    queues.current.delete(id);
    timers.current.delete(id);
    if (!patch) return;
    const { data, error } = await updateDisbursal(id, patch, {
      profileId: profile.id,
      purchaseId: profile.lead_purchase_id,
      dsaId: profile.dsa_id,
      userId,
      old,
    });
    if (error) toast.error(error.message);
    else if (data) setRows((p) => p.map((r) => (r.id === id ? (data as CustomerDisbursal) : r)));
  };

  const onChange = (row: CustomerDisbursal, key: string, value: unknown) => {
    const patch = patchRow(row, key, value);
    setRows((p) => p.map((r) => (r.id === row.id ? { ...r, ...patch } : r)));
    queues.current.set(row.id, { ...(queues.current.get(row.id) ?? {}), ...patch });
    const t = timers.current.get(row.id);
    if (t) clearTimeout(t);
    timers.current.set(row.id, setTimeout(() => void flush(row.id, row), 650));
  };

  const onAdd = async () => {
    const { data, error } = await insertDisbursal(
      {
        customer_profile_id: profile.id,
        lead_purchase_id: profile.lead_purchase_id,
        lender_case_id: null,
        dsa_id: profile.dsa_id,
        disbursal_status: "pending",
        sanctioned_amount: null,
        disbursed_amount: null,
        net_disbursal: null,
        roi: null,
        tenure: null,
        emi: null,
        processing_fee: null,
        insurance_amount: null,
        deductions: null,
        payout_expected: null,
        payout_received: null,
        payout_pending: null,
        payout_status: "expected",
        disbursal_date: null,
        utr_number: null,
        credited_bank_name: null,
        credited_account_number: null,
        credited_ifsc: null,
        first_emi_date: null,
        disbursal_notes: null,
        created_by: userId,
      },
      userId,
    );
    if (error) toast.error(error.message);
    else if (data) setRows((p) => [data as CustomerDisbursal, ...p]);
  };

  const summary = summarizeFinance(rows, payouts);

  return (
    <SectionShell
      title="Disbursal Management"
      icon={Banknote}
      action={
        <Button type="button" size="sm" onClick={onAdd}>
          <Plus className="size-4 mr-1" /> Add Disbursal
        </Button>
      }
    >
      {migrationHint && (
        <p className="text-xs text-amber-700 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2 mb-4">
          Run migration <code className="text-[10px]">20260521100000_customer_los_phase5.sql</code> to persist disbursals.
        </p>
      )}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {[
          ["Sanction", summary.totalSanction],
          ["Disbursed", summary.totalDisbursed],
          ["Net", summary.totalNetDisbursal],
          ["Payout pend.", summary.totalPayoutPending],
        ].map(([l, v]) => (
          <div key={l as string} className="rounded-xl border border-border bg-secondary/30 p-3">
            <div className="text-[10px] text-muted-foreground uppercase font-bold">{l}</div>
            <div className="font-bold text-sm">{fmtInr(v as number)}</div>
          </div>
        ))}
      </div>
      {loading ? (
        <Loader2 className="size-6 animate-spin mx-auto py-8" />
      ) : (
        <div className="space-y-4">
          {rows.map((row, i) => {
            const st = disbursalStatusMeta(row.disbursal_status);
            return (
              <RepeatableBlock key={row.id} title="Disbursal" index={i} onRemove={() => deleteDisbursal(row.id).then(refresh)}>
                <Badge className={`mb-3 ${st.color} border-0`}>{st.label}</Badge>
                <CrmFormGrid fields={FIELDS} values={rowValues(row)} onChange={(k, v) => onChange(row, k, v)} />
              </RepeatableBlock>
            );
          })}
        </div>
      )}
    </SectionShell>
  );
}





