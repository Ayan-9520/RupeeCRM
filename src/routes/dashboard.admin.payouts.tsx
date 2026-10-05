import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { adminPayoutAction, listAdminPayoutRequests, type PayoutRequest } from "@/lib/python-api";

export const Route = createFileRoute("/dashboard/admin/payouts")({
  head: () => ({ meta: [{ title: "Invoices — Admin" }] }),
  component: AdminPayouts,
});

const FILTERS = ["pending", "approved", "processing", "paid", "query", "rejected", "all"] as const;

function inr(n: number) {
  return `₹${Math.round(Number(n) || 0).toLocaleString("en-IN")}`;
}

function AdminPayouts() {
  const [rows, setRows] = useState<PayoutRequest[]>([]);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("pending");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [utr, setUtr] = useState<Record<string, string>>({});
  const [reason, setReason] = useState<Record<string, string>>({});

  const load = async (status: string) => {
    setLoading(true);
    try {
      setRows(await listAdminPayoutRequests(status));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Load failed");
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load(filter);
  }, [filter]);

  const act = async (id: string, action: "approve" | "reject" | "paid" | "processing" | "query") => {
    setBusy(id);
    try {
      await adminPayoutAction(id, action, {
        utr: utr[id] || undefined,
        rejection_reason: reason[id] || undefined,
      });
      toast.success(`Marked ${action}`);
      await load(filter);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Action failed");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="max-w-4xl space-y-5">
      <div>
        <h1 className="font-display text-2xl font-bold text-[#390A5D]">Invoice verification</h1>
        <p className="mt-1 text-sm text-[#5c4d72]">Raised invoice → approve → processing → paid. Query sends it back with a note.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => setFilter(status)}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize ${
              filter === status ? "bg-[#10662A] text-white" : "border border-[#d8ecdd] bg-white text-[#390A5D]"
            }`}
          >
            {status}
          </button>
        ))}
      </div>
      {loading ? (
        <div className="grid place-items-center py-16">
          <Loader2 className="size-6 animate-spin text-[#10662A]" />
        </div>
      ) : rows.length === 0 ? (
        <p className="py-12 text-center text-sm text-[#5c4d72]">No invoices</p>
      ) : (
        <ul className="divide-y divide-[#d8ecdd] rounded-2xl border border-[#d8ecdd] bg-white">
          {rows.map((row) => {
            const number = String(row.bank_snapshot?.invoice_number || row.note || "Payout");
            return (
              <li key={row.id} className="space-y-3 px-4 py-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="font-semibold text-[#390A5D]">
                      {row.user_name || row.user_email} · {inr(row.amount)}
                    </div>
                    <div className="text-xs text-[#5c4d72]">
                      {number} · {row.status}
                      {row.created_at ? ` · ${new Date(row.created_at).toLocaleString("en-IN")}` : ""}
                    </div>
                    <div className="mt-1 font-mono text-xs text-[#5c4d72]">
                      {String(row.bank_snapshot?.bank_name || "")} · {String(row.bank_snapshot?.account_number || "")} · {String(row.bank_snapshot?.ifsc || "")}
                    </div>
                    {row.rejection_reason ? <div className="mt-1 text-xs text-amber-800">{row.rejection_reason}</div> : null}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <input
                    value={utr[row.id] || ""}
                    onChange={(event) => setUtr((prev) => ({ ...prev, [row.id]: event.target.value }))}
                    placeholder="UTR when paying"
                    className="rounded-lg border border-[#d8ecdd] px-3 py-1.5 text-xs"
                  />
                  <input
                    value={reason[row.id] || ""}
                    onChange={(event) => setReason((prev) => ({ ...prev, [row.id]: event.target.value }))}
                    placeholder="Query or rejection note"
                    className="rounded-lg border border-[#d8ecdd] px-3 py-1.5 text-xs"
                  />
                  {(row.status === "pending" || row.status === "query") && (
                    <button type="button" disabled={busy === row.id} onClick={() => void act(row.id, "approve")} className="rounded-lg bg-[#10662A] px-3 py-1.5 text-xs font-semibold text-white">
                      Approve
                    </button>
                  )}
                  {row.status === "approved" && (
                    <button type="button" disabled={busy === row.id} onClick={() => void act(row.id, "processing")} className="rounded-lg border border-[#d8ecdd] px-3 py-1.5 text-xs font-semibold text-[#390A5D]">
                      Start processing
                    </button>
                  )}
                  {(row.status === "approved" || row.status === "processing" || row.status === "pending") && (
                    <button type="button" disabled={busy === row.id} onClick={() => void act(row.id, "paid")} className="rounded-lg border border-[#d8ecdd] px-3 py-1.5 text-xs font-semibold text-[#390A5D]">
                      Mark paid
                    </button>
                  )}
                  {(row.status === "pending" || row.status === "approved") && (
                    <button type="button" disabled={busy === row.id} onClick={() => void act(row.id, "query")} className="rounded-lg border border-amber-200 px-3 py-1.5 text-xs font-semibold text-amber-800">
                      Query
                    </button>
                  )}
                  {(row.status === "pending" || row.status === "query") && (
                    <button type="button" disabled={busy === row.id} onClick={() => void act(row.id, "reject")} className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700">
                      Reject
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
