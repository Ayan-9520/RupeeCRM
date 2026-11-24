import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth-context";
import { isPlatformAdmin } from "@/lib/role-access";
import { RUPEEDIAL_PRODUCT_MENUS } from "@/lib/rupeedial-products";
import {
  createCaseFile,
  downloadCasePaper,
  listCaseFiles,
  openSampleCase,
  saveCaseFile,
  uploadCasePaper,
  type LoanCaseFile,
} from "@/lib/python-api";

export const Route = createFileRoute("/dashboard/cases")({
  head: () => ({ meta: [{ title: "Case Files — RupeeOne" }] }),
  component: CasesPage,
});

const STAGES = [
  ["draft", "Draft"],
  ["submitted", "Submitted"],
  ["logged_in", "Logged In"],
  ["sanctioned", "Sanctioned"],
  ["disbursed", "Disbursed"],
  ["disbursed_confirmed", "Disbursed Confirmed"],
  ["collected", "Collected"],
] as const;

const CHIPS: { id: string; label: string }[] = [
  { id: "draft", label: "Draft" },
  { id: "submitted", label: "Submitted" },
  { id: "logged_in", label: "Logged In" },
  { id: "sanctioned", label: "Sanctioned" },
  { id: "disbursed", label: "Disbursed" },
  { id: "disbursed_hold", label: "Disbursed Hold" },
  { id: "disbursed_confirmed", label: "Disbursed Confirmed" },
  { id: "partially_collected", label: "Partially Collected" },
  { id: "banker_pending", label: "Banker Pending" },
  { id: "not_counted", label: "Not Counted" },
  { id: "counted", label: "Counted" },
  { id: "counted_pod_pending", label: "Counted POD Pending" },
  { id: "movement", label: "Movement" },
  { id: "cancelled", label: "Cancelled" },
  { id: "collected", label: "Collected" },
];

function statusButton(on: boolean) {
  return `rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${
    on
      ? "border-[#0D4F20] bg-[#0D4F20] text-white"
      : "border-[#d8ecdd] bg-white text-[#0D4F20] hover:border-[#0D4F20] hover:bg-[#0D4F20] hover:text-white"
  }`;
}

function inr(value: number) {
  return Math.round(value || 0).toLocaleString("en-IN");
}

function liveMoney(row: Pick<LoanCaseFile, "loan_amount" | "sanctioned_amount" | "receivable_percent" | "payable_percent" | "loyalty_amount">) {
  const base = Number(row.sanctioned_amount || 0) || Number(row.loan_amount || 0);
  const receivable = Math.round(base * Number(row.receivable_percent || 0)) / 100;
  const payable = Math.round(receivable * Number(row.payable_percent || 0)) / 100;
  const margin = receivable - payable - Number(row.loyalty_amount || 0);
  return {
    base,
    receivable,
    payable,
    agent: 0,
    net: margin,
  };
}

function todayIst() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

const loanTypes = RUPEEDIAL_PRODUCT_MENUS.flatMap((group) => group.items);

const OPS_CHIPS: { id: string; label: string }[] = [
  { id: "submitted", label: "Submitted" },
  { id: "logged_in", label: "Logged in" },
  { id: "sanctioned", label: "Sanctioned" },
  { id: "disbursed", label: "Disbursed" },
  { id: "cancelled", label: "Cancelled" },
];

function shownStatus(row: LoanCaseFile, bankDesk: boolean) {
  if (!bankDesk) return row.status_label;
  if (row.flag === "cancelled") return "Cancelled";
  return row.stage_label || row.status_label;
}

function CasesPage() {
  const { role, user } = useAuth();
  const admin = isPlatformAdmin(role);
  const bankDesk = role === "coordinator" && user?.department === "OPS" && !user?.finance_level;
  const [desk, setDesk] = useState<"files" | "payout">("files");
  const [payoutTab, setPayoutTab] = useState<"pay" | "invoice" | "report">("pay");
  const [chip, setChip] = useState("all");
  const [dateFrom, setDateFrom] = useState(() => `${todayIst().slice(0, 8)}01`);
  const [dateTo, setDateTo] = useState(todayIst);
  const [items, setItems] = useState<LoanCaseFile[]>([]);
  const [revenue, setRevenue] = useState(0);
  const [confirmed, setConfirmed] = useState(0);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState<LoanCaseFile | null>(null);
  const [saving, setSaving] = useState(false);
  const [dealQuery, setDealQuery] = useState("RD-MCF-SAMPLE-0844");
  const [payoutRows, setPayoutRows] = useState<LoanCaseFile[]>([]);
  const [payoutLoading, setPayoutLoading] = useState(false);

  const refresh = async (nextChip = chip, from = dateFrom, to = dateTo) => {
    if (!from || !to || !nextChip) {
      setItems([]);
      setRevenue(0);
      setConfirmed(0);
      setLoading(false);
      return;
    }
    setItems([]);
    setRevenue(0);
    setConfirmed(0);
    setLoading(true);
    try {
      const data = await listCaseFiles(nextChip, from, to);
      setItems(data.items);
      setRevenue(data.revenue);
      setConfirmed(data.confirmed_count);
      setCounts(data.counts ?? {});
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load case files");
    } finally {
      setLoading(false);
    }
  };

  const dealFromUrl = typeof window === "undefined" ? "" : new URLSearchParams(window.location.search).get("deal") ?? "";

  useEffect(() => {
    if (dealFromUrl) {
      void refresh("all", "", "");
      return;
    }
    void refresh("all", dateFrom, dateTo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!dealFromUrl) return;
    const hit = items.find((row) => row.deal_no.toLowerCase() === dealFromUrl.toLowerCase());
    if (hit) setActive(hit);
  }, [items, dealFromUrl]);

  useEffect(() => {
    if (desk !== "payout") return;
    let cancelled = false;
    setPayoutLoading(true);
    void listCaseFiles("all", "", "")
      .then((data) => {
        if (!cancelled) setPayoutRows(data.items);
      })
      .catch((error) => {
        if (!cancelled) toast.error(error instanceof Error ? error.message : "Could not load payout deals");
      })
      .finally(() => {
        if (!cancelled) setPayoutLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [desk]);

  const payoutHit = useMemo(() => {
    const query = dealQuery.trim().toLowerCase();
    if (!query) return null;
    return payoutRows.find((row) => row.deal_no.toLowerCase() === query) ?? payoutRows.find((row) => row.deal_no.toLowerCase().includes(query)) ?? null;
  }, [dealQuery, payoutRows]);

  const save = async (patch: Partial<LoanCaseFile>) => {
    if (!active) return;
    setSaving(true);
    try {
      const saved = await saveCaseFile(active.id, patch);
      setActive(saved);
      toast.success(`${saved.deal_no} saved`);
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const runPayout = async (id: string, patch: Partial<LoanCaseFile>) => {
    try {
      const saved = await saveCaseFile(id, patch);
      toast.success(saved.payout_note || "Payout updated");
      const data = await listCaseFiles("all", "", "");
      setPayoutRows(data.items);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Payout update failed");
    }
  };

  const money = active ? liveMoney(active) : null;


  return (
    <div className="mx-auto max-w-[1400px] space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#10662A]">{bankDesk ? "Bank files" : "Closure desk"}</p>
          <h1 className="font-display text-2xl font-bold text-[#390A5D]">Case files</h1>
          {bankDesk ? (
            <p className="mt-1 max-w-xl text-sm text-[#5c4d72]">Open a row for the full file. Sanction and disbursement are marked on Submissions. Accounts pays the partner later.</p>
          ) : null}
        </div>
        {bankDesk || role === "dsa" || role === "affiliate" ? null : (
        <div className="inline-flex rounded-xl border border-[#d8ecdd] bg-white p-1">
          <button className={`rounded-lg px-4 py-2 text-sm font-semibold ${desk === "files" ? "bg-[#10662A] text-white" : "text-[#390A5D]"}`} onClick={() => { setDesk("files"); setActive(null); }}>Case list</button>
          <button className={`rounded-lg px-4 py-2 text-sm font-semibold ${desk === "payout" ? "bg-[#10662A] text-white" : "text-[#390A5D]"}`} onClick={() => { setDesk("payout"); setActive(null); }}>Payout</button>
        </div>
        )}
      </div>

      {desk === "payout" ? (
        <section className="rounded-2xl border bg-white p-4">
          <h2 className="font-display text-lg font-bold text-[#390A5D]">Channel payout</h2>
          <p className="mt-1 text-sm text-[#5c4d72]">Find the deal, record the lender invoice, then pay the connector. Both invoice and collection must be 100% first.</p>
          <div className="mt-3 flex gap-2 overflow-x-auto">
            {([["pay", "Pay connector"], ["invoice", "Invoice"], ["report", "Report"]] as const).map(([id, label]) => (
              <button key={id} type="button" className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-semibold ${payoutTab === id ? "bg-[#10662A] text-white" : "border border-[#d8ecdd] text-[#390A5D]"}`} onClick={() => setPayoutTab(id)}>{label}</button>
            ))}
          </div>
          {payoutTab === "report" ? (
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-[720px] w-full text-left text-sm">
                <thead className="text-[11px] uppercase tracking-wide text-[#5c4d72]">
                  <tr>{["Deal", "Connector", "Status", "Invoice", "Collection", "Connector payout"].map((head) => <th key={head} className="px-2 py-2">{head}</th>)}</tr>
                </thead>
                <tbody>
                  {payoutRows.filter((row) => (!dateFrom || (row.submitted_on || "") >= dateFrom) && (!dateTo || (row.submitted_on || "") <= dateTo)).map((row) => (
                    <tr key={row.id} className="border-t">
                      <td className="px-2 py-2 font-semibold text-[#10662A]">{row.deal_no}</td>
                      <td className="px-2 py-2">{row.partner_name || "—"}</td>
                      <td className="px-2 py-2">{row.payout_status === "paid" ? "Paid" : row.payout_status === "rejected" ? "Rejected" : "Pending"}</td>
                      <td className="px-2 py-2">{row.invoice_percent}%</td>
                      <td className="px-2 py-2">{row.collection_percent}%</td>
                      <td className="px-2 py-2">₹{inr(row.payable_amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {payoutLoading ? <p className="mt-3 text-sm text-[#5c4d72]">Loading deals…</p> : null}
            </div>
          ) : null}
          {payoutTab !== "report" ? (<>
          <p className="mt-4 text-sm text-[#5c4d72]">{payoutTab === "invoice" ? "Invoice is what we bill the lender. Collection is what the lender has paid." : "Type the deal number."}</p>
          <label className="mt-4 block max-w-md text-xs font-semibold text-[#5c4d72]">
            Deal number
            <Input className="mt-1" value={dealQuery} onChange={(event) => setDealQuery(event.target.value)} placeholder="RD-MCF-SAMPLE-0844" />
          </label>
          {payoutHit ? (
            <div className="mt-4 rounded-xl border p-4">
              <div className="font-semibold">{payoutHit.deal_no}</div>
              <div className="mt-1 text-sm">{payoutHit.partner_name || "Connector"} · {payoutHit.partner_code || "no code"} · {payoutHit.status_label}</div>
              <p className={`mt-3 text-sm font-semibold ${payoutHit.payout_status === "paid" ? "text-red-600" : "text-[#14301c]"}`}>
                Invoice: {payoutHit.invoice_percent}% · Amount {inr(payoutHit.invoice_amount || payoutHit.receivable_amount)}
                <br />
                Collection: {payoutHit.collection_percent}% · Amount {inr(payoutHit.collected_amount)}
                <br />
                {payoutHit.payout_note || "Payout is not completed yet."}
              </p>
              <div className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
                <div>Receivable ₹{inr(payoutHit.receivable_amount)}</div>
                <div>Connector ₹{inr(payoutHit.payable_amount)}</div>
                <div>Net ₹{inr(payoutHit.net_revenue)}</div>
              </div>
              {admin ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button variant="outline" onClick={() => void runPayout(payoutHit.id, { invoice_amount: payoutHit.receivable_amount })}>Invoice 100%</Button>
                  <Button variant="outline" onClick={() => void runPayout(payoutHit.id, { collected_amount: payoutHit.invoice_amount || payoutHit.receivable_amount })}>Collection 100%</Button>
                  <Button onClick={() => void runPayout(payoutHit.id, { payout_status: "paid", stage: "collected", counted: true })}>Pay connector</Button>
                </div>
              ) : null}
            </div>
          ) : (
            <p className="mt-4 text-sm text-[#5c4d72]">{payoutLoading ? "Loading deals…" : "No deal with that number."}</p>
          )}
          </>) : null}
        </section>
      ) : active && money && bankDesk ? (
        <BankFile active={active} onBack={() => setActive(null)} />
      ) : active && money ? (
        <CaseForm
          active={active}
          money={money}
          admin={admin}
          saving={saving}
          onChange={setActive}
          onBack={() => setActive(null)}
          onSave={() => void save(active)}
          onUploaded={setActive}
        />
      ) : (
        <>
          <section className="rounded-2xl border border-[#d8ecdd] bg-white p-4">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex flex-wrap items-end gap-3">
                <label className="text-xs font-semibold text-[#5c4d72]">Submitted from
                  <Input type="date" className="mt-1 w-[168px] bg-white" value={dateFrom} onChange={(event) => { const value = event.target.value; setDateFrom(value); void refresh(chip, value, dateTo); }} />
                </label>
                <label className="text-xs font-semibold text-[#5c4d72]">To
                  <Input type="date" className="mt-1 w-[168px] bg-white" value={dateTo} onChange={(event) => { const value = event.target.value; setDateTo(value); void refresh(chip, dateFrom, value); }} />
                </label>
                <Button variant="outline" onClick={() => { setDateFrom(""); setDateTo(""); setItems([]); setRevenue(0); setConfirmed(0); setCounts({}); }}>Clear dates</Button>
              </div>
              {bankDesk ? null : (
              <div className="text-sm xl:text-right">
                <div className="font-display text-lg font-bold text-[#10662A]">₹{inr(dateFrom && dateTo && chip ? revenue : 0)} revenue</div>
                <div className="text-[#5c4d72]">{dateFrom && dateTo && chip ? confirmed : 0} disbursed confirmed in these dates</div>
              </div>
              )}
              {admin ? (
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={() => void createCaseFile({ loan_type: "LAP", client_name: "New applicant" }).then((row) => { setActive(row); void refresh("draft", dateFrom, dateTo); })}>New draft</Button>
                  <Button className="bg-[#10662A] hover:bg-[#0d5522]" onClick={() => void openSampleCase().then(() => { toast.success("Sample file ready"); void refresh("all", dateFrom, dateTo); })}>Sample file</Button>
                </div>
              ) : null}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
              <button className={statusButton(chip === "all")} onClick={() => { setChip("all"); void refresh("all", dateFrom, dateTo); }}>All{dateFrom && dateTo ? ` (${counts.all ?? 0})` : ""}</button>
              {(bankDesk ? OPS_CHIPS : CHIPS).map((item) => (
                <button
                  key={item.id}
                  className={statusButton(chip === item.id)}
                  onClick={() => { setChip(item.id); void refresh(item.id, dateFrom, dateTo); }}
                >
                  {item.label}
                  {dateFrom && dateTo ? ` (${counts[item.id] ?? 0})` : ""}
                </button>
              ))}
            </div>
          </section>

          {!(dateFrom && dateTo && chip) || (items.length === 0 && !loading) ? (
            <div className="rounded-xl border border-[#d8ecdd] bg-white px-4 py-3 text-sm text-[#390A5D]">
              {!dateFrom || !dateTo
                ? "Enter submitted from and to. No case shows until those dates match."
                : !chip
                  ? "Pick a status. The case shows only when that status matches — Disbursed, Banker Pending, Collected, or any other."
                  : `No ${chip === "all" ? "" : `${CHIPS.find((item) => item.id === chip)?.label ?? ""} `}case found!`}
            </div>
          ) : null}

          {dateFrom && dateTo && chip && (loading || items.length > 0) ? (
          <div className="overflow-x-auto rounded-2xl border border-[#d8ecdd] bg-white shadow-[0_8px_24px_rgba(57,10,93,0.04)]">
            <table className="min-w-[1180px] w-full text-left text-sm">
              <thead className="bg-[#390A5D] text-white">
                <tr>
                  {(bankDesk
                    ? ["Status", "Deal number", "Product", "Bank", "Partner", "Client", "Phone", "Loan amount", "Sanctioned", "Submitted", "Submitted by"]
                    : ["Status", "Deal number", "Product", "Bank", "RM", "Connector", "Client", "Loan amount", "Sanctioned", "Submitted", "Submitted by", "Net"]
                  ).map((head) => (
                    <th key={head} className="whitespace-nowrap px-3 py-3 text-[11px] font-semibold uppercase tracking-wide">{head}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={bankDesk ? 11 : 12} className="px-3 py-10 text-center"><Loader2 className="mx-auto size-5 animate-spin text-[#10662A]" /></td></tr>
                ) : items.map((row) => (
                  <tr key={row.id} className="cursor-pointer border-t border-[#eef6f0] hover:bg-[#f7fdf8]" onClick={() => setActive(row)}>
                    <td className="px-3 py-3"><span className="inline-flex whitespace-nowrap rounded-full border border-[#d8ecdd] bg-[#E8F7EC] px-2.5 py-1 text-[11px] font-semibold text-[#0D4F20]">{shownStatus(row, bankDesk)}</span></td>
                    <td className="whitespace-nowrap px-3 py-3 font-semibold text-[#10662A]">{row.deal_no}</td>
                    <td className="whitespace-nowrap px-3 py-3">{row.loan_type}</td>
                    <td className="px-3 py-3">{row.bank_name || "—"}</td>
                    {bankDesk ? null : <td className="whitespace-nowrap px-3 py-3">{row.bank_rm || "—"}</td>}
                    <td className="px-3 py-3">
                      <div className="whitespace-nowrap font-medium text-[#390A5D]">{row.partner_name || "—"}</div>
                      <div className="text-[11px] text-[#5c4d72]">{row.partner_code}</div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-3">{row.client_name || "—"}</td>
                    {bankDesk ? <td className="whitespace-nowrap px-3 py-3">{row.client_phone || "—"}</td> : null}
                    <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums">₹{inr(row.loan_amount)}</td>
                    <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums">₹{inr(row.sanctioned_amount)}</td>
                    <td className="whitespace-nowrap px-3 py-3">{row.submitted_on || row.expected_sanction_on || "—"}</td>
                    <td className="whitespace-nowrap px-3 py-3">{row.submitted_by || "—"}</td>
                    {bankDesk ? null : <td className="whitespace-nowrap px-3 py-3 text-right font-bold tabular-nums text-[#10662A]">₹{inr(row.net_revenue)}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          ) : null}
        </>
      )}
    </div>
  );
}

function BankFile({ active, onBack }: { active: LoanCaseFile; onBack: () => void }) {
  const facts: [string, string][] = [
    ["Deal number", active.deal_no],
    ["Loan stage", active.flag === "cancelled" ? "Cancelled" : active.stage_label],
    ["Client", active.client_name || "—"],
    ["Phone", active.client_phone || "—"],
    ["Product", active.loan_type || "—"],
    ["Bank", active.bank_name || "—"],
    ["Bank officer", active.bank_rm || "—"],
    ["Partner", [active.partner_name, active.partner_code].filter(Boolean).join(" · ") || "—"],
    ["Loan amount", `₹${inr(active.loan_amount)}`],
    ["Sanctioned amount", `₹${inr(active.sanctioned_amount)}`],
    ["Submitted", active.submitted_on || "—"],
    ["Submitted by", active.submitted_by || "—"],
  ];
  return (
    <section className="space-y-4 rounded-2xl border border-[#d8ecdd] bg-white p-4 sm:p-5">
      <button className="text-sm font-semibold text-[#10662A]" onClick={onBack}>← Back to list</button>
      <div>
        <h2 className="text-xl font-bold text-[#390A5D]">{active.client_name || active.deal_no}</h2>
        <p className="mt-1 text-sm text-[#5c4d72]">{active.deal_no}</p>
      </div>
      <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {facts.map(([label, value]) => (
          <div key={label} className="rounded-xl border border-[#d8ecdd] bg-[#f7fdf8] px-3 py-2">
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-[#5c4d72]">{label}</dt>
            <dd className="mt-1 text-sm font-semibold text-[#390A5D]">{value}</dd>
          </div>
        ))}
      </dl>
      <p className="text-sm text-[#5c4d72]">
        {active.flag === "cancelled"
          ? "The bank rejected this file, or it was cancelled. There is no partner invoice on a rejected file."
          : active.stage === "disbursed"
            ? "The loan is marked disbursed. The customer’s loan money comes from the bank. Partner commission is a separate invoice, paid by Accounts after approval."
            : "This file is still with the bank. Mark sanction, disbursement, or rejection on Submissions."}
        {active.counted ? "" : " Accounts has not booked the lender payout on this file yet."}
      </p>
    </section>
  );
}

function CaseForm({
  active,
  money,
  admin,
  saving,
  onChange,
  onBack,
  onSave,
  onUploaded,
}: {
  active: LoanCaseFile;
  money: ReturnType<typeof liveMoney>;
  admin: boolean;
  saving: boolean;
  onChange: (row: LoanCaseFile) => void;
  onBack: () => void;
  onSave: () => void;
  onUploaded: (row: LoanCaseFile) => void;
}) {
  const reached = STAGES.findIndex(([key]) => key === active.stage);
  return (
    <section className="space-y-4">
      <button className="text-sm font-semibold text-[#10662A]" onClick={onBack}>← Back to list</button>
      <div className="overflow-x-auto rounded-2xl border border-[#d8ecdd] bg-white px-3 py-4">
        <div className="flex min-w-[720px] items-center">
          {STAGES.map(([id, label], index) => (
            <div key={id} className="flex flex-1 items-center">
              <button
                disabled={!admin}
                onClick={() => onChange({ ...active, stage: id })}
                className="flex flex-col items-center gap-1"
              >
                <span className={`grid size-7 place-items-center rounded-full text-[11px] font-bold ${index <= reached ? "bg-[#10662A] text-white" : "bg-[#e7f5eb] text-[#5c4d72]"}`}>{index + 1}</span>
                <span className={`text-[10px] font-semibold ${index <= reached ? "text-[#10662A]" : "text-[#5c4d72]"}`}>{label}</span>
              </button>
              {index < STAGES.length - 1 ? <span className={`mx-1 mb-4 h-0.5 flex-1 ${index < reached ? "bg-[#10662A]" : "bg-[#d8ecdd]"}`} /> : null}
            </div>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap items-end justify-between gap-3 rounded-2xl border border-[#d8ecdd] bg-white p-4">
        <div>
          <p className="font-mono text-sm font-bold text-[#10662A]">{active.deal_no}</p>
          <h2 className="font-display text-xl font-bold text-[#390A5D]">{active.client_name || "Untitled file"}</h2>
          <p className="mt-1 text-sm text-[#5c4d72]">{active.loan_type || "Loan"} · {active.bank_name || "Bank not set"} · submitted {active.submitted_on || "—"} by {active.submitted_by || "—"}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {caseMarks(active).map((mark) => (
            <span key={mark} className="rounded-full bg-[#E8F7EC] px-2.5 py-1 text-[11px] font-semibold text-[#0D4F20]">{mark}</span>
          ))}
        </div>
      </div>

      <FileBlock step="1" title="Login" hint="What was logged: product, amount, source, and the sanction date.">
        <label className="block text-xs font-medium text-[#5c4d72]">
          Loan type
          <select className="mt-1 h-10 w-full rounded-md border border-input bg-white px-3 text-sm" value={active.loan_type} onChange={(event) => onChange({ ...active, loan_type: event.target.value })}>
            {active.loan_type && !loanTypes.includes(active.loan_type) ? <option value={active.loan_type}>{active.loan_type}</option> : null}
            {RUPEEDIAL_PRODUCT_MENUS.map((group) => (
              <optgroup key={group.title} label={group.title}>
                {group.items.map((item) => <option key={item} value={item}>{item}</option>)}
              </optgroup>
            ))}
          </select>
        </label>
        <Field label="Loan amount" type="number" value={String(active.loan_amount)} onChange={(value) => onChange({ ...active, loan_amount: Number(value) })} />
        <Field label="Project" value={active.project_name} onChange={(project_name) => onChange({ ...active, project_name })} />
        <Field label="Lead source" value={active.lead_source} onChange={(lead_source) => onChange({ ...active, lead_source })} />
        <Field label="Sanction date" type="date" value={(active.expected_sanction_on || "").slice(0, 10)} onChange={(expected_sanction_on) => onChange({ ...active, expected_sanction_on })} />
      </FileBlock>

      <CustomerFields active={active} onChange={onChange} onUploaded={onUploaded} />

      <FileBlock step="3" title="Connector" hint="The partner who owns this file and will be paid.">
        <Field label="Connector code" value={active.partner_code} onChange={(partner_code) => onChange({ ...active, partner_code })} />
        <Field label="Connector name" value={active.partner_name} onChange={(partner_name) => onChange({ ...active, partner_name })} />
      </FileBlock>

      <FileBlock step="4" title="Bank" hint="Lender, the confirmation and sanction letter, then every officer on this file.">
        <Field label="Bank" value={active.bank_name} onChange={(bank_name) => onChange({ ...active, bank_name })} />
        <PaperSlot label="Bank confirmation" name={active.bank_confirmation_name} onPick={(file) => void sendPaper(active.id, "bank_confirmation", file, onUploaded)} onOpen={() => void openPaper(active.id, "bank_confirmation", active.bank_confirmation_name)} />
        <PaperSlot label="Sanction letter" name={active.sanction_letter_name} onPick={(file) => void sendPaper(active.id, "sanction_letter", file, onUploaded)} onOpen={() => void openPaper(active.id, "sanction_letter", active.sanction_letter_name)} />
        <BankerList
          rows={bankerRows(active)}
          onChange={(bankers) => onChange({ ...active, bankers })}
          onCommit={(bankers) => void saveCaseFile(active.id, { bankers }).then(onUploaded).catch((error) => toast.error(error instanceof Error ? error.message : "Could not save the officer"))}
        />
      </FileBlock>

      <FileBlock step="5" title="Disbursement" hint="The bank has released the loan. Lender payout is worked out after this.">
        {admin ? (
          <>
            <Field label="Sanctioned amount" type="number" value={String(active.sanctioned_amount)} onChange={(value) => onChange({ ...active, sanctioned_amount: Number(value) })} />
            <Field label="Receivable %" type="number" value={String(active.receivable_percent)} onChange={(value) => onChange({ ...active, receivable_percent: Number(value) })} />
            <Field label="Connector payable %" type="number" value={String(active.payable_percent)} onChange={(value) => onChange({ ...active, payable_percent: Number(value) })} />
            <Field label="Customer credit name" value={active.loyalty_name} onChange={(loyalty_name) => onChange({ ...active, loyalty_name })} />
            <Field label="Customer credit" type="number" value={String(active.loyalty_amount)} onChange={(value) => onChange({ ...active, loyalty_amount: Number(value) })} />
            <Field label="Invoice amount (to lender)" type="number" value={String(active.invoice_amount)} onChange={(value) => onChange({ ...active, invoice_amount: Number(value) })} />
            <Field label="Collected amount" type="number" value={String(active.collected_amount)} onChange={(value) => onChange({ ...active, collected_amount: Number(value) })} />
            <Field label="POD remarks" value={active.pod_remarks} onChange={(pod_remarks) => onChange({ ...active, pod_remarks })} />
          </>
        ) : (
          <p className="text-sm text-[#5c4d72] md:col-span-2 xl:col-span-3">Your share of the lender payout is ₹{inr(money.payable)}. The company sets the lender percent and confirms collection.</p>
        )}
      <div className="overflow-x-auto rounded-xl border border-[#d8ecdd] md:col-span-2 xl:col-span-3">
        <table className="min-w-[880px] w-full text-left text-xs">
          <thead className="bg-[#10662A] text-white">
            <tr>
              {["Disbursement", "Sanctioned", "Receivable %", "Receivable", "Connector payable", "Agent share", "Net revenue", "Status"].map((head) => (
                <th key={head} className="px-3 py-2">{head}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="bg-[#f3fff7] font-semibold">
              <td className="px-3 py-3">{inr(active.loan_amount)}</td>
              <td className="px-3 py-3">{inr(active.sanctioned_amount || money.base)}</td>
              <td className="px-3 py-3">{active.receivable_percent}</td>
              <td className="px-3 py-3">{inr(money.receivable)}</td>
              <td className="px-3 py-3">{inr(money.payable)}</td>
              <td className="px-3 py-3">{inr(money.agent)}</td>
              <td className="px-3 py-3">{inr(money.net)}</td>
              <td className="px-3 py-3">{caseMarks(active).join(" · ")}</td>
            </tr>
          </tbody>
        </table>
      </div>

        <div className={`grid gap-2 text-sm md:col-span-2 xl:col-span-3 ${admin ? "sm:grid-cols-3" : "sm:grid-cols-1"}`}>
        <div className="rounded-xl bg-[#14301c] px-3 py-3 text-white">
          <div className="text-xs opacity-80">Lender payout</div>
          <div className="text-lg font-bold">₹{inr(money.receivable)}</div>
        </div>
        <div className="rounded-xl bg-[#10662A] px-3 py-3 text-white">
          <div className="text-xs opacity-80">Partner share · {active.partner_name || "—"}</div>
          <div className="text-lg font-bold">₹{inr(money.payable)}</div>
        </div>
        {admin ? (
          <div className="rounded-xl border px-3 py-3">
            <div className="text-xs text-[#5c4d72]">Company revenue</div>
            <div className="text-lg font-bold text-[#10662A]">₹{inr(money.net)}</div>
          </div>
        ) : null}
      </div>
      {admin ? (
        <p className="text-xs text-[#5c4d72] md:col-span-2 xl:col-span-3">
          ₹{inr(money.base)} × {active.receivable_percent}% = ₹{inr(money.receivable)} lender payout, after any subvention.
          Partner agreement {active.payable_percent}% = ₹{inr(money.payable)}.
          The rest, ₹{inr(money.net)}, is company revenue under the employee mapped to this partner.
        </p>
      ) : null}
      </FileBlock>

      <FileBlock step="6" title="Payout" hint="This is the partner invoice from Money, Invoices. It is raised there, after disbursement, and only shown here.">
        <div className="rounded-xl border border-[#d8ecdd] bg-[#f7fdf8] p-3 md:col-span-2 xl:col-span-3">
          {active.partner_invoice?.number ? (
            <>
              <p className="font-semibold text-[#390A5D]">{active.partner_invoice.number}</p>
              <p className="mt-1 text-sm text-[#5c4d72]">
                {active.partner_invoice.status_label}
                {active.partner_invoice.share != null ? ` · Share on this file ₹${inr(Number(active.partner_invoice.share))}` : ""}
                {active.partner_invoice.utr ? ` · UTR ${active.partner_invoice.utr}` : ""}
              </p>
            </>
          ) : (
            <p className="text-sm text-[#5c4d72]">No partner invoice yet. After disbursement, raise it from Money, Invoices. The same invoice will show on this file.</p>
          )}
        </div>
      </FileBlock>
      {admin ? <FileBlock step="7" title="Share" hint="Who inside the company shares this file. This is not the partner payout.">
        <StakeList
          rows={stakeRows(active)}
          onChange={(stakeholders) => onChange({ ...active, stakeholders })}
          onCommit={(stakeholders) => void saveCaseFile(active.id, { stakeholders }).then(onUploaded).catch((error) => toast.error(error instanceof Error ? error.message : "Could not save the share"))}
        />
      </FileBlock> : null}
      <FileBlock step="8" title="History" hint="What has already happened on this file. A step shows only when it is recorded.">
        <div className="overflow-x-auto md:col-span-2 xl:col-span-3">
          <table className="min-w-[640px] w-full text-left text-sm">
            <thead className="text-[11px] uppercase tracking-wide text-[#5c4d72]">
              <tr>{["Step", "Status", "Detail"].map((head) => <th key={head} className="px-2 py-2">{head}</th>)}</tr>
            </thead>
            <tbody>
              {caseHistory(active).map((line) => (
                <tr key={line.step} className="border-t border-[#eef6f0]">
                  <td className="px-2 py-2 font-semibold text-[#390A5D]">{line.step}</td>
                  <td className="px-2 py-2">{line.status}</td>
                  <td className="px-2 py-2 text-[#5c4d72]">{line.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </FileBlock>
      {admin ? (
        <div className="flex flex-wrap gap-2">
          <Button disabled={saving} onClick={onSave}>{saving ? "Saving…" : "Save file"}</Button>
          <Button variant={active.flag === "hold" ? "default" : "outline"} onClick={() => onChange({ ...active, flag: active.flag === "hold" ? "" : "hold", stage: "disbursed" })}>Disbursed hold</Button>
          <Button variant={active.flag === "banker_pending" ? "default" : "outline"} onClick={() => onChange({ ...active, flag: active.flag === "banker_pending" ? "" : "banker_pending" })}>Banker pending</Button>
          <Button variant={active.flag === "movement" ? "default" : "outline"} onClick={() => onChange({ ...active, flag: active.flag === "movement" ? "" : "movement" })}>Movement</Button>
          <Button variant={active.counted ? "default" : "outline"} onClick={() => onChange({ ...active, counted: !active.counted, pod_pending: active.counted ? false : active.pod_pending })}>{active.counted ? "Counted ✓" : "Mark counted"}</Button>
          <Button variant={active.pod_pending ? "default" : "outline"} onClick={() => onChange({ ...active, pod_pending: !active.pod_pending, counted: true })}>POD pending</Button>
          <Button variant={active.flag === "cancelled" ? "default" : "outline"} onClick={() => onChange({ ...active, flag: active.flag === "cancelled" ? "" : "cancelled" })}>{active.flag === "cancelled" ? "Undo cancel" : "Cancel"}</Button>
        </div>
      ) : (
        <p className="text-xs text-[#5c4d72]">This login can view the file. An admin saves stage and payout changes.</p>
      )}
    </section>
  );
}

function caseHistory(row: LoanCaseFile) {
  return [
    { step: "Submitted", status: row.submitted_on ? "Recorded" : "Pending", detail: row.submitted_on ? `${row.submitted_on} · ${row.submitted_by || "—"}` : "No submit date yet" },
    { step: "Sanction", status: row.expected_sanction_on ? "Dated" : "Pending", detail: row.expected_sanction_on || "Sanction date is not set" },
    { step: "File stage", status: row.stage_label || "Draft", detail: row.counted ? "Counted" : "Not counted" },
    { step: "Bank confirmation", status: row.bank_confirmation_name ? "Attached" : "Pending", detail: row.bank_confirmation_name || "No file" },
    { step: "Sanction letter", status: row.sanction_letter_name ? "Attached" : "Pending", detail: row.sanction_letter_name || "No file" },
    { step: "Invoice", status: `${row.invoice_percent}%`, detail: `₹${inr(row.invoice_amount)}` },
    { step: "Collection", status: `${row.collection_percent}%`, detail: `₹${inr(row.collected_amount)}` },
    { step: "Connector payout", status: row.payout_status === "paid" ? "Paid" : row.payout_status === "rejected" ? "Rejected" : "Pending", detail: row.payout_note || "Not paid yet" },
  ];
}

function caseMarks(row: LoanCaseFile) {
  const marks = [row.stage_label || "Draft"];
  if (row.flag === "cancelled") marks.push("Cancelled");
  if (row.flag === "hold" || (row.stage === "disbursed" && row.flag === "hold")) marks.push("Disbursed Hold");
  if (row.flag === "banker_pending") marks.push("Banker Pending");
  if (row.flag === "movement") marks.push("Movement");
  marks.push(row.counted ? "Counted" : "Not Counted");
  if (row.pod_pending) marks.push("POD Pending");
  marks.push(row.payout_status === "paid" ? "Payout done" : "Payout pending");
  return [...new Set(marks)];
}

async function sendPaper(id: string, kind: "sanction_letter" | "bank_confirmation", file: File, onUploaded: (row: LoanCaseFile) => void) {
  try {
    onUploaded(await uploadCasePaper(id, kind, file));
    toast.success(kind === "sanction_letter" ? "Sanction letter saved" : "Bank confirmation saved");
  } catch (error) {
    toast.error(error instanceof Error ? error.message : "Could not save the file");
  }
}

async function openPaper(id: string, kind: "sanction_letter" | "bank_confirmation", name?: string) {
  try {
    const blob = await downloadCasePaper(id, kind);
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = name || kind;
    link.click();
    URL.revokeObjectURL(url);
  } catch (error) {
    toast.error(error instanceof Error ? error.message : "Could not open the file");
  }
}

const EMPTY_CUSTOMER: Record<string, string> = {
  email: "", company_name: "", country: "India", state: "", city: "", address: "",
  corr_country: "", corr_state: "", corr_city: "", corr_address: "",
  pan: "", dob: "", alternate_email: "", alternate_mobile: "",
};

function customerOf(row: LoanCaseFile) {
  return { ...EMPTY_CUSTOMER, ...(row.customer || {}) };
}

function CustomerFields({ active, onChange, onUploaded }: { active: LoanCaseFile; onChange: (row: LoanCaseFile) => void; onUploaded: (row: LoanCaseFile) => void }) {
  const latest = useRef(customerOf(active));
  latest.current = customerOf(active);
  const patch = (key: string, value: string) => {
    const next = { ...latest.current, [key]: value };
    latest.current = next;
    onChange({ ...active, customer: next });
  };
  const commit = () => {
    void saveCaseFile(active.id, { customer: latest.current })
      .then(onUploaded)
      .catch((error) => toast.error(error instanceof Error ? error.message : "Could not save the customer"));
  };
  const fields: [string, string][] = [
    ["email", "Email"],
    ["company_name", "Company"],
    ["country", "Country"],
    ["state", "State"],
    ["city", "City"],
    ["address", "Address"],
    ["pan", "PAN"],
    ["dob", "Date of birth"],
    ["alternate_email", "Alternate email"],
    ["alternate_mobile", "Alternate phone"],
  ];
  return (
    <FileBlock step="2" title="Customer" hint="Who the loan is for. Name and phone first, then address and identity.">
      <Field label="Customer name" value={active.client_name} onChange={(client_name) => onChange({ ...active, client_name })} />
      <Field label="Customer phone" value={active.client_phone} onChange={(client_phone) => onChange({ ...active, client_phone })} />
      {fields.map(([key, label]) => (
        <Field key={key} label={label} value={latest.current[key] || ""} onChange={(value) => patch(key, value)} onBlur={commit} />
      ))}
    </FileBlock>
  );
}

function stakeRows(row: LoanCaseFile) {
  return row.stakeholders?.length ? row.stakeholders : [{ name: "", share_percent: 0 }];
}

function StakeList({
  rows,
  onChange,
  onCommit,
}: {
  rows: { name: string; share_percent: number }[];
  onChange: (rows: { name: string; share_percent: number }[]) => void;
  onCommit: (rows: { name: string; share_percent: number }[]) => void;
}) {
  const latest = useRef(rows);
  latest.current = rows;
  const edit = (index: number, next: { name: string; share_percent: number }) => {
    const list = rows.map((row, at) => (at === index ? next : row));
    latest.current = list;
    onChange(list);
  };
  const total = rows.reduce((sum, row) => sum + (Number(row.share_percent) || 0), 0);
  return (
    <div className="space-y-3 md:col-span-2 xl:col-span-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-[#390A5D]">People on this file · {total}% shared</p>
        {rows.length < 8 ? (
          <button type="button" aria-label="Add person" className="grid size-8 place-items-center rounded-full bg-[#10662A] text-lg font-bold leading-none text-white" onClick={() => onChange([...rows, { name: "", share_percent: 0 }])}>+</button>
        ) : null}
      </div>
      {rows.map((row, index) => (
        <div key={index} className="grid gap-2 rounded-xl border border-[#d8ecdd] p-3 sm:grid-cols-2">
          <Field label="Name" value={row.name} onChange={(name) => edit(index, { ...row, name })} onBlur={() => onCommit(latest.current)} />
          <Field label="Share %" type="number" value={String(row.share_percent)} onChange={(value) => edit(index, { ...row, share_percent: Number(value) })} onBlur={() => onCommit(latest.current)} />
          {rows.length > 1 ? (
            <button type="button" className="text-left text-xs font-semibold text-[#5c4d72] sm:col-span-2" onClick={() => { const next = rows.filter((_, at) => at !== index); onChange(next); onCommit(next); }}>Remove</button>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function bankerRows(row: LoanCaseFile) {
  if (row.bankers && row.bankers.length) return row.bankers;
  if (row.bank_rm || row.bank_rm_phone) {
    return [{ name: row.bank_rm || "", email: "", designation: "Bank RM", phone: row.bank_rm_phone || "" }];
  }
  return [{ name: "", email: "", designation: "", phone: "" }];
}

function BankerList({
  rows,
  onChange,
  onCommit,
}: {
  rows: { name: string; email: string; designation: string; phone: string }[];
  onChange: (rows: { name: string; email: string; designation: string; phone: string }[]) => void;
  onCommit: (rows: { name: string; email: string; designation: string; phone: string }[]) => void;
}) {
  const latest = useRef(rows);
  latest.current = rows;
  const edit = (index: number, key: "name" | "email" | "designation" | "phone", value: string) => {
    const next = rows.map((row, at) => (at === index ? { ...row, [key]: value } : row));
    latest.current = next;
    onChange(next);
  };
  return (
    <div className="space-y-3 md:col-span-2 xl:col-span-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-[#390A5D]">Bank officers</p>
        {rows.length < 8 ? (
          <button type="button" aria-label="Add officer" className="grid size-8 place-items-center rounded-full bg-[#10662A] text-lg font-bold leading-none text-white" onClick={() => onChange([...rows, { name: "", email: "", designation: "", phone: "" }])}>+</button>
        ) : null}
      </div>
      {rows.map((row, index) => (
        <div key={index} className="grid gap-2 rounded-xl border border-[#d8ecdd] p-3 sm:grid-cols-2 xl:grid-cols-4">
          <Field label="Name" value={row.name} onChange={(value) => edit(index, "name", value)} onBlur={() => onCommit(latest.current)} />
          <Field label="Email" value={row.email} onChange={(value) => edit(index, "email", value)} onBlur={() => onCommit(latest.current)} />
          <Field label="Designation" value={row.designation} onChange={(value) => edit(index, "designation", value)} onBlur={() => onCommit(latest.current)} />
          <Field label="Phone" value={row.phone} onChange={(value) => edit(index, "phone", value)} onBlur={() => onCommit(latest.current)} />
          {rows.length > 1 ? (
            <button type="button" className="text-left text-xs font-semibold text-[#5c4d72] sm:col-span-2 xl:col-span-4" onClick={() => onChange(rows.filter((_, at) => at !== index))}>Remove this officer</button>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function PaperSlot({ label, name, onPick, onOpen }: { label: string; name?: string; onPick: (file: File) => void; onOpen: () => void }) {
  return (
    <div className="rounded-xl border border-[#d8ecdd] bg-[#f7fdf8] p-3">
      <p className="text-xs font-semibold text-[#390A5D]">{label}</p>
      <p className="mt-1 truncate text-sm text-[#5c4d72]">{name || "Not attached"}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <label className="cursor-pointer rounded-full bg-[#10662A] px-3 py-1.5 text-xs font-semibold text-white">
          {name ? "Replace" : "Attach"}
          <input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) onPick(file); event.target.value = ""; }} />
        </label>
        {name ? <button type="button" className="rounded-full border border-[#d8ecdd] bg-white px-3 py-1.5 text-xs font-semibold text-[#390A5D]" onClick={onOpen}>Download</button> : null}
      </div>
    </div>
  );
}

function FileBlock({ step, title, hint, children }: { step?: string; title: string; hint: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-[#d8ecdd] bg-white p-4">
      <div className="flex items-center gap-2">
        {step ? <span className="grid size-6 place-items-center rounded-full bg-[#10662A] text-[11px] font-bold text-white">{step}</span> : null}
        <h3 className="font-display text-base font-bold text-[#390A5D]">{title}</h3>
      </div>
      <p className="mt-0.5 text-xs text-[#5c4d72]">{hint}</p>
      <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{children}</div>
    </section>
  );
}

function Field({ label, value, onChange, onBlur, type = "text" }: { label: string; value: string; onChange: (value: string) => void; onBlur?: () => void; type?: string }) {
  return (
    <label className="block text-xs font-medium text-[#5c4d72]">
      {label}
      <Input className="mt-1" type={type} value={value} onChange={(event) => onChange(event.target.value)} onBlur={onBlur} />
    </label>
  );
}
