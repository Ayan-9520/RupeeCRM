import { createFileRoute } from "@tanstack/react-router";
import { Cog, Lightbulb } from "lucide-react";
import { DEFAULT_AUTOMATION_RULES } from "@/lib/customer-crm/phase6-constants";

export const Route = createFileRoute("/dashboard/automation")({
  head: () => ({ meta: [{ title: "Automation — RupeeDial One" }] }),
  component: AutomationPage,
});

function AutomationPage() {
  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center gap-2">
        <Cog className="size-7 text-[#10662A]" />
        <div>
          <h1 className="font-display text-2xl font-bold text-[#390A5D]">Workflow Automation</h1>
          <p className="text-sm text-[#5c4d72]">Default rules (read-only) — toggles sync in a later release.</p>
        </div>
      </div>

      <section className="rounded-2xl border border-[#d8ecdd] bg-white p-5 shadow-[0_4px_20px_rgba(16,102,42,0.05)]">
        <h2 className="font-semibold text-[#390A5D] mb-3">Default rules</h2>
        <ul className="space-y-2">
          {DEFAULT_AUTOMATION_RULES.map((r) => (
            <li
              key={r.rule_key}
              className="flex items-center justify-between gap-3 py-2.5 border-b border-[#d8ecdd] last:border-0"
            >
              <div>
                <p className="text-sm font-medium text-[#390A5D]">{r.name}</p>
                <p className="text-[10px] text-[#5c4d72] font-mono">{r.rule_key}</p>
              </div>
              <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-[#E8F7EC] text-[#10662A]">
                Planned
              </span>
            </li>
          ))}
        </ul>
      </section>

      <div className="rounded-xl border border-[#d8ecdd] bg-[#f5fcf7] px-4 py-3 flex items-start gap-2.5 text-sm text-[#5c4d72]">
        <Lightbulb className="size-4 text-[#10662A] shrink-0 mt-0.5" />
        <span>
          Follow-ups and stage changes still work manually in My Leads. Automation runners will attach to these rule keys.
        </span>
      </div>
    </div>
  );
}
