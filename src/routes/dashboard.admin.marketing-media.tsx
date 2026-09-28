import { createFileRoute } from "@tanstack/react-router";
import { CrmPageHub } from "@/components/dashboard/CrmPageHub";

export const Route = createFileRoute("/dashboard/admin/marketing-media")({
  head: () => ({ meta: [{ title: "Marketing Media — RupeeDial One" }] }),
  component: AdminMarketingMediaPage,
});

function AdminMarketingMediaPage() {
  return (
    <CrmPageHub
      title="Marketing media"
      description="Product image library used Supabase storage. Media uploads are paused."
      links={[
        { label: "Marketing posts", to: "/dashboard/marketing/posts", desc: "Text templates" },
        { label: "Reels", to: "/dashboard/marketing/reels", desc: "Short video scripts" },
        { label: "Admin marketing", to: "/dashboard/admin/marketing", desc: "Template overview" },
      ]}
      tip="Share text templates with partners until image CDN is reconnected."
    />
  );
}
