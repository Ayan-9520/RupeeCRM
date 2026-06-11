import { createFileRoute } from "@tanstack/react-router";
import { ExecutiveAnalytics } from "@/components/customer/phase6/ExecutiveAnalytics";

export const Route = createFileRoute("/dashboard/los-executive")({
  head: () => ({ meta: [{ title: "Executive Analytics — LeadMines" }] }),
  component: ExecutiveAnalytics,
});
