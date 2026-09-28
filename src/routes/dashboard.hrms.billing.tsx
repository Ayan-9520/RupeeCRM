import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/dashboard/hrms/billing")({
  head: () => ({ meta: [{ title: "HRMS Billing — RupeeDial One" }] }),
  component: () => <Navigate to="/dashboard/billing" />,
});
