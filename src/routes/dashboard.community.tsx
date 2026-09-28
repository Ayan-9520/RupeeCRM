import { createFileRoute } from "@tanstack/react-router";
import { CrmPageHub } from "@/components/dashboard/CrmPageHub";

export const Route = createFileRoute("/dashboard/community")({
  head: () => ({ meta: [{ title: "Community — RupeeDial One" }] }),
  component: Community,
});

function Community() {
  return (
    <CrmPageHub
      title="Community"
      description="Partner community feed arrives in a later release. Use these hubs meanwhile."
      links={[
        { label: "Learn", to: "/dashboard/learn", desc: "Training academy courses" },
        { label: "Marketing", to: "/dashboard/marketing", desc: "Creatives and campaigns" },
        { label: "Leaderboard", to: "/dashboard/leaderboard", desc: "Top performers" },
      ]}
      tip="Share wins and tips via WhatsApp marketing tools until the community board ships."
    />
  );
}
