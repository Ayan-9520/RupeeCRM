import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Shield } from "lucide-react";
import {
  listCrmUsers,
  listAuditEvents,
  adminSetKyc,
  adminSuspendProfile,
  adminDeadNumberCredit,
  type AuditEvent,
} from "@/lib/python-api";

export const Route = createFileRoute("/dashboard/admin/trust")({
  head: () => ({ meta: [{ title: "Trust & Audit — Admin" }] }),
  component: AdminTrustPage,
});

function AdminTrustPage() {
  const [users, setUsers] = useState<
    {
      id: string;
      email: string;
      full_name: string;
      role: string;
      is_active: boolean;
      kyc_verified?: boolean;
    }[]
  >([]);
  const [audit, setAudit] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [purchaseId, setPurchaseId] = useState("");
  const [reason, setReason] = useState("Dead / wrong number");

  const load = useCallback(async () => {
    try {
      const [u, a] = await Promise.all([listCrmUsers(), listAuditEvents()]);
      setUsers(u.items ?? []);
      setAudit(a);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="grid place-items-center py-20">
        <Loader2 className="size-6 animate-spin text-[#10662A]" />
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <h1 className="font-display text-2xl font-bold text-[#390A5D] flex items-center gap-2">
          <Shield className="size-6 text-[#10662A]" /> Trust &amp; audit
        </h1>
        <p className="text-sm text-[#5c4d72] mt-1">
          KYC before publish/payout · suspend profiles · dead-number wallet credit · audit trail
        </p>
      </div>

      <section className="rounded-2xl border border-[#d8ecdd] bg-white p-5 space-y-3">
        <h2 className="font-semibold text-[#390A5D]">KYC verify users</h2>
        <ul className="divide-y divide-[#d8ecdd] max-h-64 overflow-auto">
          {users
            .filter((u) => u.role === "dsa" || u.role === "admin")
            .slice(0, 40)
            .map((u) => (
              <li key={u.id} className="py-2 flex flex-wrap items-center justify-between gap-2 text-sm">
                <div>
                  <div className="font-medium text-[#390A5D]">{u.full_name}</div>
                  <div className="text-xs text-[#5c4d72]">
                    {u.email} · {u.role}
                    {u.kyc_verified ? (
                      <span className="ml-2 text-[#10662A] font-semibold">KYC ✓</span>
                    ) : (
                      <span className="ml-2 text-amber-700">KYC pending</span>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  {!u.kyc_verified && (
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await adminSetKyc(u.id, true);
                          toast.success("KYC verified");
                          await load();
                        } catch (e) {
                          toast.error(e instanceof Error ? e.message : "Failed");
                        }
                      }}
                      className="rounded-lg bg-[#10662A] text-white px-2.5 py-1 text-xs font-semibold"
                    >
                      Verify KYC
                    </button>
                  )}
                  {u.kyc_verified && (
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await adminSetKyc(u.id, false);
                          toast.success("KYC cleared");
                          await load();
                        } catch (e) {
                          toast.error(e instanceof Error ? e.message : "Failed");
                        }
                      }}
                      className="rounded-lg border border-[#d8ecdd] px-2.5 py-1 text-xs font-semibold"
                    >
                      Revoke KYC
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={async () => {
                      const reason = window.prompt("Suspend reason") || "Policy";
                      try {
                        await adminSuspendProfile(u.id, true, reason);
                        toast.success("Profile suspended (if exists)");
                      } catch (e) {
                        toast.error(e instanceof Error ? e.message : "No profile / failed");
                      }
                    }}
                    className="rounded-lg border border-red-200 text-red-700 px-2.5 py-1 text-xs font-semibold"
                  >
                    Suspend profile
                  </button>
                </div>
              </li>
            ))}
        </ul>
      </section>

      <section className="rounded-2xl border border-[#d8ecdd] bg-white p-5 space-y-3">
        <h2 className="font-semibold text-[#390A5D]">Dead-number credit</h2>
        <p className="text-xs text-[#5c4d72]">
          Paste a purchase id from My Leads / audit. Credits wallet and reopens lead on marketplace.
        </p>
        <input
          value={purchaseId}
          onChange={(e) => setPurchaseId(e.target.value)}
          placeholder="Purchase UUID"
          className="w-full rounded-lg border border-[#d8ecdd] px-3 py-2 text-sm font-mono"
        />
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="w-full rounded-lg border border-[#d8ecdd] px-3 py-2 text-sm"
        />
        <button
          type="button"
          onClick={async () => {
            try {
              const res = await adminDeadNumberCredit({
                purchase_id: purchaseId.trim(),
                reason: reason.trim(),
              });
              toast.success(`Credited ₹${res.credited}`);
              setPurchaseId("");
              await load();
            } catch (e) {
              toast.error(e instanceof Error ? e.message : "Failed");
            }
          }}
          className="rounded-xl bg-[#390A5D] text-white px-4 py-2 text-sm font-semibold"
        >
          Credit &amp; reopen
        </button>
        <Link to="/dashboard/admin/payouts" className="block text-sm font-semibold text-[#10662A]">
          Admin payouts →
        </Link>
      </section>

      <section className="rounded-2xl border border-[#d8ecdd] bg-white overflow-hidden">
        <div className="px-4 py-3 font-semibold text-sm text-[#390A5D] border-b border-[#d8ecdd]">
          Recent audit
        </div>
        {audit.length === 0 ? (
          <p className="text-sm text-[#5c4d72] text-center py-8">No events yet</p>
        ) : (
          <ul className="divide-y divide-[#d8ecdd] max-h-80 overflow-auto">
            {audit.map((e) => (
              <li key={e.id} className="px-4 py-2 text-xs">
                <span className="font-bold text-[#10662A]">{e.action}</span>
                <span className="text-[#5c4d72]">
                  {" "}
                  · {e.entity_type}/{e.entity_id} ·{" "}
                  {e.created_at ? new Date(e.created_at).toLocaleString("en-IN") : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
