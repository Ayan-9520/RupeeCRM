import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { getBillingMe, getCrmUser } from "@/lib/python-api";
import { useBillingEntitlements } from "@/hooks/use-billing-entitlements";
import { MarketingUpgradeGate } from "@/components/marketing/MarketingUpgradeGate";
import { loadAttendance, loadLeaves, monthKey } from "@/lib/hrms-local";

export const Route = createFileRoute("/dashboard/hrms/me")({
  head: () => ({ meta: [{ title: "My HR — RupeeDial One" }] }),
  component: MyHrPage,
});

function MyHrPage() {
  const { hrmsSoft, loading: entLoading } = useBillingEntitlements();
  const user = getCrmUser();
  const [stats, setStats] = useState({ present: 0, absent: 0, leave: 0, myLeaves: 0 });
  const [loading, setLoading] = useState(true);
  const month = useMemo(() => monthKey(), []);

  useEffect(() => {
    if (!hrmsSoft) {
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const me = await getBillingMe();
        const owner = me.team.find((t) => t.is_owner)?.id || user?.id || "default";
        const self = me.team.find((t) => t.email === user?.email) || me.team.find((t) => t.is_owner);
        const uid = self?.id || user?.id || "";
        const att = loadAttendance(owner, month)[uid] || {};
        let present = 0;
        let absent = 0;
        let leave = 0;
        Object.values(att).forEach((v) => {
          if (v === "P") present += 1;
          else if (v === "A") absent += 1;
          else if (v === "L") leave += 1;
        });
        const myLeaves = loadLeaves(owner).filter((l) => l.user_id === uid).length;
        setStats({ present, absent, leave, myLeaves });
      } finally {
        setLoading(false);
      }
    })();
  }, [hrmsSoft, month, user?.email, user?.id]);

  if (entLoading || loading) {
    return (
      <div className="py-16 grid place-items-center">
        <Loader2 className="size-5 animate-spin text-[#10662A]" />
      </div>
    );
  }

  if (!hrmsSoft) {
    return <MarketingUpgradeGate title="My HR" description="Self attendance view on Growth+." />;
  }

  return (
    <div className="space-y-6 max-w-lg">
      <div>
        <h2 className="font-display text-lg font-bold text-[#390A5D]">
          {user?.full_name || "My HR"}
        </h2>
        <p className="text-xs text-[#5c4d72]">This month ({month}) from team attendance.</p>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Present", value: stats.present, color: "text-[#10662A]" },
          { label: "Absent", value: stats.absent, color: "text-red-700" },
          { label: "Leave days", value: stats.leave, color: "text-amber-700" },
        ].map((c) => (
          <div key={c.label} className="rounded-xl border border-[#d8ecdd] bg-white p-4 text-center">
            <div className={`font-display text-2xl font-bold ${c.color}`}>{c.value}</div>
            <div className="text-[10px] uppercase text-[#5c4d72] mt-1">{c.label}</div>
          </div>
        ))}
      </div>
      <p className="text-sm text-[#5c4d72]">Leave requests logged: {stats.myLeaves}</p>
      <div className="flex gap-3 text-sm font-semibold">
        <Link to="/dashboard/hrms/attendance" className="text-[#10662A]">
          Attendance →
        </Link>
        <Link to="/dashboard/hrms/leaves" className="text-[#10662A]">
          Leaves →
        </Link>
      </div>
    </div>
  );
}
