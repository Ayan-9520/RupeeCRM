import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { PLAN_DISPLAY, inr, type PlanCode, type BillingCycle } from "@/lib/subscription";
import { Loader2, TrendingUp, Receipt, Users, Wallet, Crown, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/dashboard/admin/billing")({
  head: () => ({ meta: [{ title: "Billing Overview — Admin" }] }),
  component: AdminBilling,
});

interface InvoiceRow {
  id: string;
  invoice_number: string;
  workspace_id: string;
  plan_code: PlanCode;
  cycle: BillingCycle;
  total_amount: number;
  subtotal: number;
  gst_amount: number;
  status: string;
  created_at: string;
  paid_at: string | null;
  billing_name: string | null;
}

interface SubRow {
  id: string;
  workspace_id: string;
  plan_code: PlanCode;
  cycle: BillingCycle;
  status: string;
  total_amount: number;
  current_period_end: string;
}

interface WorkspaceRow {
  id: string;
  name: string;
}

function AdminBilling() {
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [subs, setSubs] = useState<SubRow[]>([]);
  const [workspaces, setWorkspaces] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [invRes, subRes, wsRes] = await Promise.all([
        supabase.from("invoices").select("id,invoice_number,workspace_id,plan_code,cycle,total_amount,subtotal,gst_amount,status,created_at,paid_at,billing_name")
          .order("created_at", { ascending: false }).limit(100),
        supabase.from("subscriptions").select("id,workspace_id,plan_code,cycle,status,total_amount,current_period_end")
          .eq("status", "active"),
        supabase.from("workspaces").select("id,name"),
      ]);
      setInvoices((invRes.data ?? []) as InvoiceRow[]);
      setSubs((subRes.data ?? []) as SubRow[]);
      const map: Record<string, string> = {};
      (wsRes.data as WorkspaceRow[] | null ?? []).forEach((w) => { map[w.id] = w.name; });
      setWorkspaces(map);
      setLoading(false);
    })();
  }, []);

  if (loading) return <div className="py-16 grid place-items-center"><Loader2 className="size-6 animate-spin text-accent" /></div>;

  // Stats
  const paidInvoices = invoices.filter((i) => i.status === "paid");
  const totalRevenue = paidInvoices.reduce((s, i) => s + Number(i.total_amount), 0);
  const totalGstCollected = paidInvoices.reduce((s, i) => s + Number(i.gst_amount), 0);

  // MRR — normalize each active sub to monthly recurring
  const mrr = subs.reduce((s, sub) => {
    const amt = Number(sub.total_amount);
    if (sub.cycle === "monthly") return s + amt;
    if (sub.cycle === "quarterly") return s + amt / 3;
    if (sub.cycle === "yearly") return s + amt / 12;
    return s;
  }, 0);

  // Plan distribution
  const planCounts: Record<PlanCode, number> = { free: 0, starter: 0, growth: 0, pro: 0, enterprise: 0 };
  subs.forEach((s) => { planCounts[s.plan_code] = (planCounts[s.plan_code] ?? 0) + 1; });

  // 30-day revenue
  const thirtyDaysAgo = Date.now() - 30 * 24 * 3600_000;
  const last30Revenue = paidInvoices
    .filter((i) => new Date(i.paid_at ?? i.created_at).getTime() >= thirtyDaysAgo)
    .reduce((s, i) => s + Number(i.total_amount), 0);

  const totalActiveSubs = subs.length;

  return (
    <div className="space-y-6 max-w-7xl">
      <div>
        <h1 className="font-display text-2xl lg:text-3xl font-bold">Billing Overview</h1>
        <p className="text-muted-foreground text-sm mt-1">Subscriptions, MRR, GST collected and recent invoices across all workspaces.</p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi icon={TrendingUp} label="MRR" value={inr(mrr)} sub={`${totalActiveSubs} active subscription${totalActiveSubs === 1 ? "" : "s"}`} accent />
        <Kpi icon={Wallet} label="Total revenue" value={inr(totalRevenue)} sub={`${paidInvoices.length} paid invoices`} />
        <Kpi icon={Calendar} label="Last 30 days" value={inr(last30Revenue)} sub="Paid invoices" />
        <Kpi icon={Receipt} label="GST collected" value={inr(totalGstCollected)} sub="Across all invoices" />
      </div>

      {/* Plan distribution */}
      <div className="rounded-2xl border border-border bg-card p-5">
        <h2 className="font-semibold text-sm flex items-center gap-2 mb-4">
          <Users className="size-4 text-accent" /> Plan distribution
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {(Object.keys(planCounts) as PlanCode[]).map((code) => {
            const count = planCounts[code];
            const pct = totalActiveSubs > 0 ? Math.round((count / totalActiveSubs) * 100) : 0;
            return (
              <div key={code} className="rounded-xl border border-border bg-background p-3">
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold flex items-center gap-1">
                  <Crown className={cn("size-3", PLAN_DISPLAY[code].color)} /> {PLAN_DISPLAY[code].name}
                </div>
                <div className="font-display text-2xl font-bold mt-1">{count}</div>
                <div className="text-[11px] text-muted-foreground">{pct}% of base</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recent invoices */}
      <div className="space-y-2">
        <h2 className="font-display text-lg font-bold flex items-center gap-2">
          <Receipt className="size-5 text-accent" /> Recent invoices
        </h2>
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary/50 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-3">Invoice #</th>
                  <th className="text-left px-4 py-3">Workspace</th>
                  <th className="text-left px-4 py-3">Plan</th>
                  <th className="text-left px-4 py-3">Cycle</th>
                  <th className="text-right px-4 py-3">Amount</th>
                  <th className="text-left px-4 py-3">Status</th>
                  <th className="text-left px-4 py-3">Date</th>
                </tr>
              </thead>
              <tbody>
                {invoices.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">No invoices yet.</td></tr>
                ) : invoices.map((inv) => (
                  <tr key={inv.id} className="border-t border-border hover:bg-secondary/30">
                    <td className="px-4 py-3 font-mono text-xs">{inv.invoice_number}</td>
                    <td className="px-4 py-3 truncate max-w-[200px]">{workspaces[inv.workspace_id] ?? "—"}</td>
                    <td className="px-4 py-3">{PLAN_DISPLAY[inv.plan_code].name}</td>
                    <td className="px-4 py-3 capitalize text-muted-foreground text-xs">{inv.cycle}</td>
                    <td className="px-4 py-3 text-right font-mono font-semibold">{inr(Number(inv.total_amount))}</td>
                    <td className="px-4 py-3">
                      <Badge variant={inv.status === "paid" ? "default" : "secondary"} className="capitalize">{inv.status}</Badge>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {new Date(inv.paid_at ?? inv.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function Kpi({ icon: Icon, label, value, sub, accent }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string; value: string; sub: string; accent?: boolean;
}) {
  return (
    <div className={cn(
      "rounded-2xl border p-4",
      accent ? "border-accent/40 bg-gradient-to-br from-accent/10 to-transparent" : "border-border bg-card",
    )}>
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">
        <Icon className="size-3.5" /> {label}
      </div>
      <div className="font-display text-2xl font-bold mt-1">{value}</div>
      <div className="text-[11px] text-muted-foreground mt-0.5">{sub}</div>
    </div>
  );
}
