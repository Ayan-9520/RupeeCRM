import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { getBillingMe, getCrmUser } from "@/lib/python-api";
import { useBillingEntitlements } from "@/hooks/use-billing-entitlements";
import { MarketingUpgradeGate } from "@/components/marketing/MarketingUpgradeGate";
import {
  loadAttendance,
  saveAttendance,
  monthKey,
  type AttStatus,
} from "@/lib/hrms-local";

export const Route = createFileRoute("/dashboard/hrms/attendance")({
  head: () => ({ meta: [{ title: "Attendance — RupeeDial One" }] }),
  component: AttendancePage,
});

function AttendancePage() {
  const { hrmsSoft, loading: entLoading } = useBillingEntitlements();
  const [scope, setScope] = useState("default");
  const [members, setMembers] = useState<{ id: string; full_name: string }[]>([]);
  const [month, setMonth] = useState(monthKey());
  const [grid, setGrid] = useState<Record<string, Record<string, AttStatus>>>({});
  const [loading, setLoading] = useState(true);

  const days = useMemo(() => {
    const [y, m] = month.split("-").map(Number);
    const n = new Date(y, m, 0).getDate();
    return Array.from({ length: n }, (_, i) => String(i + 1).padStart(2, "0"));
  }, [month]);

  useEffect(() => {
    if (!hrmsSoft) {
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const me = await getBillingMe();
        const owner =
          me.team.find((t) => t.is_owner)?.id || getCrmUser()?.id || "default";
        setScope(owner);
        setMembers(me.team.filter((t) => t.is_active).map((t) => ({ id: t.id, full_name: t.full_name })));
        setGrid(loadAttendance(owner, month));
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Load failed");
      } finally {
        setLoading(false);
      }
    })();
  }, [hrmsSoft, month]);

  const cycle = (userId: string, day: string) => {
    const cur = grid[userId]?.[day] || "";
    const next: AttStatus = cur === "" ? "P" : cur === "P" ? "A" : cur === "A" ? "L" : "";
    const nextGrid = {
      ...grid,
      [userId]: { ...(grid[userId] || {}), [day]: next },
    };
    setGrid(nextGrid);
    saveAttendance(scope, nextGrid, month);
  };

  if (entLoading || loading) {
    return (
      <div className="py-16 grid place-items-center">
        <Loader2 className="size-5 animate-spin text-[#10662A]" />
      </div>
    );
  }

  if (!hrmsSoft) {
    return (
      <MarketingUpgradeGate
        title="Attendance"
        description="Mark present / absent / leave on Growth and above."
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-bold text-[#390A5D]">Attendance</h2>
          <p className="text-xs text-[#5c4d72]">Click cell: Present → Absent → Leave → clear. Saved on this device.</p>
        </div>
        <input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="rounded-lg border border-[#d8ecdd] px-3 py-1.5 text-sm"
        />
      </div>
      <div className="overflow-auto rounded-2xl border border-[#d8ecdd] bg-white">
        <table className="text-xs min-w-max">
          <thead>
            <tr className="border-b border-[#d8ecdd] bg-[#E8F7EC]/50">
              <th className="sticky left-0 bg-[#E8F7EC] px-3 py-2 text-left font-semibold text-[#390A5D]">
                Member
              </th>
              {days.map((d) => (
                <th key={d} className="px-1 py-2 font-medium text-[#5c4d72] w-7">
                  {Number(d)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.id} className="border-b border-[#d8ecdd]/60">
                <td className="sticky left-0 bg-white px-3 py-1.5 font-medium text-[#390A5D] whitespace-nowrap">
                  {m.full_name}
                </td>
                {days.map((d) => {
                  const v = grid[m.id]?.[d] || "";
                  return (
                    <td key={d} className="px-0.5 py-0.5 text-center">
                      <button
                        type="button"
                        onClick={() => cycle(m.id, d)}
                        className={`size-6 rounded text-[10px] font-bold ${
                          v === "P"
                            ? "bg-[#10662A] text-white"
                            : v === "A"
                              ? "bg-red-100 text-red-700"
                              : v === "L"
                                ? "bg-amber-100 text-amber-800"
                                : "bg-[#f5f5f5] text-[#5c4d72]"
                        }`}
                      >
                        {v || "·"}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
