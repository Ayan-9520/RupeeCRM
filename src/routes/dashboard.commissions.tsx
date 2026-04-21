import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, IndianRupee, TrendingUp, Wallet, ArrowUpRight } from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip as RTooltip, CartesianGrid,
  PieChart, Pie, Cell, Legend,
} from "recharts";

export const Route = createFileRoute("/dashboard/commissions")({
  head: () => ({ meta: [{ title: "My Commissions — LeadMines" }] }),
  component: CommissionsPage,
});

type CommissionRow = {
  id: string;
  lead_id: string;
  disbursal_id: string;
  role: string;
  base_amount: number;
  percentage: number;
  amount: number;
  status: "pending" | "credited" | "cancelled";
  credited_at: string | null;
  created_at: string;
  workspace_id: string | null;
  notes: string | null;
};

const ROLE_COLOR: Record<string, string> = {
  company: "hsl(var(--chart-1))",
  manager: "hsl(var(--chart-2))",
  employee: "hsl(var(--chart-3))",
  partner: "hsl(var(--chart-4))",
  referrer: "hsl(var(--chart-5))",
};

function fmt(n: number) {
  return `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

function CommissionsPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<CommissionRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data, error } = await supabase
        .from("commissions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (!error) setRows((data as CommissionRow[]) ?? []);
      setLoading(false);
    })();
  }, [user]);

  const stats = useMemo(() => {
    const credited = rows.filter((r) => r.status === "credited");
    const pending = rows.filter((r) => r.status === "pending");
    return {
      totalCredited: credited.reduce((s, r) => s + Number(r.amount), 0),
      totalPending: pending.reduce((s, r) => s + Number(r.amount), 0),
      count: rows.length,
      countCredited: credited.length,
    };
  }, [rows]);

  const byRole = useMemo(() => {
    const m = new Map<string, number>();
    rows.filter((r) => r.status === "credited").forEach((r) => {
      m.set(r.role, (m.get(r.role) ?? 0) + Number(r.amount));
    });
    return Array.from(m.entries()).map(([role, amount]) => ({ role, amount }));
  }, [rows]);

  const byMonth = useMemo(() => {
    const m = new Map<string, number>();
    rows.filter((r) => r.status === "credited" && r.credited_at).forEach((r) => {
      const k = (r.credited_at as string).slice(0, 7);
      m.set(k, (m.get(k) ?? 0) + Number(r.amount));
    });
    return Array.from(m.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-12)
      .map(([month, amount]) => ({ month, amount }));
  }, [rows]);

  if (loading) return <div className="p-6 flex justify-center"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="container max-w-6xl py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold">Commissions</h1>
          <p className="text-muted-foreground text-sm">Auto-split commissions from disbursed leads.</p>
        </div>
        <Link to="/dashboard/wallet" className="text-sm text-primary inline-flex items-center gap-1">
          View wallet <ArrowUpRight className="size-4" />
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard icon={<Wallet className="size-4" />} label="Total credited" value={fmt(stats.totalCredited)} />
        <StatCard icon={<TrendingUp className="size-4" />} label="Pending" value={fmt(stats.totalPending)} />
        <StatCard icon={<IndianRupee className="size-4" />} label="Entries" value={String(stats.count)} />
        <StatCard icon={<IndianRupee className="size-4" />} label="Credited entries" value={String(stats.countCredited)} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Earnings by month</CardTitle>
            <CardDescription>Credited commissions, last 12 months</CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            {byMonth.length === 0 ? (
              <div className="h-full grid place-items-center text-sm text-muted-foreground">No data yet</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byMonth}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <RTooltip formatter={(v: number) => fmt(Number(v))} />
                  <Bar dataKey="amount" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Split by role</CardTitle>
            <CardDescription>Where credited commissions came from</CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            {byRole.length === 0 ? (
              <div className="h-full grid place-items-center text-sm text-muted-foreground">No data yet</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={byRole} dataKey="amount" nameKey="role" outerRadius={90} label>
                    {byRole.map((d) => (
                      <Cell key={d.role} fill={ROLE_COLOR[d.role] ?? "hsl(var(--muted))"} />
                    ))}
                  </Pie>
                  <Legend />
                  <RTooltip formatter={(v: number) => fmt(Number(v))} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent breakdown</CardTitle>
          <CardDescription>Per-lead commission entries</CardDescription>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <div className="text-sm text-muted-foreground py-8 text-center">No commissions yet. Close and disburse a lead to start earning.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left border-b">
                    <th className="py-2 pr-3">Date</th>
                    <th className="py-2 pr-3">Role</th>
                    <th className="py-2 pr-3">Base</th>
                    <th className="py-2 pr-3">%</th>
                    <th className="py-2 pr-3 text-right">Amount</th>
                    <th className="py-2 pr-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 50).map((r) => (
                    <tr key={r.id} className="border-b last:border-b-0">
                      <td className="py-2 pr-3">{new Date(r.created_at).toLocaleDateString("en-IN")}</td>
                      <td className="py-2 pr-3 capitalize">{r.role}</td>
                      <td className="py-2 pr-3">{fmt(Number(r.base_amount))}</td>
                      <td className="py-2 pr-3">{r.percentage}%</td>
                      <td className="py-2 pr-3 text-right font-semibold">{fmt(Number(r.amount))}</td>
                      <td className="py-2 pr-3">
                        <Badge variant={r.status === "credited" ? "default" : r.status === "pending" ? "secondary" : "outline"}>
                          {r.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-muted-foreground text-xs">{icon}{label}</div>
        <div className="font-display text-2xl font-bold mt-1">{value}</div>
      </CardContent>
    </Card>
  );
}
