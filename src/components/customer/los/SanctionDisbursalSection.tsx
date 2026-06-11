import { useCallback, useEffect, useRef, useState } from "react";
import { Banknote, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectionShell } from "../shared/SectionShell";
import { CrmFormGrid, type CrmFieldConfig } from "../shared/CrmFormGrid";
import { loadSanctionRecords, upsertSanction, type SanctionDisbursal } from "@/lib/customer-crm/phase4-api";
import { toNumberOrNull } from "@/lib/customer-crm/normalize";
import type { CustomerProfile } from "@/lib/customer-crm/types";
import { toast } from "sonner";

const FIELDS: CrmFieldConfig[] = [
  { key: "sanction_amount", label: "Sanction Amount (₹)", type: "number" },
  { key: "final_roi", label: "Final ROI (%)", type: "number" },
  { key: "final_tenure", label: "Final Tenure (mo)", type: "number" },
  { key: "emi", label: "EMI (₹)", type: "number" },
  { key: "processing_fee", label: "Processing Fee (₹)", type: "number" },
  { key: "insurance_deduction", label: "Insurance Deduction (₹)", type: "number" },
  { key: "net_disbursal", label: "Net Disbursal (₹)", type: "number" },
  { key: "disbursal_date", label: "Disbursal Date", type: "date" },
  { key: "utr_number", label: "UTR Number" },
  { key: "bank_account_credited", label: "Account Credited", colSpan: 2 },
  { key: "payout_expected", label: "Payout Expected (₹)", type: "number" },
  { key: "payout_received", label: "Payout Received (₹)", type: "number" },
];

const NUM = new Set(FIELDS.filter((f) => f.type === "number").map((f) => f.key));

export function SanctionDisbursalSection({ profile, dsaId }: { profile: CustomerProfile; dsaId: string }) {
  const [row, setRow] = useState<SanctionDisbursal | null>(null);
  const [loading, setLoading] = useState(true);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  const refresh = useCallback(async () => {
    setLoading(true);
    const res = await loadSanctionRecords(profile.lead_purchase_id);
    setRow(res.rows[0] ?? null);
    setLoading(false);
  }, [profile.lead_purchase_id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const save = async (patch: Partial<SanctionDisbursal>) => {
    const base = row ?? {
      customer_profile_id: profile.id,
      lead_purchase_id: profile.lead_purchase_id,
      dsa_id: dsaId,
      lender_case_id: null,
    };
    const { data, error } = await upsertSanction({ ...base, ...patch, id: row?.id });
    if (error) toast.error(error.message);
    else if (data) setRow(data as SanctionDisbursal);
  };

  const onField = (key: string, value: unknown) => {
    const v = NUM.has(key) ? toNumberOrNull(value) : value === "" ? null : value;
    const patch = { [key]: v } as Partial<SanctionDisbursal>;
    setRow((r) => (r ? { ...r, ...patch } : ({ ...patch } as SanctionDisbursal)));
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void save(patch), 650);
  };

  const create = () => {
    void save({});
    toast.success("Sanction record created");
    refresh();
  };

  return (
    <SectionShell title="Sanction & Disbursal" icon={Banknote}>
      {loading ? (
        <Loader2 className="size-6 animate-spin mx-auto py-8" />
      ) : !row ? (
        <Button type="button" onClick={create}>
          <Plus className="size-4 mr-1" /> Add sanction record
        </Button>
      ) : (
        <CrmFormGrid fields={FIELDS} values={row as unknown as Record<string, unknown>} onChange={onField} />
      )}
    </SectionShell>
  );
}

