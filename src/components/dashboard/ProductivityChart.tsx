import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { TrendingUp } from "lucide-react";
import { crmMe, listMyLeads, type CrmPurchase } from "@/lib/python-api";
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

function pieSlices(done: number, goal: number, color: string) {
  const achieved = Math.max(0, done);
  const left = Math.max(0, goal - achieved);
  if (goal <= 0) return [{ name: "Done", value: achieved || 1, fill: color }];
  if (achieved <= 0) return [{ name: "Left", value: left, fill: "#E4F6EA" }];
  return [
    { name: "Done", value: achieved, fill: color },
    { name: "Left", value: left, fill: "#E4F6EA" },
  ];
}

function pct(actual: number, target: number) {
  if (!target) return "—";
  return `${Math.round((actual / target) * 100)}%`;
}

export function ProductivityChart() {
  const [rows, setRows] = useState<CrmPurchase[]>([]);
  const [joined, setJoined] = useState<Date | null>(null);
  const [target, setTarget] = useState(0);
  const [loginTarget, setLoginTarget] = useState(0);
  const [mode, setMode] = useState<ProductivityMode>("month");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.all([crmMe().catch(() => null), listMyLeads().catch(() => ({ items: [] as CrmPurchase[] }))])
      .then(([me, leads]) => {
        if (cancelled) return;
        const joinedAt = me?.created_at ? new Date(me.created_at) : new Date();
        setJoined(Number.isNaN(joinedAt.getTime()) ? new Date() : joinedAt);
        setTarget(Number(me?.monthly_target_inr || 0));
        setLoginTarget(Number(me?.monthly_login_target_inr || 0));
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
    () => (joined ? productivitySeries(rows, joined, target, loginTarget, mode) : []),
    [rows, joined, target, loginTarget, mode],
  );
  const current = points[points.length - 1];

  const pie = current ? pieSlices(current.disbursed, current.target, "#10662A").map((slice, index) => ({
    ...slice,
    fill: index === 0 && slice.name === "Done" ? "#10662A" : slice.fill === "#E4F6EA" ? "#c5e6cf" : slice.fill,
  })) : [];

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="rounded-2xl border border-[#d8ecdd] bg-white p-4 shadow-[0_8px_24px_rgba(16,102,42,0.05)] lg:col-span-2">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <TrendingUp className="size-4 text-[#10662A]" />
            <h3 className="text-sm font-semibold text-[#14281c]">Login vs target</h3>
          </div>
          <div className="flex rounded-full bg-[#E8F7EC] p-1">
            {(["month", "quarter", "year"] as const).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setMode(item)}
                className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${mode === item ? "bg-[#10662A] text-white" : "text-[#0D4F20]"}`}
              >
                {item}
              </button>
            ))}
          </div>
        </div>
        {loading ? (
          <div className="grid h-64 place-items-center text-sm text-[#5c4d72]">Loading login…</div>
        ) : (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={points}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="label" fontSize={11} />
                <YAxis fontSize={11} tickFormatter={compact} width={48} />
                <Tooltip formatter={(value, name) => [inr(Number(value || 0)), String(name)]} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="login" name="Login" fill="#10662A" radius={[4, 4, 0, 0]} />
                {loginTarget > 0 ? <Bar dataKey="loginTarget" name="Target" fill="#7dcea0" radius={[4, 4, 0, 0]} /> : null}
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-[#d8ecdd] bg-white p-4 shadow-[0_8px_24px_rgba(16,102,42,0.05)]">
        <h3 className="mb-1 text-sm font-semibold text-[#14281c]">Disbursement {current ? `· ${current.label}` : ""}</h3>
        <p className="mb-2 text-xs text-[#5c4d72]">
          {current ? `${inr(current.disbursed)} · ${pct(current.disbursed, current.target)} of target` : "Marked Disbursed"}
        </p>
        {loading || pie.length === 0 || (current && current.disbursed <= 0 && current.target <= 0) ? (
          <div className="grid h-64 place-items-center text-sm text-[#5c4d72]">{loading ? "Loading…" : "No disbursement yet."}</div>
        ) : (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pie} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={78} label>
                  {pie.map((slice) => (
                    <Cell key={slice.name} fill={slice.fill} />
                  ))}
                </Pie>
                <Tooltip formatter={(value, name) => [inr(Number(value || 0)), String(name)]} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
