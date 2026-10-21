import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth-context";
import { isPlatformAdmin } from "@/lib/role-access";
import {
  createCaseFile,
  listCaseFiles,
  openSampleCase,
  saveCaseFile,
  type LoanCaseFile,
} from "@/lib/python-api";

export const Route = createFileRoute("/dashboard/cases")({
  head: () => ({ meta: [{ title: "Case Files — RupeeDial One" }] }),
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

const CHIPS: { id: string; label: string; className: string }[] = [
  { id: "draft", label: "Draft", className: "bg-orange-500" },
  { id: "logged_in", label: "Logged In", className: "bg-slate-800" },
  { id: "sanctioned", label: "Sanctioned", className: "bg-pink-600" },
  { id: "disbursed", label: "Disbursed", className: "bg-blue-600" },
  { id: "disbursed_hold", label: "Disbursed Hold", className: "bg-green-600" },
  { id: "disbursed_confirmed", label: "Disbursed Confirmed", className: "bg-violet-700" },
  { id: "partially_collected", label: "Partially Collected", className: "bg-sky-600" },
  { id: "banker_pending", label: "Banker Pending", className: "bg-cyan-500" },
  { id: "not_counted", label: "Not Counted", className: "bg-lime-600" },
  { id: "counted", label: "Counted", className: "bg-fuchsia-600" },
  { id: "counted_pod_pending", label: "Counted POD Pending", className: "bg-amber-500" },
  { id: "movement", label: "Movement", className: "bg-slate-700" },
  { id: "cancelled", label: "Cancelled", className: "bg-red-600" },
  { id: "collected", label: "Collected", className: "bg-[#10662A]" },
];

function inr(value: number) {
  return Math.round(value || 0).toLocaleString("en-IN");
}

function statusChip(row: LoanCaseFile) {
  const label = row.status_label.toLowerCase();
  const hit = CHIPS.find((item) => item.label.toLowerCase() === label);
  return hit?.id ?? "collected";
}

function liveMoney(row: Pick<LoanCaseFile, "loan_amount" | "sanctioned_amount" | "receivable_percent" | "payable_percent" | "loyalty_amount">) {
  const base = Number(row.sanctioned_amount || 0) || Number(row.loan_amount || 0);
  const receivable = Math.round(base * Number(row.receivable_percent || 0)) / 100;
  const payable = Math.round(receivable * Number(row.payable_percent || 0)) / 100;
  const margin = receivable - payable - Number(row.loyalty_amount || 0);
  const agent = Math.round(margin) / 2;
  return {
    base,
    receivable,
    payable,
    agent,
    net: margin - agent,
  };
}

function CasesPage() {
  const { role } = useAuth();
  const admin = isPlatformAdmin(role);
  const [desk, setDesk] = useState<"files" | "payout">("files");
  const [chip, setChip] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [items, setItems] = useState<LoanCaseFile[]>([]);
  const [revenue, setRevenue] = useState(0);
  const [confirmed, setConfirmed] = useState(0);
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
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load case files");
    } finally {
      setLoading(false);
    }
  };

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

  const tone = (id: string) => CHIPS.find((item) => item.id === id)?.className ?? "bg-[#10662A]";

  return (
    <div className="mx-auto max-w-[1400px] space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#10662A]">Closure desk</p>
          <h1 className="font-display text-2xl font-bold text-[#390A5D]">Case files</h1>
        </div>
        <div className="inline-flex rounded-xl border border-[#d8ecdd] bg-white p-1">
          <button className={`rounded-lg px-4 py-2 text-sm font-semibold ${desk === "files" ? "bg-[#10662A] text-white" : "text-[#390A5D]"}`} onClick={() => { setDesk("files"); setActive(null); }}>Case list</button>
          <button className={`rounded-lg px-4 py-2 text-sm font-semibold ${desk === "payout" ? "bg-[#10662A] text-white" : "text-[#390A5D]"}`} onClick={() => { setDesk("payout"); setActive(null); }}>Payout</button>
        </div>
      </div>

      {desk === "payout" ? (
        <section className="rounded-2xl border bg-white p-4">
          <h2 className="text-lg font-bold">Payout payment</h2>
          <p className="mt-1 text-sm text-[#5c4d72]">Type the deal number. Invoice and collection must both be 100% before the connector is paid.</p>
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
        </section>
      ) : active && money ? (
        <CaseForm
          active={active}
          money={money}
          admin={admin}
          saving={saving}
          onChange={setActive}
          onBack={() => setActive(null)}
          onSave={() => void save(active)}
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
                <Button variant="outline" onClick={() => { setDateFrom(""); setDateTo(""); setItems([]); setRevenue(0); setConfirmed(0); }}>Clear dates</Button>
              </div>
              <div className="text-sm xl:text-right">
                <div className="font-display text-lg font-bold text-[#10662A]">₹{inr(dateFrom && dateTo && chip ? revenue : 0)} revenue</div>
                <div className="text-[#5c4d72]">{dateFrom && dateTo && chip ? confirmed : 0} disbursed confirmed in these dates</div>
              </div>
              {admin ? (
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={() => void createCaseFile({ loan_type: "LAP", client_name: "New applicant" }).then((row) => { setActive(row); void refresh("draft", dateFrom, dateTo); })}>New draft</Button>
                  <Button className="bg-[#10662A] hover:bg-[#0d5522]" onClick={() => void openSampleCase().then(() => { toast.success("Sample file ready"); void refresh("all", dateFrom, dateTo); })}>Sample file</Button>
                </div>
              ) : null}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
              <button className={`rounded-lg px-3 py-2 text-xs font-bold text-white ${chip === "all" ? "bg-[#390A5D] ring-2 ring-[#390A5D] ring-offset-1" : "bg-slate-500"}`} onClick={() => { setChip("all"); void refresh("all", dateFrom, dateTo); }}>All</button>
              {CHIPS.map((item) => (
                <button
                  key={item.id}
                  className={`rounded-lg px-3 py-2 text-xs font-bold text-white ${item.className} ${chip === item.id ? "ring-2 ring-[#390A5D] ring-offset-1" : ""}`}
                  onClick={() => { setChip(item.id); void refresh(item.id, dateFrom, dateTo); }}
                >
                  {item.label}
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
                  {["Status", "Deal number", "Product", "Bank", "RM", "Connector", "Client", "Loan amount", "Sanctioned", "Submitted", "Submitted by", "Net"].map((head) => (
                    <th key={head} className="whitespace-nowrap px-3 py-3 text-[11px] font-semibold uppercase tracking-wide">{head}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={12} className="px-3 py-10 text-center"><Loader2 className="mx-auto size-5 animate-spin text-[#10662A]" /></td></tr>
                ) : items.map((row) => (
                  <tr key={row.id} className="cursor-pointer border-t border-[#eef6f0] hover:bg-[#f7fdf8]" onClick={() => setActive(row)}>
                    <td className="px-3 py-3"><span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold text-white ${tone(statusChip(row))}`}>{row.status_label}</span></td>
                    <td className="whitespace-nowrap px-3 py-3 font-semibold text-[#10662A]">{row.deal_no}</td>
                    <td className="whitespace-nowrap px-3 py-3">{row.loan_type}</td>
                    <td className="px-3 py-3">{row.bank_name || "—"}</td>
                    <td className="whitespace-nowrap px-3 py-3">{row.bank_rm || "—"}</td>
                    <td className="px-3 py-3">
                      <div className="whitespace-nowrap font-medium text-[#390A5D]">{row.partner_name || "—"}</div>
                      <div className="text-[11px] text-[#5c4d72]">{row.partner_code}</div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-3">{row.client_name || "—"}</td>
                    <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums">₹{inr(row.loan_amount)}</td>
                    <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums">₹{inr(row.sanctioned_amount)}</td>
                    <td className="whitespace-nowrap px-3 py-3">{row.submitted_on || row.expected_sanction_on || "—"}</td>
                    <td className="whitespace-nowrap px-3 py-3">{row.submitted_by || "—"}</td>
                    <td className="whitespace-nowrap px-3 py-3 text-right font-bold tabular-nums text-[#10662A]">₹{inr(row.net_revenue)}</td>
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

function CaseForm({
  active,
  money,
  admin,
  saving,
  onChange,
  onBack,
  onSave,
}: {
  active: LoanCaseFile;
  money: ReturnType<typeof liveMoney>;
  admin: boolean;
  saving: boolean;
  onChange: (row: LoanCaseFile) => void;
  onBack: () => void;
  onSave: () => void;
}) {
  const reached = STAGES.findIndex(([key]) => key === active.stage);
  return (
    <section className="space-y-5 rounded-2xl border border-[#d8ecdd] bg-white p-4 sm:p-5">
      <button className="text-sm font-semibold text-[#10662A]" onClick={onBack}>← Back to list</button>
      <div className="overflow-x-auto">
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
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-bold">{active.deal_no}</h2>
        <span className="rounded-full bg-[#e8f7ec] px-3 py-1 text-xs font-semibold text-[#10662A]">{active.stage_label}</span>
      </div>
      <div className="rounded-xl border border-[#d8ecdd] bg-[#f7fdf8] p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#5c4d72]">What happened on this case</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {caseMarks(active).map((mark) => (
            <span key={mark} className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-[#390A5D] ring-1 ring-[#d8ecdd]">{mark}</span>
          ))}
        </div>
        <ul className="mt-3 space-y-1 text-sm text-[#390A5D]">
          <li>Submitted {active.submitted_on || "—"} by {active.submitted_by || "—"}.</li>
          <li>Sanction date {active.expected_sanction_on || "—"} · {active.client_name || "Client"} · {active.client_phone || "no phone"} · {active.bank_name || "no bank"}.</li>
          <li>Pipeline is on {active.stage_label}. {active.counted ? "This file is counted." : "This file is not counted."} {active.pod_pending ? `POD is pending${active.pod_remarks ? `: ${active.pod_remarks}` : "."}` : "POD is clear."}</li>
          <li>Invoice {active.invoice_percent}% · ₹{inr(active.invoice_amount)} · Collection {active.collection_percent}% · ₹{inr(active.collected_amount)}.</li>
          <li>{active.payout_note || (active.payout_status === "paid" ? "Connector payout is done." : "Connector payout is still pending.")}</li>
        </ul>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Field label="Loan type" value={active.loan_type} onChange={(loan_type) => onChange({ ...active, loan_type })} />
        <Field label="Lead source" value={active.lead_source} onChange={(lead_source) => onChange({ ...active, lead_source })} />
        <Field label="Connector code" value={active.partner_code} onChange={(partner_code) => onChange({ ...active, partner_code })} />
        <Field label="Connector name" value={active.partner_name} onChange={(partner_name) => onChange({ ...active, partner_name })} />
        <Field label="Client" value={active.client_name} onChange={(client_name) => onChange({ ...active, client_name })} />
        <Field label="Bank" value={active.bank_name} onChange={(bank_name) => onChange({ ...active, bank_name })} />
        <Field label="Bank RM" value={active.bank_rm} onChange={(bank_rm) => onChange({ ...active, bank_rm })} />
        <Field label="Sanction date" value={active.expected_sanction_on} onChange={(expected_sanction_on) => onChange({ ...active, expected_sanction_on })} />
        <Field label="Loan amount" type="number" value={String(active.loan_amount)} onChange={(value) => onChange({ ...active, loan_amount: Number(value) })} />
        <Field label="Sanctioned amount" type="number" value={String(active.sanctioned_amount)} onChange={(value) => onChange({ ...active, sanctioned_amount: Number(value) })} />
        <Field label="Receivable %" type="number" value={String(active.receivable_percent)} onChange={(value) => onChange({ ...active, receivable_percent: Number(value) })} />
        <Field label="Connector payable %" type="number" value={String(active.payable_percent)} onChange={(value) => onChange({ ...active, payable_percent: Number(value) })} />
        <Field label="Customer credit" type="number" value={String(active.loyalty_amount)} onChange={(value) => onChange({ ...active, loyalty_amount: Number(value) })} />
      </div>

      <div className="overflow-x-auto rounded-xl border">
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

      <div className="grid gap-2 text-sm sm:grid-cols-3">
        <div className="rounded-xl bg-[#14301c] px-3 py-3 text-white">
          <div className="text-xs opacity-80">Agent · {active.submitted_by || "—"}</div>
          <div className="text-lg font-bold">₹{inr(money.agent)}</div>
        </div>
        <div className="rounded-xl bg-[#10662A] px-3 py-3 text-white">
          <div className="text-xs opacity-80">Connector · {active.partner_name || "—"}</div>
          <div className="text-lg font-bold">₹{inr(money.payable)}</div>
        </div>
        <div className="rounded-xl border px-3 py-3">
          <div className="text-xs text-[#5c4d72]">Company net</div>
          <div className="text-lg font-bold text-[#10662A]">₹{inr(money.net)}</div>
        </div>
      </div>
      <p className="text-xs text-[#5c4d72]">
        ₹{inr(money.base)} × {active.receivable_percent}% = ₹{inr(money.receivable)} from the lender.
        Connector {active.payable_percent}% = ₹{inr(money.payable)}.
        The rest is split equally: agent ₹{inr(money.agent)} and company net ₹{inr(money.net)}.
      </p>
      {admin ? (
        <div className="flex flex-wrap gap-2">
          <Button disabled={saving} onClick={onSave}>{saving ? "Saving…" : "Save file"}</Button>
          <Button variant="outline" onClick={() => onChange({ ...active, flag: active.flag === "hold" ? "" : "hold", stage: "disbursed" })}>Disbursed hold</Button>
          <Button variant="outline" onClick={() => onChange({ ...active, flag: "banker_pending" })}>Banker pending</Button>
          <Button variant="outline" onClick={() => onChange({ ...active, pod_pending: !active.pod_pending, counted: true })}>POD pending</Button>
          <Button variant="outline" onClick={() => onChange({ ...active, flag: "cancelled" })}>Cancel</Button>
        </div>
      ) : (
        <p className="text-xs text-[#5c4d72]">This login can view the file. An admin saves stage and payout changes.</p>
      )}
    </section>
  );
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

function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return (
    <label className="block text-xs font-medium text-[#5c4d72]">
      {label}
      <Input className="mt-1" type={type} value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}
