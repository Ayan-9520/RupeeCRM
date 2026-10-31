import { createFileRoute, Outlet } from "@tanstack/react-router";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { RoleGuard } from "@/components/dashboard/RoleGuard";

export const Route = createFileRoute("/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — RupeeDial One" }] }),
  component: DashboardLayout,
});

function DashboardLayout() {
  return (
    <DashboardShell>
      <RoleGuard>
        <Outlet />
      </RoleGuard>
    </DashboardShell>
  );
}
