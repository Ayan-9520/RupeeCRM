import { createFileRoute } from "@tanstack/react-router";
import { LosAnalyticsDashboard } from "@/components/customer/phase5/LosAnalyticsDashboard";

export const Route = createFileRoute("/dashboard/los-analytics")({
  head: () => ({ meta: [{ title: "LOS Analytics — LeadMines" }] }),
  component: LosAnalyticsDashboard,
});
