import { createFileRoute } from "@tanstack/react-router";
import { CrmPageHub } from "@/components/dashboard/CrmPageHub";

export const Route = createFileRoute("/dashboard/certificates")({
  head: () => ({ meta: [{ title: "Certificates — RupeeDial One" }] }),
  component: CertificatesPage,
});

function CertificatesPage() {
  return (
    <CrmPageHub
      title="Certificates"
      description="Training certificates are paused during the CRM migration."
      links={[
        { label: "Learn", to: "/dashboard/learn", desc: "Continue product training" },
        { label: "My Leads", to: "/dashboard/my-leads", desc: "Put learning into practice" },
      ]}
      tip="Complete Learn modules — certificate downloads return after CRM training sync."
    />
  );
}
