import { useMemo, useState, type ComponentType } from "react";
import { ChevronDown, ChevronRight, Menu } from "lucide-react";
import { EligibilityStickySummary } from "./EligibilityDashboard";
import type { EligibilityEngineResult } from "@/lib/customer-crm/eligibility-types";
import type { NavSection } from "@/lib/customer-crm/constants";
import { NAV_GROUP_LABELS, NAV_GROUP_ORDER } from "@/lib/customer-crm/constants";
import type { LosDashboardStats } from "@/lib/customer-crm/phase4-api";
import { stageMeta } from "@/lib/customer-crm/workflow-constants";

export function WorkspaceSidebar({
  completionOverall,
  sectionCompletion,
  navSections,
  active,
  onNavigate,
  eligibility,
  pendingDocs,
  activeBankLogins,
  pendingFollowups,
  losStats,
  pipelineStage,
}: {
  completionOverall: number;
  sectionCompletion: Record<string, number>;
  navSections: NavSection[];
  active: string;
  onNavigate: (id: string) => void;
  eligibility: EligibilityEngineResult | null;
  pendingDocs: number;
  activeBankLogins: number;
  pendingFollowups: boolean;
  losStats?: LosDashboardStats | null;
  pipelineStage?: string | null;
}) {
  const [mobileOpen, setMobileOpen] = useState(true);
  const stage = pipelineStage ? stageMeta(pipelineStage) : null;

  const grouped = useMemo(() => {
    const map = new Map<string, NavSection[]>();
    for (const g of NAV_GROUP_ORDER) map.set(g, []);
    for (const s of navSections) {
      const list = map.get(s.group) ?? [];
      list.push(s);
      map.set(s.group, list);
    }
    return NAV_GROUP_ORDER.map((g) => ({ group: g, label: NAV_GROUP_LABELS[g], items: map.get(g) ?? [] })).filter(
      (x) => x.items.length > 0,
    );
  }, [navSections]);

  const ring = 2 * Math.PI * 18;
  const offset = ring - (completionOverall / 100) * ring;

  return (
    <aside className="lg:w-60 xl:w-64 shrink-0 border-b lg:border-b-0 lg:border-r border-border bg-card/50 flex flex-col lg:sticky lg:top-[9.5rem] lg:self-start lg:max-h-[calc(100vh-10.5rem)]">
      <button
        type="button"
        className="lg:hidden flex items-center justify-between px-4 py-2.5 text-xs font-semibold border-b border-border"
        onClick={() => setMobileOpen((o) => !o)}
      >
        <span className="flex items-center gap-2">
          <Menu className="size-4" /> Sections
        </span>
        {mobileOpen ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
      </button>

      <div className={`${mobileOpen ? "block" : "hidden"} lg:block overflow-y-auto p-4 space-y-4 flex-1`}>
        <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
          <svg className="size-11 shrink-0 -rotate-90" viewBox="0 0 44 44">
            <circle cx="22" cy="22" r="18" fill="none" stroke="currentColor" className="text-secondary" strokeWidth="4" />
            <circle
              cx="22"
              cy="22"
              r="18"
              fill="none"
              stroke="currentColor"
              className="text-accent"
              strokeWidth="4"
              strokeDasharray={ring}
              strokeDashoffset={offset}
              strokeLinecap="round"
            />
          </svg>
          <div>
            <p className="text-[10px] uppercase font-bold text-muted-foreground">Profile complete</p>
            <p className="text-xl font-display font-bold text-accent">{completionOverall}%</p>
          </div>
        </div>

        {stage && (
          <div className={`rounded-lg px-2.5 py-1.5 text-[10px] font-bold border text-center ${stage.color}`}>{stage.label}</div>
        )}

        <div className="grid grid-cols-2 gap-1.5 text-[10px]">
          <MiniStat label="Docs" value={String(pendingDocs)} warn={pendingDocs > 0} />
          <MiniStat label="Lenders" value={String(activeBankLogins)} />
          <MiniStat label="Follow-up" value={pendingFollowups ? "Due" : "OK"} warn={pendingFollowups} />
          {losStats && (
            <>
              <MiniStat label="Active" value={String(losStats.activeCases)} />
              <MiniStat label="Payout" value={String(losStats.payoutPending)} warn={losStats.payoutPending > 0} />
            </>
          )}
        </div>

        {eligibility && <EligibilityStickySummary result={eligibility} />}

        <nav className="space-y-3">
          {grouped.map(({ group, label, items }) => (
            <div key={group}>
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-2 mb-1">{label}</p>
              <ul className="space-y-0.5">
                {items.map((s) => {
                  const pct = sectionCompletion[s.id];
                  const isActive = active === s.id;
                  return (
                    <li key={s.id}>
                      <button
                        type="button"
                        onClick={() => onNavigate(s.id)}
                        className={`w-full text-left px-2.5 py-2 rounded-lg text-xs font-medium transition flex items-center gap-2 ${
                          isActive
                            ? "bg-accent text-accent-foreground shadow-sm"
                            : "text-muted-foreground hover:bg-secondary/80 hover:text-foreground"
                        }`}
                      >
                        <s.icon className="size-3.5 shrink-0 opacity-80" />
                        <span className="flex-1 truncate">{s.label}</span>
                        {pct != null && (
                          <span className={`text-[9px] tabular-nums ${isActive ? "opacity-90" : "text-muted-foreground"}`}>
                            {pct}%
                          </span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
      </div>
    </aside>
  );
}

function MiniStat({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className={`rounded-md border px-2 py-1.5 ${warn ? "border-amber-500/40 bg-amber-500/5" : "border-border bg-card"}`}>
      <span className="text-muted-foreground">{label}</span>
      <span className="block font-bold">{value}</span>
    </div>
  );
}

