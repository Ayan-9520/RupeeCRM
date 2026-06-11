import { createFileRoute } from "@tanstack/react-router";
import { AutomationDashboard } from "@/components/customer/phase6/AutomationDashboard";

export const Route = createFileRoute("/dashboard/automation")({
  head: () => ({ meta: [{ title: "Automation — LeadMines" }] }),
  component: AutomationDashboard,
});
