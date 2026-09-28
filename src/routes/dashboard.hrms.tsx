import { createFileRoute, Outlet, Link, useLocation } from "@tanstack/react-router";
import {
  Users,
  CalendarCheck,
  Wallet2,
  FileText,
  Receipt,
  CalendarRange,
  UserCircle,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useBillingEntitlements } from "@/hooks/use-billing-entitlements";
import { MarketingUpgradeGate } from "@/components/marketing/MarketingUpgradeGate";

export const Route = createFileRoute("/dashboard/hrms")({
  head: () => ({ meta: [{ title: "HRMS — RupeeDial One" }] }),
  component: HrmsLayout,
});

const TABS = [
  { to: "/dashboard/hrms", label: "Employees", icon: Users, exact: true, need: "soft" as const },
  { to: "/dashboard/hrms/me", label: "My HR", icon: UserCircle, need: "soft" as const },
  { to: "/dashboard/hrms/attendance", label: "Attendance", icon: CalendarCheck, need: "soft" as const },
  { to: "/dashboard/hrms/leaves", label: "Leaves", icon: CalendarRange, need: "soft" as const },
  { to: "/dashboard/hrms/payroll", label: "Payroll", icon: Wallet2, need: "full" as const },
  { to: "/dashboard/hrms/payslips", label: "Payslips", icon: FileText, need: "full" as const },
  { to: "/dashboard/billing", label: "Plan billing", icon: Receipt, need: "any" as const },
];

function HrmsLayout() {
  const loc = useLocation();
  const { entitlements, loading, hrmsSoft, hrmsFull } = useBillingEntitlements();
  const planLabel = entitlements.plan_name
    ? `${entitlements.plan_name} · ${entitlements.plan_status}`
    : "No plan";

  if (loading) {
    return (
      <div className="grid place-items-center py-20">
        <Loader2 className="size-6 animate-spin text-[#10662A]" />
      </div>
    );
  }

  if (!hrmsSoft) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#390A5D]">HRMS &amp; Payroll</h1>
          <p className="text-sm text-[#5c4d72] mt-1">Soft HRMS on Growth · Full payroll light on Pro.</p>
        </div>
        <MarketingUpgradeGate
          title="Growth plan required"
          description="Soft HRMS (roster, attendance, leaves) unlocks on Growth. Pro adds payroll light & payslips."
        />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#390A5D]">HRMS &amp; Payroll</h1>
          <p className="text-[#5c4d72] text-sm mt-1">
            Team roster from your plan seats. {hrmsFull ? "Payroll light unlocked." : "Upgrade to Pro for payroll."}
          </p>
        </div>
        <Link
          to="/dashboard/billing"
          className="rounded-xl border border-[#d8ecdd] bg-white px-3 py-2 text-xs font-semibold text-[#390A5D]"
        >
          Plan: {planLabel}
        </Link>
      </div>
      <div className="flex gap-1 border-b border-[#d8ecdd] overflow-x-auto">
        {TABS.map((t) => {
          const active = t.exact
            ? loc.pathname === t.to
            : t.to !== "/dashboard/billing" && loc.pathname.startsWith(t.to);
          const locked = t.need === "full" && !hrmsFull;
          return (
            <Link
              key={t.to}
              to={t.to}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-colors",
                active
                  ? "border-[#10662A] text-[#10662A]"
                  : "border-transparent text-[#5c4d72] hover:text-[#390A5D]",
                locked && "opacity-60",
              )}
            >
              <t.icon className="size-4" /> {t.label}
              {locked && <span className="text-[10px] uppercase">Pro</span>}
            </Link>
          );
        })}
      </div>
      <Outlet />
    </div>
  );
}
