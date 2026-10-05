import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Building2, Loader2, Receipt } from "lucide-react";
import { getInvoiceCentre, raiseInvoice, type InvoiceCentre } from "@/lib/python-api";

export const Route = createFileRoute("/dashboard/earnings")({
  head: () => ({ meta: [{ title: "Invoices — RupeeDial One" }] }),
  component: InvoiceCentrePage,
});

function inr(n: number) {
  return `₹${Math.round(Number(n) || 0).toLocaleString("en-IN")}`;
}

function InvoiceCentrePage() {
  const [centre, setCentre] = useState<InvoiceCentre | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setCentre(await getInvoiceCentre());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load invoices");
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

  if (loading || !centre) {
    return (
      <div className="grid place-items-center py-16">
        <Loader2 className="size-6 animate-spin text-[#10662A]" />
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

  return (
    <div className="max-w-5xl space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 font-display text-2xl font-bold text-[#390A5D]">
            <Receipt className="size-6 text-[#10662A]" /> Invoice & payout
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-[#5c4d72]">
            Disbursed cases become eligible commission at {Math.round(centre.rate * 1000) / 10}%. Raise one invoice, then admin verifies, processes and marks it paid.
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
            disabled={busy || openCases.length === 0}
            onClick={() => void raise()}
            className="rounded-xl bg-[#10662A] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {busy ? "Raising…" : "Raise invoice"}
          </button>
        </div>
        {centre.cases.length === 0 ? (
          <p className="py-8 text-center text-sm text-[#5c4d72]">No disbursed cases yet. Commission starts after disbursement.</p>
        ) : (
          <ul className="mt-3 divide-y divide-[#d8ecdd]">
            {centre.cases.map((item) => (
              <li key={item.purchase_id} className="flex items-center justify-between gap-3 py-3 text-sm">
                <div>
                  <div className="font-medium text-[#390A5D]">{item.applicant_name}</div>
                  <div className="text-xs text-[#5c4d72]">{item.product} · {item.city || "—"} · Disbursed {inr(item.disbursed)}</div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-[#10662A]">{inr(item.commission)}</div>
                  <div className="text-[10px] uppercase text-[#5c4d72]">{item.invoiced ? "On an invoice" : "Ready"}</div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-[#d8ecdd] bg-white">
        <h2 className="border-b border-[#d8ecdd] px-4 py-3 font-semibold text-[#390A5D]">Invoices</h2>
        {centre.requests.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-[#5c4d72]">No invoice raised yet.</p>
        ) : (
          <ul className="divide-y divide-[#d8ecdd]">
            {centre.requests.map((row) => {
              const number = String(row.bank_snapshot?.invoice_number || row.note || "Payout");
              return (
                <li key={row.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                  <div>
                    <div className="font-medium text-[#390A5D]">{number}</div>
                    <div className="text-xs text-[#5c4d72]">
                      {row.created_at ? new Date(row.created_at).toLocaleString("en-IN") : ""}
                      {row.utr ? ` · UTR ${row.utr}` : ""}
                      {row.rejection_reason ? ` · ${row.rejection_reason}` : ""}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-[#10662A]">{inr(row.amount)}</div>
                    <div className="text-[10px] font-bold uppercase text-[#5c4d72]">{row.status}</div>
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
