import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Building2, CheckCircle2, Download, Loader2, Receipt } from "lucide-react";
import {
  getInvoiceCentre,
  getPayoutSummary,
  raiseInvoice,
  type InvoiceCentre,
  type PayoutSummary,
} from "@/lib/python-api";
import { useAuth } from "@/lib/auth-context";
import { isPlatformAdmin } from "@/lib/role-access";
import { InvoiceSteps } from "@/components/invoices/InvoiceSteps";
import { downloadInvoicePdf, invoiceLines } from "@/lib/invoice-pdf";

export const Route = createFileRoute("/dashboard/earnings")({
  head: () => ({ meta: [{ title: "Invoices — RupeeOne" }] }),
  component: InvoiceCentrePage,
});

function inr(n: number) {
  return `₹${Math.round(Number(n) || 0).toLocaleString("en-IN")}`;
}

function InvoiceCentrePage() {
  const [centre, setCentre] = useState<InvoiceCentre | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState<PayoutSummary | null>(null);
  const { role, user } = useAuth();
  const isAdmin = isPlatformAdmin(role);

  const load = useCallback(async () => {
    try {
      const [invoiceCentre, payoutSummary] = await Promise.all([
        getInvoiceCentre(),
        getPayoutSummary().catch(() => null),
      ]);
      setCentre(invoiceCentre);
      setSummary(payoutSummary);
      setLoadError(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not load invoices";
      setLoadError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const raise = async () => {
    setBusy(true);
    try {
      const invoice = await raiseInvoice();
      toast.success(invoice.note || "Invoice raised");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not raise invoice");
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="grid place-items-center py-16">
        <Loader2 className="size-6 animate-spin text-[#10662A]" />
      </div>
    );
  }

  if (!centre) {
    return (
      <div className="py-16 text-center space-y-3">
        <p className="text-sm text-destructive">{loadError ?? "Could not load invoices"}</p>
        <button
          type="button"
          onClick={() => {
            setLoading(true);
            void load();
          }}
          className="rounded-xl border border-[#d8ecdd] px-4 py-2 text-sm font-semibold text-[#390A5D]"
        >
          Try again
        </button>
      </div>
    );
  }

  const cards = [
    ["Expected", centre.expected, "Commission on disbursed cases"],
    ["Pending", centre.pending, "Not invoiced yet"],
    ["Invoice raised", centre.invoice_raised, "Waiting for admin"],
    ["Approved", centre.approved, "Verified"],
    ["Processing", centre.processing, "Payment in progress"],
    ["Paid", centre.paid, "Settled"],
    ["Rejected / query", centre.rejected, "Needs a correction"],
  ] as const;
  const openCases = centre.cases.filter((item) => !item.invoiced);
  const kycOk = isAdmin || Boolean(summary?.kyc_verified);
  const bankOk = Boolean(summary?.bank.complete);
  const ready = !summary || (kycOk && bankOk);

  return (
    <div className="max-w-5xl space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 font-display text-2xl font-bold text-[#390A5D]">
            <Receipt className="size-6 text-[#10662A]" /> Invoice & payout
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-[#5c4d72]">
            Your share is {Math.round(centre.rate * 1000) / 10}% of the lender payout. The payout shown is after any subvention. TDS is cut from your share.
          </p>
        </div>
        <Link to="/dashboard/settings" className="inline-flex items-center gap-1.5 rounded-xl border border-[#d8ecdd] px-3 py-2 text-xs font-semibold text-[#390A5D]">
          <Building2 className="size-3.5" /> Bank details
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-7">
        {cards.map(([label, value, hint]) => (
          <div key={label} className="rounded-2xl border border-[#d8ecdd] bg-white px-3 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[#5c4d72]">{label}</p>
            <p className="mt-1 font-display text-lg font-bold text-[#10662A]">{inr(value)}</p>
            <p className="mt-0.5 text-[10px] text-slate-500">{hint}</p>
          </div>
        ))}
      </div>

      <section className="rounded-2xl border border-[#d8ecdd] bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold text-[#390A5D]">Disbursed cases</h2>
            <p className="text-xs text-[#5c4d72]">{openCases.length} waiting · {inr(centre.pending)} eligible</p>
          </div>
          <button
            type="button"
            disabled={busy || openCases.length === 0 || !ready}
            onClick={() => void raise()}
            title={ready ? undefined : "Complete the checklist below first"}
            className="rounded-xl bg-[#10662A] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {busy ? "Raising…" : "Raise invoice"}
          </button>
        </div>
        {summary && !ready ? (
          <div className="mt-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm">
            <div className="flex items-center gap-2 font-semibold text-amber-900">
              <AlertTriangle className="size-4" /> Before your first invoice
            </div>
            <ul className="mt-2 space-y-1.5 text-xs">
              <li className="flex items-start gap-2">
                {kycOk ? <CheckCircle2 className="size-4 shrink-0 text-[#10662A]" /> : <AlertTriangle className="size-4 shrink-0 text-amber-700" />}
                <span className={kycOk ? "text-[#10662A]" : "text-amber-900"}>
                  {kycOk
                    ? "KYC verified"
                    : "KYC pending — RupeeDial admin verifies your KYC from Trust & Audit. Share PAN / Aadhaar with your RupeeDial manager."}
                </span>
              </li>
              <li className="flex items-start gap-2">
                {bankOk ? <CheckCircle2 className="size-4 shrink-0 text-[#10662A]" /> : <AlertTriangle className="size-4 shrink-0 text-amber-700" />}
                <span className={bankOk ? "text-[#10662A]" : "text-amber-900"}>
                  {bankOk ? (
                    "Bank details added"
                  ) : (
                    <>
                      Bank details missing —{" "}
                      <Link to="/dashboard/settings" className="font-semibold underline">
                        add them in Settings
                      </Link>
                    </>
                  )}
                </span>
              </li>
            </ul>
          </div>
        ) : null}
        {centre.cases.length === 0 ? (
          <p className="py-8 text-center text-sm text-[#5c4d72]">No disbursed cases yet. Commission starts after disbursement.</p>
        ) : (
          <ul className="mt-3 divide-y divide-[#d8ecdd]">
            {centre.cases.map((item) => (
              <li key={item.purchase_id} className="flex items-center justify-between gap-3 py-3 text-sm">
                <div>
                  <Link to="/dashboard/customer/$id" params={{ id: item.purchase_id }} className="font-medium text-[#390A5D] hover:underline">
                    {item.applicant_name}
                  </Link>
                  <div className="text-xs text-[#5c4d72]">
                    {item.product} · {item.city || "—"} · Loan {inr(item.disbursed)}
                    {" · "}Lender payout {item.lender_percent || 0}% · {inr(item.lender_payout || 0)}
                    {" · "}Your agreement {item.agreement_percent || 0}%
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-[#10662A]">{inr(item.commission)}</div>
                  <div className="text-[10px] uppercase text-[#5c4d72]">{item.invoiced ? "On an invoice" : item.lender_payout ? "Your share" : "Lender payout pending"}</div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-[#d8ecdd] bg-white">
        <div className="flex items-center justify-between gap-3 border-b border-[#d8ecdd] px-4 py-3">
          <h2 className="font-semibold text-[#390A5D]">Invoices</h2>
          {isAdmin ? (
            <Link to="/dashboard/invoice-approvals" className="text-sm font-semibold text-[#10662A]">
              Approval queue
            </Link>
          ) : null}
        </div>
        {centre.requests.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-[#5c4d72]">No invoice raised yet.</p>
        ) : (
          <ul className="divide-y divide-[#d8ecdd]">
            {centre.requests.map((row) => {
              const number = String(row.bank_snapshot?.invoice_number || row.note || "Payout");
              return (
                <li key={row.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                  <div className="min-w-0">
                    <div className="font-medium text-[#390A5D]">{number}</div>
                    <div className="mt-1">
                      <InvoiceSteps stage={row.stage || row.status} queriedStage={row.queried_stage} />
                    </div>
                    <div className="mt-1 text-xs text-[#5c4d72]">
                      {row.stage_label || row.status}
                      {row.created_at ? ` · ${new Date(row.created_at).toLocaleString("en-IN")}` : ""}
                      {row.utr ? ` · UTR ${row.utr}` : ""}
                      {row.rejection_reason ? ` · ${row.rejection_reason}` : ""}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-right">
                    <button
                      type="button"
                      onClick={() =>
                        downloadInvoicePdf({
                          number,
                          createdAt: row.created_at,
                          partnerName: String(row.bank_snapshot?.account_holder || user?.full_name || "Partner"),
                          partnerEmail: user?.email,
                          statusLabel: row.stage_label || row.status,
                          amount: row.amount,
                          gstAmount: row.gst_amount,
                          tdsAmount: row.tds_amount,
                          netPayable: row.net_payable,
                          utr: row.utr,
                          bank: row.bank_snapshot || {},
                          lines: invoiceLines(row, centre.cases),
                        })
                      }
                      className="inline-flex items-center gap-1 rounded-lg border border-[#d8ecdd] px-2.5 py-1.5 text-xs font-semibold text-[#10662A] hover:bg-[#E8F7EC]"
                    >
                      <Download className="size-3.5" /> PDF
                    </button>
                    <div>
                      <div className="font-bold text-[#10662A]">{inr(row.net_payable ?? row.amount)}</div>
                      <div className="text-[10px] text-[#5c4d72]">Gross {inr(row.amount)}</div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
