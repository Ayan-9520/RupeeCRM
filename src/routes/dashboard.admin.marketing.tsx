import { createFileRoute } from "@tanstack/react-router";
import { CrmPageHub } from "@/components/dashboard/CrmPageHub";

export const Route = createFileRoute("/dashboard/admin/marketing")({
  head: () => ({ meta: [{ title: "Admin Marketing — RupeeDial One" }] }),
  component: AdminMarketingPage,
});

function AdminMarketingPage() {
  return (
    <CrmPageHub
      title="Admin marketing"
      description="Partners get ready-made post, WhatsApp and reel templates under Marketing, branded with their own profile."
      links={[
        { label: "Marketing hub", to: "/dashboard/marketing", desc: "Partner tools" },
        { label: "Posts", to: "/dashboard/marketing/posts", desc: "Copy-ready post templates" },
        { label: "WhatsApp", to: "/dashboard/marketing/whatsapp", desc: "WA message templates" },
      ]}
      tip="Template text is maintained by the RupeeDial team and ships with each CRM update."
    />
  );
}
