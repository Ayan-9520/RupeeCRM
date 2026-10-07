import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  AlertCircle, ArrowLeft, ArrowRight, CheckCircle2, FileText, Loader2, MessageCircle, Phone, Printer, Save, Store,
} from "lucide-react";
import {
  getBusinessCase, patchBusinessCase, type BusinessCase, type BusinessCaseData, type BusinessSection,
} from "@/lib/python-api";
import {
  APPLY_STATUSES, DATA_FIELDS, FINANCIAL_FIELDS, QUICK_FIELDS, STAGES, formatINR, optionLabel, shortINR, type BizField,
} from "@/lib/business-fields";

export const Route = createFileRoute("/dashboard/business/$ref")({
  head: () => ({ meta: [{ title: "Business Case — RupeeDial One" }] }),
  component: BusinessCasePage,
});

type Docs = BusinessCaseData["documents"];
type Applied = BusinessCaseData["applied_to"];

const FLAG_CLASS = {
  good: "bg-emerald-500/10 text-emerald-800 border-emerald-500/20",
  warn: "bg-amber-500/10 text-amber-800 border-amber-500/20",
  bad: "bg-red-500/10 text-red-800 border-red-500/20",
};

const GRADE_CLASS: Record<string, string> = {
  A: "text-emerald-600",
  B: "text-sky-600",
  C: "text-amber-600",
  D: "text-red-600",
};

const escapeHtml = (v: unknown) =>
  String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);

function BusinessCasePage() {
  const { ref } = Route.useParams();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [item, setItem] = useState<BusinessCase | null>(null);
  const [error, setError] = useState("");
  const [step, setStep] = useState(0);
  const [quick, setQuick] = useState<BusinessSection>({});
  const [data, setData] = useState<BusinessSection>({});
  const [fin, setFin] = useState<BusinessSection>({});
  const [docs, setDocs] = useState<Docs>({});
  const [selected, setSelected] = useState<string[]>([]);
  const [applied, setApplied] = useState<Applied>([]);
  const [note, setNote] = useState("");

  const hydrate = (c: BusinessCase) => {
    const b = c.business;
    setItem(c);
    setQuick(b.quick ?? {});
    setData(b.data ?? {});
    setFin(b.financials ?? {});
    setDocs(b.documents ?? {});
    setSelected(b.selected_lenders ?? []);
    setApplied(b.applied_to ?? []);
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError("");
      try {
        const c = await getBusinessCase(ref);
        hydrate(c);
        const idx = STAGES.findIndex((s) => s.key === c.business.stage);
        setStep(idx >= 0 ? idx : 0);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load case");
      } finally {
        setLoading(false);
      }
    })();
  }, [ref]);

  const a = item?.business.assessment;

  const save = async (opts?: { advance?: boolean; extra?: Parameters<typeof patchBusinessCase>[1] }) => {
    if (!item) return;
    setSaving(true);
    try {
      const nextIdx = Math.min(step + 1, STAGES.length - 1);
      const body: Parameters<typeof patchBusinessCase>[1] = {
        quick,
        data,
        financials: fin,
        documents: docs,
        selected_lenders: selected,
        applied_to: applied,
        ...opts?.extra,
      };
      const currentStage = STAGES.findIndex((s) => s.key === item.business.stage);
      if (opts?.advance && nextIdx > currentStage) body.stage = STAGES[nextIdx].key;
      const updated = await patchBusinessCase(item.case_id, body);
      hydrate(updated);
      toast.success(opts?.advance ? "Saved — moved to next step" : "Saved");
      if (opts?.advance) setStep(nextIdx);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const addNote = async () => {
    if (!item || !note.trim()) return;
    setSaving(true);
    try {
      hydrate(await patchBusinessCase(item.case_id, { note: note.trim() }));
      setNote("");
      toast.success("Note added");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to add note");
    } finally {
      setSaving(false);
    }
  };

  const toggleMarketplace = async () => {
    if (!item) return;
    try {
      hydrate(await patchBusinessCase(item.case_id, { is_marketplace: !item.is_marketplace }));
      toast.success(item.is_marketplace ? "Removed from LeadBoard" : "Listed on LeadBoard");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    }
  };

  const docStats = useMemo(() => {
    const list = a?.documents ?? [];
    const done = list.filter((d) => ["received", "verified", "not_applicable"].includes(docs[d.key]?.status ?? "")).length;
    return { done, total: list.length };
  }, [a, docs]);

  const printCam = () => {
    if (!item || !a) return;
    const q = { ...item.business.quick, ...quick };
    const rows = (fields: BizField[], src: BusinessSection) =>
      fields
        .filter((f) => src[f.key] != null && src[f.key] !== "")
        .map((f) => `<tr><th>${escapeHtml(f.label)}</th><td>${escapeHtml(f.type === "money" ? formatINR(Number(src[f.key])) : optionLabel(f, src[f.key]))}</td></tr>`)
        .join("");
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>CAM ${escapeHtml(item.case_id)}</title>
<style>body{font-family:Arial,sans-serif;color:#111;margin:32px;font-size:12px}h1{font-size:20px;margin:0}h2{font-size:14px;margin:22px 0 6px;border-bottom:2px solid #10662A;padding-bottom:4px;color:#10662A}
table{width:100%;border-collapse:collapse}th,td{border:1px solid #ddd;padding:6px 8px;text-align:left;vertical-align:top}th{background:#f5f7f5;width:38%;font-weight:600}.muted{color:#666}</style></head><body>
<h1>Credit Appraisal Memo — ${escapeHtml(q.company_name)}</h1>
<p class="muted">Case ${escapeHtml(item.case_id)} · Prepared by RupeeDial · ${new Date().toLocaleDateString("en-IN")} · Engine ${escapeHtml(a.engine)}</p>
<h2>Proposal</h2><table>
<tr><th>Facility</th><td>${escapeHtml(a.summary.facility_label)}</td></tr>
<tr><th>Amount requested</th><td>${formatINR(a.summary.requested_amount)}</td></tr>
<tr><th>Indicative eligibility</th><td>${formatINR(a.summary.eligible_amount)}</td></tr>
<tr><th>Lenders</th><td>${escapeHtml(selected.join(", ") || "—")}</td></tr></table>
<h2>Borrower profile</h2><table>${rows(QUICK_FIELDS, q)}${rows(DATA_FIELDS, data)}</table>
<h2>Financials</h2><table>${rows(FINANCIAL_FIELDS, fin)}
<tr><th>Turnover</th><td>${formatINR(a.ratios.turnover)}</td></tr>
<tr><th>Net profit${a.ratios.profit_is_estimate ? " (estimated)" : ""}</th><td>${formatINR(a.ratios.estimated_profit)}</td></tr>
<tr><th>Cash accrual</th><td>${formatINR(a.ratios.cash_accrual)}</td></tr>
<tr><th>Existing debt service (annual)</th><td>${formatINR(a.ratios.existing_emi_annual)}</td></tr>
<tr><th>DSCR</th><td>${a.ratios.dscr ?? "—"}</td></tr>
<tr><th>Loan / turnover</th><td>${a.ratios.loan_to_turnover ?? "—"}%</td></tr>
<tr><th>Enterprise size</th><td>${escapeHtml(a.ratios.enterprise_size)}</td></tr></table>
<h2>Risk assessment — Grade ${escapeHtml(a.risk.grade)} (${a.risk.score}/100)</h2><table>${a.risk.flags.map((f) => `<tr><th>${escapeHtml(f.type.toUpperCase())}</th><td>${escapeHtml(f.text)}</td></tr>`).join("")}</table>
<h2>Government schemes</h2><table>${a.schemes.map((s) => `<tr><th>${escapeHtml(s.name)}</th><td>${s.eligible ? "Eligible — " : "Not eligible — "}${escapeHtml(s.detail)}</td></tr>`).join("")}</table>
<h2>Documents</h2><table>${a.documents.map((d) => `<tr><th>${escapeHtml(d.label)}</th><td>${escapeHtml(docs[d.key]?.status ?? "pending")}${docs[d.key]?.note ? ` — ${escapeHtml(docs[d.key]?.note)}` : ""}</td></tr>`).join("")}</table>
<h2>Assumptions</h2><ul>${a.assumptions.map((x) => `<li>${escapeHtml(x)}</li>`).join("")}</ul>
<script>window.onload=()=>window.print()</script></body></html>`;
    const w = window.open("", "_blank");
    if (!w) {
      toast.error("Allow pop-ups to print the CAM");
      return;
    }
    w.document.write(html);
    w.document.close();
  };

  if (loading) {
    return (
      <div className="grid place-items-center py-20">
        <Loader2 className="size-6 animate-spin text-accent" />
      </div>
    );
  }

  if (error || !item || !a) {
    return (
      <div className="max-w-2xl mx-auto p-8 rounded-2xl border border-destructive/40 bg-destructive/5">
        <div className="flex items-center gap-2 text-destructive font-semibold mb-2">
          <AlertCircle className="size-5" /> Could not open case
        </div>
        <p className="text-sm text-muted-foreground">{error || "Case not found"}</p>
        <Link to="/dashboard/business" className="mt-4 inline-flex items-center gap-1 text-accent text-sm font-semibold">
          <ArrowLeft className="size-4" /> Back to Business Cases
        </Link>
      </div>
    );
  }

  const phoneDigits = item.full_phone.replace(/\D/g, "").slice(-10);
  const completed = new Set(item.business.completed ?? []);

  return (
    <div className="max-w-7xl space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <Link to="/dashboard/business" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-accent mb-2">
            <ArrowLeft className="size-3.5" /> Business Cases
          </Link>
          <h1 className="font-display text-2xl lg:text-3xl font-bold">{item.company_name || item.applicant_name}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            <span className="font-mono font-semibold text-foreground">{item.case_id}</span> · {item.applicant_name} · {item.city}
            {item.status === "sold" && <span className="ml-2 rounded-full bg-secondary px-2 py-0.5 text-[10px] font-bold uppercase">Sold on LeadBoard</span>}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <a href={`tel:+91${phoneDigits}`} className="inline-flex items-center gap-1.5 rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground">
            <Phone className="size-4" /> {item.full_phone}
          </a>
          <a
            href={`https://wa.me/91${phoneDigits}?text=${encodeURIComponent(`Hello from RupeeDial regarding your business loan case ${item.case_id}.`)}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-xl border border-border px-4 py-2 text-sm font-semibold hover:bg-secondary"
          >
            <MessageCircle className="size-4" /> WhatsApp
          </a>
          {item.status !== "sold" && (
            <button
              type="button"
              onClick={toggleMarketplace}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border px-4 py-2 text-sm font-semibold hover:bg-secondary"
            >
              <Store className="size-4" /> {item.is_marketplace ? "On LeadBoard — remove" : "List on LeadBoard"}
            </button>
          )}
        </div>
      </div>

      <ol className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
        {STAGES.map((s, i) => {
          const done = completed.has(s.key);
          const active = i === step;
          return (
            <li key={s.key}>
              <button
                type="button"
                onClick={() => setStep(i)}
                className={`w-full rounded-xl border px-3 py-2 text-left text-xs font-semibold transition ${
                  active ? "border-accent bg-accent/10 text-foreground" : "border-border text-muted-foreground hover:bg-secondary"
                }`}
              >
                <span className="flex items-center gap-1.5">
                  {done ? <CheckCircle2 className="size-3.5 text-emerald-600" /> : <span className="text-[10px]">{i + 1}</span>}
                  {s.label}
                </span>
                <span className={`mt-1.5 block h-1 rounded-full ${done || active ? "bg-accent" : "bg-border"}`} />
              </button>
            </li>
          );
        })}
      </ol>

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="rounded-2xl bg-card border border-border shadow-card">
          <div className="p-5 space-y-5">
            {step === 0 && (
              <Section title="Quick check" desc="Filled by the customer on rupeedial.com. Confirm on call and correct anything wrong.">
                <FieldGrid fields={QUICK_FIELDS} values={quick} onChange={setQuick} />
              </Section>
            )}

            {step === 1 && (
              <Section title="Business & data" desc="Collect on call: address, promoters, existing lenders and purpose.">
                <FieldGrid fields={DATA_FIELDS} values={data} onChange={setData} />
              </Section>
            )}

            {step === 2 && (
              <Section title={`Documents (${docStats.done}/${docStats.total})`} desc="Ask the customer to share on WhatsApp or email, then mark each one.">
                <ul className="divide-y divide-border rounded-xl border border-border">
                  {a.documents.map((d) => {
                    const cur = docs[d.key] ?? { status: "pending" };
                    return (
                      <li key={d.key} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center">
                        <div className="flex-1 text-sm font-medium flex items-center gap-2">
                          <FileText className="size-4 text-muted-foreground" /> {d.label}
                        </div>
                        <select
                          value={cur.status}
                          onChange={(e) => setDocs((p) => ({ ...p, [d.key]: { ...cur, status: e.target.value } }))}
                          className="input-base sm:w-40"
                        >
                          <option value="pending">Pending</option>
                          <option value="received">Received</option>
                          <option value="verified">Verified</option>
                          <option value="not_applicable">Not applicable</option>
                        </select>
                        <input
                          value={cur.note ?? ""}
                          onChange={(e) => setDocs((p) => ({ ...p, [d.key]: { ...cur, note: e.target.value } }))}
                          placeholder="Note"
                          className="input-base sm:w-48"
                        />
                      </li>
                    );
                  })}
                </ul>
              </Section>
            )}

            {step === 3 && (
              <>
                <Section title="Financials" desc="Enter figures from ITR, P&L and bank statements, then press Save to recalculate.">
                  <FieldGrid fields={FINANCIAL_FIELDS} values={fin} onChange={setFin} />
                </Section>
                <Section title={`Assessment — Grade ${a.risk.grade} (${a.risk.score}/100)`}>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <Stat label="Turnover" value={shortINR(a.ratios.turnover)} />
                    <Stat label={a.ratios.profit_is_estimate ? "Net profit (estimated)" : "Net profit"} value={shortINR(a.ratios.estimated_profit)} />
                    <Stat label="Cash accrual" value={shortINR(a.ratios.cash_accrual)} />
                    <Stat label="DSCR" value={a.ratios.dscr != null ? String(a.ratios.dscr) : "—"} />
                    <Stat label="Loan / turnover" value={a.ratios.loan_to_turnover != null ? `${a.ratios.loan_to_turnover}%` : "—"} />
                    <Stat label="Enterprise size" value={a.ratios.enterprise_size} />
                  </div>
                  <ul className="mt-4 space-y-2">
                    {a.risk.flags.map((f, i) => (
                      <li key={i} className={`rounded-lg border px-3 py-2 text-sm ${FLAG_CLASS[f.type]}`}>{f.text}</li>
                    ))}
                  </ul>
                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    {a.schemes.map((s) => (
                      <div key={s.key} className={`rounded-xl border p-3 text-sm ${s.eligible ? "border-emerald-500/30 bg-emerald-500/5" : "border-border"}`}>
                        <div className="font-semibold">{s.eligible ? "✓ " : ""}{s.name}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">{s.detail}</div>
                      </div>
                    ))}
                  </div>
                  <ul className="mt-4 list-disc pl-5 text-xs text-muted-foreground space-y-1">
                    {a.assumptions.map((x) => <li key={x}>{x}</li>)}
                  </ul>
                </Section>
              </>
            )}

            {step === 4 && (
              <Section title="Loan options" desc={a.summary.headline}>
                <div className="overflow-x-auto rounded-xl border border-border">
                  <table className="w-full text-sm">
                    <thead className="bg-secondary/40 text-xs uppercase text-muted-foreground">
                      <tr>
                        <th className="text-left px-3 py-2">Facility</th>
                        <th className="text-left px-3 py-2">Indicative limit</th>
                        <th className="text-left px-3 py-2">Rate</th>
                        <th className="text-left px-3 py-2">EMI</th>
                        <th className="text-left px-3 py-2">Basis</th>
                      </tr>
                    </thead>
                    <tbody>
                      {a.options.map((o) => (
                        <tr key={o.facility} className={`border-t border-border ${o.recommended ? "bg-accent/5" : ""}`}>
                          <td className="px-3 py-2 font-semibold">
                            {o.label} {o.recommended && <span className="ml-1 text-[10px] font-bold uppercase text-accent">Requested</span>}
                          </td>
                          <td className="px-3 py-2 tabular-nums font-semibold text-emerald-700">{shortINR(o.amount)}</td>
                          <td className="px-3 py-2 tabular-nums">{o.rate_min}–{o.rate_max}{o.rate_unit === "% p.a." ? "%" : "% comm."}</td>
                          <td className="px-3 py-2 tabular-nums">{o.emi ? formatINR(o.emi) : "—"}</td>
                          <td className="px-3 py-2 text-xs text-muted-foreground">{o.note}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Section>
            )}

            {step === 5 && (
              <Section title={`Matched lenders (${a.lenders.length})`} desc="Tick the lenders to apply with.">
                <ul className="divide-y divide-border rounded-xl border border-border">
                  {a.lenders.map((l) => {
                    const on = selected.includes(l.name);
                    return (
                      <li key={l.name}>
                        <label className={`flex cursor-pointer items-center gap-3 p-3 text-sm ${on ? "bg-accent/5" : ""}`}>
                          <input
                            type="checkbox"
                            checked={on}
                            onChange={() => setSelected((p) => (on ? p.filter((x) => x !== l.name) : [...p, l.name]))}
                            className="size-4 accent-[hsl(var(--accent))]"
                          />
                          <span className="flex-1">
                            <span className="font-semibold">{l.name}</span>
                            <span className="ml-2 text-xs text-muted-foreground">{l.kind}</span>
                            {l.preferred && <span className="ml-2 text-[10px] font-bold uppercase text-accent">Customer preferred</span>}
                            {l.cgtmse && <span className="ml-2 text-[10px] font-bold uppercase text-emerald-700">CGTMSE</span>}
                          </span>
                          <span className="tabular-nums font-semibold">{shortINR(l.amount)}</span>
                          <span className="w-24 text-right tabular-nums text-xs">{l.rate_min}–{l.rate_max}%</span>
                          <span className="w-14 text-right text-xs font-semibold">{l.chance}</span>
                        </label>
                      </li>
                    );
                  })}
                  {a.lenders.length === 0 && <li className="p-4 text-sm text-muted-foreground">No lender matches on current details.</li>}
                </ul>
                {a.unmatched_lenders.length > 0 && (
                  <details className="mt-3 text-sm">
                    <summary className="cursor-pointer text-muted-foreground">{a.unmatched_lenders.length} lenders not matched — why</summary>
                    <ul className="mt-2 grid gap-1 sm:grid-cols-2 text-xs">
                      {a.unmatched_lenders.map((u) => (
                        <li key={u.name}><span className="font-semibold">{u.name}</span> — {u.reason}</li>
                      ))}
                    </ul>
                  </details>
                )}
              </Section>
            )}

            {step === 6 && (
              <Section title="Apply" desc="Track each lender application. Print the CAM and attach it to the bank file.">
                {selected.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Select lenders in the previous step first.</p>
                ) : (
                  <ul className="divide-y divide-border rounded-xl border border-border">
                    {selected.map((name) => {
                      const row = applied.find((x) => x.lender === name) ?? { lender: name, status: "draft" };
                      const update = (patch: Partial<Applied[number]>) =>
                        setApplied((p) => [...p.filter((x) => x.lender !== name), { ...row, ...patch, at: new Date().toISOString() }]);
                      return (
                        <li key={name} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center">
                          <span className="flex-1 text-sm font-semibold">{name}</span>
                          <select value={row.status} onChange={(e) => update({ status: e.target.value })} className="input-base sm:w-40 capitalize">
                            {APPLY_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                          </select>
                          <input value={row.ref ?? ""} onChange={(e) => update({ ref: e.target.value })} placeholder="Bank ref / LOS no." className="input-base sm:w-48" />
                        </li>
                      );
                    })}
                  </ul>
                )}
                <button
                  type="button"
                  onClick={printCam}
                  className="mt-4 inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2 text-sm font-semibold hover:bg-secondary"
                >
                  <Printer className="size-4" /> Print / save CAM (PDF)
                </button>
              </Section>
            )}
          </div>

          <div className="sticky bottom-0 flex flex-wrap items-center justify-end gap-2 rounded-b-2xl border-t border-border bg-card/95 p-4 backdrop-blur">
            {step > 0 && (
              <button type="button" onClick={() => setStep(step - 1)} className="mr-auto inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-foreground">
                <ArrowLeft className="size-4" /> Back
              </button>
            )}
            <button
              type="button"
              disabled={saving}
              onClick={() => void save()}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border px-4 py-2 text-sm font-semibold hover:bg-secondary disabled:opacity-60"
            >
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Save
            </button>
            {step < STAGES.length - 1 ? (
              <button
                type="button"
                disabled={saving}
                onClick={() => void save({ advance: true })}
                className="inline-flex items-center gap-1.5 rounded-xl bg-accent px-5 py-2 text-sm font-semibold text-accent-foreground hover:opacity-90 disabled:opacity-60"
              >
                Save & next <ArrowRight className="size-4" />
              </button>
            ) : (
              <button
                type="button"
                disabled={saving}
                onClick={() => void save({ extra: { stage: "applied" } })}
                className="inline-flex items-center gap-1.5 rounded-xl bg-accent px-5 py-2 text-sm font-semibold text-accent-foreground hover:opacity-90 disabled:opacity-60"
              >
                <CheckCircle2 className="size-4" /> Mark applied
              </button>
            )}
          </div>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
          <div className="rounded-2xl bg-card border border-border p-5 shadow-card">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{a.summary.facility_label}</div>
            <div className="mt-1 text-2xl font-bold text-emerald-700 tabular-nums">{shortINR(a.summary.eligible_amount)}</div>
            <div className="text-xs text-muted-foreground">eligible · asked {shortINR(a.summary.requested_amount)}</div>
            <div className="mt-4 flex items-end justify-between">
              <div>
                <div className="text-xs text-muted-foreground">Risk grade</div>
                <div className={`text-3xl font-extrabold ${GRADE_CLASS[a.risk.grade] ?? ""}`}>{a.risk.grade}</div>
              </div>
              <div className="text-right text-xs text-muted-foreground">
                <div>Score {a.risk.score}/100</div>
                <div>Chance {a.risk.chance}</div>
                <div>DSCR {a.ratios.dscr ?? "—"}</div>
              </div>
            </div>
            <div className="mt-3 text-xs text-muted-foreground">Documents {docStats.done}/{docStats.total} · Lenders {selected.length}</div>
          </div>

          <div className="rounded-2xl bg-card border border-border p-5 shadow-card">
            <div className="text-sm font-semibold">Call notes</div>
            <textarea
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Called, customer will share GST returns by evening"
              className="input-base mt-2 w-full !h-auto py-2"
            />
            <button
              type="button"
              disabled={saving || !note.trim()}
              onClick={() => void addNote()}
              className="mt-2 w-full rounded-xl bg-accent py-2 text-sm font-semibold text-accent-foreground disabled:opacity-50"
            >
              Add note
            </button>
            <ul className="mt-3 space-y-2 max-h-64 overflow-y-auto">
              {[...(item.business.notes ?? [])].reverse().map((n, i) => (
                <li key={i} className="rounded-lg bg-secondary/50 p-2 text-xs">
                  <div>{n.text}</div>
                  <div className="mt-1 text-[10px] text-muted-foreground">{n.by} · {new Date(n.at).toLocaleString("en-IN")}</div>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl bg-card border border-border p-5 shadow-card">
            <div className="text-sm font-semibold">History</div>
            <ul className="mt-2 space-y-1.5 max-h-56 overflow-y-auto text-xs">
              {[...(item.business.history ?? [])].reverse().map((h, i) => (
                <li key={i}>
                  <span className="font-medium">{h.action}</span>
                  <span className="text-muted-foreground"> — {h.by}, {new Date(h.at).toLocaleString("en-IN")}</span>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Section({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="font-display text-lg font-bold">{title}</h2>
      {desc && <p className="text-xs text-muted-foreground mt-0.5 mb-3">{desc}</p>}
      {!desc && <div className="mb-3" />}
      {children}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border p-3">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="text-base font-bold tabular-nums capitalize">{value}</div>
    </div>
  );
}

function FieldGrid({
  fields,
  values,
  onChange,
}: {
  fields: BizField[];
  values: BusinessSection;
  onChange: React.Dispatch<React.SetStateAction<BusinessSection>>;
}) {
  const set = (key: string, v: BusinessSection[string]) => onChange((p) => ({ ...p, [key]: v }));
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {fields.map((f) => {
        const raw = values[f.key];
        const label = (
          <span className="text-muted-foreground">
            {f.label}
            {f.required && <span className="text-destructive"> *</span>}
          </span>
        );
        if (f.type === "multi") {
          const list = Array.isArray(raw) ? raw : [];
          return (
            <div key={f.key} className="sm:col-span-2 text-xs">
              {label}
              <div className="mt-1 flex flex-wrap gap-1.5">
                {f.options?.map((o) => {
                  const on = list.includes(o.value);
                  return (
                    <button
                      key={o.value}
                      type="button"
                      onClick={() => set(f.key, on ? list.filter((x) => x !== o.value) : [...list, o.value])}
                      className={`rounded-full border px-2.5 py-1 text-xs ${on ? "border-accent bg-accent/10 font-semibold" : "border-border text-muted-foreground"}`}
                    >
                      {o.label}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        }
        if (f.type === "textarea") {
          return (
            <label key={f.key} className="sm:col-span-2 text-xs">
              {label}
              <textarea
                rows={2}
                value={raw == null ? "" : String(raw)}
                onChange={(e) => set(f.key, e.target.value)}
                className="input-base mt-1 w-full !h-auto py-2"
              />
              {f.hint && <span className="mt-0.5 block text-[11px] text-muted-foreground">{f.hint}</span>}
            </label>
          );
        }
        if (f.type === "select") {
          return (
            <label key={f.key} className="text-xs">
              {label}
              <select value={raw == null ? "" : String(raw)} onChange={(e) => set(f.key, e.target.value)} className="input-base mt-1 w-full">
                <option value="">Select…</option>
                {f.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </label>
          );
        }
        const numeric = f.type === "number" || f.type === "money";
        const display =
          raw == null || raw === "" ? "" : f.type === "money" ? Number(raw).toLocaleString("en-IN") : String(raw);
        return (
          <label key={f.key} className="text-xs">
            {label}
            <input
              inputMode={numeric ? "decimal" : undefined}
              value={display}
              onChange={(e) => {
                if (!numeric) return set(f.key, e.target.value);
                const cleaned = e.target.value.replace(/[^\d.]/g, "");
                set(f.key, cleaned === "" ? "" : Number(cleaned));
              }}
              className="input-base mt-1 w-full"
            />
            {f.hint && <span className="mt-0.5 block text-[11px] text-muted-foreground">{f.hint}</span>}
          </label>
        );
      })}
    </div>
  );
}
