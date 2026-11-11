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
  { title: "Learn & Earn", desc: "Courses, quizzes and points", to: "/dashboard/learn", icon: GraduationCap },
  { title: "Support", desc: "Community and help", to: "/dashboard/community", icon: LifeBuoy },
  { title: "Lead wallet", desc: "Buy from the marketplace", to: "/dashboard/wallet", icon: Wallet },
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
    { label: "Today's leads", value: loading ? "…" : String(cards.today), hint: "New or due today" },
    { label: "Active cases", value: loading ? "…" : String(cards.active), hint: "Not closed" },
    { label: "Login amount", value: loading ? "…" : inr(cards.login), hint: "Sent to lender" },
    { label: "Sanction amount", value: loading ? "…" : inr(cards.sanction), hint: "Approved cases" },
    { label: "Disbursement", value: loading ? "…" : inr(cards.disburse), hint: "Money released" },
    { label: "Pending payout", value: loading ? "…" : payoutError ? "—" : inr(cards.pending), hint: payoutError ? "Could not load" : "Waiting review" },
    { label: "Approved payout", value: loading ? "…" : payoutError ? "—" : inr(cards.approved), hint: payoutError ? "Could not load" : "Approved or processing" },
    { label: "Paid payout", value: loading ? "…" : payoutError ? "—" : inr(cards.paid), hint: payoutError ? "Could not load" : "Marked paid by admin" },
    { label: "Lead wallet", value: loading ? "…" : inr(cards.wallet), hint: "Marketplace balance" },
    { label: "Conversion", value: loading ? "…" : `${cards.conversion}%`, hint: "Disbursed / all leads" },
  ];

  return (
    <div className="max-w-7xl space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#10662A]">Connector cockpit</p>
          <h1 className="font-display text-xl font-extrabold text-[#390A5D] lg:text-2xl">
            {firstName ? `${firstName}'s business` : "Your partner business"}
          </h1>
          <p className="max-w-xl text-xs text-[#5c4d72]">
            Leads, cases, lender movement and payouts in one place.
          </p>
        </div>
        <Link
          to="/dashboard/leadboard"
          className="inline-flex items-center gap-2 self-start rounded-xl bg-[#10662A] px-3.5 py-2 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(16,102,42,0.22)] sm:self-auto"
        >
          <Store className="size-4" /> Browse leads
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-5">
        {metrics.map((m) => (
          <div key={m.label} className="rounded-xl border border-[#d8ecdd] bg-white px-3 py-2 shadow-[0_4px_14px_rgba(16,102,42,0.04)]">
            <p className="truncate text-[10px] font-semibold uppercase tracking-wide text-[#5c4d72]">{m.label}</p>
            <p className="font-display text-lg font-extrabold leading-tight text-[#390A5D]">{m.value}</p>
            <p className="truncate text-[10px] text-slate-500">{m.hint}</p>
          </div>
        ))}
      </div>

      <div>
        <h2 className="font-display text-base font-bold text-[#390A5D]">Work from here</h2>
        <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-4">
          {MODULES.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.title}
                to={item.to}
                className="group flex items-center gap-2.5 rounded-xl border border-[#d8ecdd] bg-white px-3 py-2 transition hover:border-[#10662A]/40 hover:bg-[#f5fcf7]"
              >
                <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-[#E8F7EC] text-[#10662A]">
                  <Icon className="size-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-[#390A5D]">{item.title}</span>
                  <span className="block truncate text-[11px] text-[#5c4d72]">{item.desc}</span>
                </span>
                <ArrowRight className="size-3.5 shrink-0 text-[#10662A] opacity-0 transition group-hover:opacity-100" />
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
