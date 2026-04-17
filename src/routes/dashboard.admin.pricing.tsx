import { createFileRoute } from "@tanstack/react-router";
import { UserCog } from "lucide-react";

export const Route = createFileRoute("/dashboard/admin/pricing")({
  head: () => ({ meta: [{ title: "Lead Pricing — LeadMines Admin" }] }),
  component: () => (
    <div className="max-w-3xl">
      <div className="rounded-3xl bg-card border border-dashed border-border p-12 text-center">
        <div className="size-14 mx-auto rounded-2xl bg-accent/15 grid place-items-center"><UserCog className="size-6 text-accent" /></div>
        <h1 className="font-display text-2xl font-bold mt-4">Lead Pricing & Commission</h1>
        <p className="text-muted-foreground mt-2 max-w-md mx-auto">Configure dynamic lead pricing by score, set commission rates per loan type, manage refund policy.</p>
        <p className="text-xs text-muted-foreground mt-6">Coming in Phase 5.</p>
      </div>
    </div>
  ),
});
