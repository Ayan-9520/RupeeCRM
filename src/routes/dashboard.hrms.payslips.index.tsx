import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { getBillingMe, getCrmUser } from "@/lib/python-api";
import { useBillingEntitlements } from "@/hooks/use-billing-entitlements";
import { MarketingUpgradeGate } from "@/components/marketing/MarketingUpgradeGate";
import { loadPayslips, type PayslipRow } from "@/lib/hrms-local";

export const Route = createFileRoute("/dashboard/hrms/payslips/")({
  head: () => ({ meta: [{ title: "Payslips — RupeeDial One" }] }),
  component: PayslipsPage,
});

function PayslipsPage() {
  const { hrmsFull, loading: entLoading } = useBillingEntitlements();
  const [rows, setRows] = useState<PayslipRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!hrmsFull) {
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const me = await getBillingMe();
        const owner = me.team.find((t) => t.is_owner)?.id || getCrmUser()?.id || "default";
        setRows(loadPayslips(owner));
      } finally {
        setLoading(false);
      }
    })();
  }, [hrmsFull]);

  if (entLoading || loading) {
    return (
      <div className="py-16 grid place-items-center">
        <Loader2 className="size-5 animate-spin text-[#10662A]" />
      </div>
    );
  }

  if (!hrmsFull) {
    return (
      <MarketingUpgradeGate title="Payslips" description="Payslip list unlocks on Pro with payroll light." />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-bold text-[#390A5D]">Payslips</h2>
        <Link to="/dashboard/hrms/payroll" className="text-sm font-semibold text-[#10662A]">
          Run payroll
        </Link>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-[#5c4d72] text-center py-12">No payslips yet. Run payroll first.</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => (
            <li key={r.id}>
              <Link
                to="/dashboard/hrms/payslips/$id"
                params={{ id: r.id }}
                className="block rounded-xl border border-[#d8ecdd] bg-white px-4 py-3 hover:bg-[#E8F7EC]/40"
              >
                <div className="flex justify-between gap-2 text-sm">
                  <span className="font-semibold text-[#390A5D]">{r.name}</span>
                  <span className="font-mono text-[#10662A]">₹{r.net.toLocaleString("en-IN")}</span>
                </div>
                <div className="text-xs text-[#5c4d72] mt-0.5">{r.month}</div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
