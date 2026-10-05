import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  BadgeIndianRupee,
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
  getPayoutSummary,
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

const MODULES = [
  { title: "Leads", desc: "Pipeline and follow-ups", to: "/dashboard/my-leads", icon: KanbanSquare },
  { title: "Customers", desc: "People on your cases", to: "/dashboard/my-leads", icon: Users },
  { title: "Applications", desc: "Login to disbursal", to: "/dashboard/cases", icon: FileText },
  { title: "Documents", desc: "Open a case to collect docs", to: "/dashboard/my-leads", icon: FileText },
  { title: "Lender match", desc: "Cases with lenders", to: "/dashboard/cases", icon: Landmark },
  { title: "Payout", desc: "Commission and requests", to: "/dashboard/earnings", icon: BadgeIndianRupee },
  { title: "Invoice", desc: "Raise and track commission invoices", to: "/dashboard/earnings", icon: Receipt },
  { title: "Network", desc: "Connectors, invites and revenue share", to: "/dashboard/network", icon: Network },
  { title: "Academy", desc: "Products, scripts and the assistant", to: "/dashboard/training", icon: GraduationCap },
  { title: "Rewards", desc: "Points and targets", to: "/dashboard/rewards", icon: BadgeIndianRupee },
  { title: "Support", desc: "Community and help", to: "/dashboard/community", icon: LifeBuoy },
  { title: "Lead wallet", desc: "Buy from the marketplace", to: "/dashboard/wallet", icon: Wallet },
] as const;

export function ConnectorCockpit({ firstName }: { firstName: string }) {
  const [loading, setLoading] = useState(true);
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
      const [leads, payout, requests, billing] = await Promise.all([
        listMyLeads().catch(() => ({ items: [] as CrmPurchase[], total: 0, stages: [] as string[] })),
        getPayoutSummary().catch(() => null),
        listMyPayoutRequests().catch(() => []),
        getBillingMe().catch(() => null),
      ]);
      if (cancelled) return;
      const rows = leads.items ?? [];
      const today = rows.filter((r) => isToday(r.created_at) || isToday(r.next_followup_at)).length;
      const active = rows.filter((r) => !CLOSED.has(r.pipeline_stage)).length;
      const login = rows.filter((r) => LOGIN_STAGES.has(r.pipeline_stage)).reduce((s, r) => s + amountOf(r), 0);
      const sanction = rows.filter((r) => SANCTION_STAGES.has(r.pipeline_stage)).reduce((s, r) => s + amountOf(r), 0);
      const disburse = rows.filter((r) => r.pipeline_stage === "disbursed" || r.converted).reduce((s, r) => s + amountOf(r), 0);
      const approved = requests
        .filter((r) => r.status === "approved" || r.status === "processing")
        .reduce((s, r) => s + Number(r.amount || 0), 0);
      const done = rows.filter((r) => r.pipeline_stage === "disbursed" || r.converted).length;
      setCards({
        today,
        active,
        login,
        sanction,
        disburse,
        pending: Number(payout?.pending || 0),
        approved,
        paid: Number(payout?.paid_out || 0),
        wallet: Number(billing?.entitlements.wallet_balance || 0),
        conversion: rows.length ? Math.round((done / rows.length) * 100) : 0,
      });
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const metrics = [
    { label: "Today's leads", value: loading ? "…" : String(cards.today), hint: "New or due today" },
    { label: "Active cases", value: loading ? "…" : String(cards.active), hint: "Not closed" },
    { label: "Login amount", value: loading ? "…" : inr(cards.login), hint: "Sent to lender" },
    { label: "Sanction amount", value: loading ? "…" : inr(cards.sanction), hint: "Approved cases" },
    { label: "Disbursement", value: loading ? "…" : inr(cards.disburse), hint: "Money released" },
    { label: "Pending payout", value: loading ? "…" : inr(cards.pending), hint: "Waiting review" },
    { label: "Approved payout", value: loading ? "…" : inr(cards.approved), hint: "Ready to pay" },
    { label: "Paid payout", value: loading ? "…" : inr(cards.paid), hint: "Already paid" },
    { label: "Lead wallet", value: loading ? "…" : inr(cards.wallet), hint: "Marketplace balance" },
    { label: "Conversion", value: loading ? "…" : `${cards.conversion}%`, hint: "Disbursed / all leads" },
  ];

  return (
    <div className="max-w-7xl space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#10662A]">Connector cockpit</p>
          <h1 className="mt-1 font-display text-2xl font-extrabold text-[#390A5D] lg:text-3xl">
            {firstName ? `${firstName}'s business` : "Your partner business"}
          </h1>
          <p className="mt-1 max-w-xl text-sm text-[#5c4d72]">
            Leads, cases, lender movement and payouts in one place.
          </p>
        </div>
        <Link
          to="/dashboard/leadboard"
          className="inline-flex items-center gap-2 rounded-xl bg-[#10662A] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(16,102,42,0.22)]"
        >
          <Store className="size-4" /> Browse leads
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {metrics.map((m) => (
          <div key={m.label} className="rounded-2xl border border-[#d8ecdd] bg-white px-4 py-3.5 shadow-[0_4px_18px_rgba(16,102,42,0.05)]">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[#5c4d72]">{m.label}</p>
            <p className="mt-1 font-display text-xl font-extrabold text-[#390A5D]">{m.value}</p>
            <p className="mt-0.5 text-[11px] text-slate-500">{m.hint}</p>
          </div>
        ))}
      </div>

      <div>
        <h2 className="font-display text-lg font-bold text-[#390A5D]">Work from here</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {MODULES.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.title}
                to={item.to}
                className="group flex items-center gap-3 rounded-2xl border border-[#d8ecdd] bg-white p-4 transition hover:border-[#10662A]/40 hover:bg-[#f5fcf7]"
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#E8F7EC] text-[#10662A]">
                  <Icon className="size-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold text-[#390A5D]">{item.title}</span>
                  <span className="block text-xs text-[#5c4d72]">{item.desc}</span>
                </span>
                <ArrowRight className="size-4 text-[#10662A] opacity-0 transition group-hover:opacity-100" />
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
