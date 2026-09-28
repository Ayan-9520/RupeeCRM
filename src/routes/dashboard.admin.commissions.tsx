import { createFileRoute } from "@tanstack/react-router";
import { CrmPageHub } from "@/components/dashboard/CrmPageHub";

export const Route = createFileRoute("/dashboard/admin/commissions")({
  head: () => ({ meta: [{ title: "Commission Rules — Admin" }] }),
  component: CommissionRulesPage,
});

function CommissionRulesPage() {
  return (
    <CrmPageHub
      title="Commission Rules"
      description="Split rules will sync from CRM in a later release."
      links={[
        { label: "Partner Applications", to: "/dashboard/admin/partners", desc: "DSA onboarding" },
        { label: "Users", to: "/dashboard/admin/users", desc: "Roles & accounts" },
        { label: "Website Leads", to: "/dashboard/website-leads", desc: "Inbound leads" },
      ]}
    />
  );
}
