import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import {
  DOCUMENT_CATALOG,
  DOCUMENT_CATEGORY_LABELS,
  DOCUMENT_STATUSES,
  type DocumentCategory,
} from "@/lib/customer-crm/document-catalog";
import {
  ensureDocumentSlots,
  loadCustomerDocuments,
  removeCustomerDocument,
  updateDocumentMeta,
  uploadCustomerDocument,
  addTimelineEntry,
  type CustomerDocument,
} from "@/lib/customer-crm/phase3-api";
import { SectionShell } from "./shared/SectionShell";
import { FolderOpen, Upload, Eye, Trash2, Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  const [migrationHint, setMigrationHint] = useState(false);
  const [uploadingSlug, setUploadingSlug] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const refresh = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const ensured = await ensureDocumentSlots(profile.id, profile.lead_purchase_id, leadId, user.id);
    if (ensured.migrationRequired) setMigrationHint(true);
    const res = await loadCustomerDocuments(profile.lead_purchase_id);
    if (res.migrationRequired) setMigrationHint(true);
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
      await addTimelineNote(`Document uploaded: ${doc.doc_label}`);
    }
  };

  const addTimelineNote = async (body: string) => {
    if (!user) return;
    await addTimelineEntry({
      customer_profile_id: profile.id,
      lead_purchase_id: profile.lead_purchase_id,
      dsa_id: user.id,
      activity_type: "document",
      title: "Document",
      body,
      created_by: user.id,
    });
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

  return (
    <SectionShell title="Documents" description="Upload center — KYC, income, property & banking proofs" icon={FolderOpen}>
      {migrationHint && (
        <div className="mb-4 flex gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs">
          <AlertTriangle className="size-4 shrink-0" />
          Run <code className="px-1 rounded bg-background/80">20260519100000_customer_crm_phase3.sql</code> for full document workflow.
        </div>
      )}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-8">
          {categories.map((cat) => {
            const items = DOCUMENT_CATALOG.filter((c) => c.category === cat);
            return (
              <div key={cat}>
                <h3 className="text-sm font-bold mb-3">{DOCUMENT_CATEGORY_LABELS[cat]}</h3>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {items.map((item) => {
                    const doc = docBySlug.get(item.slug);
                    const status = doc?.status ?? "pending";
                    const isUploading = uploadingSlug === item.slug;
                    return (
                      <div key={item.slug} className="rounded-xl border border-border bg-card p-4 flex flex-col gap-3">
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-sm font-semibold">{item.label}</span>
                          <Badge variant="outline" className={`text-[10px] capitalize ${STATUS_COLORS[status] ?? ""}`}>
                            {status.replace(/_/g, " ")}
                          </Badge>
                        </div>
                        {doc?.file_name && (
                          <p className="text-xs text-muted-foreground truncate" title={doc.file_name}>
                            {doc.file_name}
                          </p>
                        )}
                        <div className="flex flex-wrap gap-2 mt-auto">
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
                            variant="outline"
                            disabled={isUploading || !doc}
                            onClick={() => fileRefs.current[item.slug]?.click()}
                          >
                            {isUploading ? (
                              <Loader2 className="size-3.5 animate-spin" />
                            ) : (
                              <Upload className="size-3.5 mr-1" />
                            )}
                            {doc?.file_url ? "Replace" : "Upload"}
                          </Button>
                          {doc?.file_url && (
                            <Button type="button" size="sm" variant="ghost" asChild>
                              <a href={doc.file_url} target="_blank" rel="noopener noreferrer">
                                <Eye className="size-3.5 mr-1" /> Preview
                              </a>
                            </Button>
                          )}
                          {doc?.file_url && (
                            <Button type="button" size="sm" variant="ghost" className="text-destructive" onClick={() => doc && onRemove(doc)}>
                              <Trash2 className="size-3.5" />
                            </Button>
                          )}
                        </div>
                        {isUploading && (
                          <div className="h-1 rounded-full bg-secondary overflow-hidden">
                            <div className="h-full bg-accent transition-all" style={{ width: `${progress}%` }} />
                          </div>
                        )}
                        {doc && (
                          <div className="space-y-2 pt-2 border-t border-border">
                            <Select value={status} onValueChange={(v) => onStatusChange(doc, v)}>
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {DOCUMENT_STATUSES.map((s) => (
                                  <SelectItem key={s} value={s}>
                                    {s.replace(/_/g, " ")}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Textarea
                              placeholder="Verification notes…"
                              className="text-xs min-h-[60px]"
                              defaultValue={doc.verification_notes ?? ""}
                              onBlur={(e) => {
                                if (e.target.value !== (doc.verification_notes ?? "")) {
                                  void updateDocumentMeta(doc.id, { verification_notes: e.target.value }).then(refresh);
                                }
                              }}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </SectionShell>
  );
}

