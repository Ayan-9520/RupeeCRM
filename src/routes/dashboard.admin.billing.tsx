import { createFileRoute } from "@tanstack/react-router";
import { CrmPageHub } from "@/components/dashboard/CrmPageHub";

export const Route = createFileRoute("/dashboard/admin/billing")({
  head: () => ({ meta: [{ title: "Admin Billing — RupeeDial One" }] }),
  component: AdminBillingPage,
});

function AdminBillingPage() {
  return (
    <CrmPageHub
      title="Admin billing"
      description="Workspace invoices lived in Supabase. CRM workspaces run on Enterprise during migration."
      links={[
        { label: "Workspace billing", to: "/dashboard/billing", desc: "Current plan card" },
        { label: "Users", to: "/dashboard/admin/users", desc: "CRM accounts" },
        { label: "Partners", to: "/dashboard/admin/partners", desc: "DSA applications" },
      ]}
      tip="Razorpay/invoices return after billing is ported to the Python CRM API."
    />
  );
}
