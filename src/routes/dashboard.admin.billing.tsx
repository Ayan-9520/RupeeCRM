import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { CreditCard, Loader2, Search } from "lucide-react";
import {
  adminActivatePlan,
  adminCancelPlan,
  adminCreditWallet,
  getAdminSubscriptions,
  listAdminBillingPayments,
  type AdminSubscription,
  type BillingPaymentRow,
} from "@/lib/python-api";

export const Route = createFileRoute("/dashboard/admin/billing")({
  head: () => ({ meta: [{ title: "Admin Billing — RupeeOne" }] }),
  component: AdminBillingPage,
});

type Cycle = "monthly" | "quarterly" | "yearly";

function inr(n: number) {
  return `₹${Math.round(Number(n) || 0).toLocaleString("en-IN")}`;
}

function when(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  });
}

function shortDate(iso: string | null) {
  return iso ? new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—";
}

function AdminBillingPage() {
  const [items, setItems] = useState<AdminSubscription[]>([]);
  const [plans, setPlans] = useState<{ id: string; name: string }[]>([]);
  const [summary, setSummary] = useState({ active_count: 0, active_value: 0 });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "none">("all");
  const [form, setForm] = useState<{ userId: string; planId: string; cycle: Cycle }>({ userId: "", planId: "", cycle: "monthly" });
  const [credit, setCredit] = useState({ userId: "", amount: "", note: "" });
  const [payments, setPayments] = useState<BillingPaymentRow[]>([]);

  const load = useCallback(async () => {
    try {
      const [data, paymentRows] = await Promise.all([getAdminSubscriptions(), listAdminBillingPayments().catch(() => [])]);
      setItems(data.items);
      setPayments(paymentRows);
      setPlans(data.plans);
      setSummary({ active_count: data.active_count, active_value: data.active_value });
      setForm((f) => ({ ...f, planId: f.planId || data.plans[0]?.id || "" }));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load subscriptions");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const shown = useMemo(() => {
    const term = q.trim().toLowerCase();
    return items.filter((i) => {
      if (filter === "active" && i.plan_status !== "active") return false;
      if (filter === "none" && i.plan_status === "active") return false;
      return !term || i.full_name.toLowerCase().includes(term) || i.email.toLowerCase().includes(term);
    });
  }, [items, q, filter]);

  const activate = async () => {
    if (!form.userId || !form.planId) {
      toast.error("Pick a partner and a plan");
      return;
    }
    setBusy("activate");
    try {
      const res = await adminActivatePlan(form.userId, form.planId, form.cycle);
      toast.success(res.message);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Activation failed");
    } finally {
      setBusy(null);
    }
  };

  const creditWallet = async () => {
    const amount = Number(credit.amount);
    if (!credit.userId || !(amount > 0)) {
      toast.error("Pick a partner and enter an amount");
      return;
    }
    setBusy("credit");
    try {
      const res = await adminCreditWallet(credit.userId, amount, credit.note);
      toast.success(res.message);
      setCredit({ userId: "", amount: "", note: "" });
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not add credit");
    } finally {
      setBusy(null);
    }
  };

  const cancel = async (row: AdminSubscription) => {
    if (!window.confirm(`Cancel ${row.full_name}'s plan? Wallet credits stay.`)) return;
    setBusy(row.user_id);
    try {
      const res = await adminCancelPlan(row.user_id);
      toast.success(res.message);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Cancel failed");
    } finally {
      setBusy(null);
    }
  };

  if (loading) {
    return (
      <div className="grid place-items-center py-16">
        <Loader2 className="size-6 animate-spin text-[#10662A]" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl space-y-5">
      <div>
        <h1 className="flex items-center gap-2 font-display text-2xl font-bold text-[#390A5D]">
          <CreditCard className="size-6 text-[#10662A]" /> Billing overview
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-[#5c4d72]">
          Partners pay by UPI or bank transfer. After you confirm the payment, activate their plan here — lead credits are added to their wallet automatically.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <Card label="Active plans" value={String(summary.active_count)} />
        <Card label="Active plan value" value={inr(summary.active_value)} />
        <Card label="Partner accounts" value={String(items.length)} />
      </div>

      <section className="rounded-2xl border border-[#d8ecdd] bg-white p-5">
        <h2 className="font-semibold text-[#390A5D]">Activate a plan after payment</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-[2fr_1fr_1fr_auto]">
          <select
            value={form.userId}
            onChange={(e) => setForm((f) => ({ ...f, userId: e.target.value }))}
            className="h-10 rounded-xl border border-[#d8ecdd] bg-white px-3 text-sm"
          >
            <option value="">Select partner…</option>
            {items.map((i) => (
              <option key={i.user_id} value={i.user_id}>
                {i.full_name} · {i.email}
              </option>
            ))}
          </select>
          <select
            value={form.planId}
            onChange={(e) => setForm((f) => ({ ...f, planId: e.target.value }))}
            className="h-10 rounded-xl border border-[#d8ecdd] bg-white px-3 text-sm"
          >
            {plans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <select
            value={form.cycle}
            onChange={(e) => setForm((f) => ({ ...f, cycle: e.target.value as Cycle }))}
            className="h-10 rounded-xl border border-[#d8ecdd] bg-white px-3 text-sm capitalize"
          >
            <option value="monthly">Monthly</option>
            <option value="quarterly">Quarterly</option>
            <option value="yearly">Yearly</option>
          </select>
          <button
            onClick={() => void activate()}
            disabled={busy === "activate"}
            className="h-10 rounded-xl bg-[#10662A] px-5 text-sm font-semibold text-white disabled:opacity-60"
          >
            {busy === "activate" ? "Activating…" : "Activate"}
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-[#d8ecdd] bg-white p-5">
        <h2 className="font-semibold text-[#390A5D]">Payments</h2>
        <p className="mt-1 text-xs text-[#5c4d72]">
          Each confirmed payment shows the date and time. Razorpay will add rows here after the keys are connected. Activating a plan records the offline payment now.
        </p>
        {payments.length === 0 ? (
          <p className="py-6 text-sm text-[#5c4d72]">No payment recorded yet.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-[#d8ecdd] text-[11px] font-bold uppercase tracking-wide text-[#5c4d72]">
                  <th className="py-2 pr-3">Date</th>
                  <th className="py-2 pr-3">Partner</th>
                  <th className="py-2 pr-3">Description</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((row) => (
                  <tr key={row.id} className="border-b border-[#eef6f0]">
                    <td className="py-2.5 pr-3">{when(row.paid_at || row.created_at)}</td>
                    <td className="py-2.5 pr-3">
                      <div className="font-medium text-[#390A5D]">{row.partner_name}</div>
                      <div className="text-xs text-[#5c4d72]">{row.email}</div>
                    </td>
                    <td className="py-2.5 pr-3">{row.description}</td>
                    <td className="py-2.5 pr-3">
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize ${row.status === "paid" ? "bg-[#E8F7EC] text-[#10662A]" : "bg-amber-50 text-amber-800"}`}>{row.status}</span>
                    </td>
                    <td className="py-2.5 text-right font-semibold">{inr(row.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-[#d8ecdd] bg-white p-5">
        <h2 className="font-semibold text-[#390A5D]">Credit a wallet after payment</h2>
        <p className="mt-0.5 text-xs text-[#5c4d72]">
          Enter the amount the partner paid. ₹5,000+ adds 5% extra credit, ₹10,000+ adds 10%. Bonus is lead credit, not cash.
        </p>
        <div className="mt-3 grid gap-3 md:grid-cols-[2fr_1fr_2fr_auto]">
          <select
            value={credit.userId}
            onChange={(e) => setCredit((c) => ({ ...c, userId: e.target.value }))}
            className="h-10 rounded-xl border border-[#d8ecdd] bg-white px-3 text-sm"
          >
            <option value="">Select partner…</option>
            {items.map((i) => (
              <option key={i.user_id} value={i.user_id}>
                {i.full_name} · {inr(i.wallet_balance)}
              </option>
            ))}
          </select>
          <input
            type="number"
            min={1}
            value={credit.amount}
            onChange={(e) => setCredit((c) => ({ ...c, amount: e.target.value }))}
            placeholder="Amount ₹"
            className="h-10 rounded-xl border border-[#d8ecdd] px-3 text-sm"
          />
          <input
            value={credit.note}
            onChange={(e) => setCredit((c) => ({ ...c, note: e.target.value }))}
            placeholder="UPI ref / note"
            maxLength={200}
            className="h-10 rounded-xl border border-[#d8ecdd] px-3 text-sm"
          />
          <button
            onClick={() => void creditWallet()}
            disabled={busy === "credit"}
            className="h-10 rounded-xl bg-[#10662A] px-5 text-sm font-semibold text-white disabled:opacity-60"
          >
            {busy === "credit" ? "Adding…" : "Add credit"}
          </button>
        </div>
        {Number(credit.amount) > 0 && (
          <p className="mt-3 text-sm text-[#390A5D]">
            {(() => {
              const paid = Number(credit.amount);
              const percent = paid >= 10000 ? 10 : paid >= 5000 ? 5 : 0;
              const bonus = Math.round(paid * (percent / 100));
              return percent
                ? `Partner pays ₹${paid.toLocaleString("en-IN")} → wallet gets ₹${(paid + bonus).toLocaleString("en-IN")} (₹${bonus.toLocaleString("en-IN")} extra).`
                : `₹${paid.toLocaleString("en-IN")} goes in as-is. Extra credit starts at ₹5,000.`;
            })()}
          </p>
        )}
      </section>

      <section className="rounded-2xl border border-[#d8ecdd] bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-semibold text-[#390A5D]">Subscriptions</h2>
          <div className="flex flex-wrap gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search name or email"
                className="h-9 rounded-xl border border-[#d8ecdd] pl-8 pr-3 text-sm"
              />
            </div>
            {(["all", "active", "none"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`h-9 rounded-xl px-3 text-xs font-semibold ${
                  filter === f ? "bg-[#10662A] text-white" : "border border-[#d8ecdd] text-[#390A5D]"
                }`}
              >
                {f === "all" ? "All" : f === "active" ? "Active" : "No plan"}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="border-b border-[#e2efe6] text-left text-xs uppercase tracking-wide text-[#5c4d72]">
              <tr>
                <th className="py-2">Partner</th>
                <th className="py-2">Plan</th>
                <th className="py-2">Status</th>
                <th className="py-2">Ends</th>
                <th className="py-2 text-right">Amount</th>
                <th className="py-2 text-right">Wallet</th>
                <th className="py-2 text-right">Seats</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {shown.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-6 text-center text-[#5c4d72]">
                    No accounts match.
                  </td>
                </tr>
              )}
              {shown.map((row) => (
                <tr key={row.user_id} className="border-b border-[#e2efe6]/60 last:border-0">
                  <td className="py-2.5">
                    <p className="font-medium text-[#390A5D]">{row.full_name}</p>
                    <p className="text-xs text-[#5c4d72]">
                      {row.email} · {row.role}
                    </p>
                  </td>
                  <td className="py-2.5 capitalize">{row.plan_name ? `${row.plan_name} · ${row.plan_cycle}` : "—"}</td>
                  <td className="py-2.5">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize ${
                        row.plan_status === "active" ? "bg-[#E8F7EC] text-[#10662A]" : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {row.plan_status}
                    </span>
                  </td>
                  <td className="py-2.5">{shortDate(row.plan_ends_at)}</td>
                  <td className="py-2.5 text-right">{row.amount ? inr(row.amount) : "—"}</td>
                  <td className="py-2.5 text-right">{inr(row.wallet_balance)}</td>
                  <td className="py-2.5 text-right">{row.seats_used}</td>
                  <td className="py-2.5 text-right">
                    {row.plan_status === "active" ? (
                      <button
                        onClick={() => void cancel(row)}
                        disabled={busy === row.user_id}
                        className="text-xs font-semibold text-red-700 hover:underline disabled:opacity-50"
                      >
                        Cancel
                      </button>
                    ) : (
                      <button
                        onClick={() => setForm((f) => ({ ...f, userId: row.user_id }))}
                        className="text-xs font-semibold text-[#10662A] hover:underline"
                      >
                        Select
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[#d8ecdd] bg-white px-4 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-[#5c4d72]">{label}</p>
      <p className="mt-1 font-display text-lg font-bold text-[#10662A]">{value}</p>
    </div>
  );
}
