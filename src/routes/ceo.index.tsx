import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  Building2, Users, ArrowRight, TrendingUp, ShieldCheck, Store, IndianRupee,
  Trophy, FileDown, Loader2, BadgeCheck, Wallet, UserPlus, Banknote,
} from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { isPlatformAdmin } from "@/lib/role-access";
import { getAdminOverview, type AdminOverview } from "@/lib/python-api";

export const Route = createFileRoute("/ceo/")({
  head: () => ({ meta: [{ title: "CEO Overview — RupeeDial One" }] }),
  component: CeoOverview,
});

const fmtINR = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n || 0);

const PIE_COLORS = ["#10662A", "#390A5D", "#f59e0b", "#14b8a6", "#8b5cf6", "#ef4444", "#64748b"];

function CeoOverview() {
  const { user, role, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState<AdminOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);
  const allowed = isPlatformAdmin(role);

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/auth", search: { next: "/ceo" } as never });
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (authLoading || !user) return;
    if (!allowed) {
      setLoading(false);
      return;
    }
    getAdminOverview()
      .then(setData)
      .catch((e: Error) => toast.error(e.message || "Could not load overview"))
      .finally(() => setLoading(false));
  }, [authLoading, user, allowed]);

  const exportPdf = async () => {
    if (!data || !reportRef.current) return;
    setExporting(true);
    try {
      const [{ jsPDF }, html2canvasMod] = await Promise.all([import("jspdf"), import("html2canvas")]);
      const html2canvas = html2canvasMod.default;
      const canvas = await html2canvas(reportRef.current, { backgroundColor: "#ffffff", scale: 2, useCORS: true });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pageWidth - 20;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      pdf.setFontSize(16);
      pdf.text("RupeeDial CEO Report", 10, 12);
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
        if (remaining > 0) {
          pdf.addPage();
          y = 10;
        }
      }
      pdf.save(`ceo-report-${new Date().toISOString().slice(0, 10)}.pdf`);
      toast.success("Report exported");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    } finally {
      setExporting(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen grid place-items-center bg-[#F5FBF7]">
        <Loader2 className="size-6 animate-spin text-[#10662A]" />
      </div>
    );
  }

  if (!allowed) {
    return (
      <div className="min-h-screen grid place-items-center bg-[#F5FBF7] p-6">
        <div className="rounded-2xl border border-[#d8ecdd] bg-white p-8 text-center">
          <h1 className="font-display text-2xl font-bold text-[#390A5D]">Restricted</h1>
          <p className="mt-2 text-sm text-[#5c4d72]">CEO / admin access required.</p>
          <Link to="/dashboard" className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-[#10662A]">
            Back to dashboard <ArrowRight className="size-4" />
          </Link>
        </div>
      </div>
    );
  }

  const k = data?.kpis;
  const roles = Object.entries(data?.roles ?? {}).sort((a, b) => b[1] - a[1]);

  return (
    <div className="min-h-screen bg-[#F5FBF7] py-8 px-5">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-[#E8F7EC] grid place-items-center">
              <Building2 className="size-5 text-[#10662A]" />
            </div>
            <div>
              <h1 className="font-display text-2xl font-bold text-[#390A5D]">CEO overview</h1>
              <p className="text-sm text-[#5c4d72]">Org-wide totals with a 14-day activity trend.</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Link
              to="/dashboard"
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#d8ecdd] bg-white px-3 py-2 text-sm font-semibold text-[#390A5D]"
            >
              Dashboard
            </Link>
            <button
              onClick={exportPdf}
              disabled={exporting || !data}
              className="inline-flex items-center gap-2 rounded-xl bg-[#10662A] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {exporting ? <Loader2 className="size-4 animate-spin" /> : <FileDown className="size-4" />}
              Export PDF
            </button>
          </div>
        </div>

        <div ref={reportRef} className="space-y-6 bg-[#F5FBF7] p-2">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <KpiCard icon={<Users className="size-4" />} label="Total leads" value={String(k?.total_leads ?? 0)} />
            <KpiCard icon={<ShieldCheck className="size-4" />} label="Verified leads" value={String(k?.verified_leads ?? 0)} />
            <KpiCard icon={<Store className="size-4" />} label="Marketplace sales" value={String(k?.marketplace_sales ?? 0)} />
            <KpiCard icon={<IndianRupee className="size-4" />} label="Lead revenue" value={fmtINR(k?.lead_revenue ?? 0)} />
            <KpiCard icon={<BadgeCheck className="size-4" />} label="Conversions" value={String(k?.conversions ?? 0)} />
            <KpiCard icon={<Banknote className="size-4" />} label="Disbursed value" value={fmtINR(k?.disbursed_value ?? 0)} />
            <KpiCard icon={<Users className="size-4" />} label="Active partners" value={String(k?.active_partners ?? 0)} />
            <KpiCard icon={<Building2 className="size-4" />} label="Team members" value={String(k?.team_members ?? 0)} />
            <KpiCard
              icon={<UserPlus className="size-4" />}
              label="Pending applications"
              value={String(k?.pending_partner_applications ?? 0)}
              to="/dashboard/admin/partners"
            />
            <KpiCard
              icon={<Wallet className="size-4" />}
              label="Pending payouts"
              value={fmtINR(k?.pending_payout_amount ?? 0)}
              to="/dashboard/admin/payouts"
            />
          </div>

          <div className="grid lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 rounded-2xl border border-[#d8ecdd] p-4 bg-white">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="size-4 text-[#10662A]" />
                <h3 className="font-semibold text-sm text-[#390A5D]">Daily leads vs sales (14 days)</h3>
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data?.daily ?? []}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="day" fontSize={11} />
                    <YAxis fontSize={11} allowDecimals={false} />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="leads" fill="#10662A" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="sales" fill="#390A5D" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="rounded-2xl border border-[#d8ecdd] p-4 bg-white">
              <h3 className="font-semibold text-sm mb-3 text-[#390A5D]">Leads by product</h3>
              {(data?.by_product ?? []).length === 0 ? (
                <div className="h-64 grid place-items-center text-sm text-[#5c4d72]">No leads yet.</div>
              ) : (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={data?.by_product ?? []} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label>
                        {(data?.by_product ?? []).map((_, i) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>

          <div className="grid lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 rounded-2xl border border-[#d8ecdd] p-4 bg-white">
              <div className="flex items-center gap-2 mb-3">
                <Trophy className="size-4 text-[#10662A]" />
                <h3 className="font-semibold text-sm text-[#390A5D]">Top performers</h3>
              </div>
              {(data?.top_performers ?? []).length === 0 ? (
                <div className="text-sm text-[#5c4d72] py-4 text-center">No purchases yet.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-xs uppercase tracking-wide text-[#5c4d72] border-b border-[#e2efe6]">
                      <tr>
                        <th className="text-left py-2">#</th>
                        <th className="text-left py-2">Partner</th>
                        <th className="text-right py-2">Purchases</th>
                        <th className="text-right py-2">Conversions</th>
                        <th className="text-right py-2">Disbursed</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data!.top_performers.map((p, i) => (
                        <tr key={i} className="border-b border-[#e2efe6]/60 last:border-0">
                          <td className="py-2 text-[#5c4d72]">{i + 1}</td>
                          <td className="py-2 font-medium text-[#390A5D]">{p.name}</td>
                          <td className="py-2 text-right">{p.purchases}</td>
                          <td className="py-2 text-right">{p.conversions}</td>
                          <td className="py-2 text-right font-semibold text-[#10662A]">{fmtINR(p.revenue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <div className="rounded-2xl border border-[#d8ecdd] p-4 bg-white">
              <h3 className="font-semibold text-sm mb-3 text-[#390A5D]">Active users by role</h3>
              <ul className="space-y-2 text-sm">
                {roles.map(([r, n]) => (
                  <li key={r} className="flex items-center justify-between rounded-lg bg-[#F5FBF7] px-3 py-2">
                    <span className="capitalize text-[#390A5D]">{r.replace(/_/g, " ")}</span>
                    <span className="font-semibold text-[#10662A]">{n}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function KpiCard({ icon, label, value, to }: { icon: React.ReactNode; label: string; value: string; to?: string }) {
  const body = (
    <>
      <div className="flex items-center gap-2 text-[#5c4d72] text-xs">
        {icon}
        {label}
      </div>
      <div className="text-xl font-display font-bold mt-1.5 text-[#390A5D]">{value}</div>
    </>
  );
  if (to) {
    return (
      <Link to={to as "/dashboard"} className="rounded-2xl border border-[#d8ecdd] p-4 bg-white hover:border-[#10662A]/40">
        {body}
      </Link>
    );
  }
  return <div className="rounded-2xl border border-[#d8ecdd] p-4 bg-white">{body}</div>;
}
