import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  listAdminPayoutRequests,
  adminPayoutAction,
  type PayoutRequest,
} from "@/lib/python-api";

export const Route = createFileRoute("/dashboard/admin/payouts")({
  head: () => ({ meta: [{ title: "Payout Requests — Admin" }] }),
  component: AdminPayouts,
});

function AdminPayouts() {
  const [rows, setRows] = useState<PayoutRequest[]>([]);
  const [filter, setFilter] = useState("pending");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = async (status: string) => {
    setLoading(true);
    try {
      setRows(await listAdminPayoutRequests(status));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Load failed");
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load(filter);
  }, [filter]);

  const act = async (id: string, action: "approve" | "reject" | "paid") => {
    let utr: string | undefined;
    let rejection_reason: string | undefined;
    if (action === "paid" || action === "approve") {
      utr = window.prompt("UTR / reference (optional)") || undefined;
    }
    if (action === "reject") {
      rejection_reason = window.prompt("Rejection reason") || "Rejected";
    }
    setBusy(id);
    try {
      await adminPayoutAction(id, action, { utr, rejection_reason });
      toast.success(`Marked ${action}`);
      await load(filter);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-5 max-w-4xl">
      <div>
        <h1 className="font-display text-2xl font-bold text-[#390A5D]">Payout requests</h1>
        <p className="text-sm text-[#5c4d72] mt-1">
          Manual bank settle — approve, then mark paid with UTR after transfer.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {["pending", "approved", "paid", "rejected", "all"].map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setFilter(s)}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize ${
              filter === s ? "bg-[#10662A] text-white" : "border border-[#d8ecdd] bg-white text-[#390A5D]"
            }`}
          >
            {s}
          </button>
        ))}
      </div>
      {loading ? (
        <div className="grid place-items-center py-16">
          <Loader2 className="size-6 animate-spin text-[#10662A]" />
        </div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-[#5c4d72] text-center py-12">No requests</p>
      ) : (
        <ul className="rounded-2xl border border-[#d8ecdd] bg-white divide-y divide-[#d8ecdd]">
          {rows.map((r) => (
            <li key={r.id} className="px-4 py-4 space-y-2">
              <div className="flex flex-wrap justify-between gap-2">
                <div>
                  <div className="font-semibold text-[#390A5D]">
                    {r.user_name || r.user_email} · ₹{r.amount.toLocaleString("en-IN")}
                  </div>
                  <div className="text-xs text-[#5c4d72]">
                    {r.user_email} · {r.status}
                    {r.created_at ? ` · ${new Date(r.created_at).toLocaleString("en-IN")}` : ""}
                  </div>
                  <div className="text-xs text-[#5c4d72] mt-1 font-mono">
                    {(r.bank_snapshot?.bank_name as string) || ""} ·{" "}
                    {(r.bank_snapshot?.account_number as string) || ""} ·{" "}
                    {(r.bank_snapshot?.ifsc as string) || ""}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 items-start">
                  {r.status === "pending" && (
                    <>
                      <button
                        type="button"
                        disabled={busy === r.id}
                        onClick={() => void act(r.id, "approve")}
                        className="rounded-lg bg-[#10662A] text-white px-3 py-1.5 text-xs font-semibold"
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        disabled={busy === r.id}
                        onClick={() => void act(r.id, "reject")}
                        className="rounded-lg border border-red-200 text-red-700 px-3 py-1.5 text-xs font-semibold"
                      >
                        Reject
                      </button>
                    </>
                  )}
                  {(r.status === "pending" || r.status === "approved") && (
                    <button
                      type="button"
                      disabled={busy === r.id}
                      onClick={() => void act(r.id, "paid")}
                      className="rounded-lg border border-[#d8ecdd] px-3 py-1.5 text-xs font-semibold text-[#390A5D]"
                    >
                      Mark paid
                    </button>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
