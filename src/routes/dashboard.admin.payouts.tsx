import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import {
  Loader2, IndianRupee, Clock, CheckCircle2, XCircle, BadgeCheck, Banknote, Smartphone,
  Filter, Search, Copy, ShieldCheck,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/dashboard/admin/payouts")({
  head: () => ({ meta: [{ title: "Payout Requests — Admin" }] }),
  component: AdminPayouts,
});

type PayoutStatus = "pending" | "approved" | "rejected" | "paid";
type PayoutMethod = "upi" | "bank";

type Payout = {
  id: string;
  user_id: string;
  amount: number;
  method: PayoutMethod;
  upi_id: string | null;
  bank_account: string | null;
  ifsc: string | null;
  account_holder: string | null;
  status: PayoutStatus;
  requested_at: string;
  decided_at: string | null;
  paid_at: string | null;
  reject_reason: string | null;
  transaction_ref: string | null;
  admin_notes: string | null;
};

type Profile = { id: string; full_name: string | null; phone: string | null; company_name: string | null };

type Action = "approve" | "reject" | "paid";

function AdminPayouts() {
  const { role, loading: authLoading } = useAuth();
  const [rows, setRows] = useState<Payout[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<"all" | PayoutStatus>("pending");
  const [search, setSearch] = useState("");

  const [action, setAction] = useState<{ payout: Payout; type: Action } | null>(null);

  const fetchAll = async () => {
    setLoading(true);
    const { data: payouts } = await supabase
      .from("payout_requests")
      .select("*")
      .order("requested_at", { ascending: false });
    const list = (payouts ?? []) as Payout[];
    setRows(list);
    const ids = Array.from(new Set(list.map((r) => r.user_id)));
    if (ids.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id,full_name,phone,company_name")
        .in("id", ids);
      const map: Record<string, Profile> = {};
      for (const p of (profs ?? []) as Profile[]) map[p.id] = p;
      setProfiles(map);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (authLoading) return;
    if (role !== "admin") { setLoading(false); return; }
    fetchAll();
  }, [role, authLoading]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (search) {
        const s = search.toLowerCase();
        const p = profiles[r.user_id];
        if (!(p?.full_name?.toLowerCase().includes(s)
            || p?.phone?.includes(s)
            || r.upi_id?.toLowerCase().includes(s)
            || r.id.toLowerCase().includes(s))) return false;
      }
      return true;
    });
  }, [rows, statusFilter, search, profiles]);

  const kpi = useMemo(() => {
    let pending = 0, approved = 0, paid = 0, rejected = 0;
    let pendingAmt = 0, paidAmt = 0;
    for (const r of rows) {
      if (r.status === "pending") { pending++; pendingAmt += Number(r.amount); }
      else if (r.status === "approved") { approved++; pendingAmt += Number(r.amount); }
      else if (r.status === "paid") { paid++; paidAmt += Number(r.amount); }
      else rejected++;
    }
    return { pending, approved, paid, rejected, pendingAmt, paidAmt };
  }, [rows]);

  if (authLoading || loading) {
    return <div className="grid place-items-center py-20"><Loader2 className="size-6 animate-spin text-accent" /></div>;
  }

  if (role !== "admin") {
    return (
      <div className="max-w-xl mx-auto rounded-2xl bg-card border border-dashed border-border p-12 text-center">
        <ShieldCheck className="size-10 mx-auto text-muted-foreground" />
        <h2 className="font-display text-xl font-bold mt-3">Admin access required</h2>
        <p className="text-sm text-muted-foreground mt-1">You need an admin role to manage payouts.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl">
      <div>
        <h1 className="font-display text-2xl lg:text-3xl font-bold">Payout Requests</h1>
        <p className="text-muted-foreground mt-1">Review, approve and release commission payouts to partners.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi icon={Clock} label="Pending" value={kpi.pending} sub={`₹${kpi.pendingAmt.toLocaleString("en-IN")} to release`} tone="amber" />
        <Kpi icon={BadgeCheck} label="Approved" value={kpi.approved} sub="Awaiting transfer" tone="blue" />
        <Kpi icon={CheckCircle2} label="Paid" value={kpi.paid} sub={`₹${kpi.paidAmt.toLocaleString("en-IN")} released`} tone="success" />
        <Kpi icon={XCircle} label="Rejected" value={kpi.rejected} sub="Last 30 days" tone="rose" />
      </div>

      <div className="rounded-2xl bg-card border border-border p-4 shadow-card">
        <div className="grid sm:grid-cols-3 gap-3 items-center">
          <div className="relative sm:col-span-2">
            <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search partner name, phone, UPI, request ID…"
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-background border border-border text-sm focus:outline-none focus:border-accent"
            />
          </div>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as "all" | PayoutStatus)} className="input-base">
            <option value="all">All statuses</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="paid">Paid</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
        <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
          <Filter className="size-3.5" />
          <span>{filtered.length} of {rows.length} requests</span>
        </div>
      </div>

      <div className="rounded-2xl bg-card border border-border shadow-card overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-12 text-center text-sm text-muted-foreground">No payout requests match these filters.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary/40 text-[11px] uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="text-left font-semibold py-2.5 px-4">Partner</th>
                  <th className="text-right font-semibold py-2.5 px-4">Amount</th>
                  <th className="text-left font-semibold py-2.5 px-4">Method</th>
                  <th className="text-left font-semibold py-2.5 px-4">Payout details</th>
                  <th className="text-left font-semibold py-2.5 px-4">Requested</th>
                  <th className="text-left font-semibold py-2.5 px-4">Status</th>
                  <th className="text-right font-semibold py-2.5 px-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const p = profiles[r.user_id];
                  return (
                    <tr key={r.id} className="border-t border-border hover:bg-secondary/30 align-top">
                      <td className="py-3 px-4">
                        <div className="font-medium truncate max-w-[180px]">{p?.full_name ?? "—"}</div>
                        <div className="text-[11px] text-muted-foreground font-mono truncate max-w-[180px]">{r.user_id.slice(0, 8)}</div>
                        {p?.phone && <div className="text-[11px] text-muted-foreground">{p.phone}</div>}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        ₹{Number(r.amount).toLocaleString("en-IN")}
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-secondary border border-border">
                          {r.method === "upi" ? <Smartphone className="size-3" /> : <Banknote className="size-3" />}
                          {r.method.toUpperCase()}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        {r.method === "upi" ? (
                          <CopyChip value={r.upi_id ?? "—"} />
                        ) : (
                          <div className="space-y-0.5 text-[12px]">
                            <div className="font-medium">{r.account_holder}</div>
                            <CopyChip value={r.bank_account ?? "—"} />
                            <div className="text-[11px] text-muted-foreground">IFSC: {r.ifsc}</div>
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-[12px] text-muted-foreground whitespace-nowrap">
                        {new Date(r.requested_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                      </td>
                      <td className="py-3 px-4">
                        <StatusBadge status={r.status} />
                        {r.transaction_ref && <div className="text-[10px] text-muted-foreground mt-1 font-mono">{r.transaction_ref}</div>}
                        {r.reject_reason && <div className="text-[10px] text-rose-600 dark:text-rose-400 mt-1 max-w-[180px] truncate" title={r.reject_reason}>{r.reject_reason}</div>}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-end gap-1.5 flex-wrap">
                          {r.status === "pending" && (
                            <>
                              <button onClick={() => setAction({ payout: r, type: "approve" })}
                                className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-blue-500/15 text-blue-700 dark:text-blue-300 hover:bg-blue-500/25">Approve</button>
                              <button onClick={() => setAction({ payout: r, type: "reject" })}
                                className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-rose-500/15 text-rose-700 dark:text-rose-300 hover:bg-rose-500/25">Reject</button>
                            </>
                          )}
                          {(r.status === "pending" || r.status === "approved") && (
                            <button onClick={() => setAction({ payout: r, type: "paid" })}
                              className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/25">Mark paid</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ActionDialog
        action={action}
        partnerName={action ? profiles[action.payout.user_id]?.full_name ?? "Partner" : ""}
        onClose={() => setAction(null)}
        onDone={() => { setAction(null); fetchAll(); }}
      />
    </div>
  );
}

function ActionDialog({
  action, partnerName, onClose, onDone,
}: {
  action: { payout: Payout; type: Action } | null;
  partnerName: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [txnRef, setTxnRef] = useState("");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setTxnRef(""); setReason(""); setNotes("");
  }, [action]);

  if (!action) return null;
  const { payout, type } = action;

  const titles = {
    approve: "Approve payout",
    reject: "Reject payout",
    paid: "Mark as paid",
  };

  const submit = async () => {
    if (type === "reject" && reason.trim().length < 3) {
      toast.error("Please provide a reason"); return;
    }
    if (type === "paid" && txnRef.trim().length < 3) {
      toast.error("Enter the transaction reference / UTR"); return;
    }
    setSubmitting(true);
    const { error } = await supabase.rpc("process_payout", {
      _payout_id: payout.id,
      _action: type,
      _transaction_ref: type === "paid" ? txnRef.trim() : null,
      _reject_reason: type === "reject" ? reason.trim() : null,
      _admin_notes: notes.trim() || null,
    });
    setSubmitting(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`Payout ${type === "paid" ? "marked as paid" : type + "d"}`);
    onDone();
  };

  return (
    <Dialog open={!!action} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{titles[type]}</DialogTitle>
          <DialogDescription>
            ₹{Number(payout.amount).toLocaleString("en-IN")} to <strong>{partnerName}</strong> via {payout.method.toUpperCase()}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="rounded-lg bg-secondary/40 border border-border p-3 text-xs">
            {payout.method === "upi" ? (
              <div><span className="text-muted-foreground">UPI: </span><span className="font-mono">{payout.upi_id}</span></div>
            ) : (
              <div className="space-y-0.5">
                <div><span className="text-muted-foreground">Account holder: </span>{payout.account_holder}</div>
                <div><span className="text-muted-foreground">A/C: </span><span className="font-mono">{payout.bank_account}</span></div>
                <div><span className="text-muted-foreground">IFSC: </span><span className="font-mono">{payout.ifsc}</span></div>
              </div>
            )}
          </div>

          {type === "paid" && (
            <div>
              <Label htmlFor="txn">Transaction reference / UTR</Label>
              <Input id="txn" value={txnRef} onChange={(e) => setTxnRef(e.target.value)} placeholder="UTR123456789" />
            </div>
          )}
          {type === "reject" && (
            <div>
              <Label htmlFor="reason">Reason for rejection</Label>
              <Input id="reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Invalid bank details, etc." />
            </div>
          )}
          <div>
            <Label htmlFor="notes">Internal notes (optional)</Label>
            <Input id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Private note" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={submitting}>
            {submitting ? <Loader2 className="size-4 animate-spin" /> : "Confirm"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CopyChip({ value }: { value: string }) {
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(value); toast.success("Copied"); }}
      className="inline-flex items-center gap-1.5 text-[11px] font-mono bg-secondary hover:bg-accent/15 px-2 py-0.5 rounded-md border border-border max-w-[200px] truncate"
      title={value}
    >
      <Copy className="size-3 shrink-0" /> <span className="truncate">{value}</span>
    </button>
  );
}

function Kpi({ icon: Icon, label, value, sub, tone }: {
  icon: React.ComponentType<{ className?: string }>; label: string; value: number; sub: string;
  tone: "amber" | "blue" | "success" | "rose";
}) {
  const cls =
    tone === "success" ? "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/30"
    : tone === "amber" ? "text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/30"
    : tone === "blue" ? "text-blue-600 dark:text-blue-400 bg-blue-500/10 border-blue-500/30"
    : "text-rose-600 dark:text-rose-400 bg-rose-500/10 border-rose-500/30";
  return (
    <div className="rounded-2xl bg-card border border-border p-4 shadow-card">
      <div className={`size-9 rounded-xl border grid place-items-center mb-3 ${cls}`}>
        <Icon className="size-4" />
      </div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-display text-2xl font-bold mt-0.5">{value}</div>
      <div className="text-[11px] text-muted-foreground mt-0.5">{sub}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: PayoutStatus }) {
  const map = {
    pending: { label: "Pending", cls: "bg-amber-500/15 text-amber-700 dark:text-amber-300", Icon: Clock },
    approved: { label: "Approved", cls: "bg-blue-500/15 text-blue-700 dark:text-blue-300", Icon: BadgeCheck },
    paid: { label: "Paid", cls: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300", Icon: CheckCircle2 },
    rejected: { label: "Rejected", cls: "bg-rose-500/15 text-rose-700 dark:text-rose-300", Icon: XCircle },
  } as const;
  const m = map[status];
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${m.cls}`}>
      <m.Icon className="size-2.5" /> {m.label}
    </span>
  );
}

// suppress unused
void IndianRupee;
