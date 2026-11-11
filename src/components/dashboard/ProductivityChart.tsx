import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
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

  return (
    <section className="rounded-3xl border border-[#d8ecdd] bg-white p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-bold text-[#390A5D]">Performance</h2>
          <p className="mt-1 max-w-xl text-xs text-[#5c4d72]">
            Login is the amount sent to a bank. Disbursement is the amount marked Disbursed. Admin sets both monthly targets.
            A sample for a PL/BL caller on ₹20,000 salary is about ₹25 lakh disbursement a month.
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

      {loading || !current ? (
        <p className="mt-3 text-sm text-[#5c4d72]">{loading ? "Loading performance…" : "No period yet."}</p>
      ) : (
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {[
            ["Login", current.login, current.loginTarget],
            ["Disbursement", current.disbursed, current.target],
            ["Login to disbursement", current.disbursed, current.login],
          ].map(([label, actual, goal]) => (
            <div key={String(label)} className="rounded-2xl bg-[#F4FBF6] px-3 py-2.5 ring-1 ring-[#d8ecdd]">
              <p className="text-[10px] font-bold uppercase tracking-wide text-[#5c4d72]">{label}</p>
              <p className="mt-1 font-display text-lg font-bold text-[#0D4F20]">{pct(Number(actual), Number(goal))}</p>
              <p className="text-xs text-[#14281c]">
                {inr(Number(actual))}
                {label === "Login to disbursement" ? ` of ${inr(Number(goal))} login` : ` / ${Number(goal) ? inr(Number(goal)) : "no target"}`}
              </p>
            </div>
          ))}
        </div>
      )}

      {!loading && current ? (
        <div className="mt-3 grid items-center gap-3 lg:grid-cols-[1.4fr_0.8fr]">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-[#390A5D]">Login</p>
            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={points} barGap={2}>
                  <CartesianGrid stroke="#e7f5eb" vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: "#5c4d72", fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={compact} tick={{ fill: "#5c4d72", fontSize: 10 }} axisLine={false} tickLine={false} width={42} />
                  <Tooltip formatter={(value, name) => [inr(Number(value || 0)), String(name)]} />
                  <Bar dataKey="login" name="Login" fill="#390A5D" radius={[4, 4, 0, 0]} />
                  {loginTarget > 0 ? <Bar dataKey="loginTarget" name="Login target" fill="#d4c4e4" radius={[4, 4, 0, 0]} /> : null}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div>
            <p className="text-center text-[11px] font-bold uppercase tracking-wide text-[#10662A]">Disbursement · {current.label}</p>
            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieSlices(current.disbursed, current.target, "#10662A")} dataKey="value" nameKey="name" innerRadius={46} outerRadius={68} paddingAngle={2} stroke="none">
                    {pieSlices(current.disbursed, current.target, "#10662A").map((slice) => (
                      <Cell key={slice.name} fill={slice.fill} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value, name) => [inr(Number(value || 0)), String(name)]} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
