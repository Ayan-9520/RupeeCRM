import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { getBillingMe, getCrmUser } from "@/lib/python-api";
import { useBillingEntitlements } from "@/hooks/use-billing-entitlements";
import { MarketingUpgradeGate } from "@/components/marketing/MarketingUpgradeGate";
import { loadLeaves, saveLeaves, type LeaveRow } from "@/lib/hrms-local";

export const Route = createFileRoute("/dashboard/hrms/leaves")({
  head: () => ({ meta: [{ title: "Leaves — RupeeDial One" }] }),
  component: LeavesPage,
});

function LeavesPage() {
  const { hrmsSoft, loading: entLoading } = useBillingEntitlements();
  const [scope, setScope] = useState("default");
  const [members, setMembers] = useState<{ id: string; full_name: string }[]>([]);
  const [rows, setRows] = useState<LeaveRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ user_id: "", from: "", to: "", reason: "" });

  useEffect(() => {
    if (!hrmsSoft) {
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const me = await getBillingMe();
        const owner = me.team.find((t) => t.is_owner)?.id || getCrmUser()?.id || "default";
        setScope(owner);
        setMembers(me.team.filter((t) => t.is_active).map((t) => ({ id: t.id, full_name: t.full_name })));
        setRows(loadLeaves(owner));
        if (me.team[0]) setForm((f) => ({ ...f, user_id: me.team[0].id }));
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Load failed");
      } finally {
        setLoading(false);
      }
    })();
  }, [hrmsSoft]);

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.user_id || !form.from || !form.to) {
      toast.error("Pick member and dates");
      return;
    }
    const name = members.find((m) => m.id === form.user_id)?.full_name || "Member";
    const next: LeaveRow[] = [
      {
        id: crypto.randomUUID(),
        user_id: form.user_id,
        name,
        from: form.from,
        to: form.to,
        reason: form.reason,
        status: "pending",
        created_at: new Date().toISOString(),
      },
      ...rows,
    ];
    setRows(next);
    saveLeaves(scope, next);
    toast.success("Leave logged");
    setForm((f) => ({ ...f, from: "", to: "", reason: "" }));
  };

  const setStatus = (id: string, status: LeaveRow["status"]) => {
    const next = rows.map((r) => (r.id === id ? { ...r, status } : r));
    setRows(next);
    saveLeaves(scope, next);
  };

  if (entLoading || loading) {
    return (
      <div className="py-16 grid place-items-center">
        <Loader2 className="size-5 animate-spin text-[#10662A]" />
      </div>
    );
  }

  if (!hrmsSoft) {
    return <MarketingUpgradeGate title="Leaves" description="Leave log unlocks on Growth." />;
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h2 className="font-display text-lg font-bold text-[#390A5D]">Leave log</h2>
        <p className="text-xs text-[#5c4d72]">Simple register — approvals are manual (soft HRMS).</p>
      </div>

      <form onSubmit={add} className="rounded-2xl border border-[#d8ecdd] bg-white p-4 grid sm:grid-cols-2 gap-3">
        <select
          value={form.user_id}
          onChange={(e) => setForm({ ...form, user_id: e.target.value })}
          className="rounded-lg border border-[#d8ecdd] px-3 py-2 text-sm"
        >
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.full_name}
            </option>
          ))}
        </select>
        <input
          placeholder="Reason"
          value={form.reason}
          onChange={(e) => setForm({ ...form, reason: e.target.value })}
          className="rounded-lg border border-[#d8ecdd] px-3 py-2 text-sm"
        />
        <input
          type="date"
          value={form.from}
          onChange={(e) => setForm({ ...form, from: e.target.value })}
          className="rounded-lg border border-[#d8ecdd] px-3 py-2 text-sm"
        />
        <input
          type="date"
          value={form.to}
          onChange={(e) => setForm({ ...form, to: e.target.value })}
          className="rounded-lg border border-[#d8ecdd] px-3 py-2 text-sm"
        />
        <button
          type="submit"
          className="sm:col-span-2 rounded-xl bg-[#10662A] text-white py-2 text-sm font-semibold"
        >
          Add leave
        </button>
      </form>

      <ul className="space-y-2">
        {rows.length === 0 && (
          <li className="text-sm text-[#5c4d72] text-center py-8">No leaves logged</li>
        )}
        {rows.map((r) => (
          <li
            key={r.id}
            className="rounded-xl border border-[#d8ecdd] bg-white p-4 flex flex-wrap items-center justify-between gap-2 text-sm"
          >
            <div>
              <div className="font-semibold text-[#390A5D]">{r.name}</div>
              <div className="text-xs text-[#5c4d72]">
                {r.from} → {r.to}
                {r.reason ? ` · ${r.reason}` : ""}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase font-bold text-[#5c4d72]">{r.status}</span>
              {r.status === "pending" && (
                <>
                  <button
                    type="button"
                    onClick={() => setStatus(r.id, "approved")}
                    className="text-xs font-semibold text-[#10662A]"
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatus(r.id, "rejected")}
                    className="text-xs font-semibold text-red-700"
                  >
                    Reject
                  </button>
                </>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
