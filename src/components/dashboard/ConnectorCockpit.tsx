import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, Store } from "lucide-react";
import { DeskGuide } from "@/components/dashboard/DeskGuide";
import { ProductivityChart } from "@/components/dashboard/ProductivityChart";
import { RecallList } from "@/components/dashboard/RecallList";
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

  const moneyRow = [
    { ...payouts[0], tone: "green" as const },
    { ...payouts[1], tone: "white" as const },
    { ...payouts[2], tone: "green" as const },
    { ...metrics[8], tone: "white" as const },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-3">
      <section className="overflow-hidden rounded-2xl bg-gradient-to-r from-[#0D4F20] to-[#10662A] text-white shadow-[0_10px_24px_rgba(13,79,32,0.16)]">
        <div className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#B7E4C7]">Partner desk</p>
            <h1 className="font-display text-xl font-bold">{firstName ? `${firstName}'s business` : "Your partner business"}</h1>
          </div>
          <Link to="/dashboard/cases" className="rounded-xl px-2 py-1 transition hover:bg-white/10 sm:text-right">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#B7E4C7]">Disbursed</p>
            <p className="font-display text-xl font-bold leading-tight">{loading ? "…" : inr(cards.disburse)}</p>
            <p className="text-xs text-white/70">{loading ? "…" : `${cards.conversion}% of leads`}</p>
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-2 border-t border-white/15 p-2 sm:grid-cols-4">
          {moneyRow.map((item) => (
            <Link
              key={item.label}
              to={item.to}
              className={item.tone === "green"
                ? "rounded-xl px-3 py-2 transition hover:bg-black/15"
                : "rounded-xl bg-white px-3 py-2 text-[#14281c] shadow-[0_8px_18px_rgba(0,0,0,0.12)] transition hover:bg-[#F4FBF6]"}
            >
              <p className={`text-[10px] font-semibold uppercase tracking-wide ${item.tone === "green" ? "text-white/70" : "text-[#5c4d72]"}`}>{item.label}</p>
              <p className={`text-base font-semibold ${item.tone === "white" ? "text-[#10662A]" : ""}`}>{item.value}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-[#d8ecdd] bg-white px-3 py-2.5 shadow-[0_8px_20px_rgba(16,102,42,0.04)]">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-bold text-[#390A5D]">Open pipeline</h2>
          <Link to="/dashboard/leadboard" className="inline-flex items-center gap-1.5 rounded-lg bg-[#10662A] px-2.5 py-1 text-xs font-semibold text-white hover:bg-[#0D4F20]">
            <Store className="size-3.5" /> Browse leads
          </Link>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2 xl:grid-cols-4">
          {pipeline.map((item) => (
            <Link key={item.label} to={item.to} className="group rounded-xl bg-[#F4FBF6] px-3 py-2 transition hover:bg-[#0D4F20]">
              <span className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wide text-[#5c4d72] group-hover:text-[#B7E4C7]">
                {item.label}
                <ArrowRight className="size-3" />
              </span>
              <span className="mt-0.5 block font-display text-lg font-bold leading-tight text-[#390A5D] group-hover:text-white">{item.value}</span>
              <span className="block text-[11px] text-[#5c4d72] group-hover:text-white/75">{item.hint}</span>
            </Link>
          ))}
        </div>
      </section>

      <ProductivityChart />

      <RecallList />

      <DeskGuide audience="partner" />
    </div>
  );
}
