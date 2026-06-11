import { useCallback, useEffect, useRef, useState } from "react";
import { Plus, Building2, Loader2, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SectionShell } from "../shared/SectionShell";
import { CrmFormGrid, type CrmFieldConfig } from "../shared/CrmFormGrid";
import { RepeatableBlock } from "../shared/RepeatableBlock";
import { EmptyBlock } from "../shared/EmptyBlock";
import { LENDER_LOGIN_STATUSES } from "@/lib/customer-crm/workflow-constants";
import {
  deleteLenderCase,
  insertLenderCase,
  loadLenderCases,
  setBestOffer,
  updateLenderCase,
  type LenderCase,
} from "@/lib/customer-crm/phase4-api";
import { toNumberOrNull } from "@/lib/customer-crm/normalize";
import type { CustomerProfile } from "@/lib/customer-crm/types";
import { toast } from "sonner";

const FIELDS: CrmFieldConfig[] = [
  { key: "lender_name", label: "Lender / Bank" },
  { key: "branch", label: "Branch" },
  { key: "banker_name", label: "Banker Name" },
  { key: "banker_mobile", label: "Banker Mobile", type: "tel" },
  { key: "banker_email", label: "Banker Email", type: "email" },
  { key: "login_date", label: "Login Date", type: "date" },
  {
    key: "login_status",
    label: "Login Status",
    type: "select",
    options: LENDER_LOGIN_STATUSES.map((s) => s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())),
  },
  { key: "sanctioned_amount", label: "Sanction Amount (₹)", type: "number" },
  { key: "roi", label: "ROI (%)", type: "number" },
  { key: "tenure", label: "Tenure (months)", type: "number" },
  { key: "processing_fee", label: "Processing Fee (₹)", type: "number" },
  { key: "insurance_amount", label: "Insurance (₹)", type: "number" },
  { key: "disbursed_amount", label: "Disbursed (₹)", type: "number" },
  { key: "payout_expected", label: "Payout Expected (₹)", type: "number" },
  { key: "payout_received", label: "Payout Received (₹)", type: "number" },
  { key: "payout_status", label: "Payout Status", type: "select", options: ["pending", "partial", "received"] },
  { key: "rejection_reason", label: "Rejection Reason", type: "textarea", colSpan: 2 },
  { key: "remarks", label: "Remarks", type: "textarea", colSpan: 2 },
];

const NUM = new Set([
  "sanctioned_amount",
  "roi",
  "tenure",
  "processing_fee",
  "insurance_amount",
  "disbursed_amount",
  "payout_expected",
  "payout_received",
]);

function rowValues(r: LenderCase): Record<string, unknown> {
  return {
    ...r,
    login_status: (r.login_status ?? "draft").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
  };
}

function patchRow(_r: LenderCase, key: string, value: unknown): Partial<LenderCase> {
  if (key === "login_status" && typeof value === "string") {
    return { login_status: value.toLowerCase().replace(/\s+/g, "_") };
  }
  if (NUM.has(key)) return { [key]: toNumberOrNull(value) } as Partial<LenderCase>;
  return { [key]: value === "" ? null : value } as Partial<LenderCase>;
}

export function LenderCasesSection({
  profile,
  dsaId,
  onCountChange,
}: {
  profile: CustomerProfile;
  dsaId: string;
  onCountChange?: (n: number) => void;
}) {
  const [rows, setRows] = useState<LenderCase[]>([]);
  const [loading, setLoading] = useState(true);
  const queues = useRef(new Map<string, Partial<LenderCase>>());
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const refresh = useCallback(async () => {
    setLoading(true);
    const res = await loadLenderCases(profile.lead_purchase_id);
    setRows(res.rows);
    onCountChange?.(res.rows.filter((r) => !["closed", "rejected"].includes(r.login_status)).length);
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
    const { data, error } = await updateLenderCase(id, patch);
    if (error) toast.error(error.message);
    else if (data) setRows((p) => p.map((r) => (r.id === id ? (data as LenderCase) : r)));
  };

  const onChange = (row: LenderCase, key: string, value: unknown) => {
    const patch = patchRow(row, key, value);
    setRows((p) => p.map((r) => (r.id === row.id ? { ...r, ...patch } : r)));
    queues.current.set(row.id, { ...(queues.current.get(row.id) ?? {}), ...patch });
    const t = timers.current.get(row.id);
    if (t) clearTimeout(t);
    timers.current.set(row.id, setTimeout(() => void flush(row.id), 650));
  };

  const onAdd = async () => {
    const { data, error } = await insertLenderCase({
      customer_profile_id: profile.id,
      lead_purchase_id: profile.lead_purchase_id,
      dsa_id: dsaId,
      lender_name: null,
      branch: null,
      banker_name: null,
      banker_mobile: null,
      banker_email: null,
      login_date: null,
      login_status: "draft",
      sanctioned_amount: null,
      roi: null,
      tenure: null,
      processing_fee: null,
      insurance_amount: null,
      disbursed_amount: null,
      payout_expected: null,
      payout_received: null,
      payout_status: "pending",
      rejection_reason: null,
      remarks: null,
      is_best_offer: false,
      sort_order: rows.length,
      created_by: dsaId,
    });
    if (error) toast.error(error.message);
    else if (data) setRows((p) => [...p, data as LenderCase]);
  };

  const best = rows.find((r) => r.is_best_offer);

  return (
    <SectionShell
      title="Lender Cases"
      description="Multi-bank processing — compare offers"
      icon={Building2}
      action={
        <Button type="button" size="sm" onClick={onAdd}>
          <Plus className="size-4 mr-1" /> Add Lender
        </Button>
      }
    >
      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="size-6 animate-spin" />
        </div>
      ) : rows.length === 0 ? (
        <EmptyBlock message="No lenders added" hint="Add each bank where the case is logged in" />
      ) : (
        <>
          <div className="overflow-x-auto mb-6 rounded-xl border border-border">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b bg-secondary/40 text-left text-[10px] uppercase text-muted-foreground">
                  <th className="p-2">Lender</th>
                  <th className="p-2">Status</th>
                  <th className="p-2">Sanction</th>
                  <th className="p-2">ROI</th>
                  <th className="p-2">Payout</th>
                  <th className="p-2" />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className={`border-b ${r.is_best_offer ? "bg-accent/5" : ""}`}>
                    <td className="p-2 font-semibold">{r.lender_name ?? "—"}</td>
                    <td className="p-2 capitalize">{r.login_status.replace(/_/g, " ")}</td>
                    <td className="p-2">₹{Number(r.sanctioned_amount || 0).toLocaleString("en-IN")}</td>
                    <td className="p-2">{r.roi ?? "—"}%</td>
                    <td className="p-2 capitalize">{r.payout_status ?? "—"}</td>
                    <td className="p-2">
                      {r.is_best_offer ? (
                        <Badge className="text-[9px]">Best offer</Badge>
                      ) : (
                        <Button type="button" size="sm" variant="ghost" className="h-7 text-[10px]" onClick={() => setBestOffer(profile.lead_purchase_id, r.id).then(refresh)}>
                          <Star className="size-3" />
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {best && (
            <p className="text-xs text-accent font-semibold mb-4">
              Best offer: {best.lender_name} — ₹{Number(best.sanctioned_amount || 0).toLocaleString("en-IN")} @ {best.roi}%
            </p>
          )}
          <div className="space-y-4">
            {rows.map((row, i) => (
              <RepeatableBlock key={row.id} title="Lender" index={i} onRemove={() => deleteLenderCase(row.id).then(refresh)}>
                <CrmFormGrid fields={FIELDS} values={rowValues(row)} onChange={(k, v) => onChange(row, k, v)} />
              </RepeatableBlock>
            ))}
          </div>
        </>
      )}
    </SectionShell>
  );
}

