import { createFileRoute } from "@tanstack/react-router";
import { BarChart3 } from "lucide-react";

export const Route = createFileRoute("/dashboard/earnings")({
  head: () => ({ meta: [{ title: "Earnings — LeadMines" }] }),
  component: () => (
    <div className="max-w-3xl">
      <div className="rounded-3xl bg-card border border-dashed border-border p-12 text-center">
        <div className="size-14 mx-auto rounded-2xl bg-accent/15 grid place-items-center"><BarChart3 className="size-6 text-accent" /></div>
        <h1 className="font-display text-2xl font-bold mt-4">Earnings & Commissions</h1>
        <p className="text-muted-foreground mt-2 max-w-md mx-auto">Track your monthly commission, disbursal earnings, payout history and pending settlements.</p>
        <p className="text-xs text-muted-foreground mt-6">Coming in Phase 5.</p>
      </div>
    </div>
  ),
});
