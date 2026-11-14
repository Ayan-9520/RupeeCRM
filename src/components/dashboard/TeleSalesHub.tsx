import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Banknote, Check, Loader2, MapPin, Phone, Search } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { listMyLeads, patchMyLead, type CrmPurchase } from "@/lib/python-api";
import {
  CALL_SCRIPTS,
  DISPOSITIONS,
  isFollowupDue,
  isOpenCall,
  isTeleSection,
  isToday,
  lastDisposition,
  scriptFor,
  telesalesStats,
} from "@/lib/telesales";

type Desk = "queue" | "followups" | "script" | "today" | "sheet";

const TABS: { id: Exclude<Desk, "sheet">; label: string }[] = [
  { id: "queue", label: "To call" },
  { id: "followups", label: "Follow-ups" },
  { id: "script", label: "What to say" },
  { id: "today", label: "Today" },
];

const JOBS = [
  { who: "You", title: "Call and mark the result", detail: "Connected, Interested, Not interested, or a callback." },
  { who: "Partner", title: "Collects the papers", detail: "After Interested, the partner who owns the file takes PAN and income proof." },
  { who: "Bank desk", title: "Sanction and disbursement", detail: "This desk does not send the file to the bank." },
];

const HANDED = new Set(["interested"]);
const STILL = new Set(["connected", "not_reachable", "eligible"]);
const CLOSED = new Set(["not_interested", "wrong_number"]);

const SAVED: Record<string, string> = {
  interested: "Marked Interested. The partner now collects the documents.",
  connected: "Marked Connected. This file stays on your list.",
  not_reachable: "Saved. Try this number again later.",
  eligible: "Noted. The partner still collects the documents.",
  not_interested: "Closed. The partner will not work this file.",
  wrong_number: "Closed as a wrong number.",
  callback: "Callback saved. It shows under Follow-ups.",
};

function inr(n: number) {
  return `₹${Math.round(Number(n) || 0).toLocaleString("en-IN")}`;
}

function when(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

function productLabel(value: string | null | undefined) {
  const raw = (value || "Loan").replace(/[_-]+/g, " ").trim();
  return raw.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function resultLine(row: CrmPurchase) {
  const note = lastDisposition(row);
  if (note?.text) return note.text;
  if (row.pipeline_stage === "contacted") return "Already spoken";
  return "Not called yet";
}

function deskFromHash(hash: string): Desk {
  if (hash === "followups") return "followups";
  if (hash === "scripts") return "script";
  if (hash === "performance") return "today";
  if (hash === "sheet") return "sheet";
  if (isTeleSection(hash) && hash !== "queue") return "sheet";
  return "queue";
}

export function TeleSalesHub() {
  const { role } = useAuth();
  const canBrowse = role === "ceo" || role === "super_admin" || role === "admin" || role === "dsa";
  const [rows, setRows] = useState<CrmPurchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [section, setSection] = useState<Desk>("queue");
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
      setSelectedId((current) => (current && items.some((row) => row.id === current) ? current : items.find((row) => row.lead)?.id ?? null));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load TeleSales");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setSection(deskFromHash(window.location.hash.replace("#", "")));
    void load();
  }, []);

  const openSection = (id: Desk) => {
    setSection(id);
    window.history.replaceState(null, "", `#${id === "script" ? "scripts" : id === "today" ? "performance" : id}`);
  };

  const selected = rows.find((row) => row.id === selectedId) ?? null;
  const stats = useMemo(() => telesalesStats(rows), [rows]);
  const queueCount = rows.filter(isOpenCall).length;
  const followupCount = rows.filter((row) => isFollowupDue(row)).length;

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

  const openLead = (row: CrmPurchase) => {
    setSelectedId(row.id);
    setNote("");
    setCallbackAt("");
    openSection("sheet");
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
      setCallbackAt("");
      toast.success(SAVED[code] || "Call result saved");
      await load();
      if (code === "interested" || code === "not_interested" || code === "wrong_number") openSection("queue");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save the call result");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-6xl space-y-5">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#10662A]">Telecaller</p>
        <h1 className="font-display text-2xl font-bold text-[#390A5D] lg:text-3xl">Your calling desk</h1>
        <p className="mt-1 max-w-2xl text-sm text-[#5c4d72]">
          You only see the leads on your list. Call the customer and mark the result. The partner collects the papers. The bank desk records sanction and disbursement.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {JOBS.map((job) => (
          <article key={job.who} className="rounded-2xl border border-[#d8ecdd] bg-white p-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#10662A]">{job.who}</p>
            <h2 className="mt-1 font-display text-base font-bold text-[#390A5D]">{job.title}</h2>
            <p className="mt-1 text-sm text-[#5c4d72]">{job.detail}</p>
          </article>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => openSection(item.id)}
            className={`rounded-full px-3 py-1.5 text-sm font-semibold ${
              section === item.id ? "bg-[#10662A] text-white" : "border border-[#d8ecdd] bg-white text-[#390A5D]"
            }`}
          >
            {item.label}
            {item.id === "queue" ? ` · ${queueCount}` : ""}
            {item.id === "followups" ? ` · ${followupCount}` : ""}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid place-items-center py-20"><Loader2 className="size-6 animate-spin text-[#10662A]" /></div>
      ) : section === "script" ? (
        <Scripts product={selected?.lead?.product_subtype} />
      ) : section === "today" ? (
        <Today stats={stats} rows={rows} />
      ) : section === "sheet" ? (
        <CallSheet
          row={selected}
          note={note}
          setNote={setNote}
          callbackAt={callbackAt}
          setCallbackAt={setCallbackAt}
          busy={busy}
          onDisposition={saveDisposition}
          onBack={() => openSection("queue")}
        />
      ) : visible.length === 0 ? (
        <Empty section={section} canBrowse={canBrowse} />
      ) : (
        <div className="space-y-3">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#5c4d72]" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name, city, or phone" className="h-11 w-full rounded-xl border border-[#d8ecdd] bg-white pl-9 pr-3 text-sm" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {visible.map((row) => (
              <QueueCard key={row.id} row={row} onOpen={() => openLead(row)} />
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
  return (
    <article className="rounded-2xl border border-[#d8ecdd] bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-bold text-[#390A5D]">{lead.applicant_name}</h2>
          <p className="mt-0.5 flex items-center gap-1 text-xs text-[#5c4d72]"><MapPin className="size-3" />{lead.city || "City not on file"}</p>
        </div>
        <span className="rounded-full bg-[#E8F7EC] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-[#10662A]">{resultLine(row)}</span>
      </div>
      <div className="mt-3 space-y-1 text-sm text-[#14281c]">
        <p className="flex items-center gap-2"><Phone className="size-3.5 text-[#10662A]" /><span className="font-mono">{lead.full_phone}</span></p>
        <p className="flex items-center gap-2"><Banknote className="size-3.5 text-[#10662A]" />{productLabel(lead.product_subtype)} · {inr(lead.loan_amount)}</p>
      </div>
      <p className="mt-2 text-xs text-[#5c4d72]">
        {row.partner_name ? `Partner: ${row.partner_name}` : "Partner owns this file"}
        {row.next_followup_at ? ` · Follow-up ${when(row.next_followup_at)}` : ""}
      </p>
      <div className="mt-3 flex gap-2">
        <a href={`tel:${lead.full_phone}`} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#10662A] px-3 py-2.5 text-sm font-bold text-white">
          <Phone className="size-4" /> Call
        </a>
        <button type="button" onClick={onOpen} className="rounded-xl border border-[#d8ecdd] px-4 py-2.5 text-sm font-semibold text-[#390A5D]">
          Mark result
        </button>
      </div>
    </article>
  );
}

function CallSheet({
  row,
  note,
  setNote,
  callbackAt,
  setCallbackAt,
  busy,
  onDisposition,
  onBack,
}: {
  row: CrmPurchase | null;
  note: string;
  setNote: (value: string) => void;
  callbackAt: string;
  setCallbackAt: (value: string) => void;
  busy: boolean;
  onDisposition: (code: string, followup?: string) => void;
  onBack: () => void;
}) {
  if (!row?.lead) {
    return (
      <div className="rounded-2xl border border-dashed border-[#d8ecdd] bg-white p-8 text-center">
        <p className="font-semibold text-[#390A5D]">Pick a lead from To call.</p>
        <button type="button" onClick={onBack} className="mt-3 rounded-full bg-[#10662A] px-4 py-2 text-sm font-semibold text-white">Back to the list</button>
      </div>
    );
  }
  const lead = row.lead;
  const script = scriptFor(lead.product_subtype);
  const byCode = (codes: Set<string>) => DISPOSITIONS.filter((item) => codes.has(item.code));
  return (
    <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
      <section className="rounded-2xl border border-[#d8ecdd] bg-white p-5">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#10662A]">Customer</p>
        <h2 className="mt-1 font-display text-2xl font-bold text-[#390A5D]">{lead.applicant_name}</h2>
        <p className="text-sm text-[#5c4d72]">{lead.city || "—"}{lead.state ? `, ${lead.state}` : ""}</p>
        <a href={`tel:${lead.full_phone}`} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#10662A] px-3 py-2.5 font-mono text-sm font-bold text-white">
          <Phone className="size-4" /> {lead.full_phone}
        </a>
        <dl className="mt-4 space-y-2 text-sm">
          <Fact label="Product" value={`${productLabel(lead.product_subtype)} · ${inr(lead.loan_amount)}`} />
          <Fact label="Work" value={lead.employment_type || "Ask on the call"} />
          <Fact label="Income" value={lead.monthly_income ? `${inr(lead.monthly_income)} / month` : "Ask on the call"} />
          <Fact label="Partner" value={row.partner_name || "The partner who bought this lead"} />
          <Fact label="Last result" value={resultLine(row)} />
        </dl>
      </section>

      <section className="space-y-4">
        <div className="rounded-2xl border border-[#d8ecdd] bg-white p-5">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#10662A]">Your job on this call</p>
          <h2 className="mt-1 font-display text-lg font-bold text-[#390A5D]">Mark one result</h2>
          <textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Short note, optional" className="mt-3 min-h-20 w-full rounded-xl border border-[#d8ecdd] px-3 py-2 text-sm" />
          <ResultRow title="Hand to the partner" hint="Customer wants the loan. You stop here." items={byCode(HANDED)} busy={busy} onPick={onDisposition} primary />
          <ResultRow title="Keep on your list" hint="Spoken, not reachable, or still checking." items={byCode(STILL)} busy={busy} onPick={onDisposition} />
          <div className="mt-4 rounded-xl bg-[#F4FBF6] p-3">
            <p className="text-sm font-semibold text-[#390A5D]">Callback</p>
            <p className="text-xs text-[#5c4d72]">They asked you to call later. It stays on your list.</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <input type="datetime-local" value={callbackAt} onChange={(event) => setCallbackAt(event.target.value)} className="h-10 rounded-xl border border-[#d8ecdd] bg-white px-3 text-sm" />
              <button type="button" disabled={busy || !callbackAt} onClick={() => onDisposition("callback", new Date(callbackAt).toISOString())} className="h-10 rounded-xl bg-[#10662A] px-4 text-sm font-semibold text-white disabled:opacity-50">
                Save callback
              </button>
            </div>
          </div>
          <ResultRow title="Close the file" hint="Not interested, or the number is wrong." items={byCode(CLOSED)} busy={busy} onPick={onDisposition} />
        </div>
        <div className="rounded-2xl border border-[#d8ecdd] bg-white p-5">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#10662A]">What to say · {script.title}</p>
          <ol className="mt-2 list-decimal space-y-2 pl-4 text-sm text-[#3d3450]">
            {script.lines.map((line) => <li key={line}>{line}</li>)}
          </ol>
          <p className="mt-3 text-xs text-[#5c4d72]">Do not promise sanction. Do not ask them to send documents to you.</p>
        </div>
      </section>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 border-t border-[#eef6f0] pt-2">
      <dt className="text-[#5c4d72]">{label}</dt>
      <dd className="text-right font-medium text-[#14281c]">{value}</dd>
    </div>
  );
}

function ResultRow({
  title,
  hint,
  items,
  busy,
  onPick,
  primary,
}: {
  title: string;
  hint: string;
  items: { code: string; label: string }[];
  busy: boolean;
  onPick: (code: string) => void;
  primary?: boolean;
}) {
  return (
    <div className="mt-4">
      <p className="text-sm font-semibold text-[#390A5D]">{title}</p>
      <p className="text-xs text-[#5c4d72]">{hint}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {items.map((item) => (
          <button
            key={item.code}
            type="button"
            disabled={busy}
            onClick={() => onPick(item.code)}
            className={
              primary
                ? "inline-flex items-center gap-1.5 rounded-full bg-[#10662A] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                : "rounded-full border border-[#d8ecdd] bg-white px-4 py-2 text-sm font-semibold text-[#390A5D] disabled:opacity-50"
            }
          >
            {primary ? <Check className="size-3.5" /> : null}
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function Scripts({ product }: { product?: string | null }) {
  const active = scriptFor(product);
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {CALL_SCRIPTS.map((script) => (
        <article key={script.id} className={`rounded-2xl border bg-white p-4 ${script.id === active.id ? "border-[#10662A]" : "border-[#d8ecdd]"}`}>
          <h2 className="font-display font-bold text-[#390A5D]">{script.title}</h2>
          <ol className="mt-2 list-decimal space-y-2 pl-4 text-sm text-[#3d3450]">
            {script.lines.map((line) => <li key={line}>{line}</li>)}
          </ol>
        </article>
      ))}
    </div>
  );
}

function Today({ stats, rows }: { stats: ReturnType<typeof telesalesStats>; rows: CrmPurchase[] }) {
  const closed = rows.flatMap((row) => row.notes ?? []).filter(
    (note) => note.kind === "disposition" && isToday(note.at) && (note.code === "not_interested" || note.code === "wrong_number"),
  ).length;
  const items = [
    ["Left to call", stats.queue, "New or already spoken"],
    ["Follow-ups", stats.followups, "Due today or overdue"],
    ["Calls today", stats.callsToday, "Results you saved today"],
    ["Connected", stats.connected, "Still on your list"],
    ["Handed to partner", stats.interested, "Marked Interested today"],
    ["Callbacks", stats.callbacks, "Saved today"],
    ["Closed", closed, "Not interested or wrong number"],
    ["Connect rate", `${stats.connectRate}%`, "Connected out of today's calls"],
  ] as const;
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {items.map(([label, value, hint]) => (
        <div key={label} className="rounded-2xl border border-[#d8ecdd] bg-white px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[#5c4d72]">{label}</p>
          <p className="mt-1 font-display text-2xl font-bold text-[#390A5D]">{value}</p>
          <p className="mt-0.5 text-[11px] text-[#5c4d72]">{hint}</p>
        </div>
      ))}
    </div>
  );
}

function Empty({ section, canBrowse }: { section: Desk; canBrowse: boolean }) {
  const title = section === "followups" ? "No follow-up is due" : "Nothing to call";
  return (
    <div className="rounded-3xl border border-dashed border-[#d8ecdd] bg-white p-12 text-center">
      <Phone className="mx-auto size-6 text-[#10662A]" />
      <h2 className="mt-3 font-display text-xl font-bold text-[#390A5D]">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-[#5c4d72]">
        A company telecaller sees a lead only after admin assigns it. A partner's telecaller sees only that partner's new leads.
      </p>
      {canBrowse ? (
        <Link to="/dashboard/leadboard" className="mt-4 inline-flex rounded-full bg-[#10662A] px-4 py-2 text-sm font-semibold text-white">Browse marketplace</Link>
      ) : null}
    </div>
  );
}
