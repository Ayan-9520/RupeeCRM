import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, ChevronDown, ChevronRight, Download, FileCheck2, FileDown, Loader2, Settings2 } from "lucide-react";
import {
  downloadInvoiceExcel,
  getFinanceSetup,
  invoiceApprovalAction,
  listInvoiceApprovals,
  payInvoice,
  saveFinanceSetup,
  type FinanceSetupUser,
  type InvoiceApprovalRow,
} from "@/lib/python-api";
import { useAuth } from "@/lib/auth-context";
import { isPlatformAdmin } from "@/lib/role-access";
import { InvoiceSteps, STAGE_FILTERS, actionLabel, inr } from "@/components/invoices/InvoiceSteps";
import { downloadInvoicePdf } from "@/lib/invoice-pdf";

export const Route = createFileRoute("/dashboard/invoice-approvals")({
  head: () => ({ meta: [{ title: "Invoice approvals — RupeeDial One" }] }),
  component: InvoiceApprovalsPage,
});

type Tab = "mine" | "all" | "setup";

const LEVELS: [string, string][] = [
  ["", "Not an approver"],
  ["rm", "RM"],
  ["manager", "Manager"],
  ["business_head", "Business Head"],
  ["accounts", "Accounts"],
];

function todayIso() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
}

function InvoiceApprovalsPage() {
  const { role, user } = useAuth();
  const isAdmin = isPlatformAdmin(role);
  const [tab, setTab] = useState<Tab>("mine");
  const [rows, setRows] = useState<InvoiceApprovalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stage, setStage] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    if (tab === "setup") return;
    setLoading(true);
    try {
      setRows(
        await listInvoiceApprovals({
          scope: tab,
          stage: tab === "all" && stage !== "all" ? stage : undefined,
          date_from: dateFrom || undefined,
          date_to: dateTo || undefined,
        }),
      );
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load invoices");
    } finally {
      setLoading(false);
    }
  }, [tab, stage, dateFrom, dateTo]);

  useEffect(() => {
    void load();
  }, [load]);

  const exportExcel = async () => {
    setExporting(true);
    try {
      const blob = await downloadInvoiceExcel({
        stage: stage !== "all" ? stage : undefined,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `RupeeDial-Invoices-${todayIso()}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    } finally {
      setExporting(false);
    }
  };

  const replaceRow = (row: InvoiceApprovalRow) => {
    setRows((prev) => (tab === "mine" && !row.can_act ? prev.filter((r) => r.id !== row.id) : prev.map((r) => (r.id === row.id ? row : r))));
  };

  const tabs: [Tab, string][] = [
    ["mine", "My queue"],
    ["all", "All invoices"],
    ...(isAdmin ? ([["setup", "Setup"]] as [Tab, string][]) : []),
  ];

  return (
    <div className="max-w-6xl space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 font-display text-2xl font-bold text-[#390A5D]">
            <FileCheck2 className="size-6 text-[#10662A]" /> Invoice approvals
          </h1>
          <p className="mt-1 text-sm text-[#5c4d72]">
            Partner invoice → RM 1 → RM 2 → Manager → Business Head → Accounts payment.
            {user?.finance_level ? ` You are: ${LEVELS.find(([k]) => k === user.finance_level)?.[1] ?? user.finance_level}.` : ""}
          </p>
        </div>
        {tab !== "setup" ? (
          <button
            type="button"
            onClick={() => void exportExcel()}
            disabled={exporting}
            className="inline-flex items-center gap-2 rounded-xl border border-[#d8ecdd] bg-white px-3.5 py-2 text-sm font-semibold text-[#10662A] hover:bg-[#E8F7EC] disabled:opacity-60"
          >
            {exporting ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />} Download Excel
          </button>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {tabs.map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold ${
              tab === id ? "bg-[#10662A] text-white" : "border border-[#d8ecdd] bg-white text-[#390A5D] hover:border-[#10662A]/40"
            }`}
          >
            {label}
          </button>
        ))}
        {tab !== "setup" ? (
          <div className="ml-auto flex flex-wrap items-center gap-2 text-xs">
            {tab === "all" ? (
              <select value={stage} onChange={(e) => setStage(e.target.value)} className="h-8 rounded-lg border border-[#d8ecdd] bg-white px-2">
                {STAGE_FILTERS.map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            ) : null}
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-8 rounded-lg border border-[#d8ecdd] bg-white px-2" />
            <span className="text-[#5c4d72]">to</span>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-8 rounded-lg border border-[#d8ecdd] bg-white px-2" />
          </div>
        ) : null}
      </div>

      {tab === "setup" ? (
        <SetupPanel />
      ) : loading ? (
        <div className="grid place-items-center py-16">
          <Loader2 className="size-6 animate-spin text-[#10662A]" />
        </div>
      ) : error ? (
        <p className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">{error}</p>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-[#d8ecdd] bg-white py-14 text-center text-sm text-[#5c4d72]">
          {tab === "mine" ? "Nothing waiting for you right now." : "No invoices for these filters."}
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => (
            <ApprovalCard key={row.id} row={row} onChange={replaceRow} />
          ))}
        </div>
      )}
    </div>
  );
}

function ApprovalCard({ row, onChange }: { row: InvoiceApprovalRow; onChange: (row: InvoiceApprovalRow) => void }) {
  // Partner invoice PDF is generated from the saved payout figures.
  const [open, setOpen] = useState(row.can_act);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const snap = row.bank_snapshot || {};
  const number = String(snap.invoice_number || row.note || "Invoice");
  const atAccounts = row.stage === "accounts";
  const [pay, setPay] = useState({
    payment_mode: "NEFT",
    payment_bank: "",
    transaction_id: "",
    payment_date: todayIso(),
    paid_amount: String(row.net_payable ?? row.amount),
    remarks: "",
  });

  const run = async (action: "approve" | "query" | "reject" | "processing") => {
    if ((action === "query" || action === "reject") && !comment.trim()) {
      toast.error("Write a note for the partner first");
      return;
    }
    setBusy(action);
    try {
      const updated = await invoiceApprovalAction(row.id, action, comment.trim());
      toast.success(action === "approve" ? `Sent to ${updated.stage_label}` : action === "processing" ? "Payment processing" : action === "query" ? "Query sent to partner" : "Invoice rejected");
      setComment("");
      onChange(updated);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusy(null);
    }
  };

  const recordPayment = async () => {
    if (!pay.payment_bank.trim() || !pay.transaction_id.trim()) {
      toast.error("Bank and transaction ID are required");
      return;
    }
    setBusy("pay");
    try {
      const updated = await payInvoice(row.id, {
        payment_mode: pay.payment_mode,
        payment_bank: pay.payment_bank.trim(),
        transaction_id: pay.transaction_id.trim(),
        payment_date: pay.payment_date,
        paid_amount: Number(pay.paid_amount) || undefined,
        remarks: pay.remarks.trim() || undefined,
      });
      toast.success("Payment recorded");
      onChange(updated);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not record payment");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className={`overflow-hidden rounded-2xl border bg-white ${row.can_act ? "border-[#10662A]/40 shadow-[0_6px_20px_rgba(16,102,42,0.08)]" : "border-[#d8ecdd]"}`}>
      <div role="button" tabIndex={0} onClick={() => setOpen((o) => !o)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") setOpen((o) => !o); }} className="flex w-full cursor-pointer flex-wrap items-center gap-3 px-4 py-3 text-left hover:bg-[#f7fbf8]">
        {open ? <ChevronDown className="size-4 text-[#10662A]" /> : <ChevronRight className="size-4 text-[#10662A]" />}
        <div className="min-w-[12rem] flex-1">
          <div className="font-semibold text-[#390A5D]">{number}</div>
          <div className="text-xs text-[#5c4d72]">
            {row.user_name} · {row.user_email}
            {row.partner_dsa_id ? ` · ${row.partner_dsa_id}` : ""}
          </div>
        </div>
        <div className="text-right">
          <div className="font-bold text-[#10662A]">{inr(row.net_payable ?? row.amount)}</div>
          <div className="text-[10px] uppercase text-[#5c4d72]">Net payable</div>
        </div>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            const disbursed = Number(snap.disbursed_total || 0);
            downloadInvoicePdf({
              number,
              createdAt: row.created_at,
              partnerName: String(snap.account_holder || row.user_name || "Partner"),
              partnerEmail: row.user_email,
              statusLabel: row.stage_label,
              amount: row.amount,
              gstAmount: row.gst_amount,
              tdsAmount: row.tds_amount,
              netPayable: row.net_payable,
              utr: row.utr,
              paymentMode: row.payment_mode,
              bank: snap,
              lines: [
                {
                  description: `${(snap.case_ids as unknown[] | undefined)?.length || 0} disbursed case(s)`,
                  disbursed,
                  commission: row.amount,
                },
              ],
            });
          }}
          className="inline-flex items-center gap-1 rounded-lg border border-[#d8ecdd] bg-white px-2.5 py-1.5 text-xs font-semibold text-[#10662A]"
        >
          <FileDown className="size-3.5" /> PDF
        </button>
        <span
          className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
            row.stage === "paid"
              ? "bg-emerald-100 text-emerald-800"
              : row.stage === "rejected"
                ? "bg-red-100 text-red-700"
                : row.stage === "query"
                  ? "bg-amber-100 text-amber-800"
                  : "bg-[#E8F7EC] text-[#10662A]"
          }`}
        >
          {row.stage_label}
          {row.status === "processing" ? " · processing" : ""}
        </span>
      </div>
      <div className="px-4 pb-3">
        <InvoiceSteps stage={row.stage} queriedStage={row.queried_stage} />
      </div>
      {open ? (
        <div className="space-y-4 border-t border-[#e3f1e7] bg-[#fafdfb] px-4 py-4">
          <div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <Info label="Commission" value={inr(row.amount)} />
            <Info label="GST" value={inr(row.gst_amount ?? 0)} />
            <Info label="TDS" value={`− ${inr(row.tds_amount ?? 0)}`} />
            <Info label="Net payable" value={inr(row.net_payable ?? row.amount)} strong />
            <Info label="Cases" value={String((snap.case_ids as unknown[] | undefined)?.length ?? 0)} />
            <Info label="Disbursed total" value={inr(Number(snap.disbursed_total || 0))} />
            <Info label="RM 1 / RM 2" value={`${row.rm1_name || "Not set"} / ${row.rm2_name || "Not set"}`} />
            <Info label="Raised on" value={row.created_at ? new Date(row.created_at).toLocaleString("en-IN") : "—"} />
            <Info label="Bank" value={`${snap.bank_name || "—"} · ${snap.account_number || ""} · ${snap.ifsc || ""}`} />
            <Info label="Account holder" value={String(snap.account_holder || "—")} />
            <Info label="PAN / GSTIN" value={`${snap.pan || "—"} / ${snap.gstin || "—"}`} />
            {row.utr ? <Info label="Payment" value={`${row.payment_mode || ""} · ${row.utr} · ${row.payment_date || ""}`} /> : null}
          </div>
          {row.rejection_reason && (row.stage === "query" || row.stage === "rejected") ? (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">Note to partner: {row.rejection_reason}</p>
          ) : null}

          <History row={row} />

          {row.can_act ? (
            <div className="space-y-3 rounded-xl border border-[#d8ecdd] bg-white p-3">
              <div className="text-xs font-bold uppercase tracking-wide text-[#10662A]">Your action · {row.stage_label}</div>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Comment (required for Query / Reject)"
                className="min-h-[60px] w-full rounded-lg border border-[#d8ecdd] px-3 py-2 text-sm"
              />
              <div className="flex flex-wrap gap-2">
                {!atAccounts ? (
                  <button type="button" disabled={!!busy} onClick={() => void run("approve")} className="inline-flex items-center gap-1.5 rounded-lg bg-[#10662A] px-3.5 py-2 text-sm font-semibold text-white disabled:opacity-50">
                    {busy === "approve" ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />} Approve
                  </button>
                ) : row.status !== "processing" ? (
                  <button type="button" disabled={!!busy} onClick={() => void run("processing")} className="rounded-lg border border-[#d8ecdd] px-3.5 py-2 text-sm font-semibold text-[#390A5D] disabled:opacity-50">
                    Start processing
                  </button>
                ) : null}
                <button type="button" disabled={!!busy} onClick={() => void run("query")} className="rounded-lg border border-amber-300 px-3.5 py-2 text-sm font-semibold text-amber-800 disabled:opacity-50">
                  Query
                </button>
                <button type="button" disabled={!!busy} onClick={() => void run("reject")} className="rounded-lg border border-red-200 px-3.5 py-2 text-sm font-semibold text-red-700 disabled:opacity-50">
                  Reject
                </button>
              </div>
              {atAccounts ? (
                <div className="space-y-2 border-t border-[#e3f1e7] pt-3">
                  <div className="text-xs font-bold uppercase tracking-wide text-[#10662A]">Record payment</div>
                  <div className="grid gap-2 sm:grid-cols-3">
                    <select value={pay.payment_mode} onChange={(e) => setPay((p) => ({ ...p, payment_mode: e.target.value }))} className="h-9 rounded-lg border border-[#d8ecdd] px-2 text-sm">
                      {["NEFT", "RTGS", "IMPS", "UPI", "CHEQUE"].map((m) => (
                        <option key={m}>{m}</option>
                      ))}
                    </select>
                    <input value={pay.payment_bank} onChange={(e) => setPay((p) => ({ ...p, payment_bank: e.target.value }))} placeholder="Paid from bank / account" className="h-9 rounded-lg border border-[#d8ecdd] px-2 text-sm" />
                    <input value={pay.transaction_id} onChange={(e) => setPay((p) => ({ ...p, transaction_id: e.target.value }))} placeholder="Transaction ID / UTR" className="h-9 rounded-lg border border-[#d8ecdd] px-2 text-sm" />
                    <input type="date" value={pay.payment_date} max={todayIso()} onChange={(e) => setPay((p) => ({ ...p, payment_date: e.target.value }))} className="h-9 rounded-lg border border-[#d8ecdd] px-2 text-sm" />
                    <input type="number" value={pay.paid_amount} onChange={(e) => setPay((p) => ({ ...p, paid_amount: e.target.value }))} placeholder="Paid amount" className="h-9 rounded-lg border border-[#d8ecdd] px-2 text-sm" />
                    <input value={pay.remarks} onChange={(e) => setPay((p) => ({ ...p, remarks: e.target.value }))} placeholder="Remarks (optional)" className="h-9 rounded-lg border border-[#d8ecdd] px-2 text-sm" />
                  </div>
                  <button type="button" disabled={!!busy} onClick={() => void recordPayment()} className="inline-flex items-center gap-1.5 rounded-lg bg-[#10662A] px-3.5 py-2 text-sm font-semibold text-white disabled:opacity-50">
                    {busy === "pay" ? <Loader2 className="size-4 animate-spin" /> : null} Mark paid
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function Info({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-[#5c4d72]">{label}</div>
      <div className={`truncate ${strong ? "font-bold text-[#10662A]" : "text-[#1f1a2e]"}`} title={value}>
        {value}
      </div>
    </div>
  );
}

function History({ row }: { row: InvoiceApprovalRow }) {
  if (!row.history.length) return null;
  return (
    <div>
      <div className="mb-1.5 text-xs font-bold uppercase tracking-wide text-[#10662A]">History</div>
      <div className="overflow-x-auto rounded-xl border border-[#d8ecdd] bg-white">
        <table className="w-full min-w-[560px] text-xs">
          <thead className="bg-[#10662A] text-left text-white">
            <tr>
              <th className="px-3 py-2 font-semibold">Step</th>
              <th className="px-3 py-2 font-semibold">Status</th>
              <th className="px-3 py-2 font-semibold">Comments</th>
              <th className="px-3 py-2 font-semibold">Updated by</th>
              <th className="px-3 py-2 font-semibold">Updated on</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#e3f1e7]">
            {row.history.map((h, i) => (
              <tr key={i}>
                <td className="px-3 py-2">{h.stage_label}</td>
                <td className="px-3 py-2 font-semibold">{actionLabel(h.action)}</td>
                <td className="px-3 py-2 text-[#5c4d72]">{h.comment || "—"}</td>
                <td className="px-3 py-2">{h.actor_name || "—"}</td>
                <td className="px-3 py-2 text-[#5c4d72]">{h.created_at ? new Date(h.created_at).toLocaleString("en-IN") : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SetupPanel() {
  const [users, setUsers] = useState<FinanceSetupUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    try {
      setUsers((await getFinanceSetup()).users);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not load users");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async (u: FinanceSetupUser, body: Parameters<typeof saveFinanceSetup>[1]) => {
    try {
      await saveFinanceSetup(u.id, body);
      toast.success("Saved");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    }
  };

  const q = search.trim().toLowerCase();
  const match = (u: FinanceSetupUser) => !q || u.full_name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
  const staff = useMemo(() => users.filter((u) => !["dsa", "affiliate", "customer"].includes(u.role)), [users]);
  const partners = useMemo(() => users.filter((u) => u.role === "dsa" || u.role === "affiliate"), [users]);
  const rms = staff.filter((u) => u.finance_level === "rm");

  if (loading) {
    return (
      <div className="grid place-items-center py-16">
        <Loader2 className="size-6 animate-spin text-[#10662A]" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search name or email"
        className="h-9 w-72 rounded-lg border border-[#d8ecdd] bg-white px-3 text-sm"
      />
      <section className="rounded-2xl border border-[#d8ecdd] bg-white">
        <h2 className="flex items-center gap-2 border-b border-[#d8ecdd] px-4 py-3 font-semibold text-[#390A5D]">
          <Settings2 className="size-4 text-[#10662A]" /> Team approval levels
        </h2>
        <ul className="max-h-[420px] divide-y divide-[#e3f1e7] overflow-y-auto">
          {staff.filter(match).map((u) => (
            <li key={u.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm">
              <div>
                <div className="font-medium text-[#390A5D]">{u.full_name}</div>
                <div className="text-xs text-[#5c4d72]">
                  {u.email} · {u.role}
                </div>
              </div>
              <select
                value={u.finance_level || ""}
                onChange={(e) => void save(u, { finance_level: e.target.value || null })}
                className="h-8 rounded-lg border border-[#d8ecdd] px-2 text-xs"
              >
                {LEVELS.map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </li>
          ))}
        </ul>
      </section>
      <section className="rounded-2xl border border-[#d8ecdd] bg-white">
        <h2 className="border-b border-[#d8ecdd] px-4 py-3 font-semibold text-[#390A5D]">Partner RM assignment</h2>
        {rms.length < 2 ? (
          <p className="px-4 pt-3 text-xs text-amber-800">Set at least two team members to the RM level above, then assign RM 1 and RM 2 here.</p>
        ) : null}
        <ul className="max-h-[420px] divide-y divide-[#e3f1e7] overflow-y-auto">
          {partners.filter(match).map((u) => (
            <li key={u.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm">
              <div>
                <div className="font-medium text-[#390A5D]">{u.full_name}</div>
                <div className="text-xs text-[#5c4d72]">
                  {u.email} · {u.role}
                </div>
              </div>
              <div className="flex gap-2">
                {(["rm1_user_id", "rm2_user_id"] as const).map((key, i) => (
                  <select
                    key={key}
                    value={u[key] || ""}
                    onChange={(e) => void save(u, { [key]: e.target.value || null })}
                    className="h-8 rounded-lg border border-[#d8ecdd] px-2 text-xs"
                  >
                    <option value="">RM {i + 1}: not set</option>
                    {rms.map((rm) => (
                      <option key={rm.id} value={rm.id}>
                        RM {i + 1}: {rm.full_name}
                      </option>
                    ))}
                  </select>
                ))}
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
