import { createFileRoute } from "@tanstack/react-router";
import { CrmPageHub } from "@/components/dashboard/CrmPageHub";

export const Route = createFileRoute("/dashboard/rewards")({
  head: () => ({ meta: [{ title: "Rewards — RupeeDial One" }] }),
  component: RewardsPage,
});

function RewardsPage() {
  return (
    <CrmPageHub
      title="Rewards"
      description="Points and redemptions are not in the CRM API yet. Track deal value via Earnings."
      links={[
        { label: "Earnings", to: "/dashboard/earnings", desc: "Converted deal values" },
        { label: "Commissions", to: "/dashboard/commissions", desc: "Purchases with deal value" },
        { label: "Wallet", to: "/dashboard/wallet", desc: "Demo lead credits" },
      ]}
      tip="Mark leads converted in My Leads to grow your earnings board."
    />
  );
}
