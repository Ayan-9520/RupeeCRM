import { useEffect, useState, memo } from "react";
import { BarChart3, Loader2 } from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { SectionShell } from "../shared/SectionShell";
import { loadDisbursals, loadPayouts, summarizeFinance } from "@/lib/customer-crm/phase5-api";
import { loadLenderCases } from "@/lib/customer-crm/phase4-api";
import { fmtInr } from "@/lib/customer-crm/finance-calculators";
import type { CustomerProfile } from "@/lib/customer-crm/types";

const PIE_COLORS = ["hsl(var(--accent))", "#8b5cf6", "#f59e0b", "#10b981"];

export const CaseReportsSection = memo(function CaseReportsSection({ profile }: { profile: CustomerProfile }) {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState({ sanction: 0, disbursed: 0, payout: 0, pending: 0 });
  const [lenderBars, setLenderBars] = useState<{ name: string; sanction: number }[]>([]);
  const [statusPie, setStatusPie] = useState<{ name: string; value: number }[]>([]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [d, p, l] = await Promise.all([
        loadDisbursals(profile.lead_purchase_id),
        loadPayouts(profile.lead_purchase_id),
        loadLenderCases(profile.lead_purchase_id),
      ]);
      const fin = summarizeFinance(d.rows, p.rows);
      setSummary({
        sanction: fin.totalSanction,
        disbursed: fin.totalDisbursed,
        payout: fin.totalPayoutReceived,
        pending: fin.totalPayoutPending,
      });
      setLenderBars(
        l.rows.map((r) => ({
          name: (r.lender_name ?? "Lender").slice(0, 12),
          sanction: Number(r.sanctioned_amount) || 0,
        })),
      );
      const statusMap = new Map<string, number>();
      for (const r of d.rows) {
        const k = r.disbursal_status.replace(/_/g, " ");
        statusMap.set(k, (statusMap.get(k) ?? 0) + 1);
      }
      setStatusPie(Array.from(statusMap.entries()).map(([name, value]) => ({ name, value })));
      setLoading(false);
    })();
  }, [profile.lead_purchase_id]);

  const funnel = [
    { stage: "Sanction", amount: summary.sanction },
    { stage: "Disbursed", amount: summary.disbursed },
    { stage: "Payout", amount: summary.payout },
  ];

  return (
    <SectionShell title="Case Analytics" description="Sanction, disbursal, and payout trends" icon={BarChart3}>
      {loading ? (
        <Loader2 className="size-6 animate-spin mx-auto py-8" />
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            {[
              ["Sanction", summary.sanction],
              ["Disbursed", summary.disbursed],
              ["Payout recv.", summary.payout],
              ["Payout pend.", summary.pending],
            ].map(([l, v]) => (
              <div key={l as string} className="rounded-xl border border-border bg-secondary/30 p-3">
                <p className="text-[10px] text-muted-foreground uppercase font-bold">{l}</p>
                <p className="font-bold text-sm">{fmtInr(v as number)}</p>
              </div>
            ))}
          </div>
          <div className="grid lg:grid-cols-2 gap-6">
            <div className="h-48">
              <p className="text-xs font-semibold mb-2">Approval funnel</p>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={funnel}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="stage" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(v: number) => fmtInr(v)} />
                  <Bar dataKey="amount" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            {lenderBars.length > 0 && (
              <div className="h-48">
                <p className="text-xs font-semibold mb-2">Lender sanction comparison</p>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={lenderBars} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                    <XAxis type="number" tick={{ fontSize: 10 }} />
                    <YAxis dataKey="name" type="category" width={72} tick={{ fontSize: 9 }} />
                    <Tooltip formatter={(v: number) => fmtInr(v)} />
                    <Bar dataKey="sanction" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
            {statusPie.length > 0 && (
              <div className="h-48 lg:col-span-2">
                <p className="text-xs font-semibold mb-2">Disbursal status mix</p>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={statusPie} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label>
                      {statusPie.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </>
      )}
    </SectionShell>
  );
});



