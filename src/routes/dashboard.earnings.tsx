import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { IndianRupee, Loader2, ArrowRight, Building2 } from "lucide-react";
import {
  getPayoutSummary,
  listMyPayoutRequests,
  createPayoutRequest,
  listMyLeads,
  type PayoutSummary,
  type PayoutRequest,
  type CrmPurchase,
} from "@/lib/python-api";

export const Route = createFileRoute("/dashboard/earnings")({
  head: () => ({ meta: [{ title: "Earnings — RupeeDial One" }] }),
  component: EarningsPage,
});

function EarningsPage() {
  const [summary, setSummary] = useState<PayoutSummary | null>(null);
  const [requests, setRequests] = useState<PayoutRequest[]>([]);
  const [rows, setRows] = useState<CrmPurchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [sum, reqs, leads] = await Promise.all([
        getPayoutSummary(),
        listMyPayoutRequests(),
        listMyLeads(),
      ]);
      setSummary(sum);
      setRequests(reqs);
      setRows((leads.items ?? []).filter((p) => p.converted));
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to load earnings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const requestPayout = async () => {
    const n = Number(amount);
    if (!Number.isFinite(n) || n <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    setBusy(true);
    try {
      await createPayoutRequest(n);
      toast.success("Payout request submitted");
      setAmount("");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Request failed");
    } finally {
      setBusy(false);
    }
  };

  if (loading || !summary) {
    return (
      <div className="grid place-items-center py-16">
        <Loader2 className="size-6 animate-spin text-[#10662A]" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#390A5D] flex items-center gap-2">
            <IndianRupee className="size-6 text-[#10662A]" /> Earnings &amp; payouts
          </h1>
          <p className="text-sm text-[#5c4d72] mt-1">{summary.policy}</p>
        </div>
        <Link
          to="/dashboard/settings"
          className="inline-flex items-center gap-1.5 rounded-xl border border-[#d8ecdd] px-3 py-2 text-xs font-semibold text-[#390A5D]"
        >
          <Building2 className="size-3.5" /> Bank details
        </Link>
      </div>

      <div className="grid sm:grid-cols-4 gap-3">
        {[
          { label: "Earned", value: summary.earned },
          { label: "Paid out", value: summary.paid_out },
          { label: "Pending", value: summary.pending },
          { label: "Available", value: summary.available },
        ].map((c) => (
          <div key={c.label} className="rounded-xl border border-[#d8ecdd] bg-white px-4 py-3">
            <div className="text-[10px] uppercase text-[#5c4d72]">{c.label}</div>
            <div className="font-display font-bold text-lg text-[#10662A]">
              ₹{c.value.toLocaleString("en-IN")}
            </div>
          </div>
        ))}
      </div>

      <section className="rounded-2xl border border-[#d8ecdd] bg-white p-5 space-y-3">
        <div className="font-semibold text-[#390A5D]">Request payout</div>
        <p className="text-xs text-[#5c4d72]">
          Min ₹{summary.payout_min.toLocaleString("en-IN")}. Bank transfer is manual — admin marks paid with UTR.
          {!summary.bank.complete && (
            <>
              {" "}
              <Link to="/dashboard/settings" className="font-semibold text-[#10662A] underline">
                Add bank details
              </Link>{" "}
              first.
            </>
          )}
          {summary.bank.complete && !summary.kyc_verified && (
            <> Ask admin to verify KYC (Trust & Audit) before requesting.</>
          )}
        </p>
        <div className="flex flex-wrap gap-2">
          <input
            type="number"
            min={summary.payout_min}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="rounded-lg border border-[#d8ecdd] px-3 py-2 text-sm w-40"
            placeholder="Amount"
          />
          <button
            type="button"
            disabled={busy || !summary.can_request}
            onClick={() => void requestPayout()}
            className="rounded-xl bg-[#10662A] text-white px-4 py-2 text-sm font-semibold disabled:opacity-50"
          >
            {busy ? "…" : "Submit request"}
          </button>
        </div>
      </section>

      {requests.length > 0 && (
        <section className="rounded-2xl border border-[#d8ecdd] bg-white divide-y divide-[#d8ecdd]">
          <div className="px-4 py-3 font-semibold text-sm text-[#390A5D]">Your requests</div>
          {requests.map((r) => (
            <div key={r.id} className="px-4 py-3 flex justify-between gap-3 text-sm">
              <div>
                <div className="font-medium text-[#390A5D]">₹{r.amount.toLocaleString("en-IN")}</div>
                <div className="text-xs text-[#5c4d72]">
                  {r.created_at ? new Date(r.created_at).toLocaleString("en-IN") : ""}
                  {r.utr ? ` · UTR ${r.utr}` : ""}
                  {r.rejection_reason ? ` · ${r.rejection_reason}` : ""}
                </div>
              </div>
              <span className="text-[10px] uppercase font-bold self-center text-[#5c4d72]">{r.status}</span>
            </div>
          ))}
        </section>
      )}

      <section>
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-semibold text-[#390A5D] text-sm">Converted deals</h2>
          <Link to="/dashboard/my-leads" className="text-xs font-semibold text-[#10662A] inline-flex items-center gap-1">
            My Leads <ArrowRight className="size-3" />
          </Link>
        </div>
        {rows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#d8ecdd] py-10 text-center text-sm text-[#5c4d72]">
            No converted deals yet
          </div>
        ) : (
          <ul className="rounded-2xl border border-[#d8ecdd] bg-white divide-y divide-[#d8ecdd]">
            {rows.map((p) => (
              <li key={p.id} className="px-4 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-semibold text-sm text-[#390A5D] truncate">
                    {p.lead?.applicant_name ?? p.lead_id}
                  </div>
                  <div className="text-xs text-[#5c4d72]">{p.pipeline_stage}</div>
                </div>
                <div className="font-bold text-[#10662A]">
                  ₹{Number(p.deal_value || 0).toLocaleString("en-IN")}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
