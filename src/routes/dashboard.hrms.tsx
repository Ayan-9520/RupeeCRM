import { createFileRoute, Outlet, Link, useLocation } from "@tanstack/react-router";
import { Users, CalendarCheck, Wallet2, FileText, Receipt, CalendarRange, UserCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/dashboard/hrms")({
  head: () => ({ meta: [{ title: "HRMS — LeadMines" }] }),
  component: HrmsLayout,
});

const TABS = [
  { to: "/dashboard/hrms", label: "Employees", icon: Users, exact: true },
  { to: "/dashboard/hrms/me", label: "My HR", icon: UserCircle },
  { to: "/dashboard/hrms/attendance", label: "Attendance", icon: CalendarCheck },
  { to: "/dashboard/hrms/leaves", label: "Leaves", icon: CalendarRange },
  { to: "/dashboard/hrms/payroll", label: "Payroll", icon: Wallet2 },
  { to: "/dashboard/hrms/payslips", label: "Payslips", icon: FileText },
  { to: "/dashboard/hrms/billing", label: "Billing", icon: Receipt },
];

function HrmsLayout() {
  const loc = useLocation();
  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-bold">HRMS &amp; Payroll</h1>
        <p className="text-muted-foreground text-sm mt-1">Manage employees, attendance, salaries and payslips for your workspace.</p>
      </div>
      <div className="flex gap-1 border-b border-border overflow-x-auto">
        {TABS.map((t) => {
          const active = t.exact ? loc.pathname === t.to : loc.pathname.startsWith(t.to);
          return (
            <Link key={t.to} to={t.to} className={cn(
              "flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-colors",
              active ? "border-accent text-accent" : "border-transparent text-muted-foreground hover:text-foreground"
            )}>
              <t.icon className="size-4" /> {t.label}
            </Link>
          );
        })}
      </div>
      <Outlet />
    </div>
  );
}
