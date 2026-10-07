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
      description="Partners create branded images with the post and visiting-card generators. A shared image library needs cloud storage."
      links={[
        { label: "Marketing posts", to: "/dashboard/marketing/posts", desc: "Text templates" },
        { label: "Reels", to: "/dashboard/marketing/reels", desc: "Short video scripts" },
        { label: "Admin marketing", to: "/dashboard/admin/marketing", desc: "Template overview" },
      ]}
      tip="Image uploads can be turned on once a storage bucket (for example S3 or Cloudflare R2) is connected."
    />
  );
}
