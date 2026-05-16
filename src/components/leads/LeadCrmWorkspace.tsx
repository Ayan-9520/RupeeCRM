import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import {
  Loader2,
  Phone,
  X,
  MessageSquare,
  Copy,
  CheckCircle2,
  Clock,
  ChevronRight,
  StickyNote,
  CalendarClock,
  Trophy,
  IndianRupee,
  FileText,
  Mail,
  Send,
  Upload,
  User as UserIcon,
  Briefcase,
  CreditCard,
  Activity,
  FolderOpen,
  Target,
  Download,
  AlertCircle,
  Wallet,
  Shield,
  Landmark,
  ClipboardList,
  Pencil,
  Check,
} from "lucide-react";
import { CATEGORY_META, calcCommission, type Pipeline, type ProductCategory, type ProductType } from "@/lib/products";
import type { Json } from "@/integrations/supabase/types";
import {
  CRM_SECTIONS,
  extractApplicationDraft,
  formatDisplayValue,
  getCrmFieldValue,
  parseCrmFieldValue,
  type CrmFieldDef,
  type LeadCrmLead,
} from "@/lib/lead-crm-fields";

type Note = { at: string; text: string; by?: string; kind?: string };

export type CrmPurchase = {
  id: string;
  lead_id?: string;
  pipeline_stage: string;
  price_paid: number;
  created_at: string;
  updated_at: string;
  notes: Note[];
  next_followup_at: string | null;
  converted: boolean;
  deal_value: number;
  crm_profile?: Record<string, unknown>;
  leads: LeadCrmLead | null;
};

type CaseDoc = {
  id: string;
  doc_type: string;
  file_name: string;
  file_url: string;
  file_size: number | null;
  mime_type: string | null;
  uploaded_by: string;
  created_at: string;
};

type StatusLog = {
  id: string;
  from_stage: string | null;
  to_stage: string;
  notes: string | null;
  created_at: string;
  changed_by: string | null;
};

const DOC_TYPES: { value: string; label: string }[] = [
  { value: "pan", label: "PAN Card" },
  { value: "aadhaar", label: "Aadhaar" },
  { value: "bank_statement", label: "Bank Statement" },
  { value: "salary_slip", label: "Salary Slip" },
  { value: "itr", label: "ITR" },
  { value: "selfie", label: "Selfie" },
  { value: "address_proof", label: "Address Proof" },
  { value: "other", label: "Other" },
];

const SECTION_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  personal: UserIcon,
  employment: Briefcase,
  banking: Landmark,
  loan: CreditCard,
  kyc: Shield,
  processing: ClipboardList,
  documents: FolderOpen,
  notes: StickyNote,
};

type TabId = "crm" | "pipeline" | "documents" | "notes" | "commission";

export function LeadCrmWorkspace({
  purchase,
  pipeline,
  productType,
  onClose,
  onUpdate,
  onLeadPatch,
  onCrmProfilePatch,
}: {
  purchase: CrmPurchase;
  pipeline?: Pipeline;
  productType?: ProductType;
  onClose: () => void;
  onUpdate: (
    id: string,
    patch: Partial<Pick<CrmPurchase, "pipeline_stage" | "next_followup_at" | "converted" | "deal_value">> & {
      notes?: Note[];
    },
  ) => Promise<boolean>;
  onLeadPatch: (leadId: string, patch: Partial<LeadCrmLead>) => void;
  onCrmProfilePatch: (purchaseId: string, profile: Record<string, unknown>) => void;
}) {
  const { user } = useAuth();
  const lead = purchase.leads;
  const [tab, setTab] = useState<TabId>("crm");
  const [crmProfile, setCrmProfile] = useState<Record<string, unknown>>(purchase.crm_profile ?? {});
  const [crmSection, setCrmSection] = useState("personal");
  const [commissions, setCommissions] = useState<
    { id: string; amount: number; percentage: number; base_amount: number; status: string; created_at: string; credited_at: string | null }[]
  >([]);
  const [disbursals, setDisbursals] = useState<
    {
      id: string;
      lender_name: string | null;
      loan_account_no: string | null;
      disbursed_amount: number;
      commission_amount: number;
      status: string;
      disbursed_at: string | null;
      created_at: string;
    }[]
  >([]);
  const [noteText, setNoteText] = useState("");
  const [followup, setFollowup] = useState(purchase.next_followup_at?.slice(0, 10) ?? "");
  const [dealValue, setDealValue] = useState<string>(String(purchase.deal_value || lead?.loan_amount || 0));
  const [busy, setBusy] = useState(false);
  const [docs, setDocs] = useState<CaseDoc[]>([]);
  const [logs, setLogs] = useState<StatusLog[]>([]);
  const [docType, setDocType] = useState("pan");
  const [uploading, setUploading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [savingField, setSavingField] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
    setCrmProfile(purchase.crm_profile ?? {});
  }, [purchase.id, purchase.crm_profile]);

  const draft = useMemo(() => extractApplicationDraft(purchase.notes), [purchase.notes]);

  const loadAux = async () => {
    const [d, l, c, ds] = await Promise.all([
      supabase
        .from("case_documents")
        .select("id,doc_type,file_name,file_url,file_size,mime_type,uploaded_by,created_at")
        .eq("lead_purchase_id", purchase.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("case_status_logs")
        .select("id,from_stage,to_stage,notes,created_at,changed_by")
        .eq("lead_purchase_id", purchase.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("commissions")
        .select("id,amount,percentage,base_amount,status,created_at,credited_at")
        .eq("lead_purchase_id", purchase.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("disbursals")
        .select("id,lender_name,loan_account_no,disbursed_amount,commission_amount,status,disbursed_at,created_at")
        .eq("lead_purchase_id", purchase.id)
        .order("created_at", { ascending: false }),
    ]);
    setDocs((d.data as CaseDoc[]) ?? []);
    setLogs((l.data as StatusLog[]) ?? []);
    setCommissions((c.data as typeof commissions) ?? []);
    setDisbursals((ds.data as typeof disbursals) ?? []);
  };

  useEffect(() => {
    loadAux(); /* eslint-disable-next-line */
  }, [purchase.id]);

  if (!lead) return null;

  const meta = CATEGORY_META[lead.product_category as ProductCategory];
  const phoneDigits = lead.full_phone.replace(/[^\d]/g, "");
  const waLink = `https://wa.me/${phoneDigits}`;
  const callLink = `tel:${lead.full_phone}`;
  const smsLink = `sms:${lead.full_phone}`;
  const emailLink = lead.email ? `mailto:${lead.email}` : null;
  const visibleNotes = purchase.notes.filter((n) => !n.kind);

  const saveCrmField = async (field: CrmFieldDef, value: string) => {
    const parsed = parseCrmFieldValue(field, value);
    const empty = parsed === "" || parsed === null;
    setSavingField(field.key);
    try {
      if (field.storage === "leads") {
        const patch = { [field.key]: empty ? null : parsed };
        const { error } = await supabase.from("leads").update(patch as never).eq("id", lead.id);
        if (error) throw error;
        onLeadPatch(lead.id, patch as Partial<LeadCrmLead>);
        toast.success(`${field.label} saved`);
      } else if (field.storage === "product_details") {
        const next = { ...lead.product_details };
        if (empty) delete next[field.key];
        else next[field.key] = parsed;
        const { error } = await supabase
          .from("leads")
          .update({ product_details: next as Json })
          .eq("id", lead.id);
        if (error) throw error;
        onLeadPatch(lead.id, { product_details: next });
        toast.success(`${field.label} saved`);
      } else {
        const next = { ...crmProfile };
        if (empty) delete next[field.key];
        else next[field.key] = parsed;
        const { error } = await supabase
          .from("lead_purchases")
          .update({ crm_profile: next as Json } as never)
          .eq("id", purchase.id);
        if (error) throw error;
        setCrmProfile(next);
        onCrmProfilePatch(purchase.id, next);
        toast.success(`${field.label} saved`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSavingField(null);
    }
  };

  const addNote = async () => {
    const txt = noteText.trim();
    if (!txt) return;
    setBusy(true);
    const updated: Note[] = [...purchase.notes, { at: new Date().toISOString(), text: txt, by: user?.email ?? undefined }];
    const ok = await onUpdate(purchase.id, { notes: updated });
    setBusy(false);
    if (ok) {
      setNoteText("");
      toast.success("Note added");
    }
  };

  const moveStage = async (key: string) => {
    if (key === purchase.pipeline_stage) return;
    setBusy(true);
    const ok = await onUpdate(purchase.id, { pipeline_stage: key });
    if (ok && purchase.lead_id && user) {
      await supabase.from("case_status_logs").insert({
        lead_purchase_id: purchase.id,
        lead_id: purchase.lead_id,
        from_stage: purchase.pipeline_stage,
        to_stage: key,
        changed_by: user.id,
      } as never);
      loadAux();
    }
    setBusy(false);
    if (ok) toast.success("Stage updated");
  };

  const saveFollowup = async () => {
    setBusy(true);
    const ok = await onUpdate(purchase.id, { next_followup_at: followup ? new Date(followup).toISOString() : null });
    setBusy(false);
    if (ok) toast.success(followup ? "Follow-up set" : "Follow-up cleared");
  };

  const markConverted = async (won: boolean) => {
    setBusy(true);
    const ok = await onUpdate(purchase.id, { converted: won, deal_value: Number(dealValue) || 0 });
    setBusy(false);
    if (ok) toast.success(won ? "Marked as converted" : "Reverted");
  };

  const copyText = async (text: string, label: string) => {
    await navigator.clipboard.writeText(text);
    toast.success(`${label} copied`);
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user || !purchase.lead_id) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error("File too large (max 10MB)");
      return;
    }
    setUploading(true);
    try {
      const path = `${user.id}/${purchase.id}/${Date.now()}-${file.name}`;
      const { error: upErr } = await supabase.storage.from("case-documents").upload(path, file);
      if (upErr) throw upErr;
      const { data: signed } = await supabase.storage.from("case-documents").createSignedUrl(path, 60 * 60 * 24 * 365);
      const { error: insErr } = await supabase.from("case_documents").insert({
        lead_purchase_id: purchase.id,
        lead_id: purchase.lead_id,
        uploaded_by: user.id,
        doc_type: docType,
        file_name: file.name,
        file_url: signed?.signedUrl || path,
        file_size: file.size,
        mime_type: file.type,
      });
      if (insErr) throw insErr;
      toast.success("Document uploaded");
      e.target.value = "";
      loadAux();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const commission = productType ? calcCommission(productType, Number(dealValue) || lead.loan_amount) : 0;
  const followUpDate = purchase.next_followup_at ? new Date(purchase.next_followup_at) : null;
  const overdue = followUpDate ? followUpDate.getTime() < Date.now() : false;

  type TimelineItem = { at: string; type: string; text: string; by?: string };
  const timeline: TimelineItem[] = [
    { at: purchase.created_at, type: "purchased", text: `Lead purchased for ₹${purchase.price_paid}` },
    ...logs.map((l) => ({
      at: l.created_at,
      type: "stage",
      text: `Stage: ${l.from_stage ? `${l.from_stage} → ` : ""}${l.to_stage}`,
    })),
    ...purchase.notes.map((n) => ({
      at: n.at,
      type: n.kind ?? "note",
      text: n.text,
      by: n.by,
    })),
  ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  const crmNav = [
    ...CRM_SECTIONS.map((s) => ({ id: s.id, label: s.title })),
    { id: "documents", label: "Documents" },
    { id: "notes", label: "Notes & Follow-up" },
  ];

  return (
    <CrmBackdrop mounted={mounted} onClose={onClose}>
      <div
        className={`bg-card border border-border shadow-elevated w-full sm:max-w-[1400px] h-full sm:h-[94vh] sm:rounded-2xl overflow-hidden flex flex-col transition-all duration-200 ${
          mounted ? "scale-100 opacity-100" : "scale-95 opacity-0"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="border-b border-border bg-gradient-to-br from-card via-card to-secondary/30 p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <CrmHeaderLead
              lead={lead}
              meta={meta}
              productType={productType}
              pipeline={pipeline}
              purchase={purchase}
              overdue={overdue}
              followUpDate={followUpDate}
            />
            <button onClick={onClose} className="size-9 rounded-full grid place-items-center hover:bg-secondary shrink-0" aria-label="Close">
              <X className="size-4" />
            </button>
          </div>
          <div className="mt-4 grid grid-cols-3 sm:grid-cols-7 gap-2">
            <ActionBtn href={callLink} icon={Phone} label="Call" tone="accent" />
            <ActionBtn href={waLink} target="_blank" icon={MessageSquare} label="WhatsApp" tone="emerald" />
            <ActionBtn href={smsLink} icon={Send} label="SMS" tone="default" />
            <ActionBtn href={emailLink ?? undefined} icon={Mail} label="Email" tone="default" disabled={!emailLink} />
            <ActionBtn onClick={() => copyText(lead.full_phone, "Phone")} icon={Copy} label="Copy #" tone="default" />
            <ActionBtn onClick={() => setTab("crm")} icon={FileText} label="CRM" tone="default" />
            <Link
              to="/dashboard/my-leads/$id/apply"
              params={{ id: purchase.id }}
              className="flex flex-col items-center gap-1 py-2.5 rounded-xl bg-gradient-to-br from-accent to-accent/70 text-accent-foreground font-semibold text-[11px] hover:opacity-90 transition"
            >
              <FileText className="size-4" />
              Apply
            </Link>
          </div>
        </div>

        {/* Tabs */}
        <CrmTabs tab={tab} setTab={setTab} docsCount={docs.length} notesCount={visibleNotes.length} />

        <div className="flex-1 overflow-y-auto">
          {tab === "crm" && (
            <CrmLayout>
              <nav className="lg:w-52 shrink-0 flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible pb-2 lg:pb-0 lg:sticky lg:top-0 lg:self-start">
                {crmNav.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => {
                      setCrmSection(s.id);
                      document.getElementById(`crm-section-${s.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
                    }}
                    className={`text-left text-xs font-semibold px-3 py-2 rounded-lg whitespace-nowrap transition ${
                      crmSection === s.id ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-secondary"
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </nav>

              <CrmSections>
                {CRM_SECTIONS.map((section) => {
                  const Icon = SECTION_ICONS[section.id] ?? UserIcon;
                  return (
                    <section key={section.id} id={`crm-section-${section.id}`} className="scroll-mt-4">
                      <CrmSectionCard title={section.title} icon={Icon}>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {section.fields.map((field) => (
                            <CrmFieldRow
                              key={field.key}
                              field={field}
                              value={getCrmFieldValue(field, lead, crmProfile, draft)}
                              display={formatDisplayValue(field, getCrmFieldValue(field, lead, crmProfile, draft))}
                              saving={savingField === field.key}
                              onSave={(v) => saveCrmField(field, v)}
                              onCopy={field.key === "full_phone" || field.key === "email" ? copyText : undefined}
                            />
                          ))}
                        </div>
                        {section.id === "personal" && (
                          <div className="mt-4 grid sm:grid-cols-3 gap-2 text-xs">
                            <MetaChip label="Lead score" value={lead.score} />
                            <MetaChip label="Source" value={lead.source ?? "—"} />
                            <MetaChip label="Phone verified" value={lead.phone_verified === true ? "Yes" : lead.phone_verified === false ? "No" : "—"} />
                            {lead.quality_score != null && <MetaChip label="Quality" value={String(lead.quality_score)} />}
                            {lead.fraud_risk ? <MetaChip label="Fraud risk" value={lead.fraud_risk} /> : null}
                          </div>
                        )}
                        {section.id === "loan" && lead.notes && (
                          <div className="mt-4 rounded-xl border border-border bg-secondary/30 p-3 text-sm">
                            <div className="text-[10px] font-bold uppercase text-muted-foreground mb-1">Customer note</div>
                            <p className="whitespace-pre-wrap">{lead.notes}</p>
                          </div>
                        )}
                      </CrmSectionCard>
                    </section>
                  );
                })}

                <section id="crm-section-documents" className="scroll-mt-4">
                  <CrmSectionCard title="Documents" icon={FolderOpen}>
                    <p className="text-xs text-muted-foreground mb-3">
                      KYC and income proofs. {docs.length} file{docs.length !== 1 ? "s" : ""} on record.
                    </p>
                    <button
                      type="button"
                      onClick={() => setTab("documents")}
                      className="text-xs font-semibold text-accent inline-flex items-center gap-1 mb-3"
                    >
                      Open documents tab <ChevronRight className="size-3" />
                    </button>
                    {docs.length > 0 && (
                      <ul className="space-y-2">
                        {docs.slice(0, 4).map((d) => (
                          <li key={d.id} className="flex items-center gap-2 text-sm border border-border rounded-lg p-2">
                            <FileText className="size-4 text-accent shrink-0" />
                            <span className="truncate flex-1">{d.file_name}</span>
                            <a href={d.file_url} target="_blank" rel="noopener" className="text-xs text-accent font-semibold">
                              Open
                            </a>
                          </li>
                        ))}
                      </ul>
                    )}
                  </CrmSectionCard>
                </section>

                <section id="crm-section-notes" className="scroll-mt-4">
                  <CrmSectionCard title="Notes & Follow-up" icon={StickyNote}>
                    <div className="grid sm:grid-cols-2 gap-4 mb-4">
                      <label className="text-xs block">
                        <span className="text-muted-foreground">Next follow-up</span>
                        <div className="flex gap-2 mt-1">
                          <input type="date" value={followup} onChange={(e) => setFollowup(e.target.value)} className="input-base flex-1" />
                          <button
                            onClick={saveFollowup}
                            disabled={busy}
                            className="px-3 py-2 rounded-xl bg-accent text-accent-foreground text-xs font-semibold disabled:opacity-60"
                          >
                            Save
                          </button>
                        </div>
                      </label>
                      <div className="text-xs">
                        <span className="text-muted-foreground">Pipeline stage</span>
                        <CrmStageDisplay pipeline={pipeline} stage={purchase.pipeline_stage} />
                      </div>
                    </div>
                    <textarea
                      value={noteText}
                      onChange={(e) => setNoteText(e.target.value)}
                      placeholder="Call summary, requirement, next step…"
                      rows={3}
                      className="input-base w-full !h-auto py-2 text-sm"
                    />
                    <div className="flex justify-end mt-2">
                      <button
                        onClick={addNote}
                        disabled={busy || !noteText.trim()}
                        className="px-4 py-2 rounded-xl bg-accent text-accent-foreground text-sm font-semibold disabled:opacity-50"
                      >
                        Add note
                      </button>
                    </div>
                    {visibleNotes.length > 0 && (
                      <ul className="mt-4 space-y-2 border-t border-border pt-4">
                        {[...visibleNotes].reverse().slice(0, 5).map((n, i) => (
                          <li key={i} className="text-sm rounded-lg bg-secondary/40 p-3">
                            <div className="text-[10px] text-muted-foreground">{new Date(n.at).toLocaleString("en-IN")}</div>
                            <p className="mt-0.5 whitespace-pre-wrap">{n.text}</p>
                          </li>
                        ))}
                      </ul>
                    )}
                  </CrmSectionCard>
                </section>
              </CrmSections>
            </CrmLayout>
          )}

          {tab === "pipeline" && (
            <PipelineTab
              pipeline={pipeline}
              purchase={purchase}
              busy={busy}
              dealValue={dealValue}
              setDealValue={setDealValue}
              commission={commission}
              moveStage={moveStage}
              markConverted={markConverted}
              timeline={timeline}
            />
          )}

          {tab === "documents" && (
            <DocumentsTab docs={docs} docType={docType} setDocType={setDocType} uploading={uploading} handleUpload={handleUpload} />
          )}

          {tab === "notes" && (
            <NotesTab visibleNotes={visibleNotes} noteText={noteText} setNoteText={setNoteText} addNote={addNote} busy={busy} followup={followup} setFollowup={setFollowup} saveFollowup={saveFollowup} />
          )}

          {tab === "commission" && (
            <CommissionTab lead={lead} purchase={purchase} commission={commission} disbursals={disbursals} commissions={commissions} crmProfile={crmProfile} />
          )}
        </div>
      </div>
    </CrmBackdrop>
  );
}

/* ——— Subcomponents (kept in-file for cohesion) ——— */

function CrmBackdrop({ mounted, onClose, children }: { mounted: boolean; onClose: () => void; children: React.ReactNode }) {
  return (
    <div
      className={`fixed inset-0 z-50 bg-black/70 backdrop-blur-sm grid place-items-center p-0 sm:p-4 transition-opacity duration-200 ${mounted ? "opacity-100" : "opacity-0"}`}
      onClick={onClose}
    >
      {children}
    </div>
  );
}

function CrmHeaderLead({
  lead,
  meta,
  productType,
  pipeline,
  purchase,
  overdue,
  followUpDate,
}: {
  lead: LeadCrmLead;
  meta: (typeof CATEGORY_META)[ProductCategory];
  productType?: ProductType;
  pipeline?: Pipeline;
  purchase: CrmPurchase;
  overdue: boolean;
  followUpDate: Date | null;
}) {
  return (
    <div className="min-w-0 flex-1">
      <div className="flex items-center gap-1.5 mb-2 flex-wrap">
        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${meta.chipBg} ${meta.chipText}`}>{meta.label}</span>
        {productType && (
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-secondary text-foreground/70 border border-border">{productType.name}</span>
        )}
        <StageBadge pipeline={pipeline} stageKey={purchase.pipeline_stage} />
        {purchase.converted && (
          <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 inline-flex items-center gap-0.5">
            <CheckCircle2 className="size-2.5" /> Won
          </span>
        )}
        {overdue && (
          <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-red-500/15 text-red-600 inline-flex items-center gap-0.5">
            <AlertCircle className="size-2.5" /> Overdue
          </span>
        )}
      </div>
      <div className="flex items-center gap-3">
        <div className="size-12 sm:size-14 rounded-2xl bg-gradient-to-br from-accent/30 to-accent/10 border border-accent/30 grid place-items-center font-display text-lg font-bold text-accent shrink-0">
          {lead.applicant_name.slice(0, 2).toUpperCase()}
        </div>
        <div className="min-w-0">
          <h2 className="font-display text-xl sm:text-2xl font-bold truncate">{lead.applicant_name}</h2>
          <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-3 flex-wrap">
            <span className="inline-flex items-center gap-1">
              <Wallet className="size-3" /> ₹{purchase.price_paid} paid
            </span>
            <span className="inline-flex items-center gap-1">
              <Clock className="size-3" /> {timeAgo(purchase.created_at)}
            </span>
            {followUpDate && (
              <span className={`inline-flex items-center gap-1 ${overdue ? "text-red-600" : "text-amber-600"}`}>
                <CalendarClock className="size-3" />
                {followUpDate.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function CrmTabs({
  tab,
  setTab,
  docsCount,
  notesCount,
}: {
  tab: TabId;
  setTab: (t: TabId) => void;
  docsCount: number;
  notesCount: number;
}) {
  const items: { id: TabId; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: "crm", label: "CRM Profile", icon: UserIcon },
    { id: "pipeline", label: "Pipeline", icon: Activity },
    { id: "documents", label: `Documents (${docsCount})`, icon: FolderOpen },
    { id: "notes", label: `Notes (${notesCount})`, icon: StickyNote },
    { id: "commission", label: "Commission", icon: IndianRupee },
  ];
  return (
    <div className="border-b border-border bg-card px-2 sm:px-4 flex gap-1 overflow-x-auto">
      {items.map((t) => {
        const Icon = t.icon;
        const active = tab === t.id;
        return (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`relative px-3 sm:px-4 py-3 text-xs sm:text-sm font-semibold inline-flex items-center gap-1.5 whitespace-nowrap transition ${
              active ? "text-accent" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon className="size-3.5" /> {t.label}
            {active && <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-accent rounded-full" />}
          </button>
        );
      })}
    </div>
  );
}

function CrmLayout({ children }: { children: React.ReactNode }) {
  return <div className="p-5 sm:p-6 flex flex-col lg:flex-row gap-6">{children}</div>;
}

function CrmSections({ children }: { children: React.ReactNode }) {
  return <div className="flex-1 space-y-6 min-w-0">{children}</div>;
}

function CrmSectionCard({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
      <div className="flex items-center gap-2 mb-4 pb-3 border-b border-border/60">
        <div className="size-8 rounded-lg bg-accent/10 text-accent grid place-items-center">
          <Icon className="size-4" />
        </div>
        <h3 className="font-display font-bold text-base">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function CrmFieldRow({
  field,
  value,
  display,
  saving,
  onSave,
  onCopy,
}: {
  field: CrmFieldDef;
  value: string;
  display: string;
  saving: boolean;
  onSave: (v: string) => void;
  onCopy?: (text: string, label: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const hasValue = value.trim().length > 0;
  const showInput = !hasValue || editing;

  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  const inputEl = () => {
    const base = "input-base w-full text-sm mt-1";
    if (field.type === "textarea") {
      return <textarea rows={2} value={draft} onChange={(e) => setDraft(e.target.value)} className={`${base} !h-auto py-2`} placeholder={field.placeholder} disabled={field.readOnly} />;
    }
    if (field.type === "select" && field.options) {
      return (
        <select value={draft} onChange={(e) => setDraft(e.target.value)} className={base} disabled={field.readOnly}>
          <option value="">— Select —</option>
          {field.options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      );
    }
    return (
      <input
        type={field.type === "number" ? "text" : field.type}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        className={base}
        placeholder={field.placeholder ?? field.label}
        readOnly={field.readOnly}
      />
    );
  };

  return (
    <div className="min-w-0">
      <div className="flex items-center justify-between gap-2">
        <label className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{field.label}</label>
        {hasValue && !field.readOnly && !editing && (
          <button type="button" onClick={() => setEditing(true)} className="text-muted-foreground hover:text-accent" title="Edit">
            <Pencil className="size-3" />
          </button>
        )}
      </div>
      {showInput ? (
        <div>
          {inputEl()}
          {!field.readOnly && (
            <button
              type="button"
              disabled={saving || !draft.trim()}
              onClick={async () => {
                await onSave(draft);
                setEditing(false);
              }}
              className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-accent disabled:opacity-50"
            >
              {saving ? <Loader2 className="size-3 animate-spin" /> : <Check className="size-3" />}
              Save
            </button>
          )}
        </div>
      ) : (
        <div>
          <span className="text-sm font-medium break-words">{display || value}</span>
          {onCopy && (
            <button type="button" onClick={() => onCopy(value, field.label)} className="text-muted-foreground hover:text-accent shrink-0">
              <Copy className="size-3" />
            </button>
          )}
        </div>
      )}
      {!hasValue && !field.readOnly && <p className="text-[10px] text-muted-foreground mt-0.5">Empty — enter & save</p>}
    </div>
  );
}

function MetaChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-secondary/40 px-2 py-1.5">
      <div className="text-[10px] uppercase text-muted-foreground">{label}</div>
      <div>{value}</div>
    </div>
  );
}

function CrmStageDisplay({ pipeline, stage }: { pipeline?: Pipeline; stage: string }) {
  const label = pipeline?.stages.find((s) => s.key === stage)?.label ?? stage;
  return <div className="input-base mt-1 text-sm font-semibold capitalize">{label}</div>;
}

function PipelineTab({
  pipeline,
  purchase,
  busy,
  dealValue,
  setDealValue,
  commission,
  moveStage,
  markConverted,
  timeline,
}: {
  pipeline?: Pipeline;
  purchase: CrmPurchase;
  busy: boolean;
  dealValue: string;
  setDealValue: (v: string) => void;
  commission: number;
  moveStage: (k: string) => void;
  markConverted: (won: boolean) => void;
  timeline: { at: string; type: string; text: string; by?: string }[];
}) {
  return (
    <div className="p-5 sm:p-6 space-y-6">
      {pipeline && (
        <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
          <h3 className="font-display font-bold text-base mb-4">Pipeline</h3>
          <div className="flex flex-wrap gap-1.5">
            {pipeline.stages.map((s, i) => {
              const currIdx = pipeline.stages.findIndex((x) => x.key === purchase.pipeline_stage);
              const isCurrent = s.key === purchase.pipeline_stage;
              const isDone = i < currIdx;
              return (
                <button
                  key={s.key}
                  disabled={busy}
                  onClick={() => moveStage(s.key)}
                  className={`text-[11px] font-bold px-2.5 py-1.5 rounded-full border transition ${
                    isCurrent
                      ? "bg-accent text-accent-foreground border-accent"
                      : isDone
                        ? "bg-emerald-500/15 text-emerald-700 border-emerald-500/30"
                        : "bg-card text-muted-foreground border-border hover:border-accent/50"
                  }`}
                >
                  {isDone && "✓ "}
                  {s.label}
                </button>
              );
            })}
          </div>
        </div>
      )}
      <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
        <div className="flex items-center gap-2 mb-3">
          <Target className="size-4 text-accent" />
          <h3 className="font-display font-bold text-base">Conversion</h3>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <label className="text-xs">
            <span className="text-muted-foreground">Final deal value (₹)</span>
            <input type="number" value={dealValue} onChange={(e) => setDealValue(e.target.value)} className="input-base mt-1 w-full" />
          </label>
          <div className="text-xs">
            <span className="text-muted-foreground">Est. commission</span>
            <div className="input-base mt-1 font-display font-bold text-emerald-600">₹{commission.toLocaleString("en-IN")}</div>
          </div>
        </div>
        {!purchase.converted ? (
          <button onClick={() => markConverted(true)} disabled={busy} className="mt-3 w-full py-2.5 rounded-xl bg-emerald-500 text-white font-semibold text-sm">
            <Trophy className="size-4 inline mr-1" /> Mark converted
          </button>
        ) : (
          <button onClick={() => markConverted(false)} disabled={busy} className="mt-3 w-full py-2.5 rounded-xl border border-border text-sm">
            Undo conversion
          </button>
        )}
      </div>
      <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
        <h3 className="font-display font-bold text-base mb-4">Activity</h3>
        <ol className="relative border-l border-border ml-2 space-y-4">
          {timeline.map((it, i) => (
            <li key={i} className="ml-4 text-sm">
              <div className="text-[10px] text-muted-foreground">{new Date(it.at).toLocaleString("en-IN")} · {it.type}</div>
              <div className="whitespace-pre-wrap">{it.text}</div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

function DocumentsTab({
  docs,
  docType,
  setDocType,
  uploading,
  handleUpload,
}: {
  docs: CaseDoc[];
  docType: string;
  setDocType: (v: string) => void;
  uploading: boolean;
  handleUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <div className="p-5 sm:p-6 space-y-4">
      <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
        <h3 className="font-display font-bold text-base mb-3">Upload document</h3>
        <div className="grid sm:grid-cols-[1fr_auto] gap-2">
          <select value={docType} onChange={(e) => setDocType(e.target.value)} className="input-base">
            {DOC_TYPES.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </select>
          <label className={`inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-accent text-accent-foreground font-semibold text-sm cursor-pointer ${uploading ? "opacity-60" : ""}`}>
            {uploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
            Choose file
            <input type="file" className="hidden" onChange={handleUpload} accept="image/*,application/pdf" disabled={uploading} />
          </label>
        </div>
      </div>
      {docs.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-10 text-center text-sm text-muted-foreground">No documents yet.</div>
      ) : (
        <ul className="space-y-2">
          {docs.map((d) => (
            <li key={d.id} className="flex items-center gap-3 rounded-xl border p-3">
              <FileText className="size-5 text-accent" />
              <div className="flex-1 min-w-0 truncate text-sm font-semibold">{d.file_name}</div>
              <a href={d.file_url} target="_blank" rel="noopener" className="text-xs font-semibold text-accent">
                Open
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function NotesTab({
  visibleNotes,
  noteText,
  setNoteText,
  addNote,
  busy,
  followup,
  setFollowup,
  saveFollowup,
}: {
  visibleNotes: Note[];
  noteText: string;
  setNoteText: (v: string) => void;
  addNote: () => void;
  busy: boolean;
  followup: string;
  setFollowup: (v: string) => void;
  saveFollowup: () => void;
}) {
  return (
    <div>
      <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
        <h3 className="font-display font-bold text-base mb-3">Follow-up</h3>
        <div className="flex gap-2">
          <input type="date" value={followup} onChange={(e) => setFollowup(e.target.value)} className="input-base flex-1" />
          <button onClick={saveFollowup} disabled={busy} className="px-4 py-2 rounded-xl bg-accent text-accent-foreground text-sm font-semibold">
            Save
          </button>
        </div>
      </div>
      <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
        <textarea value={noteText} onChange={(e) => setNoteText(e.target.value)} rows={4} className="input-base w-full !h-auto py-2" placeholder="Internal note…" />
        <div className="flex justify-end mt-2">
          <button onClick={addNote} disabled={busy || !noteText.trim()} className="px-4 py-2 rounded-xl bg-accent text-accent-foreground text-sm font-semibold disabled:opacity-50">
            Add note
          </button>
        </div>
      </div>
      <ul className="space-y-2">
        {[...visibleNotes].reverse().map((n, i) => (
          <li key={i} className="rounded-xl border p-4 text-sm">
            <div>{new Date(n.at).toLocaleString("en-IN")}</div>
            <p className="mt-1 whitespace-pre-wrap">{n.text}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

function CommissionTab({
  lead,
  purchase,
  commission,
  disbursals,
  commissions,
  crmProfile,
}: {
  lead: LeadCrmLead;
  purchase: CrmPurchase;
  commission: number;
  disbursals: { id: string; lender_name: string | null; loan_account_no: string | null; disbursed_amount: number; commission_amount: number; status: string; disbursed_at: string | null; created_at: string }[];
  commissions: { id: string; amount: number; percentage: number; base_amount: number; status: string; created_at: string; credited_at: string | null }[];
  crmProfile: Record<string, unknown>;
}) {
  const procStatus = crmProfile.processing_status ? String(crmProfile.processing_status) : null;
  return (
    <div className="p-5 sm:p-6 space-y-4">
      <div className="grid sm:grid-cols-3 gap-3 text-xs">
        <MetaChip label="Ticket" value={`₹${lead.loan_amount.toLocaleString("en-IN")}`} />
        <MetaChip label="Deal value" value={purchase.deal_value ? `₹${purchase.deal_value.toLocaleString("en-IN")}` : "—"} />
        <MetaChip label="Est. commission" value={`₹${commission.toLocaleString("en-IN")}`} />
      </div>
      {procStatus && (
        <div className="rounded-xl border border-accent/30 bg-accent/5 p-3 text-sm">
          Banker status: <span className="font-semibold">{procStatus}</span>
          {crmProfile.lender_name != null && crmProfile.lender_name !== "" ? (
            <span className="text-muted-foreground"> · {String(crmProfile.lender_name)}</span>
          ) : null}
        </div>
      )}
      <div>
        <h3 className="font-display font-bold text-base mb-3">Disbursals</h3>
        {disbursals.length === 0 ? (
          <p className="text-xs text-muted-foreground">No disbursal recorded yet.</p>
        ) : (
          <ul className="space-y-2">
            {disbursals.map((d) => (
              <li key={d.id} className="rounded-xl border p-3 text-sm">
                <div className="font-semibold">{d.lender_name ?? "Lender"}</div>
                <div className="text-xs text-muted-foreground mt-1 grid sm:grid-cols-3 gap-2">
                  <span>A/C: {d.loan_account_no ?? "—"}</span>
                  <span>₹{Number(d.disbursed_amount).toLocaleString("en-IN")}</span>
                  <span>{d.status}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div>
        <h3 className="font-display font-bold text-base mb-3">Commission ledger</h3>
        {commissions.length === 0 ? (
          <p className="text-xs text-muted-foreground">No commission entries yet.</p>
        ) : (
          <ul className="space-y-2">
            {commissions.map((c) => (
              <li key={c.id} className="flex justify-between rounded-xl border p-3 text-sm">
                <span className="font-semibold">₹{Number(c.amount).toLocaleString("en-IN")}</span>
                <span className="text-[10px] uppercase font-bold">{c.status}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function StageBadge({ pipeline, stageKey }: { pipeline?: Pipeline; stageKey: string }) {
  const stage = pipeline?.stages.find((s) => s.key === stageKey);
  return (
    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-secondary border border-border">
      {stage?.label ?? stageKey}
    </span>
  );
}

function ActionBtn({
  icon: Icon,
  label,
  tone,
  href,
  target,
  onClick,
  disabled,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  tone: "accent" | "emerald" | "default";
  href?: string;
  target?: string;
  onClick?: () => void;
  disabled?: boolean;
}) {
  const cls =
    tone === "accent"
      ? "bg-accent text-accent-foreground"
      : tone === "emerald"
        ? "bg-emerald-500 text-white"
        : "border border-border hover:bg-secondary";
  const base = `flex flex-col items-center gap-1 py-2.5 rounded-xl font-semibold text-[11px] transition ${cls} ${disabled ? "opacity-40 pointer-events-none" : ""}`;
  if (href) {
    return (
      <a href={href} target={target} rel={target ? "noopener" : undefined} className={base}>
        <Icon className="size-4" />
        {label}
      </a>
    );
  }
  return (
    <button type="button" onClick={onClick} className={base} disabled={disabled}>
      <Icon className="size-4" />
      {label}
    </button>
  );
}

function timeAgo(iso: string) {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
