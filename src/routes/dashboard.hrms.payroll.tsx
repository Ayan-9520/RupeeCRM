import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { getBillingMe, getCrmUser } from "@/lib/python-api";
import { useBillingEntitlements } from "@/hooks/use-billing-entitlements";
import { MarketingUpgradeGate } from "@/components/marketing/MarketingUpgradeGate";
import { loadPayslips, savePayslips, monthKey, type PayslipRow } from "@/lib/hrms-local";

export const Route = createFileRoute("/dashboard/hrms/payroll")({
  head: () => ({ meta: [{ title: "Payroll — RupeeDial One" }] }),
  component: PayrollPage,
});

function PayrollPage() {
  const { hrmsFull, loading: entLoading } = useBillingEntitlements();
  const [scope, setScope] = useState("default");
  const [members, setMembers] = useState<{ id: string; full_name: string }[]>([]);
  const [month, setMonth] = useState(monthKey());
  const [basic, setBasic] = useState(25000);
  const [allowances, setAllowances] = useState(5000);
  const [deductions, setDeductions] = useState(2000);
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
        setScope(owner);
        setMembers(me.team.filter((t) => t.is_active).map((t) => ({ id: t.id, full_name: t.full_name })));
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Load failed");
      } finally {
        setLoading(false);
      }
    })();
  }, [hrmsFull]);

  const runPayroll = () => {
    const existing = loadPayslips(scope).filter((p) => p.month !== month);
    const net = Math.max(0, basic + allowances - deductions);
    const generated: PayslipRow[] = members.map((m) => ({
      id: crypto.randomUUID(),
      user_id: m.id,
      name: m.full_name,
      month,
      basic,
      allowances,
      deductions,
      net,
      created_at: new Date().toISOString(),
    }));
    savePayslips(scope, [...generated, ...existing]);
    toast.success(`Generated ${generated.length} payslips for ${month}`);
  };

  if (entLoading || loading) {
    return (
      <div className="py-16 grid place-items-center">
        <Loader2 className="size-5 animate-spin text-[#10662A]" />
      </div>
    );
  }

  if (!hrmsFull) {
    return (
      <MarketingUpgradeGate
        title="Payroll light"
        description="Manual payroll run & payslips unlock on Pro. No statutory engine yet — edit amounts and generate slips."
      />
    );
  }

  return (
    <div className="space-y-6 max-w-xl">
      <div>
        <h2 className="font-display text-lg font-bold text-[#390A5D]">Payroll light</h2>
        <p className="text-xs text-[#5c4d72]">
          Same CTC template applied to all active seats for the month. Statutory automation later.
        </p>
      </div>
      <div className="rounded-2xl border border-[#d8ecdd] bg-white p-5 space-y-3">
        <label className="block text-sm">
          <span className="font-semibold text-[#390A5D]">Month</span>
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="mt-1 w-full rounded-lg border border-[#d8ecdd] px-3 py-2"
          />
        </label>
        <label className="block text-sm">
          <span className="font-semibold text-[#390A5D]">Basic</span>
          <input
            type="number"
            value={basic}
            onChange={(e) => setBasic(Number(e.target.value))}
            className="mt-1 w-full rounded-lg border border-[#d8ecdd] px-3 py-2"
          />
        </label>
        <label className="block text-sm">
          <span className="font-semibold text-[#390A5D]">Allowances</span>
          <input
            type="number"
            value={allowances}
            onChange={(e) => setAllowances(Number(e.target.value))}
            className="mt-1 w-full rounded-lg border border-[#d8ecdd] px-3 py-2"
          />
        </label>
        <label className="block text-sm">
          <span className="font-semibold text-[#390A5D]">Deductions</span>
          <input
            type="number"
            value={deductions}
            onChange={(e) => setDeductions(Number(e.target.value))}
            className="mt-1 w-full rounded-lg border border-[#d8ecdd] px-3 py-2"
          />
        </label>
        <div className="text-sm font-semibold text-[#10662A]">
          Net / person: ₹{(basic + allowances - deductions).toLocaleString("en-IN")} · {members.length}{" "}
          seats
        </div>
        <button
          type="button"
          onClick={runPayroll}
          className="w-full rounded-xl bg-[#10662A] text-white py-2.5 text-sm font-semibold"
        >
          Generate payslips
        </button>
        <Link to="/dashboard/hrms/payslips" className="block text-center text-sm font-semibold text-[#10662A]">
          View payslips →
        </Link>
      </div>
    </div>
  );
}
