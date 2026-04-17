import { createFileRoute } from "@tanstack/react-router";
import { FileText } from "lucide-react";

export const Route = createFileRoute("/dashboard/submissions")({
  head: () => ({ meta: [{ title: "Submissions — LeadMines" }] }),
  component: () => (
    <div className="max-w-3xl">
      <div className="rounded-3xl bg-card border border-dashed border-border p-12 text-center">
        <div className="size-14 mx-auto rounded-2xl bg-accent/15 grid place-items-center"><FileText className="size-6 text-accent" /></div>
        <h1 className="font-display text-2xl font-bold mt-4">Lender Submissions</h1>
        <p className="text-muted-foreground mt-2 max-w-md mx-auto">Sales coordinator panel: review documents, assign cases to lenders, track submission status.</p>
        <p className="text-xs text-muted-foreground mt-6">Coming in Phase 4.</p>
      </div>
    </div>
  ),
});
