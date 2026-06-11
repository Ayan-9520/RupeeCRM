import { useCallback, useEffect, useRef, useState } from "react";
import { Plus, Building2, Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectionShell } from "./shared/SectionShell";
import { CrmFormGrid, type CrmFieldConfig } from "./shared/CrmFormGrid";
import { RepeatableBlock } from "./shared/RepeatableBlock";
import { EmptyBlock } from "./shared/EmptyBlock";
import { BANK_LOGIN_STATUSES } from "@/lib/customer-crm/document-catalog";
import {
  deleteBankLogin,
  insertBankLogin,
  loadBankLogins,
  updateBankLogin,
  type BankLogin,
} from "@/lib/customer-crm/phase3-api";
import { toNumberOrNull } from "@/lib/customer-crm/normalize";
import type { CustomerProfile } from "@/lib/customer-crm/types";
import { toast } from "sonner";

const LOGIN_FIELDS: CrmFieldConfig[] = [
  { key: "bank_name", label: "Bank Name" },
  { key: "product", label: "Product" },
  { key: "login_date", label: "Login Date", type: "date" },
  { key: "login_amount", label: "Login Amount (₹)", type: "number" },
  { key: "roi_percent", label: "ROI (%)", type: "number" },
  { key: "tenure_months", label: "Tenure (months)", type: "number" },
  { key: "banker_name", label: "Banker Name" },
  { key: "banker_mobile", label: "Banker Mobile", type: "tel" },
  { key: "branch", label: "Branch" },
  {
    key: "login_status",
    label: "Login Status",
    type: "select",
    options: BANK_LOGIN_STATUSES.map((s) => s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())),
  },
  { key: "sanction_amount", label: "Sanction Amount (₹)", type: "number" },
  { key: "approved_amount", label: "Approved Amount (₹)", type: "number" },
  { key: "processing_fees", label: "Processing Fees (₹)", type: "number" },
  { key: "disbursal_status", label: "Disbursal Status" },
  { key: "expected_disbursal_date", label: "Expected Disbursal", type: "date" },
  { key: "rejection_reason", label: "Rejection Reason", type: "textarea", colSpan: 2 },
];

const NUM_KEYS = new Set([
  "login_amount",
  "roi_percent",
  "tenure_months",
  "sanction_amount",
  "approved_amount",
  "processing_fees",
]);

function statusToDb(label: string): string {
  return label.toLowerCase().replace(/\s+/g, "_");
}

function statusFromDb(db: string): string {
  return db.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function rowValues(row: BankLogin): Record<string, unknown> {
  return {
    ...row,
    login_status: statusFromDb(row.login_status),
  };
}

function patchRow(row: BankLogin, key: string, value: unknown): Partial<BankLogin> {
  if (key === "login_status" && typeof value === "string") {
    return { login_status: statusToDb(value) };
  }
  if (NUM_KEYS.has(key)) {
    return { [key]: toNumberOrNull(value) } as Partial<BankLogin>;
  }
  if (key === "tenure_months") {
    const n = toNumberOrNull(value);
    return { tenure_months: n != null ? Math.round(n) : null };
  }
  return { [key]: value === "" ? null : value } as Partial<BankLogin>;
}

export function BankLoginsSection({
  profile,
  dsaId,
  onCountChange,
}: {
  profile: CustomerProfile;
  dsaId: string;
  onCountChange?: (active: number) => void;
}) {
  const [rows, setRows] = useState<BankLogin[]>([]);
  const [loading, setLoading] = useState(true);
  const [migrationHint, setMigrationHint] = useState(false);
  const queues = useRef(new Map<string, Partial<BankLogin>>());
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const refresh = useCallback(async () => {
    setLoading(true);
    const res = await loadBankLogins(profile.lead_purchase_id);
    if (res.migrationRequired) setMigrationHint(true);
    setRows(res.rows);
    const active = res.rows.filter((r) => !["closed", "rejected"].includes(r.login_status)).length;
    onCountChange?.(active);
    setLoading(false);
  }, [profile.lead_purchase_id, onCountChange]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const flush = async (id: string) => {
    const patch = queues.current.get(id);
    queues.current.delete(id);
    timers.current.delete(id);
    if (!patch) return;
    const { data, error } = await updateBankLogin(id, patch);
    if (error) toast.error(error.message);
    else if (data) setRows((prev) => prev.map((r) => (r.id === id ? (data as BankLogin) : r)));
  };

  const onChange = (row: BankLogin, key: string, value: unknown) => {
    const patch = patchRow(row, key, value);
    setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, ...patch } : r)));
    const merged = { ...(queues.current.get(row.id) ?? {}), ...patch };
    queues.current.set(row.id, merged);
    const t = timers.current.get(row.id);
    if (t) clearTimeout(t);
    timers.current.set(row.id, setTimeout(() => void flush(row.id), 650));
  };

  const onAdd = async () => {
    const { data, error } = await insertBankLogin({
      customer_profile_id: profile.id,
      lead_purchase_id: profile.lead_purchase_id,
      dsa_id: dsaId,
      bank_name: null,
      product: null,
      login_date: null,
      login_amount: null,
      roi_percent: null,
      tenure_months: null,
      banker_name: null,
      banker_mobile: null,
      branch: null,
      login_status: "draft",
      sanction_amount: null,
      approved_amount: null,
      rejection_reason: null,
      processing_fees: null,
      disbursal_status: null,
      expected_disbursal_date: null,
      sort_order: rows.length,
    });
    if (error) {
      if (error.message.includes("does not exist")) setMigrationHint(true);
      toast.error(error.message);
      return;
    }
    if (data) setRows((prev) => [...prev, data as BankLogin]);
  };

  const onRemove = async (id: string) => {
    const { error } = await deleteBankLogin(id);
    if (error) toast.error(error.message);
    else setRows((prev) => prev.filter((r) => r.id !== id));
  };

  return (
    <SectionShell
      title="Bank Processing"
      description="Multiple bank logins — track login, sanction & disbursal"
      icon={Building2}
      action={
        <Button type="button" size="sm" onClick={onAdd}>
          <Plus className="size-4 mr-1" /> Add Bank Login
        </Button>
      }
    >
      {migrationHint && (
        <div className="mb-4 flex gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs">
          <AlertTriangle className="size-4 shrink-0" />
          Run Phase 3 migration for bank login tracking.
        </div>
      )}
      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : rows.length === 0 ? (
        <EmptyBlock message="No bank logins" hint="Add a row when you log the case with a lender" />
      ) : (
        <div className="space-y-4">
          {rows.map((row, i) => (
            <RepeatableBlock key={row.id} title="Bank Login" index={i} onRemove={() => onRemove(row.id)}>
              <CrmFormGrid fields={LOGIN_FIELDS} values={rowValues(row)} onChange={(k, v) => onChange(row, k, v)} />
            </RepeatableBlock>
          ))}
        </div>
      )}
    </SectionShell>
  );
}

