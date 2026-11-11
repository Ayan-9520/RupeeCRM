import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  BadgeIndianRupee,
  Calculator,
  FileText,
  GraduationCap,
  KanbanSquare,
  Landmark,
  LifeBuoy,
  Network,
  Receipt,
  Store,
  Users,
  Wallet,
} from "lucide-react";
import {
  getBillingMe,
  listMyLeads,
  listMyPayoutRequests,
  type CrmPurchase,
} from "@/lib/python-api";

const LOGIN_STAGES = new Set(["bank_submitted", "submitted"]);
const SANCTION_STAGES = new Set(["sanctioned", "approved"]);
const CLOSED = new Set(["disbursed", "rejected"]);

function inr(n: number) {
  const v = Number(n) || 0;
  return `₹${Math.round(v).toLocaleString("en-IN")}`;
}

function isToday(iso: string | null | undefined) {
  if (!iso) return false;
  const d = new Date(iso);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}

function amountOf(row: CrmPurchase) {
  return Number(row.deal_value || row.lead?.loan_amount || 0);
}

const GROUPS = [
  {
    title: "Pipeline",
    items: [
      { title: "Leads", desc: "Pipeline and follow-ups", to: "/dashboard/my-leads", icon: KanbanSquare },
      { title: "Customers", desc: "People on your cases", to: "/dashboard/my-leads", icon: Users },
      { title: "Applications", desc: "Login to disbursal", to: "/dashboard/cases", icon: FileText },
      { title: "Documents", desc: "Open a case to collect docs", to: "/dashboard/my-leads", icon: FileText },
      { title: "Lender match", desc: "Cases with lenders", to: "/dashboard/cases", icon: Landmark },
      { title: "EMI calculator", desc: "Quote an instalment on a call", to: "/dashboard/emi", icon: Calculator },
    ],
  },
  {
    title: "Money",
    items: [
      { title: "Payout", desc: "Commission and requests", to: "/dashboard/earnings", icon: BadgeIndianRupee },
      { title: "Invoice", desc: "Raise and track commission invoices", to: "/dashboard/earnings", icon: Receipt },
      { title: "Lead wallet", desc: "Buy from the marketplace", to: "/dashboard/wallet", icon: Wallet },
    ],
  },
  {
    title: "Grow",
    items: [
      { title: "Network", desc: "Connectors, invites and revenue share", to: "/dashboard/network", icon: Network },
      { title: "Academy", desc: "Products, scripts and the assistant", to: "/dashboard/training", icon: GraduationCap },
      { title: "Learn & Earn", desc: "Courses, quizzes and points", to: "/dashboard/learn", icon: GraduationCap },
      { title: "Support", desc: "Community and help", to: "/dashboard/community", icon: LifeBuoy },
    ],
  },
] as const;

export function ConnectorCockpit({ firstName }: { firstName: string }) {
  const [loading, setLoading] = useState(true);
  const [payoutError, setPayoutError] = useState(false);
  const [cards, setCards] = useState({
    today: 0,
    active: 0,
    login: 0,
    sanction: 0,
    disburse: 0,
    pending: 0,
    approved: 0,
    paid: 0,
    wallet: 0,
    conversion: 0,
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [leads, requestsOrNull, billing] = await Promise.all([
        listMyLeads().catch(() => ({ items: [] as CrmPurchase[], total: 0, stages: [] as string[] })),
        listMyPayoutRequests().catch(() => null),
        getBillingMe().catch(() => null),
      ]);
      const requests = requestsOrNull ?? [];
      const sumStatus = (...statuses: string[]) =>
        requests.filter((r) => statuses.includes(r.status)).reduce((s, r) => s + Number(r.amount || 0), 0);
      if (cancelled) return;
      const rows = leads.items ?? [];
      const today = rows.filter((r) => isToday(r.created_at) || isToday(r.next_followup_at)).length;
      const active = rows.filter((r) => !CLOSED.has(r.pipeline_stage)).length;
      const login = rows.filter((r) => LOGIN_STAGES.has(r.pipeline_stage)).reduce((s, r) => s + amountOf(r), 0);
      const sanction = rows.filter((r) => SANCTION_STAGES.has(r.pipeline_stage)).reduce((s, r) => s + amountOf(r), 0);
      const disburse = rows.filter((r) => r.pipeline_stage === "disbursed" || r.converted).reduce((s, r) => s + amountOf(r), 0);
      const done = rows.filter((r) => r.pipeline_stage === "disbursed" || r.converted).length;
      setCards({
        today,
        active,
        login,
        sanction,
        disburse,
        pending: sumStatus("pending"),
        approved: sumStatus("approved", "processing"),
        paid: sumStatus("paid"),
        wallet: Number(billing?.entitlements.wallet_balance || 0),
        conversion: rows.length ? Math.round((done / rows.length) * 100) : 0,
      });
      setPayoutError(requestsOrNull === null);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const metrics = [
    { label: "Today's leads", value: loading ? "…" : String(cards.today), hint: "New or due today", to: "/dashboard/my-leads" as const },
    { label: "Active cases", value: loading ? "…" : String(cards.active), hint: "Not closed", to: "/dashboard/my-leads" as const },
    { label: "Login amount", value: loading ? "…" : inr(cards.login), hint: "Sent to lender", to: "/dashboard/cases" as const },
    { label: "Sanction amount", value: loading ? "…" : inr(cards.sanction), hint: "Approved cases", to: "/dashboard/cases" as const },
    { label: "Disbursement", value: loading ? "…" : inr(cards.disburse), hint: "Money released", to: "/dashboard/cases" as const },
    { label: "Pending payout", value: loading ? "…" : payoutError ? "—" : inr(cards.pending), hint: payoutError ? "Could not load" : "Waiting review", to: "/dashboard/earnings" as const },
    { label: "Approved payout", value: loading ? "…" : payoutError ? "—" : inr(cards.approved), hint: payoutError ? "Could not load" : "Approved or processing", to: "/dashboard/earnings" as const },
    { label: "Paid payout", value: loading ? "…" : payoutError ? "—" : inr(cards.paid), hint: payoutError ? "Could not load" : "Marked paid by admin", to: "/dashboard/earnings" as const },
    { label: "Lead wallet", value: loading ? "…" : inr(cards.wallet), hint: "Marketplace balance", to: "/dashboard/wallet" as const },
    { label: "Conversion", value: loading ? "…" : `${cards.conversion}%`, hint: "Disbursed / all leads", to: "/dashboard/cases" as const },
  ];

  const pipeline = metrics.slice(0, 4);
  const payouts = metrics.slice(5, 8);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-[#0D4F20] to-[#10662A] text-white shadow-[0_18px_40px_rgba(13,79,32,0.2)]">
        <div className="flex flex-col gap-6 p-6 sm:p-8 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#B7E4C7]">Partner desk</p>
            <h1 className="mt-2 font-display text-3xl font-bold">{firstName ? `${firstName}'s business` : "Your partner business"}</h1>
            <p className="mt-2 max-w-md text-sm leading-6 text-white/75">Disbursed cases, open pipeline and the payout still with RupeeDial.</p>
          </div>
          <Link to="/dashboard/cases" className="rounded-2xl px-4 py-3 transition hover:bg-white/10 lg:text-right">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#B7E4C7]">Disbursement</p>
            <p className="mt-1 font-display text-4xl font-bold">{loading ? "…" : inr(cards.disburse)}</p>
            <p className="mt-1 text-sm text-white/75">{loading ? "…" : `${cards.conversion}% of leads disbursed`} · Open cases</p>
          </Link>
        </div>
        <div className="grid border-t border-white/15 sm:grid-cols-3">
          {payouts.map((item) => (
            <Link key={item.label} to={item.to} className="border-white/15 px-6 py-4 transition hover:bg-black/15 sm:border-l sm:first:border-l-0">
              <p className="text-xs text-white/70">{item.label}</p>
              <p className="mt-1 text-xl font-semibold">{item.value}</p>
              <p className="text-xs text-white/60">{item.hint} · Open</p>
            </Link>
          ))}
        </div>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-lg font-bold text-[#390A5D]">Open pipeline</h2>
        <Link to="/dashboard/leadboard" className="inline-flex items-center gap-2 rounded-xl bg-[#10662A] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#0D4F20]">
          <Store className="size-4" /> Browse leads
        </Link>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {pipeline.map((item) => (
          <Link key={item.label} to={item.to} className="group rounded-2xl border border-[#d8ecdd] bg-white px-4 py-4 shadow-[0_10px_24px_rgba(16,102,42,0.05)] transition hover:border-[#0D4F20] hover:bg-[#0D4F20]">
            <span className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-[#5c4d72] group-hover:text-[#B7E4C7]">
              {item.label}
              <ArrowRight className="size-3.5" />
            </span>
            <span className="mt-2 block font-display text-2xl font-bold text-[#390A5D] group-hover:text-white">{item.value}</span>
            <span className="mt-1 block text-sm text-[#5c4d72] group-hover:text-white/75">{item.hint}</span>
          </Link>
        ))}
      </div>
      <Link to="/dashboard/wallet" className="flex items-center justify-between rounded-2xl border border-[#d8ecdd] bg-white px-4 py-4 text-sm text-[#14281c] shadow-[0_10px_24px_rgba(16,102,42,0.05)] transition hover:border-[#0D4F20] hover:bg-[#0D4F20] hover:text-white">
        <span>Lead wallet <span className="font-semibold">{loading ? "…" : inr(cards.wallet)}</span> · marketplace balance</span>
        <ArrowRight className="size-4 shrink-0" />
      </Link>

      {GROUPS.map((group) => (
        <section key={group.title}>
          <h2 className="font-display text-lg font-bold text-[#390A5D]">{group.title}</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {group.items.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.title}
                  to={item.to}
                  className="group flex items-center gap-3 rounded-2xl border border-[#d8ecdd] bg-white px-4 py-3.5 shadow-[0_8px_20px_rgba(16,102,42,0.04)] transition hover:border-[#0D4F20] hover:bg-[#0D4F20]"
                >
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#E8F7EC] text-[#10662A] group-hover:bg-white/15 group-hover:text-white">
                    <Icon className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-[#390A5D] group-hover:text-white">{item.title}</span>
                    <span className="block text-sm text-[#5c4d72] group-hover:text-white/75">{item.desc}</span>
                  </span>
                  <ArrowRight className="size-4 shrink-0 text-[#10662A] group-hover:text-white" />
                </Link>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
