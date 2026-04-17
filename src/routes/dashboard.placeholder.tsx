// Shared placeholder pages for modules coming in later phases.
import { createFileRoute } from "@tanstack/react-router";
import { Construction } from "lucide-react";

function PlaceholderView({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="max-w-3xl">
      <div className="rounded-3xl bg-card border border-dashed border-border p-12 text-center">
        <div className="size-14 mx-auto rounded-2xl bg-accent/15 grid place-items-center">
          <Construction className="size-6 text-accent" />
        </div>
        <h1 className="font-display text-2xl font-bold mt-4">{title}</h1>
        <p className="text-muted-foreground mt-2 max-w-md mx-auto">{desc}</p>
        <p className="text-xs text-muted-foreground mt-6">Coming in a later build phase.</p>
      </div>
    </div>
  );
}

export const Route = createFileRoute("/dashboard/placeholder")({
  component: () => <PlaceholderView title="Module" desc="This module is on the roadmap." />,
});
