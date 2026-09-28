import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Building2, Users, ArrowRight, TrendingUp, ShieldCheck, Store, IndianRupee,
  Trophy, FileDown, Loader2,
} from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/ceo/")({
  head: () => ({ meta: [{ title: "CEO Overview — RupeeDial One" }] }),
  component: CeoOverview,
  beforeLoad: async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw redirect({ to: "/auth" });
  },
});

type WsRow = { workspace_id: string; name: string; parent_workspace_id: string | null; depth: number };
type Performer = { name: string; conversions: number; revenue: number };
type DailyPoint = { day: string; leads: number; sales: number };

interface Kpis {
  totalLeads: number;
  verifiedLeads: number;
  marketplaceSales: number;
  revenue: number;
  totalWorkspaces: number;
  topPerformers: Performer[];
  daily: DailyPoint[];
  byProduct: { name: string; value: number }[];
}

const fmtINR = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n || 0);

const PIE_COLORS = ["hsl(var(--accent))", "hsl(var(--primary))", "#f59e0b", "#10b981", "#8b5cf6", "#ef4444"];

function CeoOverview() {
  const [rows, setRows] = useState<WsRow[]>([]);
  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [exporting, setExporting] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setAllowed(false); setLoading(false); return; }
      const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
      const ok = (roles ?? []).some((r) => r.role === "ceo" || r.role === "super_admin" || r.role === "admin");
      setAllowed(ok);
      if (!ok) { setLoading(false); return; }

      const { data: wsData } = await supabase.rpc("get_ceo_workspaces", { _user_id: user.id });
      const wsRows = (wsData as WsRow[]) ?? [];
      setRows(wsRows);

      // Fetch KPIs over last 7 days
      const since = new Date(Date.now() - 7 * 86400000).toISOString();

      const [leadsRes, purchasesRes, profilesRes] = await Promise.all([
        supabase.from("leads").select("id, phone_verified, is_marketplace, product_category, created_at, price"),
        supabase.from("lead_purchases").select("id, dsa_id, price_paid, deal_value, converted, created_at"),
        supabase.from("profiles").select("id, full_name"),
      ]);

      const leads = leadsRes.data ?? [];
      const purchases = purchasesRes.data ?? [];
      const profiles = profilesRes.data ?? [];
      const profileMap = new Map(profiles.map((p: any) => [p.id, p.full_name || "Unknown"]));

      const totalLeads = leads.length;
      const verifiedLeads = leads.filter((l: any) => l.phone_verified).length;
      const marketplaceSales = purchases.length;
      const revenue = purchases.reduce((s: number, p: any) => s + Number(p.price_paid || 0), 0);

      // Top performers (by purchases revenue)
      const perfMap = new Map<string, Performer>();
      for (const p of purchases as any[]) {
        const name = profileMap.get(p.dsa_id) || "Unknown";
        const cur = perfMap.get(p.dsa_id) || { name, conversions: 0, revenue: 0 };
        cur.conversions += p.converted ? 1 : 0;
        cur.revenue += Number(p.deal_value || p.price_paid || 0);
        perfMap.set(p.dsa_id, cur);
      }
      const topPerformers = Array.from(perfMap.values())
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5);

      // Daily series (last 7 days)
      const days: DailyPoint[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(Date.now() - i * 86400000);
        const key = d.toISOString().slice(0, 10);
        days.push({
          day: d.toLocaleDateString("en-IN", { weekday: "short" }),
          leads: leads.filter((l: any) => l.created_at?.slice(0, 10) === key && l.created_at >= since).length,
          sales: purchases.filter((p: any) => p.created_at?.slice(0, 10) === key && p.created_at >= since).length,
        });
      }

      // By product category
      const catMap = new Map<string, number>();
      for (const l of leads as any[]) {
        const k = l.product_category || "other";
        catMap.set(k, (catMap.get(k) || 0) + 1);
      }
      const byProduct = Array.from(catMap.entries()).map(([name, value]) => ({ name, value }));

      setKpis({
        totalLeads, verifiedLeads, marketplaceSales, revenue,
        totalWorkspaces: wsRows.length,
        topPerformers, daily: days, byProduct,
      });
      setLoading(false);
    })();
  }, []);

  const exportPdf = async () => {
    if (!kpis || !reportRef.current) return;
    setExporting(true);
    try {
      const [{ jsPDF }, html2canvasMod] = await Promise.all([
        import("jspdf"),
        import("html2canvas"),
      ]);
      const html2canvas = (html2canvasMod as any).default || html2canvasMod;
      const canvas = await html2canvas(reportRef.current, {
        backgroundColor: "#ffffff",
        scale: 2,
        useCORS: true,
      });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pageWidth - 20;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      pdf.setFontSize(16);
      pdf.text("Weekly CEO Report", 10, 12);
      pdf.setFontSize(10);
      pdf.text(`Generated: ${new Date().toLocaleString("en-IN")}`, 10, 18);

      let y = 24;
      let remaining = imgHeight;
      let position = 0;
      while (remaining > 0) {
        const sliceHeight = Math.min(remaining, pageHeight - y - 10);
        pdf.addImage(imgData, "PNG", 10, y - position, imgWidth, imgHeight);
        remaining -= sliceHeight;
        position += sliceHeight;
        if (remaining > 0) { pdf.addPage(); y = 10; }
      }
      pdf.save(`ceo-weekly-report-${new Date().toISOString().slice(0, 10)}.pdf`);
      toast.success("Report exported");
    } catch (e: any) {
      toast.error(e?.message ?? "Export failed");
    } finally {
      setExporting(false);
    }
  };

  if (loading) return <div className="p-10 text-muted-foreground flex items-center gap-2"><Loader2 className="size-4 animate-spin"/>Loading…</div>;
  if (allowed === false) {
    return (
      <div className="p-10">
        <h1 className="text-2xl font-display font-semibold">Restricted</h1>
        <p className="text-muted-foreground mt-2">CEO / super-admin access required.</p>
        <Link to="/dashboard" className="text-accent text-sm mt-4 inline-flex items-center gap-1">Back to dashboard <ArrowRight className="size-4"/></Link>
      </div>
    );
  }

  const roots = rows.filter((r) => r.depth === 0);
  const children = (parentId: string) => rows.filter((r) => r.parent_workspace_id === parentId);

  return (
    <div className="min-h-screen bg-background text-foreground py-8 px-5">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-accent/15 grid place-items-center"><Building2 className="size-5 text-accent"/></div>
            <div>
              <h1 className="text-2xl font-display font-semibold">CEO overview</h1>
              <p className="text-sm text-muted-foreground">Org-wide KPIs over the last 7 days.</p>
            </div>
          </div>
          <Button onClick={exportPdf} disabled={exporting} className="gap-2">
            {exporting ? <Loader2 className="size-4 animate-spin"/> : <FileDown className="size-4"/>}
            Export weekly PDF
          </Button>
        </div>

        <div ref={reportRef} className="space-y-6 bg-background p-2">
          {/* KPI cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <KpiCard icon={<Users className="size-4"/>} label="Total leads" value={String(kpis?.totalLeads ?? 0)} />
            <KpiCard icon={<ShieldCheck className="size-4"/>} label="Verified leads" value={String(kpis?.verifiedLeads ?? 0)} />
            <KpiCard icon={<Store className="size-4"/>} label="Marketplace sales" value={String(kpis?.marketplaceSales ?? 0)} />
            <KpiCard icon={<IndianRupee className="size-4"/>} label="Revenue (7d)" value={fmtINR(kpis?.revenue ?? 0)} />
            <KpiCard icon={<Building2 className="size-4"/>} label="Workspaces" value={String(kpis?.totalWorkspaces ?? 0)} />
          </div>

          {/* Charts */}
          <div className="grid lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 rounded-2xl border border-border p-4 bg-card">
              <div className="flex items-center gap-2 mb-3"><TrendingUp className="size-4 text-accent"/><h3 className="font-semibold text-sm">Daily leads vs sales</h3></div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={kpis?.daily ?? []}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3}/>
                    <XAxis dataKey="day" fontSize={11}/>
                    <YAxis fontSize={11}/>
                    <Tooltip/>
                    <Legend wrapperStyle={{ fontSize: 12 }}/>
                    <Bar dataKey="leads" fill="hsl(var(--accent))" radius={[4,4,0,0]}/>
                    <Bar dataKey="sales" fill="hsl(var(--primary))" radius={[4,4,0,0]}/>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="rounded-2xl border border-border p-4 bg-card">
              <h3 className="font-semibold text-sm mb-3">Leads by product</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={kpis?.byProduct ?? []} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label>
                      {(kpis?.byProduct ?? []).map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]}/>)}
                    </Pie>
                    <Tooltip/>
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Top performers */}
          <div className="rounded-2xl border border-border p-4 bg-card">
            <div className="flex items-center gap-2 mb-3"><Trophy className="size-4 text-accent"/><h3 className="font-semibold text-sm">Top performers</h3></div>
            {(kpis?.topPerformers ?? []).length === 0 ? (
              <div className="text-sm text-muted-foreground py-4 text-center">No purchases yet.</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="text-xs uppercase tracking-wide text-muted-foreground border-b border-border">
                  <tr><th className="text-left py-2">#</th><th className="text-left py-2">Partner</th><th className="text-right py-2">Conversions</th><th className="text-right py-2">Revenue</th></tr>
                </thead>
                <tbody>
                  {kpis!.topPerformers.map((p, i) => (
                    <tr key={i} className="border-b border-border/50 last:border-0">
                      <td className="py-2 text-muted-foreground">{i + 1}</td>
                      <td className="py-2 font-medium">{p.name}</td>
                      <td className="py-2 text-right">{p.conversions}</td>
                      <td className="py-2 text-right font-semibold">{fmtINR(p.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Workspaces */}
          {roots.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-semibold text-sm flex items-center gap-2"><Building2 className="size-4 text-accent"/>Organization workspaces</h3>
              {roots.map((root) => (
                <div key={root.workspace_id} className="rounded-2xl border border-border p-4 bg-card">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Building2 className="size-5 text-accent" />
                      <div>
                        <div className="font-display font-semibold">{root.name}</div>
                        <div className="text-xs text-muted-foreground">Main organization</div>
                      </div>
                    </div>
                    <Link to="/dashboard" className="text-sm text-accent inline-flex items-center gap-1">Open <ArrowRight className="size-4"/></Link>
                  </div>
                  {children(root.workspace_id).length > 0 && (
                    <div className="mt-4 pl-4 border-l border-border space-y-2">
                      <div className="text-xs uppercase tracking-wide text-muted-foreground flex items-center gap-1.5"><Users className="size-3.5"/> Partner sub-tenants</div>
                      {children(root.workspace_id).map((c) => (
                        <div key={c.workspace_id} className="flex items-center justify-between rounded-lg bg-background border border-border px-3 py-2">
                          <span className="text-sm">{c.name}</span>
                          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">depth {c.depth}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function KpiCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border p-4 bg-card">
      <div className="flex items-center gap-2 text-muted-foreground text-xs">{icon}{label}</div>
      <div className="text-xl font-display font-semibold mt-1.5">{value}</div>
    </div>
  );
}
