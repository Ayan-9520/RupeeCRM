import { createFileRoute } from "@tanstack/react-router";
import { CustomerWorkspacePage } from "@/components/customer/CustomerWorkspacePage";

export const Route = createFileRoute("/dashboard/customer/$id")({
  head: () => ({ meta: [{ title: "Customer CRM — LeadMines" }] }),
  component: CustomerRoute,
});

function CustomerRoute() {
  const { id } = Route.useParams();
  return <CustomerWorkspacePage purchaseId={id} />;
}
