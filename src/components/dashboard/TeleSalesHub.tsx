import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Banknote, Loader2, MapPin, Phone, Search } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { listMyLeads, patchMyLead, type CrmPurchase } from "@/lib/python-api";
import {
  CALL_SCRIPTS,
  DISPOSITIONS,
  TELE_SECTIONS,
  gradeLabel,
  isFollowupDue,
  isOpenCall,
  isTeleSection,
  lastDisposition,
  scriptFor,
  telesalesStats,
  type TeleSection,
} from "@/lib/telesales";

function inr(n: number) {
  return `₹${Math.round(Number(n) || 0).toLocaleString("en-IN")}`;
}

function when(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function TeleSalesHub() {
  const { role } = useAuth();
  const canBrowse = role === "ceo" || role === "super_admin" || role === "admin" || role === "dsa";
  const [rows, setRows] = useState<CrmPurchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [section, setSection] = useState<TeleSection>("queue");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [note, setNote] = useState("");
  const [callbackAt, setCallbackAt] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const data = await listMyLeads();
      const items = data.items ?? [];
      setRows(items);
      setSelectedId((current) => current ?? items.find((row) => row.lead)?.id ?? null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load TeleSales");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const hash = window.location.hash.replace("#", "");
    if (isTeleSection(hash)) setSection(hash);
    void load();
  }, []);

  const openSection = (id: TeleSection) => {
    setSection(id);
    window.history.replaceState(null, "", `#${id}`);
  };

  const selected = rows.find((row) => row.id === selectedId) ?? null;
  const stats = useMemo(() => telesalesStats(rows), [rows]);

  const visible = rows.filter((row) => {
    if (section === "queue" && !isOpenCall(row)) return false;
    if (section === "followups" && !isFollowupDue(row)) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    const lead = row.lead;
    return (
      lead?.applicant_name.toLowerCase().includes(q) ||
      lead?.city.toLowerCase().includes(q) ||
      (lead?.full_phone || "").includes(q)
    );
  });

  const choose = (row: CrmPurchase, next: TeleSection = "profile") => {
    setSelectedId(row.id);
    openSection(next);
  };

  const saveDisposition = async (code: string, followup?: string) => {
    if (!selected) return;
    setBusy(true);
    try {
      await patchMyLead(selected.id, {
        disposition: code,
        notes_text: note.trim() || undefined,
        next_followup_at: followup,
      });
      setNote("");
      toast.success("Disposition saved");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save disposition");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-6xl space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#10662A]">TeleSales</p>
          <h1 className="font-display text-2xl font-bold text-[#390A5D] lg:text-3xl">Calling desk</h1>
          <p className="mt-1 text-sm text-muted-foreground">Owned leads only. Name and phone stay on this desk after the lead is assigned to you.</p>
        </div>
        {canBrowse ? (
          <Link to="/dashboard/my-leads" className="rounded-full border border-border px-4 py-2 text-sm font-semibold">
            My Leads
          </Link>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2">
        {TELE_SECTIONS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => openSection(item.id)}
            className={`rounded-full px-3 py-1.5 text-sm font-semibold ${
              section === item.id ? "bg-[#10662A] text-white" : "border border-border bg-white text-[#390A5D]"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid place-items-center py-20"><Loader2 className="size-6 animate-spin text-[#10662A]" /></div>
      ) : section === "scripts" ? (
        <Scripts product={selected?.lead?.product_subtype} />
      ) : section === "performance" ? (
        <Performance stats={stats} />
      ) : section === "profile" || section === "eligibility" || section === "disposition" || section === "callback" || section === "conversion" ? (
        <LeadWork
          row={selected}
          section={section}
          note={note}
          setNote={setNote}
          callbackAt={callbackAt}
          setCallbackAt={setCallbackAt}
          busy={busy}
          onDisposition={saveDisposition}
          onPick={() => openSection("queue")}
        />
      ) : visible.length === 0 ? (
        <Empty section={section} canBrowse={canBrowse} />
      ) : (
        <div className="space-y-3">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name, city, or phone" className="input-base w-full pl-9" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {visible.map((row) => (
              <QueueCard key={row.id} row={row} onOpen={() => choose(row)} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function QueueCard({ row, onOpen }: { row: CrmPurchase; onOpen: () => void }) {
  const lead = row.lead;
  if (!lead) return null;
  const disposition = lastDisposition(row);
  return (
    <div className="rounded-2xl border border-border bg-white p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-display font-bold">{lead.applicant_name}</div>
          <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground"><MapPin className="size-3" />{lead.city || "—"}</div>
        </div>
        <span className="rounded-full bg-[#E8F7EC] px-2 py-0.5 text-[10px] font-bold uppercase text-[#10662A]">{gradeLabel(row)}</span>
      </div>
      <div className="mt-3 space-y-1 text-sm">
        <div className="flex items-center gap-2"><Phone className="size-3.5 text-[#10662A]" /><span className="font-mono">{lead.full_phone}</span></div>
        <div className="flex items-center gap-2"><Banknote className="size-3.5 text-[#10662A]" />{lead.product_subtype || "Loan"} · {inr(lead.loan_amount)}</div>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        {disposition ? disposition.text : row.pipeline_stage}
        {row.next_followup_at ? ` · Follow-up ${when(row.next_followup_at)}` : ""}
      </p>
      <div className="mt-3 flex gap-2">
        <a href={`tel:${lead.full_phone}`} className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg bg-[#10662A] px-3 py-2 text-sm font-bold text-white">
          <Phone className="size-4" /> Call
        </a>
        <button type="button" onClick={onOpen} className="rounded-lg border border-border px-3 py-2 text-sm font-semibold">Open</button>
      </div>
    </div>
  );
}

function LeadWork({
  row,
  section,
  note,
  setNote,
  callbackAt,
  setCallbackAt,
  busy,
  onDisposition,
  onPick,
}: {
  row: CrmPurchase | null;
  section: TeleSection;
  note: string;
  setNote: (value: string) => void;
  callbackAt: string;
  setCallbackAt: (value: string) => void;
  busy: boolean;
  onDisposition: (code: string, followup?: string) => void;
  onPick: () => void;
}) {
  if (!row?.lead) {
    return (
      <div className="rounded-2xl border border-dashed border-border p-8 text-center">
        <p className="font-semibold">Select a lead from the call queue.</p>
        <button type="button" onClick={onPick} className="mt-3 rounded-full bg-[#10662A] px-4 py-2 text-sm font-semibold text-white">Open queue</button>
      </div>
    );
  }
  const lead = row.lead;
  const checks = [
    { label: "Phone on file", ok: Boolean(lead.full_phone) },
    { label: "City", ok: Boolean(lead.city && lead.city.toLowerCase() !== "unknown") },
    { label: "Monthly income", ok: Number(lead.monthly_income || 0) > 0 },
    { label: "Employment", ok: Boolean(lead.employment_type) },
    { label: "Requirement amount", ok: Number(lead.loan_amount || 0) > 0 },
  ];
  const ready = checks.filter((item) => item.ok).length >= 4;

  return (
    <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
      <div className="rounded-2xl border border-border bg-white p-4">
        <div className="text-xs font-bold uppercase text-[#10662A]">{gradeLabel(row)}</div>
        <h2 className="mt-1 font-display text-xl font-bold">{lead.applicant_name}</h2>
        <p className="text-sm text-muted-foreground">{lead.city}{lead.state ? `, ${lead.state}` : ""}</p>
        <a href={`tel:${lead.full_phone}`} className="mt-3 inline-flex items-center gap-2 font-mono text-sm font-semibold text-[#10662A]">
          <Phone className="size-4" /> {lead.full_phone}
        </a>
        <p className="mt-2 text-sm">{lead.product_subtype || "Loan"} · {inr(lead.loan_amount)}</p>
        <p className="mt-1 text-xs text-muted-foreground">{lastDisposition(row)?.text || row.pipeline_stage}</p>
      </div>

      <div className="rounded-2xl border border-border bg-white p-4">
        {section === "profile" && (
          <dl className="grid gap-3 sm:grid-cols-2 text-sm">
            <Field label="Email" value={lead.email || "—"} />
            <Field label="Employment" value={lead.employment_type || "—"} />
            <Field label="Company" value={lead.company_name || "—"} />
            <Field label="Income" value={lead.monthly_income ? inr(lead.monthly_income) : "—"} />
            <Field label="Stage" value={row.pipeline_stage} />
            <Field label="Follow-up" value={when(row.next_followup_at)} />
          </dl>
        )}

        {section === "eligibility" && (
          <div>
            <p className="text-sm text-muted-foreground">This is a calling checklist. Lender eligibility runs later in OneFlo.</p>
            <ul className="mt-3 space-y-2">
              {checks.map((item) => (
                <li key={item.label} className="flex items-center justify-between rounded-xl border border-border px-3 py-2 text-sm">
                  <span>{item.label}</span>
                  <span className={item.ok ? "font-semibold text-[#10662A]" : "text-amber-700"}>{item.ok ? "Yes" : "Missing"}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-sm font-semibold">{ready ? "Enough to discuss. Mark eligible if the customer confirms." : "Collect the missing points before marking eligible."}</p>
          </div>
        )}

        {section === "disposition" && (
          <div className="space-y-3">
            <textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Call note" className="input-base min-h-20 w-full" />
            <div className="flex flex-wrap gap-2">
              {DISPOSITIONS.map((item) => (
                <button key={item.code} type="button" disabled={busy} onClick={() => onDisposition(item.code)} className="rounded-full border border-border px-3 py-1.5 text-sm font-semibold hover:bg-[#f5fcf7] disabled:opacity-50">
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {section === "callback" && (
          <div className="space-y-3">
            <label className="block text-sm font-semibold">Callback time</label>
            <input type="datetime-local" value={callbackAt} onChange={(event) => setCallbackAt(event.target.value)} className="input-base" />
            <button
              type="button"
              disabled={busy || !callbackAt}
              onClick={() => onDisposition("callback", new Date(callbackAt).toISOString())}
              className="rounded-full bg-[#10662A] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              Save callback
            </button>
          </div>
        )}

        {section === "conversion" && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Moves this lead to document collection for the connector. It does not sanction or disburse.</p>
            <p className="text-sm">Suggested script: {scriptFor(lead.product_subtype).title}</p>
            <button type="button" disabled={busy} onClick={() => onDisposition("converted")} className="rounded-full bg-[#390A5D] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
              Convert to case
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}

function Scripts({ product }: { product?: string | null }) {
  const active = scriptFor(product);
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {CALL_SCRIPTS.map((script) => (
        <article key={script.id} className={`rounded-2xl border bg-white p-4 ${script.id === active.id ? "border-[#10662A]" : "border-border"}`}>
          <h2 className="font-display font-bold">{script.title}</h2>
          <ol className="mt-2 list-decimal space-y-2 pl-4 text-sm text-[#3d3450]">
            {script.lines.map((line) => <li key={line}>{line}</li>)}
          </ol>
        </article>
      ))}
    </div>
  );
}

function Performance({ stats }: { stats: ReturnType<typeof telesalesStats> }) {
  const items = [
    ["Queue left", stats.queue],
    ["Follow-ups due", stats.followups],
    ["Calls today", stats.callsToday],
    ["Connected", stats.connected],
    ["Interested", stats.interested],
    ["Callbacks", stats.callbacks],
    ["Converted today", stats.convertedToday],
    ["Cases moved ahead", stats.converted],
    ["Connect rate", `${stats.connectRate}%`],
  ] as const;
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
      {items.map(([label, value]) => (
        <div key={label} className="rounded-2xl border border-border bg-white px-4 py-3">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="mt-1 font-display text-2xl font-bold text-[#390A5D]">{value}</p>
        </div>
      ))}
    </div>
  );
}

function Empty({ section, canBrowse }: { section: TeleSection; canBrowse: boolean }) {
  const label = TELE_SECTIONS.find((item) => item.id === section)?.label ?? "TeleSales";
  return (
    <div className="rounded-3xl border border-dashed border-border p-12 text-center">
      <Phone className="mx-auto size-6 text-[#10662A]" />
      <h2 className="mt-3 font-display text-xl font-bold">Nothing in {label}</h2>
      <p className="mt-2 text-sm text-muted-foreground">Leads on your login show up here with phone, script and disposition.</p>
      {canBrowse ? (
        <Link to="/dashboard/leadboard" className="mt-4 inline-flex rounded-full bg-[#10662A] px-4 py-2 text-sm font-semibold text-white">Browse marketplace</Link>
      ) : null}
    </div>
  );
}
