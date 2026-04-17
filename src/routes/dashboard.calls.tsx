import { createFileRoute } from "@tanstack/react-router";
import { Phone } from "lucide-react";

export const Route = createFileRoute("/dashboard/calls")({
  head: () => ({ meta: [{ title: "Call Queue — LeadMines" }] }),
  component: () => (
    <Placeholder icon={Phone} title="Call Center Queue" desc="Telecaller dashboard with auto-dialer, call dispositions, follow-up scheduling and lead handoff to coordinators." />
  ),
});

function Placeholder({ icon: Icon, title, desc }: { icon: React.ComponentType<{ className?: string }>; title: string; desc: string }) {
  return (
    <div className="max-w-3xl">
      <div className="rounded-3xl bg-card border border-dashed border-border p-12 text-center">
        <div className="size-14 mx-auto rounded-2xl bg-accent/15 grid place-items-center"><Icon className="size-6 text-accent" /></div>
        <h1 className="font-display text-2xl font-bold mt-4">{title}</h1>
        <p className="text-muted-foreground mt-2 max-w-md mx-auto">{desc}</p>
        <p className="text-xs text-muted-foreground mt-6">Coming in Phase 4.</p>
      </div>
    </div>
  );
}
