import { useState } from "react";
import { User, Users, Layers } from "lucide-react";
import type { BusinessScope } from "@/lib/python-api";

const KEY = "rupeedial.business-scope";
const OPTIONS: { id: BusinessScope; label: string; icon: typeof User }[] = [
  { id: "self", label: "Self Business", icon: User },
  { id: "team", label: "Team Business", icon: Users },
  { id: "combined", label: "Combined Business", icon: Layers },
];

export function useBusinessScope(): [BusinessScope, (next: BusinessScope) => void] {
  const [scope, setScope] = useState<BusinessScope>(() => {
    const saved = typeof window !== "undefined" ? window.sessionStorage.getItem(KEY) : null;
    return saved === "self" || saved === "team" || saved === "combined" ? saved : "combined";
  });
  return [
    scope,
    (next) => {
      setScope(next);
      window.sessionStorage.setItem(KEY, next);
    },
  ];
}

export function BusinessScopeSwitch({ value, onChange, hasTeam }: { value: BusinessScope; onChange: (next: BusinessScope) => void; hasTeam: boolean }) {
  return (
    <div className="inline-flex rounded-full border border-[#d8ecdd] bg-white p-1 shadow-[0_2px_10px_rgba(8,122,53,0.06)]" role="tablist">
      {OPTIONS.map((opt) => {
        const off = opt.id === "team" && !hasTeam;
        const on = value === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            role="tab"
            aria-selected={on}
            disabled={off}
            title={off ? "No one reports to you yet" : undefined}
            onClick={() => onChange(opt.id)}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
              on ? "bg-gradient-to-r from-[#087A35] to-[#0b9a45] text-white shadow" : off ? "cursor-not-allowed text-slate-300" : "text-[#390A5D] hover:bg-[#f2faf4]"
            }`}
          >
            <opt.icon className="size-3.5" /> {opt.label}
          </button>
        );
      })}
    </div>
  );
}
