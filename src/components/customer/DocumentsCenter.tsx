import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import {
  DOCUMENT_CATALOG,
  DOCUMENT_CATEGORY_LABELS,
  DOCUMENT_STATUSES,
  type DocumentCategory,
} from "@/lib/customer-crm/document-catalog";
import {
  loadCustomerDocuments,
  removeCustomerDocument,
  updateDocumentMeta,
  uploadCustomerDocument,
  requestBlob,
  type CustomerDocument,
} from "@/lib/customer-crm/phase3-api";
import { SectionShell } from "./shared/SectionShell";
import { FolderOpen, Upload, Eye, Trash2, Loader2, AlertTriangle, ChevronRight, ChevronsUpDown, StickyNote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import type { CustomerProfile } from "@/lib/customer-crm/types";

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-secondary text-muted-foreground",
  uploaded: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  under_review: "bg-amber-500/15 text-amber-800",
  verified: "bg-emerald-500/15 text-emerald-700",
  rejected: "bg-destructive/15 text-destructive",
  expired: "bg-orange-500/15 text-orange-800",
};

const STATUS_DOT: Record<string, string> = {
  pending: "bg-slate-300",
  uploaded: "bg-blue-500",
  under_review: "bg-amber-500",
  verified: "bg-emerald-500",
  rejected: "bg-red-500",
  expired: "bg-orange-500",
};

type FilterKey = "all" | "pending" | "uploaded" | "verified" | "rejected";

const FILTERS: [FilterKey, string][] = [
  ["all", "All"],
  ["pending", "Pending"],
  ["uploaded", "Uploaded"],
  ["verified", "Verified"],
  ["rejected", "Rejected"],
];

export function DocumentsCenter({
  profile,
  leadId,
  onDocsChange,
}: {
  profile: CustomerProfile;
  leadId: string;
  onDocsChange?: (pending: number) => void;
}) {
  const { user } = useAuth();
  const [docs, setDocs] = useState<CustomerDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [uploadingSlug, setUploadingSlug] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [filter, setFilter] = useState<FilterKey>("all");
  const [openCats, setOpenCats] = useState<Set<DocumentCategory>>(() => new Set<DocumentCategory>(["kyc"] as DocumentCategory[]));
  const [openNotes, setOpenNotes] = useState<Set<string>>(() => new Set());

  const refresh = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const res = await loadCustomerDocuments(profile.lead_purchase_id);
    setLoadError(res.error ?? null);
    setDocs(res.docs);
    const pending = res.docs.filter((d) => d.status === "pending" || d.status === "rejected").length;
    onDocsChange?.(pending);
    setLoading(false);
  }, [user, profile.id, profile.lead_purchase_id, leadId, onDocsChange]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const docBySlug = new Map(docs.map((d) => [d.doc_slug, d]));

  const onUpload = async (slug: string, file: File) => {
    const doc = docBySlug.get(slug);
    if (!doc || !user) return;
    setUploadingSlug(slug);
    setProgress(0);
    const { error } = await uploadCustomerDocument({
      doc,
      file,
      userId: user.id,
      leadId,
      onProgress: setProgress,
    });
    setUploadingSlug(null);
    if (error) toast.error(error);
    else {
      toast.success("Document uploaded");
      await refresh();
    }
  };

  const onPreview = async (doc: CustomerDocument) => {
    if (!doc.file_url) return;
    try {
      const blob = await requestBlob(doc.file_url);
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not open the document");
    }
  };

  const onStatusChange = async (doc: CustomerDocument, status: string) => {
    const { error } = await updateDocumentMeta(doc.id, { status: status as CustomerDocument["status"] });
    if (error) toast.error(error.message);
    else refresh();
  };

  const onRemove = async (doc: CustomerDocument) => {
    if (!confirm(`Remove ${doc.doc_label}?`)) return;
    const { error } = await removeCustomerDocument(doc);
    if (error) toast.error(error.message);
    else {
      toast.success("Document removed");
      refresh();
    }
  };

  const categories = Object.keys(DOCUMENT_CATEGORY_LABELS) as DocumentCategory[];
  const statusOf = (slug: string) => docBySlug.get(slug)?.status ?? "pending";
  const groupOf = (status: string): FilterKey =>
    status === "verified" ? "verified" : status === "pending" ? "pending" : status === "rejected" || status === "expired" ? "rejected" : "uploaded";
  const counts = DOCUMENT_CATALOG.reduce<Record<FilterKey, number>>(
    (acc, item) => {
      acc.all += 1;
      acc[groupOf(statusOf(item.slug))] += 1;
      return acc;
    },
    { all: 0, pending: 0, uploaded: 0, verified: 0, rejected: 0 },
  );
  const done = counts.uploaded + counts.verified;
  const pct = counts.all ? Math.round((done / counts.all) * 100) : 0;
  const allOpen = openCats.size === categories.length;

  const toggleCat = (cat: DocumentCategory) =>
    setOpenCats((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });

  const toggleNote = (slug: string) =>
    setOpenNotes((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });

  return (
    <SectionShell title="Documents" description="Upload center — KYC, income, property & banking proofs" icon={FolderOpen}>
      {loadError && (
        <div className="mb-4 flex gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs">
          <AlertTriangle className="size-4 shrink-0" />
          {loadError}
        </div>
      )}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-2xl border border-[#d8ecdd] bg-gradient-to-br from-[#f5fcf7] to-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-[#5c4d72]">Document checklist</div>
                <div className="font-display text-lg font-bold text-[#390A5D]">
                  {done} of {counts.all} uploaded <span className="text-sm font-semibold text-[#10662A]">· {pct}%</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpenCats(allOpen ? new Set() : new Set(categories))}
                className="inline-flex items-center gap-1 rounded-lg border border-[#d8ecdd] bg-white px-2.5 py-1.5 text-xs font-semibold text-[#390A5D] hover:bg-[#E8F7EC]"
              >
                <ChevronsUpDown className="size-3.5" /> {allOpen ? "Collapse all" : "Expand all"}
              </button>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#E8F7EC]">
              <div className="h-full rounded-full bg-gradient-to-r from-[#10662A] to-[#3ba55c] transition-all" style={{ width: `${pct}%` }} />
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {FILTERS.map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    setFilter(key);
                    if (key !== "all") setOpenCats(new Set(categories));
                  }}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                    filter === key ? "bg-[#10662A] text-white" : "border border-[#d8ecdd] bg-white text-[#390A5D] hover:border-[#10662A]/40"
                  }`}
                >
                  {label}
                  <span className={`rounded-full px-1.5 text-[10px] ${filter === key ? "bg-white/20" : "bg-[#E8F7EC] text-[#10662A]"}`}>{counts[key]}</span>
                </button>
              ))}
            </div>
          </div>

          {categories.map((cat) => {
            const all = DOCUMENT_CATALOG.filter((c) => c.category === cat);
            const items = all.filter((item) => filter === "all" || groupOf(statusOf(item.slug)) === filter);
            if (filter !== "all" && items.length === 0) return null;
            const catDone = all.filter((item) => ["uploaded", "verified"].includes(groupOf(statusOf(item.slug)))).length;
            const open = openCats.has(cat);
            return (
              <div key={cat} className="overflow-hidden rounded-2xl border border-border bg-card">
                <button
                  type="button"
                  onClick={() => toggleCat(cat)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-[#f7fdf8]"
                  aria-expanded={open}
                >
                  <ChevronRight className={`size-4 shrink-0 text-[#10662A] transition-transform ${open ? "rotate-90" : ""}`} />
                  <span className="flex-1 text-sm font-bold text-[#390A5D]">{DOCUMENT_CATEGORY_LABELS[cat]}</span>
                  <span className="text-[11px] font-semibold text-[#5c4d72]">
                    {catDone}/{all.length} done
                  </span>
                  <span className="hidden h-1.5 w-20 overflow-hidden rounded-full bg-[#E8F7EC] sm:block">
                    <span className="block h-full rounded-full bg-[#10662A]" style={{ width: `${(catDone / all.length) * 100}%` }} />
                  </span>
                </button>
                {open ? (
                  <ul className="divide-y divide-border border-t border-border">
                    {items.map((item) => {
                      const doc = docBySlug.get(item.slug);
                      const status = doc?.status ?? "pending";
                      const isUploading = uploadingSlug === item.slug;
                      const noteOpen = openNotes.has(item.slug);
                      const hasNote = Boolean(doc?.verification_notes);
                      return (
                        <li key={item.slug} className="px-4 py-2.5">
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                            <span className={`size-2 shrink-0 rounded-full ${STATUS_DOT[status] ?? "bg-slate-300"}`} />
                            <div className="min-w-[9rem] flex-1">
                              <div className="text-sm font-semibold text-[#1e1b2e]">{item.label}</div>
                              <div className="truncate text-[11px] text-muted-foreground" title={doc?.file_name ?? undefined}>
                                {doc?.file_name || "Not uploaded yet"}
                              </div>
                            </div>
                            {doc ? (
                              <Select value={status} onValueChange={(v) => onStatusChange(doc, v)}>
                                <SelectTrigger className={`h-7 w-[124px] rounded-full border-0 px-3 text-[11px] font-semibold capitalize ${STATUS_COLORS[status] ?? ""}`}>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {DOCUMENT_STATUSES.map((s) => (
                                    <SelectItem key={s} value={s} className="capitalize">
                                      {s.replace(/_/g, " ")}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : null}
                            <div className="flex items-center gap-1">
                              <input
                                ref={(el) => {
                                  fileRefs.current[item.slug] = el;
                                }}
                                type="file"
                                accept=".pdf,image/*"
                                className="hidden"
                                onChange={(e) => {
                                  const f = e.target.files?.[0];
                                  if (f) void onUpload(item.slug, f);
                                  e.target.value = "";
                                }}
                              />
                              <Button
                                type="button"
                                size="sm"
                                variant={doc?.file_url ? "outline" : "default"}
                                className={`h-7 px-2.5 text-[11px] ${doc?.file_url ? "" : "bg-[#10662A] hover:bg-[#0d5522]"}`}
                                disabled={isUploading || !doc}
                                onClick={() => fileRefs.current[item.slug]?.click()}
                              >
                                {isUploading ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5 mr-1" />}
                                {doc?.file_url ? "Replace" : "Upload"}
                              </Button>
                              {doc?.file_url ? (
                                <Button type="button" size="icon" variant="ghost" className="size-7" title="Preview" onClick={() => void onPreview(doc)}>
                                  <Eye className="size-3.5" />
                                </Button>
                              ) : null}
                              {doc ? (
                                <Button
                                  type="button"
                                  size="icon"
                                  variant="ghost"
                                  className={`size-7 ${hasNote ? "text-[#10662A]" : ""}`}
                                  title={hasNote ? "View note" : "Add note"}
                                  onClick={() => toggleNote(item.slug)}
                                >
                                  <StickyNote className="size-3.5" />
                                </Button>
                              ) : null}
                              {doc?.file_url ? (
                                <Button type="button" size="icon" variant="ghost" className="size-7 text-destructive" title="Remove file" onClick={() => onRemove(doc)}>
                                  <Trash2 className="size-3.5" />
                                </Button>
                              ) : null}
                            </div>
                          </div>
                          {isUploading && (
                            <div className="mt-2 h-1 overflow-hidden rounded-full bg-secondary">
                              <div className="h-full bg-[#10662A] transition-all" style={{ width: `${progress}%` }} />
                            </div>
                          )}
                          {doc && (noteOpen || (hasNote && filter === "rejected")) ? (
                            <Textarea
                              autoFocus={noteOpen}
                              placeholder="Verification notes…"
                              className="mt-2 min-h-[56px] text-xs"
                              defaultValue={doc.verification_notes ?? ""}
                              onBlur={(e) => {
                                if (e.target.value !== (doc.verification_notes ?? "")) {
                                  void updateDocumentMeta(doc.id, { verification_notes: e.target.value }).then((res) => {
                                    if (res.error) toast.error(res.error.message);
                                    else void refresh();
                                  });
                                }
                              }}
                            />
                          ) : hasNote ? (
                            <p className="mt-1 line-clamp-1 pl-5 text-[11px] text-[#5c4d72]">Note: {doc?.verification_notes}</p>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </SectionShell>
  );
}

