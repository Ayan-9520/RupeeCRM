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
      description="Template CMS moved off Supabase. Partners use hardcoded templates under Marketing."
      links={[
        { label: "Marketing hub", to: "/dashboard/marketing", desc: "Partner tools" },
        { label: "Posts", to: "/dashboard/marketing/posts", desc: "Copy-ready post templates" },
        { label: "WhatsApp", to: "/dashboard/marketing/whatsapp", desc: "WA message templates" },
      ]}
      tip="Edit templates in code / local defaults until marketing admin API exists."
    />
  );
}
