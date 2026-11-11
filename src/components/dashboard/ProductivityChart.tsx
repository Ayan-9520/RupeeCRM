import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { toast } from "sonner";
import { crmMe, listMyLeads, updateCrmProfile, type CrmPurchase } from "@/lib/python-api";
import { productivitySeries, type ProductivityMode } from "@/lib/productivity";

function inr(n: number) {
  return `₹${Math.round(n || 0).toLocaleString("en-IN")}`;
}

function compact(n: number) {
  if (n >= 10000000) return `${(n / 10000000).toFixed(1)}Cr`;
  if (n >= 100000) return `${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `${Math.round(n / 1000)}k`;
  return String(Math.round(n));
}

export function ProductivityChart() {
  const [rows, setRows] = useState<CrmPurchase[]>([]);
  const [joined, setJoined] = useState<Date | null>(null);
  const [target, setTarget] = useState(0);
  const [draft, setDraft] = useState("");
  const [mode, setMode] = useState<ProductivityMode>("month");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([crmMe().catch(() => null), listMyLeads().catch(() => ({ items: [] as CrmPurchase[] }))])
      .then(([me, leads]) => {
        if (cancelled) return;
        const joinedAt = me?.created_at ? new Date(me.created_at) : new Date();
        const saved = Number(me?.monthly_target_inr || 0);
        setJoined(Number.isNaN(joinedAt.getTime()) ? new Date() : joinedAt);
        setTarget(saved);
        setDraft(saved ? String(Math.round(saved)) : "");
        setRows(leads.items || []);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const points = useMemo(
    () => (joined ? productivitySeries(rows, joined, target, mode) : []),
    [rows, joined, target, mode],
  );
  const current = points[points.length - 1];
  const achievement = current && current.target > 0 ? Math.round((current.disbursed / current.target) * 100) : null;

  const save = async () => {
    const amount = Number(draft.replace(/[^\d]/g, "") || 0);
    setSaving(true);
    try {
      const me = await updateCrmProfile({ monthly_target_inr: amount });
      const saved = Number(me.monthly_target_inr || 0);
      setTarget(saved);
      setDraft(saved ? String(Math.round(saved)) : "");
      toast.success(saved ? "Monthly target saved" : "Monthly target cleared");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save the target");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-3xl border border-[#d8ecdd] bg-white p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-bold text-[#390A5D]">Productivity vs target</h2>
          <p className="mt-1 max-w-xl text-sm text-[#5c4d72]">
            Disbursed amount on cases marked Disbursed, from{" "}
            {joined ? joined.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "joining"} to today.
            Calls are the statuses saved on a lead.
          </p>
        </div>
        <div className="flex rounded-full bg-[#E8F7EC] p-1">
          {(["month", "quarter", "year"] as const).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setMode(item)}
              className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${mode === item ? "bg-[#0D4F20] text-white" : "text-[#0D4F20]"}`}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <label className="text-xs font-semibold text-[#5c4d72]">
          Monthly disbursement target (₹)
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value.replace(/[^\d]/g, ""))}
            inputMode="numeric"
            placeholder="Set your target"
            className="mt-1 h-10 w-48 rounded-xl border border-[#d8ecdd] px-3 text-sm text-[#14281c]"
          />
        </label>
        <button type="button" disabled={saving} onClick={() => void save()} className="h-10 rounded-xl bg-[#10662A] px-4 text-sm font-semibold text-white hover:bg-[#0D4F20] disabled:opacity-50">
          {saving ? "Saving…" : "Save target"}
        </button>
        {current ? (
          <p className="text-sm text-[#14281c]">
            {current.label}: <strong>{inr(current.disbursed)}</strong>
            {current.target > 0 ? ` of ${inr(current.target)} · ${achievement}%` : " · target not set"}
            {` · ${current.cases} disbursed · ${current.calls} calls`}
          </p>
        ) : null}
      </div>

      {loading ? (
        <p className="mt-4 text-sm text-[#5c4d72]">Loading productivity…</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <div className="h-64 min-w-[560px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={points} barGap={4}>
                <CartesianGrid stroke="#e7f5eb" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: "#5c4d72", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={compact} tick={{ fill: "#5c4d72", fontSize: 11 }} axisLine={false} tickLine={false} width={48} />
                <Tooltip formatter={(value, name) => [String(name).toLowerCase() === "calls" ? Number(value || 0) : inr(Number(value || 0)), String(name)]} />
                <Legend />
                <Bar dataKey="disbursed" name="Disbursed" fill="#10662A" radius={[6, 6, 0, 0]} />
                {target > 0 ? <Bar dataKey="target" name="Target" fill="#B7E4C7" radius={[6, 6, 0, 0]} /> : null}
              </BarChart>
            </ResponsiveContainer>
          </div>
          <table className="mt-3 w-full min-w-[560px] text-left text-sm">
            <thead>
              <tr className="border-b border-[#d8ecdd] text-[11px] font-bold uppercase tracking-wide text-[#5c4d72]">
                <th className="py-2 pr-3">Period</th>
                <th className="py-2 pr-3">Calls</th>
                <th className="py-2 pr-3">Disbursed cases</th>
                <th className="py-2 pr-3">Disbursed</th>
                <th className="py-2 pr-3">Target</th>
                <th className="py-2">Achievement</th>
              </tr>
            </thead>
            <tbody>
              {[...points].reverse().map((point) => (
                <tr key={point.label} className="border-b border-[#eef6f0]">
                  <td className="py-2 pr-3 font-semibold text-[#390A5D]">{point.label}</td>
                  <td className="py-2 pr-3">{point.calls}</td>
                  <td className="py-2 pr-3">{point.cases}</td>
                  <td className="py-2 pr-3">{inr(point.disbursed)}</td>
                  <td className="py-2 pr-3">{point.target ? inr(point.target) : "—"}</td>
                  <td className="py-2 font-semibold text-[#0D4F20]">{point.target ? `${Math.round((point.disbursed / point.target) * 100)}%` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
