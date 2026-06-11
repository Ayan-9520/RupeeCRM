import { useEffect, useMemo, useState } from "react";
import { Building2, Loader2, Star } from "lucide-react";
import { SectionShell } from "../shared/SectionShell";
import { loadLenderCases, type LenderCase } from "@/lib/customer-crm/phase4-api";
import { calculateEmi, fmtInr } from "@/lib/customer-crm/finance-calculators";
import { Badge } from "@/components/ui/badge";
import type { CustomerProfile } from "@/lib/customer-crm/types";

export function LenderComparisonGrid({ profile }: { profile: CustomerProfile }) {
  const [rows, setRows] = useState<LenderCase[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const res = await loadLenderCases(profile.lead_purchase_id);
      setRows(res.rows);
      setLoading(false);
    })();
  }, [profile.lead_purchase_id]);

  const highlights = useMemo(() => {
    const withRoi = rows.filter((r) => r.roi != null && Number(r.roi) > 0);
    const bestRoi = withRoi.length ? withRoi.reduce((a, b) => (Number(a.roi) < Number(b.roi) ? a : b)) : null;
    const highestSanction = rows.reduce(
      (best, r) => ((Number(r.sanctioned_amount) || 0) > (Number(best?.sanctioned_amount) || 0) ? r : best),
      null as LenderCase | null,
    );
    const bestPayout = rows.reduce(
      (best, r) => ((Number(r.payout_expected) || 0) > (Number(best?.payout_expected) || 0) ? r : best),
      null as LenderCase | null,
    );
    return { bestRoi, highestSanction, bestPayout };
  }, [rows]);

  return (
    <SectionShell title="Bank Offer Comparison" description="Side-by-side lender metrics" icon={Building2}>
      {loading ? (
        <Loader2 className="size-6 animate-spin mx-auto py-8" />
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">Add lender cases in LOS Operations</p>
      ) : (
        <div className="overflow-x-auto -mx-1">
          <table className="w-full text-xs min-w-[720px]">
            <thead>
              <tr className="border-b border-border text-muted-foreground text-left">
                <th className="py-2 pr-2 font-semibold">Lender</th>
                <th className="py-2 px-2 font-semibold">ROI</th>
                <th className="py-2 px-2 font-semibold">Tenure</th>
                <th className="py-2 px-2 font-semibold">EMI</th>
                <th className="py-2 px-2 font-semibold">Sanction</th>
                <th className="py-2 px-2 font-semibold">Proc. fee</th>
                <th className="py-2 px-2 font-semibold">Payout</th>
                <th className="py-2 px-2 font-semibold">Login</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const emi = calculateEmi(Number(r.sanctioned_amount) || 0, Number(r.roi) || 0, Number(r.tenure) || 0);
                const tags: string[] = [];
                if (highlights.bestRoi?.id === r.id) tags.push("Best ROI");
                if (highlights.highestSanction?.id === r.id) tags.push("Highest sanction");
                if (highlights.bestPayout?.id === r.id) tags.push("Best payout");
                return (
                  <tr key={r.id} className="border-b border-border/60 hover:bg-secondary/30">
                    <td className="py-2.5 pr-2">
                      <div className="font-semibold flex items-center gap-1">
                        {r.is_best_offer && <Star className="size-3 text-amber-500 fill-amber-500" />}
                        {r.lender_name ?? "—"}
                      </div>
                      {tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {tags.map((t) => (
                            <Badge key={t} variant="secondary" className="text-[9px] px-1 py-0">
                              {t}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="py-2.5 px-2">{r.roi != null ? `${r.roi}%` : "—"}</td>
                    <td className="py-2.5 px-2">{r.tenure ?? "—"} mo</td>
                    <td className="py-2.5 px-2">{fmtInr(emi)}</td>
                    <td className="py-2.5 px-2 font-medium">{fmtInr(r.sanctioned_amount)}</td>
                    <td className="py-2.5 px-2">{fmtInr(r.processing_fee)}</td>
                    <td className="py-2.5 px-2">{fmtInr(r.payout_expected)}</td>
                    <td className="py-2.5 px-2 capitalize">{r.login_status?.replace(/_/g, " ") ?? "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </SectionShell>
  );
}



