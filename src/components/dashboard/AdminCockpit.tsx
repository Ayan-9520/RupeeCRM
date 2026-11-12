import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, BadgeCheck, CreditCard, Globe, IndianRupee, Loader2, Users } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  getAdminOverview,
  getAdminSubscriptions,
  listCrmLeads,
  type AdminOverview,
  type CrmLead,
} from "@/lib/python-api";

const PIE = ["#0D4F20", "#10662A", "#1f8a4c", "#7dcea0", "#c5e6cf"];

function inr(n: number) {
  return `₹${Math.round(Number(n) || 0).toLocaleString("en-IN")}`;
}

function when(iso: string) {
  return new Date(iso).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  });
}

export function AdminCockpit({ firstName }: { firstName: string }) {
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [plans, setPlans] = useState({ count: 0, value: 0 });
  const [leads, setLeads] = useState<CrmLead[]>([]);
  const [leadTotal, setLeadTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let live = true;
    Promise.all([
      getAdminOverview().catch(() => null),
      getAdminSubscriptions().catch(() => null),
      listCrmLeads({ source: "website", limit: 6 }).catch(() => ({ items: [] as CrmLead[], total: 0 })),
    ]).then(([company, billing, website]) => {
      if (!live) return;
      setOverview(company);
      setPlans({ count: billing?.active_count ?? 0, value: billing?.active_value ?? 0 });
      setLeads(website.items ?? []);
      setLeadTotal(website.total ?? 0);
      setLoading(false);
    });
    return () => {
      live = false;
    };
  }, []);

  const k = overview?.kpis;
  const today = new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" });
  const attention = [
    {
      label: "Partner applications",
      value: loading ? "…" : String(k?.pending_partner_applications ?? 0),
      hint: "Waiting for approval",
      to: "/dashboard/admin/partners",
      icon: Users,
      hot: (k?.pending_partner_applications ?? 0) > 0,
    },
    {
      label: "Website leads",
      value: loading ? "…" : String(leadTotal),
      hint: "From rupeedial.com",
      to: "/dashboard/website-leads",
      icon: Globe,
      hot: false,
    },
    {
      label: "Payouts waiting",
      value: loading ? "…" : inr(k?.pending_payout_amount ?? 0),
      hint: "Not paid out yet",
      to: "/dashboard/admin/payouts",
      icon: IndianRupee,
      hot: (k?.pending_payout_amount ?? 0) > 0,
    },
    {
      label: "Active plans",
      value: loading ? "…" : String(plans.count),
      hint: loading ? "Plan value" : `${inr(plans.value)} on plans`,
      to: "/dashboard/admin/billing",
      icon: CreditCard,
      hot: false,
    },
  ] as const;

  const company = [
    ["Leads in the book", loading ? "…" : String(k?.total_leads ?? 0)],
    ["Leads sold", loading ? "…" : String(k?.marketplace_sales ?? 0)],
    ["Lead revenue", loading ? "…" : inr(k?.lead_revenue ?? 0)],
    ["Disbursed value", loading ? "…" : inr(k?.disbursed_value ?? 0)],
  ];

  const work = [
    { title: "Approve partners", desc: "A login is created after you approve.", to: "/dashboard/admin/partners" },
    { title: "Price website leads", desc: "Forms that came in from rupeedial.com.", to: "/dashboard/website-leads" },
    { title: "Move invoices", desc: "RM1, RM2, then Accounts.", to: "/dashboard/invoice-approvals" },
    { title: "Billing", desc: "Plans, payments, and a bank-transfer activation.", to: "/dashboard/admin/billing" },
    { title: "Payouts", desc: "What is still to be paid to partners.", to: "/dashboard/admin/payouts" },
    { title: "Users", desc: "Staff and partner logins.", to: "/dashboard/admin/users" },
  ] as const;

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <section className="rounded-2xl bg-[#0D4F20] px-5 py-4 text-white shadow-[0_12px_28px_rgba(13,79,32,0.16)]">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/70">Admin · RupeeOne</div>
            <h1 className="mt-1 font-display text-2xl font-bold tracking-tight">
              {firstName ? `${firstName}'s desk` : "Operations desk"}
            </h1>
            <p className="mt-1 text-sm text-white/75">Partners, website leads, payouts and plans.</p>
          </div>
          <div className="text-xs font-medium text-white/70">{today}</div>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {attention.map((card) => (
          <Link
            key={card.label}
            to={card.to}
            className={`group rounded-2xl border bg-white p-4 shadow-[0_4px_16px_rgba(16,102,42,0.04)] transition-colors hover:bg-[#0D4F20] ${
              card.hot ? "border-[#10662A]" : "border-[#d8ecdd]"
            }`}
          >
            <div className="flex items-center justify-between">
              <card.icon className="size-4 text-[#10662A] group-hover:text-white" />
              <ArrowRight className="size-3.5 text-[#10662A] opacity-0 transition-opacity group-hover:text-white group-hover:opacity-100" />
            </div>
            <div className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-[#5c4d72] group-hover:text-white/75">{card.label}</div>
            <div className="mt-1 font-display text-2xl font-bold text-[#0D4F20] group-hover:text-white">{card.value}</div>
            <div className="mt-1 text-[11px] text-[#8a7aa0] group-hover:text-white/70">{card.hint}</div>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {company.map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-[#d8ecdd] bg-white px-4 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-[#5c4d72]">{label}</div>
            <div className="mt-1 font-display text-xl font-bold text-[#390A5D]">{value}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <section className="rounded-2xl border border-[#d8ecdd] bg-white p-4 shadow-[0_4px_16px_rgba(16,102,42,0.04)] lg:col-span-2">
          <h2 className="font-display text-sm font-bold text-[#390A5D]">Leads and sales · 14 days</h2>
          <div className="mt-3 h-56">
            {loading ? (
              <div className="grid h-full place-items-center"><Loader2 className="size-5 animate-spin text-[#10662A]" /></div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={overview?.daily ?? []} barGap={4} barCategoryGap="42%">
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e7f5eb" />
                  <XAxis dataKey="day" tick={{ fontSize: 11, fill: "#5c4d72" }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#5c4d72" }} axisLine={false} tickLine={false} width={28} />
                  <Tooltip />
                  <Bar dataKey="leads" name="Leads" fill="#10662A" maxBarSize={12} radius={[3, 3, 0, 0]} />
                  <Bar dataKey="sales" name="Sold" fill="#7dcea0" maxBarSize={12} radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </section>
        <section className="rounded-2xl border border-[#d8ecdd] bg-white p-4 shadow-[0_4px_16px_rgba(16,102,42,0.04)]">
          <h2 className="font-display text-sm font-bold text-[#390A5D]">Leads by product</h2>
          {(overview?.by_product ?? []).length === 0 ? (
            <div className="grid h-56 place-items-center text-sm text-[#5c4d72]">No leads yet.</div>
          ) : (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={overview?.by_product ?? []} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={42} outerRadius={68}>
                    {(overview?.by_product ?? []).map((_, index) => (
                      <Cell key={index} fill={PIE[index % PIE.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>
      </div>

      <div className="grid gap-3 lg:grid-cols-5">
        <section className="overflow-hidden rounded-2xl border border-[#d8ecdd] bg-white shadow-[0_4px_16px_rgba(16,102,42,0.04)] lg:col-span-3">
          <div className="flex items-center justify-between border-b border-[#d8ecdd] px-4 py-3">
            <h2 className="font-display text-sm font-bold text-[#390A5D]">Latest website leads</h2>
            <Link to="/dashboard/website-leads" className="text-xs font-bold text-[#10662A] hover:underline">Open</Link>
          </div>
          {leads.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-[#5c4d72]">{loading ? "Loading…" : "No website lead yet."}</p>
          ) : (
            <table className="w-full text-sm">
              <tbody>
                {leads.map((lead) => (
                  <tr key={lead.id} className="border-t border-[#eef6f0]">
                    <td className="px-4 py-2.5">
                      <div className="font-medium text-[#390A5D]">{lead.applicant_name}</div>
                      <div className="text-xs text-[#5c4d72]">{lead.city || "—"} · {lead.product_subtype || lead.product_category}</div>
                    </td>
                    <td className="px-3 py-2.5 text-right text-xs text-[#5c4d72]">{when(lead.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="rounded-2xl border border-[#d8ecdd] bg-white p-4 lg:col-span-2">
          <h2 className="font-display text-sm font-bold text-[#390A5D]">Today's work</h2>
          <div className="mt-3 space-y-1.5">
            {work.map((item) => (
              <Link key={item.to} to={item.to} className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-[#F4FBF6]">
                <BadgeCheck className="size-4 shrink-0 text-[#10662A]" />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-[#390A5D]">{item.title}</span>
                  <span className="block truncate text-xs text-[#5c4d72]">{item.desc}</span>
                </span>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
