import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, ArrowLeft } from "lucide-react";
import { getBillingMe, getCrmUser } from "@/lib/python-api";
import { useBillingEntitlements } from "@/hooks/use-billing-entitlements";
import { MarketingUpgradeGate } from "@/components/marketing/MarketingUpgradeGate";
import { loadPayslips, type PayslipRow } from "@/lib/hrms-local";

export const Route = createFileRoute("/dashboard/hrms/payslips/$id")({
  head: () => ({ meta: [{ title: "Payslip — RupeeDial One" }] }),
  component: PayslipDetail,
});

function PayslipDetail() {
  const { id } = Route.useParams();
  const { hrmsFull, loading: entLoading } = useBillingEntitlements();
  const [row, setRow] = useState<PayslipRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!hrmsFull) {
      setLoading(false);
      return;
    }
    (async () => {
      const me = await getBillingMe().catch(() => null);
      const owner = me?.team.find((t) => t.is_owner)?.id || getCrmUser()?.id || "default";
      const found = loadPayslips(owner).find((p) => p.id === id) || null;
      setRow(found);
      setLoading(false);
    })();
  }, [hrmsFull, id]);

  if (entLoading || loading) {
    return (
      <div className="py-16 grid place-items-center">
        <Loader2 className="size-5 animate-spin text-[#10662A]" />
      </div>
    );
  }

  if (!hrmsFull) {
    return <MarketingUpgradeGate title="Payslip" description="Pro plan required." />;
  }

  if (!row) {
    return (
      <div className="text-center py-12">
        <p className="text-sm text-[#5c4d72]">Payslip not found</p>
        <Link to="/dashboard/hrms/payslips" className="text-sm font-semibold text-[#10662A] mt-2 inline-block">
          Back
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-md space-y-4">
      <Link
        to="/dashboard/hrms/payslips"
        className="inline-flex items-center gap-1 text-sm text-[#10662A] font-semibold"
      >
        <ArrowLeft className="size-3.5" /> All payslips
      </Link>
      <div className="rounded-2xl border border-[#d8ecdd] bg-white p-6 print:border-0">
        <div className="text-xs uppercase tracking-widest text-[#5c4d72]">RupeeDial Partner</div>
        <h1 className="font-display text-2xl font-bold text-[#390A5D] mt-1">Payslip</h1>
        <p className="text-sm text-[#5c4d72] mt-1">
          {row.name} · {row.month}
        </p>
        <dl className="mt-6 space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-[#5c4d72]">Basic</dt>
            <dd className="font-medium">₹{row.basic.toLocaleString("en-IN")}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-[#5c4d72]">Allowances</dt>
            <dd className="font-medium">₹{row.allowances.toLocaleString("en-IN")}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-[#5c4d72]">Deductions</dt>
            <dd className="font-medium">₹{row.deductions.toLocaleString("en-IN")}</dd>
          </div>
          <div className="flex justify-between border-t border-[#d8ecdd] pt-2 font-bold text-[#10662A]">
            <dt>Net pay</dt>
            <dd>₹{row.net.toLocaleString("en-IN")}</dd>
          </div>
        </dl>
        <button
          type="button"
          onClick={() => window.print()}
          className="mt-6 w-full rounded-xl border border-[#d8ecdd] py-2 text-sm font-semibold text-[#390A5D] print:hidden"
        >
          Print / Save PDF
        </button>
      </div>
    </div>
  );
}
