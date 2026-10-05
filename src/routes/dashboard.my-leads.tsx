import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Loader2,
  Phone,
  MapPin,
  RefreshCw,
  KanbanSquare,
  Mail,
  MessageCircle,
  Copy,
  X,
  Flame,
  Sun,
  Snowflake,
  Building2,
  FileText,
  StickyNote,
  ChevronRight,
  Clock,
  Layers,
  Save,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  Activity,
} from "lucide-react";
import { listMyLeads, patchMyLead, type CrmLead, type CrmPurchase } from "@/lib/python-api";
import { gradeCode, gradeFromPipeline, gradeText } from "@/lib/lead-grades";
import {
  CRM_FORM_SECTIONS,
  getKnownDetailKeys,
  readDetail,
  stringifyVal,
  type FormFieldDef,
} from "@/lib/crm-form-sections";

export const Route = createFileRoute("/dashboard/my-leads")({
  head: () => ({ meta: [{ title: "My Leads — RupeeDial CRM" }] }),
  component: MyLeadsPage,
});

const STAGE_LABELS: Record<string, string> = {
  new: "New",
  contacted: "Contacted",
  docs_collected: "Docs collected",
  bank_submitted: "Bank submitted",
  sanctioned: "Sanctioned",
  disbursed: "Disbursed",
  rejected: "Rejected",
};

type EditForm = {
  lead: Record<string, string>;
  details: Record<string, string>;
  deal_value: string;
  next_followup_at: string;
  /** leftover product_details / raw keys not in section map */
  extra: Record<string, string>;
};

function scoreMeta(score: string) {
  if (score === "hot")
    return { label: "HOT", Icon: Flame, className: "bg-red-50 text-red-600 border-red-200" };
  if (score === "warm")
    return { label: "WARM", Icon: Sun, className: "bg-amber-50 text-amber-700 border-amber-200" };
  return { label: "COLD", Icon: Snowflake, className: "bg-sky-50 text-sky-700 border-sky-200" };
}

function formatLabel(key: string) {
  return key
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function toDatetimeLocal(iso: string | null | undefined) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const LEAD_SKIP_EXTRA = new Set([
  "applicant_name",
  "full_phone",
  "masked_phone",
  "email",
  "city",
  "state",
  "loan_amount",
  "monthly_income",
  "employment_type",
  "company_name",
  "product_category",
  "product_subtype",
  "product_details",
  "product_type_id",
  "workspace_id",
  "score",
  "price",
  "source",
  "status",
  "is_marketplace",
  "sale_available",
  "quality_factors",
  "quality_score",
  "assigned_to",
  "created_by",
  "remarks",
  "internal_notes",
  "raw",
  "phone_verified",
  "utm_source",
  "utm_medium",
  "utm_campaign",
]);

function mergeDetailsBag(lead: CrmLead | null): Record<string, unknown> {
  if (!lead) return {};
  return { ...(lead.raw_payload || {}), ...(lead.product_details || {}) };
}

function buildForm(p: CrmPurchase): EditForm {
  const lead = p.lead;
  const bag = mergeDetailsBag(lead);
  const known = getKnownDetailKeys();

  const leadVals: Record<string, string> = {};
  const detailVals: Record<string, string> = {};

  for (const section of CRM_FORM_SECTIONS) {
    for (const f of section.fields) {
      if (f.source === "lead") {
        const fromLead = lead ? (lead as unknown as Record<string, unknown>)[f.key] : undefined;
        const fromBag = readDetail(bag, f.key, f.aliases);
        leadVals[f.key] =
          fromLead !== null && fromLead !== undefined && fromLead !== ""
            ? stringifyVal(fromLead)
            : fromBag;
      } else if (f.source === "details") {
        detailVals[f.key] = readDetail(bag, f.key, f.aliases);
      }
    }
  }

  const extra: Record<string, string> = {};
  for (const [k, v] of Object.entries(bag)) {
    if (LEAD_SKIP_EXTRA.has(k) || known.has(k)) continue;
    if (v === null || v === undefined || v === "") continue;
    // skip huge nested blobs shown separately
    if (k === "selected_banks" || k === "documents" || k === "banks") continue;
    extra[k] = stringifyVal(v);
  }

  return {
    lead: leadVals,
    details: detailVals,
    deal_value: p.deal_value != null ? String(p.deal_value) : "",
    next_followup_at: toDatetimeLocal(p.next_followup_at),
    extra,
  };
}

function docsFromLead(lead: CrmLead | null): Record<string, string[]> {
  const bag = mergeDetailsBag(lead);
  const docs = bag.documents;
  if (!docs || typeof docs !== "object" || Array.isArray(docs)) return {};
  const out: Record<string, string[]> = {};
  for (const [k, v] of Object.entries(docs as Record<string, unknown>)) {
    if (Array.isArray(v)) out[k] = v.map(String);
    else if (typeof v === "string" && v) out[k] = [v];
  }
  return out;
}

function banksFromLead(lead: CrmLead | null): Array<Record<string, unknown>> {
  const bag = mergeDetailsBag(lead);
  const banks = bag.selected_banks ?? bag.banks;
  if (!Array.isArray(banks)) return [];
  return banks.filter((b) => b && typeof b === "object") as Array<Record<string, unknown>>;
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-[11px] font-semibold text-[#5c4d72]">{label}</span>
      {children}
    </label>
  );
}

const inputClass =
  "w-full h-10 px-3 rounded-lg border border-[#d8ecdd] bg-white text-sm text-[#390A5D] placeholder:text-[#5c4d72]/50 focus:outline-none focus:border-[#10662A] focus:ring-2 focus:ring-[#10662A]/15 transition";
const textareaClass =
  "w-full min-h-[72px] px-3 py-2 rounded-lg border border-[#d8ecdd] bg-white text-sm text-[#390A5D] focus:outline-none focus:border-[#10662A] focus:ring-2 focus:ring-[#10662A]/15 transition";

function MyLeadsPage() {
  const [items, setItems] = useState<CrmPurchase[]>([]);
  const [stages, setStages] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeStage, setActiveStage] = useState<string>("all");
  const [selected, setSelected] = useState<CrmPurchase | null>(null);
  const [form, setForm] = useState<EditForm | null>(null);
  const [tab, setTab] = useState<"details" | "pipeline" | "notes">("details");
  const [noteText, setNoteText] = useState("");
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const data = await listMyLeads();
      setItems(data.items);
      setStages(data.stages);
      if (selected) {
        const fresh = data.items.find((p) => p.id === selected.id) ?? null;
        setSelected(fresh);
        if (fresh && !dirty) setForm(buildForm(fresh));
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load My Leads");
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    if (activeStage === "all") return items;
    return items.filter((p) => p.pipeline_stage === activeStage);
  }, [items, activeStage]);

  const openLead = (p: CrmPurchase) => {
    setSelected(p);
    setForm(buildForm(p));
    setDirty(false);
    setTab("details");
    setNoteText("");
  };

  const setLeadField = (key: string, value: string) => {
    setForm((prev) => (prev ? { ...prev, lead: { ...prev.lead, [key]: value } } : prev));
    setDirty(true);
  };

  const setDetailField = (key: string, value: string) => {
    setForm((prev) => (prev ? { ...prev, details: { ...prev.details, [key]: value } } : prev));
    setDirty(true);
  };

  const setPurchaseField = (key: "deal_value" | "next_followup_at", value: string) => {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
    setDirty(true);
  };

  const setExtra = (key: string, value: string) => {
    setForm((prev) => (prev ? { ...prev, extra: { ...prev.extra, [key]: value } } : prev));
    setDirty(true);
  };

  const applyLocal = (updated: CrmPurchase) => {
    setItems((prev) => prev.map((p) => (p.id === updated.id ? { ...p, ...updated } : p)));
    setSelected(updated);
    setForm(buildForm(updated));
    setDirty(false);
  };

  const fieldValue = (f: FormFieldDef): string => {
    if (!form) return "";
    if (f.source === "lead") return form.lead[f.key] ?? "";
    if (f.source === "details") return form.details[f.key] ?? "";
    if (f.key === "deal_value") return form.deal_value;
    if (f.key === "next_followup_at") return form.next_followup_at;
    return "";
  };

  const onFieldChange = (f: FormFieldDef, value: string) => {
    if (f.source === "lead") setLeadField(f.key, value);
    else if (f.source === "details") setDetailField(f.key, value);
    else if (f.key === "deal_value" || f.key === "next_followup_at") setPurchaseField(f.key, value);
  };

  const saveDetails = async () => {
    if (!selected || !form) return;
    setSaving(true);
    try {
      const product_details: Record<string, unknown> = { ...(selected.lead?.product_details || {}) };

      for (const [k, v] of Object.entries(form.details)) {
        const trimmed = v.trim();
        if (!trimmed) {
          delete product_details[k];
          continue;
        }
        if (["existingEmi", "calcMonthlyIncome", "interest_rate", "emi", "formMonthlyIncome"].includes(k)) {
          product_details[k] = Number(trimmed);
        } else {
          product_details[k] = trimmed;
        }
        // keep snake_case mirrors for older rows
        if (k === "motherName") product_details.mother_name = trimmed;
        if (k === "officialEmail") product_details.official_email = trimmed;
        if (k === "workExperience") product_details.work_experience = trimmed;
        if (k === "existingEmi") product_details.existing_emi = Number(trimmed);
        if (k === "loanType") product_details.loan_type = trimmed;
        if (k === "calcMonthlyIncome") product_details.calc_monthly_income = Number(trimmed);
      }

      for (const [k, v] of Object.entries(form.extra)) {
        const trimmed = v.trim();
        if (!trimmed) {
          delete product_details[k];
          continue;
        }
        try {
          product_details[k] = JSON.parse(trimmed);
        } catch {
          product_details[k] = trimmed;
        }
      }

      const L = form.lead;
      const updated = await patchMyLead(selected.id, {
        deal_value: form.deal_value === "" ? null : Number(form.deal_value),
        next_followup_at: form.next_followup_at ? new Date(form.next_followup_at).toISOString() : undefined,
        clear_followup: !form.next_followup_at,
        lead: {
          applicant_name: (L.applicant_name || "").trim(),
          full_phone: (L.full_phone || "").trim(),
          email: (L.email || "").trim() || null,
          city: (L.city || "").trim(),
          state: (L.state || "").trim() || null,
          company_name: (L.company_name || "").trim() || null,
          employment_type: L.employment_type || null,
          loan_amount: L.loan_amount === "" ? 0 : Number(L.loan_amount),
          monthly_income: L.monthly_income === "" ? null : Number(L.monthly_income),
          product_subtype: (L.product_subtype || "").trim() || null,
          score: L.score || "cold",
          product_details,
        },
      });
      applyLocal(updated);
      toast.success("Lead details saved — form auto-fill updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const moveStage = async (stage: string) => {
    if (!selected) return;
    setSaving(true);
    try {
      const updated = await patchMyLead(selected.id, { pipeline_stage: stage });
      applyLocal(updated);
      toast.success(`Pipeline → ${STAGE_LABELS[stage] ?? stage}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Stage update failed");
    } finally {
      setSaving(false);
    }
  };

  const advanceStage = async () => {
    if (!selected) return;
    const forward = stages.filter((s) => s !== "rejected");
    const fi = forward.indexOf(selected.pipeline_stage);
    if (fi < 0 || fi >= forward.length - 1) {
      toast.message("Already at final stage");
      return;
    }
    await moveStage(forward[fi + 1]);
  };

  const addNote = async () => {
    if (!selected || !noteText.trim()) return;
    setSaving(true);
    try {
      const updated = await patchMyLead(selected.id, { notes_text: noteText.trim() });
      applyLocal(updated);
      setNoteText("");
      toast.success("Note added");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add note");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5 max-w-7xl">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[#10662A] mb-1">
            <Layers className="size-3" /> Live pipeline CRM
          </div>
          <h1 className="font-display text-2xl font-extrabold text-[#390A5D] tracking-tight flex items-center gap-2">
            <KanbanSquare className="size-6 text-[#10662A]" />
            My Leads
          </h1>
          <p className="text-[#5c4d72] mt-0.5 text-sm max-w-xl">
            Edit form fields · New → Disbursed · notes & follow-ups
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/dashboard/leadboard"
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-[#d8ecdd] bg-white text-[#390A5D] text-sm font-semibold hover:bg-[#E8F7EC] hover:border-[#10662A]/35"
          >
            Leadboard
          </Link>
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex items-center gap-1.5 border border-[#d8ecdd] bg-white rounded-xl px-3 py-1.5 text-sm font-semibold text-[#390A5D] hover:bg-[#E8F7EC] cursor-pointer"
          >
            <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => setActiveStage("all")}
          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition cursor-pointer ${
            activeStage === "all"
              ? "bg-[#10662A] text-white border-[#10662A]"
              : "border-[#d8ecdd] bg-white text-[#5c4d72] hover:bg-[#E8F7EC] hover:border-[#10662A]/30"
          }`}
        >
          All ({items.length})
        </button>
        {stages.map((s) => {
          const count = items.filter((p) => p.pipeline_stage === s).length;
          return (
            <button
              key={s}
              type="button"
              onClick={() => setActiveStage(s)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition cursor-pointer ${
                activeStage === s
                  ? "bg-[#10662A] text-white border-[#10662A]"
                  : "border-[#d8ecdd] bg-white text-[#5c4d72] hover:bg-[#E8F7EC] hover:border-[#10662A]/30"
              }`}
            >
              {STAGE_LABELS[s] ?? s} ({count})
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-[#d8ecdd] bg-white p-3.5 animate-pulse space-y-2.5">
              <div className="h-4 w-24 rounded bg-[#E8F7EC]" />
              <div className="h-3 w-32 rounded bg-[#f5fcf7]" />
              <div className="grid grid-cols-2 gap-1.5">
                <div className="h-9 rounded-lg bg-[#f5fcf7]" />
                <div className="h-9 rounded-lg bg-[#f5fcf7]" />
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#d8ecdd] bg-white p-10 text-center text-[#5c4d72] text-sm">
          No purchased leads yet. Go to{" "}
          <Link to="/dashboard/leadboard" className="text-[#10662A] font-bold hover:underline">
            Leadboard
          </Link>{" "}
          and click Buy.
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {filtered.map((p) => {
            const lead = p.lead;
            const sm = scoreMeta(lead?.score || "cold");
            const ScoreIcon = sm.Icon;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => openLead(p)}
                className="text-left rounded-xl border border-[#d8ecdd] bg-white p-3.5 shadow-[0_2px_8px_rgba(16,102,42,0.04)] hover:border-[#10662A]/35 hover:shadow-[0_10px_24px_rgba(16,102,42,0.1)] hover:-translate-y-0.5 transition-all group flex flex-col gap-2.5 cursor-pointer"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-display font-bold text-[15px] text-[#390A5D] truncate group-hover:text-[#10662A] transition-colors leading-tight">
                      {lead?.applicant_name ?? "Lead"}
                    </div>
                    <div className="text-[11px] text-[#5c4d72] flex items-center gap-1.5 mt-0.5 flex-wrap">
                      <span className="inline-flex items-center gap-0.5">
                        <MapPin className="size-3" /> {lead?.city || "—"}
                      </span>
                      <span className="text-[#d8ecdd]">·</span>
                      <span className="inline-flex items-center gap-0.5 font-medium text-[#390A5D]">
                        <Phone className="size-3" /> {lead?.full_phone || "—"}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span
                      className={`text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-md border inline-flex items-center gap-0.5 ${sm.className}`}
                    >
                      <ScoreIcon className="size-2.5" />
                      {sm.label}
                    </span>
                    <span className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-md bg-[#E8F7EC] text-[#10662A] border border-[#d8ecdd]">
                      {gradeText(gradeFromPipeline(p.pipeline_stage) || gradeCode({ ...lead, pipeline_stage: p.pipeline_stage, full_phone: lead?.full_phone }))}
                    </span>
                    <span className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-md bg-white text-[#5c4d72] border border-[#d8ecdd]">
                      {STAGE_LABELS[p.pipeline_stage] ?? p.pipeline_stage}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-1.5">
                  <div className="rounded-lg bg-[#f5fcf7] border border-[#d8ecdd] px-2 py-1.5">
                    <div className="text-[9px] uppercase tracking-wide font-semibold text-[#5c4d72]">Ticket</div>
                    <div className="text-xs font-bold text-[#390A5D] truncate">
                      ₹{Number(lead?.loan_amount || 0).toLocaleString("en-IN")}
                    </div>
                  </div>
                  <div className="rounded-lg bg-[#f5fcf7] border border-[#d8ecdd] px-2 py-1.5">
                    <div className="text-[9px] uppercase tracking-wide font-semibold text-[#5c4d72]">Product</div>
                    <div className="text-xs font-bold text-[#390A5D] truncate capitalize">
                      {lead?.product_subtype || lead?.product_category || "—"}
                    </div>
                  </div>
                </div>

                {lead?.email && (
                  <div className="text-[11px] text-[#5c4d72] flex items-center gap-1 truncate">
                    <Mail className="size-3 shrink-0" />
                    <span className="truncate">{lead.email}</span>
                  </div>
                )}

                <div className="flex items-center justify-between pt-0.5 mt-auto border-t border-[#d8ecdd]/80 pt-2">
                  <span className="text-[10px] text-[#5c4d72] inline-flex items-center gap-1">
                    <Clock className="size-3" />
                    {p.next_followup_at
                      ? `Follow-up ${new Date(p.next_followup_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`
                      : "No follow-up"}
                  </span>
                  <span className="inline-flex items-center gap-0.5 text-[#10662A] font-bold text-[11px]">
                    Edit CRM <ChevronRight className="size-3.5" />
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {selected && form && (
        <div className="fixed inset-0 z-50 bg-black/45 backdrop-blur-[2px] grid place-items-center p-2 sm:p-4">
          <div className="w-full max-w-6xl max-h-[94vh] overflow-hidden rounded-2xl border border-[#d8ecdd] bg-[#f5fcf7] shadow-[0_24px_60px_rgba(16,102,42,0.18)] flex flex-col">
            {/* Header */}
            <div className="border-b border-[#d8ecdd] bg-white px-4 sm:px-5 py-3.5 flex items-start justify-between gap-3 shrink-0">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="font-display text-lg font-extrabold text-[#390A5D] truncate">
                    {form.lead.applicant_name || "Lead"}
                  </h2>
                  {selected.converted && (
                    <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 inline-flex items-center gap-1">
                      <CheckCircle2 className="size-3" /> Converted
                    </span>
                  )}
                  <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-md bg-[#E8F7EC] text-[#10662A] border border-[#d8ecdd]">
                    {STAGE_LABELS[selected.pipeline_stage] ?? selected.pipeline_stage}
                  </span>
                  {dirty && (
                    <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200">
                      Unsaved
                    </span>
                  )}
                </div>
                <p className="text-xs text-[#5c4d72] mt-0.5">
                  {selected.lead?.product_subtype || selected.lead?.product_category || "Loan"} · Paid ₹
                  {Number(selected.price_paid || 0).toLocaleString("en-IN")}
                  {selected.lead?.product_details?.lead_id
                    ? ` · ${String(selected.lead.product_details.lead_id)}`
                    : ""}
                </p>
                <div className="flex flex-wrap gap-1.5 mt-2.5">
                  <a
                    href={`tel:${form.lead.full_phone || ""}`}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#10662A] text-white px-2.5 py-1.5 text-xs font-semibold hover:bg-[#0D4F20]"
                  >
                    <Phone className="size-3.5" /> Call
                  </a>
                  <a
                    href={`https://wa.me/${(form.lead.full_phone || "").replace(/\D/g, "")}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[#d8ecdd] bg-white px-2.5 py-1.5 text-xs font-semibold text-[#390A5D] hover:bg-[#E8F7EC]"
                  >
                    <MessageCircle className="size-3.5" /> WhatsApp
                  </a>
                  {form.lead.email && (
                    <a
                      href={`mailto:${form.lead.email}`}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-[#d8ecdd] bg-white px-2.5 py-1.5 text-xs font-semibold text-[#390A5D] hover:bg-[#E8F7EC]"
                    >
                      <Mail className="size-3.5" /> Email
                    </a>
                  )}
                  <button
                    type="button"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[#d8ecdd] bg-white px-2.5 py-1.5 text-xs font-semibold text-[#390A5D] hover:bg-[#E8F7EC] cursor-pointer"
                    onClick={async () => {
                      await navigator.clipboard.writeText(form.lead.full_phone || "");
                      toast.success("Phone copied");
                    }}
                  >
                    <Copy className="size-3.5" /> Copy
                  </button>
                  <button
                    type="button"
                    disabled={saving || selected.pipeline_stage === "disbursed" || selected.pipeline_stage === "rejected"}
                    onClick={() => void advanceStage()}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#390A5D] text-white px-2.5 py-1.5 text-xs font-semibold disabled:opacity-40 hover:bg-[#2d0848] cursor-pointer"
                  >
                    Next stage <ArrowRight className="size-3.5" />
                  </button>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (dirty && !confirm("Discard unsaved changes?")) return;
                  setSelected(null);
                  setForm(null);
                  setDirty(false);
                }}
                className="rounded-lg p-2 hover:bg-[#E8F7EC] text-[#5c4d72] cursor-pointer shrink-0"
              >
                <X className="size-5" />
              </button>
            </div>

            {/* Tabs */}
            <div className="border-b border-[#d8ecdd] px-4 sm:px-5 flex gap-0.5 bg-white shrink-0">
              {(
                [
                  ["details", "Details", FileText],
                  ["pipeline", "Pipeline", Activity],
                  ["notes", "Notes", StickyNote],
                ] as const
              ).map(([id, label, Icon]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTab(id)}
                  className={`px-3.5 py-2.5 text-sm font-semibold border-b-2 -mb-px inline-flex items-center gap-1.5 cursor-pointer transition-colors ${
                    tab === id
                      ? "border-[#10662A] text-[#10662A]"
                      : "border-transparent text-[#5c4d72] hover:text-[#390A5D]"
                  }`}
                >
                  <Icon className="size-3.5" /> {label}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-5">
              {tab === "details" && (
                <div className="space-y-4 pb-16">
                  <p className="text-xs text-[#5c4d72]">
                    Website form auto-fill — edit any field, then Save. Pipeline: New → Disbursed.
                  </p>

                  {CRM_FORM_SECTIONS.map((section) => (
                    <div
                      key={section.id}
                      className="rounded-xl border border-[#d8ecdd] bg-white p-4 shadow-[0_2px_10px_rgba(16,102,42,0.04)] space-y-3"
                    >
                      <div className="flex items-center gap-2 text-sm font-bold text-[#390A5D]">
                        <div className="size-7 rounded-lg bg-[#E8F7EC] grid place-items-center">
                          <Building2 className="size-3.5 text-[#10662A]" />
                        </div>
                        {section.title}
                      </div>
                      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {section.fields.map((f) => {
                          const val = fieldValue(f);
                          const inputType =
                            f.key === "next_followup_at"
                              ? "datetime-local"
                              : f.type === "number"
                                ? "number"
                                : f.type === "email"
                                  ? "email"
                                  : f.type === "tel"
                                    ? "tel"
                                    : "text";
                          return (
                            <Field key={`${section.id}-${f.key}`} label={f.label}>
                              {f.type === "select" && f.options ? (
                                <select
                                  className={inputClass}
                                  value={val}
                                  onChange={(e) => onFieldChange(f, e.target.value)}
                                >
                                  <option value="">Select</option>
                                  {f.options.map((o) => (
                                    <option key={o} value={o}>
                                      {f.key === "score" ? o.toUpperCase() : o}
                                    </option>
                                  ))}
                                </select>
                              ) : f.type === "textarea" ? (
                                <textarea
                                  className={textareaClass}
                                  value={val}
                                  onChange={(e) => onFieldChange(f, e.target.value)}
                                />
                              ) : (
                                <input
                                  className={inputClass}
                                  type={inputType}
                                  value={val}
                                  onChange={(e) => onFieldChange(f, e.target.value)}
                                />
                              )}
                            </Field>
                          );
                        })}
                      </div>
                    </div>
                  ))}

                  {banksFromLead(selected.lead).length > 0 && (
                    <div className="rounded-xl border border-[#d8ecdd] bg-white p-4 shadow-[0_2px_10px_rgba(16,102,42,0.04)] space-y-3">
                      <div className="text-sm font-bold text-[#390A5D]">Selected banks</div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-left text-[10px] uppercase text-[#5c4d72] border-b border-[#d8ecdd]">
                              <th className="py-2 pr-3 font-semibold">Bank</th>
                              <th className="py-2 pr-3 font-semibold">Rate %</th>
                              <th className="py-2 font-semibold">EMI ₹</th>
                            </tr>
                          </thead>
                          <tbody>
                            {banksFromLead(selected.lead).map((b, i) => (
                              <tr key={i} className="border-b border-[#d8ecdd]/70">
                                <td className="py-2 pr-3 font-medium text-[#390A5D]">
                                  {String(b.bankName ?? b.bank_name ?? "—")}
                                </td>
                                <td className="py-2 pr-3 text-[#5c4d72]">
                                  {String(b.interestRate ?? b.interest_rate ?? "—")}
                                </td>
                                <td className="py-2 text-[#5c4d72]">{String(b.emi ?? "—")}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {Object.keys(docsFromLead(selected.lead)).length > 0 && (
                    <div className="rounded-xl border border-[#d8ecdd] bg-white p-4 shadow-[0_2px_10px_rgba(16,102,42,0.04)] space-y-3">
                      <div className="flex items-center gap-2 text-sm font-bold text-[#390A5D]">
                        <FileText className="size-4 text-[#10662A]" /> Documents
                      </div>
                      <div className="space-y-2">
                        {Object.entries(docsFromLead(selected.lead)).map(([type, urls]) =>
                          urls.length === 0 ? null : (
                            <div key={type}>
                              <div className="text-[10px] font-bold uppercase text-[#5c4d72] mb-1">{type}</div>
                              <div className="flex flex-wrap gap-2">
                                {urls.map((u, i) => (
                                  <a
                                    key={i}
                                    href={u}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-xs font-semibold text-[#10662A] underline underline-offset-2"
                                  >
                                    Open {i + 1}
                                  </a>
                                ))}
                              </div>
                            </div>
                          ),
                        )}
                      </div>
                    </div>
                  )}

                  {Object.keys(form.extra).length > 0 && (
                    <div className="rounded-xl border border-[#d8ecdd] bg-white p-4 shadow-[0_2px_10px_rgba(16,102,42,0.04)] space-y-3">
                      <div className="text-sm font-bold text-[#390A5D]">Other form fields</div>
                      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {Object.entries(form.extra).map(([k, v]) => (
                          <Field key={k} label={formatLabel(k)}>
                            <input
                              className={inputClass}
                              value={v}
                              onChange={(e) => setExtra(k, e.target.value)}
                            />
                          </Field>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="sticky bottom-0 -mx-4 sm:-mx-5 px-4 sm:px-5 py-3 bg-gradient-to-t from-[#f5fcf7] via-[#f5fcf7] to-transparent flex items-center justify-between gap-3">
                    <span className="text-xs text-[#5c4d72]">
                      {dirty ? "You have unsaved changes" : "All changes saved"}
                    </span>
                    <button
                      type="button"
                      disabled={saving || !dirty}
                      onClick={() => void saveDetails()}
                      className="inline-flex items-center gap-2 rounded-xl bg-[#10662A] text-white px-5 py-2.5 text-sm font-semibold disabled:opacity-45 hover:bg-[#0D4F20] cursor-pointer shadow-[0_6px_16px_rgba(16,102,42,0.2)]"
                    >
                      {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                      Save all details
                    </button>
                  </div>
                </div>
              )}

              {tab === "pipeline" && (
                <div className="grid lg:grid-cols-[1fr_0.85fr] gap-4">
                  <div className="rounded-xl border border-[#d8ecdd] bg-white p-4 shadow-[0_2px_10px_rgba(16,102,42,0.04)] space-y-3">
                    <div className="text-sm font-bold text-[#390A5D]">Stage timeline</div>
                    <p className="text-xs text-[#5c4d72] -mt-1">Click any stage to move · New → Disbursed</p>
                    <ol className="space-y-2">
                      {stages.map((s, i) => {
                        const forward = stages.filter((x) => x !== "rejected");
                        const currentIdx = forward.indexOf(selected.pipeline_stage);
                        const stageIdx = forward.indexOf(s);
                        const done =
                          selected.pipeline_stage === "rejected"
                            ? s === "rejected"
                            : stageIdx >= 0 && currentIdx >= 0 && stageIdx <= currentIdx;
                        const active = s === selected.pipeline_stage;
                        return (
                          <li key={s}>
                            <button
                              type="button"
                              disabled={saving}
                              onClick={() => void moveStage(s)}
                              className={`w-full text-left rounded-xl border px-3.5 py-2.5 flex items-center gap-3 transition cursor-pointer ${
                                active
                                  ? "border-[#10662A] bg-[#E8F7EC]"
                                  : done
                                    ? "border-[#d8ecdd] bg-[#f5fcf7]"
                                    : "border-[#d8ecdd] bg-white hover:bg-[#f5fcf7]"
                              }`}
                            >
                              <span
                                className={`size-7 rounded-full grid place-items-center text-xs font-bold shrink-0 ${
                                  active
                                    ? "bg-[#10662A] text-white"
                                    : done
                                      ? "bg-[#10662A]/20 text-[#10662A]"
                                      : "bg-[#E8F7EC] text-[#5c4d72]"
                                }`}
                              >
                                {done && !active ? <CheckCircle2 className="size-3.5" /> : i + 1}
                              </span>
                              <div className="min-w-0">
                                <div className={`font-semibold text-sm ${active ? "text-[#10662A]" : "text-[#390A5D]"}`}>
                                  {STAGE_LABELS[s] ?? s}
                                </div>
                                <div className="text-[11px] text-[#5c4d72]">
                                  {active ? "Current stage" : done ? "Completed" : "Click to jump"}
                                </div>
                              </div>
                            </button>
                          </li>
                        );
                      })}
                    </ol>
                  </div>
                  <div className="space-y-3">
                    <div className="rounded-xl border border-[#d8ecdd] bg-white p-4 shadow-[0_2px_10px_rgba(16,102,42,0.04)] space-y-3">
                      <div className="flex items-center gap-2 text-sm font-bold text-[#390A5D]">
                        <CalendarClock className="size-4 text-[#10662A]" /> Follow-up & deal
                      </div>
                      <Field label="Next follow-up">
                        <input
                          className={inputClass}
                          type="datetime-local"
                          value={form.next_followup_at}
                          onChange={(e) => setPurchaseField("next_followup_at", e.target.value)}
                        />
                      </Field>
                      <Field label="Deal value (₹)">
                        <input
                          className={inputClass}
                          type="number"
                          value={form.deal_value}
                          onChange={(e) => setPurchaseField("deal_value", e.target.value)}
                        />
                      </Field>
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => void saveDetails()}
                        className="w-full rounded-xl bg-[#10662A] text-white py-2.5 text-sm font-semibold hover:bg-[#0D4F20] cursor-pointer disabled:opacity-50"
                      >
                        {saving ? <Loader2 className="size-4 animate-spin inline mr-1.5" /> : null}
                        Save follow-up
                      </button>
                      <button
                        type="button"
                        disabled={saving || selected.pipeline_stage === "disbursed" || selected.pipeline_stage === "rejected"}
                        onClick={() => void advanceStage()}
                        className="w-full rounded-xl border border-[#d8ecdd] py-2.5 text-sm font-semibold text-[#390A5D] inline-flex items-center justify-center gap-2 hover:bg-[#E8F7EC] cursor-pointer disabled:opacity-40"
                      >
                        Advance to next stage <ArrowRight className="size-4" />
                      </button>
                      <button
                        type="button"
                        disabled={saving || selected.pipeline_stage === "rejected"}
                        onClick={() => void moveStage("rejected")}
                        className="w-full rounded-xl border border-red-200 text-red-600 py-2.5 text-sm font-semibold hover:bg-red-50 cursor-pointer disabled:opacity-40"
                      >
                        Mark rejected
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {tab === "notes" && (
                <div className="max-w-2xl space-y-3">
                  <div className="space-y-2 max-h-72 overflow-y-auto">
                    {(selected.notes || []).length === 0 ? (
                      <div className="rounded-xl border border-dashed border-[#d8ecdd] bg-white p-6 text-center text-sm text-[#5c4d72]">
                        No activity yet — add a call note or update.
                      </div>
                    ) : (
                      [...(selected.notes || [])].reverse().map((n, i) => (
                        <div
                          key={i}
                          className="rounded-xl border border-[#d8ecdd] bg-white px-3.5 py-2.5 text-sm shadow-[0_2px_8px_rgba(16,102,42,0.03)]"
                        >
                          <div className="text-[10px] text-[#5c4d72] flex items-center gap-1 font-semibold">
                            <Clock className="size-3" />
                            {new Date(n.at).toLocaleString("en-IN")}
                            {n.by ? ` · ${n.by}` : ""}
                            {n.kind ? ` · ${n.kind}` : ""}
                          </div>
                          <div className="mt-1 text-[#390A5D]">{n.text}</div>
                        </div>
                      ))
                    )}
                  </div>
                  <textarea
                    className={textareaClass + " min-h-[100px]"}
                    placeholder="Call summary, docs pending, banker update…"
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                  />
                  <button
                    type="button"
                    disabled={saving || !noteText.trim()}
                    onClick={() => void addNote()}
                    className="rounded-xl bg-[#10662A] text-white px-5 py-2.5 text-sm font-semibold disabled:opacity-45 hover:bg-[#0D4F20] cursor-pointer"
                  >
                    {saving ? <Loader2 className="size-4 animate-spin inline mr-1.5" /> : null}
                    Add note
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
