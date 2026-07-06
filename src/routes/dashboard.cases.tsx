import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { isPlatformAdmin } from "@/lib/role-access";
import { toast } from "sonner";
import {
  Building2, Loader2, Phone, MapPin, IndianRupee, FileText, Upload,
  Clock, CheckCircle2, XCircle, User as UserIcon, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/dashboard/cases")({
  head: () => ({ meta: [{ title: "Cases — LeadMines" }] }),
  component: CasesPage,
});

const PIPELINE_STAGES = ["new", "contacted", "docs", "submitted", "approved", "disbursed", "rejected"] as const;
type Stage = typeof PIPELINE_STAGES[number];

const STAGE_BADGE: Record<string, string> = {
  new: "bg-muted text-muted-foreground",
  contacted: "bg-blue-500/15 text-blue-600",
  docs: "bg-amber-500/15 text-amber-600",
  submitted: "bg-purple-500/15 text-purple-600",
  approved: "bg-emerald-500/15 text-emerald-600",
  disbursed: "bg-green-500/15 text-green-700 font-semibold",
  rejected: "bg-red-500/15 text-red-600",
};

const DOC_TYPES = [
  { value: "pan", label: "PAN Card" },
  { value: "aadhaar", label: "Aadhaar" },
  { value: "bank_statement", label: "Bank Statement" },
  { value: "salary_slip", label: "Salary Slip" },
  { value: "itr", label: "ITR" },
  { value: "agreement", label: "Loan Agreement" },
  { value: "sanction_letter", label: "Sanction Letter" },
  { value: "disbursal_proof", label: "Disbursal Proof" },
  { value: "other", label: "Other" },
];

interface CaseRow {
  id: string;
  lead_id: string;
  pipeline_stage: string;
  price_paid: number;
  deal_value: number;
  converted: boolean;
  created_at: string;
  updated_at: string;
  dsa_id: string;
  leads: {
    applicant_name: string;
    full_phone: string;
    masked_phone: string;
    city: string;
    state: string | null;
    product_subtype: string | null;
    loan_amount: number;
    product_category: string;
    email: string | null;
  };
}

interface CaseDoc {
  id: string;
  doc_type: string;
  file_name: string;
  file_url: string;
  verified: boolean;
  created_at: string;
}

interface StatusLog {
  id: string;
  from_stage: string | null;
  to_stage: string;
  notes: string | null;
  created_at: string;
}

function CasesPage() {
  const { user, role } = useAuth();
  const [cases, setCases] = useState<CaseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [stageFilter, setStageFilter] = useState<Stage | "all">("all");
  const [search, setSearch] = useState("");
  const [active, setActive] = useState<CaseRow | null>(null);

  const refresh = async () => {
    if (!user) return;
    setLoading(true);
    let query = supabase
      .from("lead_purchases")
      .select(`id, lead_id, pipeline_stage, price_paid, deal_value, converted, created_at, updated_at, dsa_id,
               leads:lead_id(applicant_name, full_phone, masked_phone, city, state, product_subtype, loan_amount, product_category, email)`)
      .order("updated_at", { ascending: false });

    // Platform admins & lenders see all; others see own purchases
    if (!isPlatformAdmin(role) && role !== "lender") {
      query = query.eq("dsa_id", user.id);
    }

    const { data, error } = await query;
    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }
    setCases((data as any) || []);
    setLoading(false);
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, role]);

  const filtered = useMemo(() => {
    return cases.filter((c) => {
      if (stageFilter !== "all" && c.pipeline_stage !== stageFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        const lead = c.leads;
        return (
          lead?.applicant_name?.toLowerCase().includes(q) ||
          lead?.full_phone?.includes(q) ||
          lead?.city?.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [cases, stageFilter, search]);

  const stageCounts = useMemo(() => {
    const c: Record<string, number> = { all: cases.length };
    for (const stage of PIPELINE_STAGES) c[stage] = 0;
    cases.forEach((x) => { c[x.pipeline_stage] = (c[x.pipeline_stage] || 0) + 1; });
    return c;
  }, [cases]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-2xl font-bold flex items-center gap-2">
            <Building2 className="size-6 text-accent" /> Lender Cases
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {isPlatformAdmin(role) ? "All cases across the platform" : role === "lender" ? "Cases assigned to you" : "Your active cases"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Input
            placeholder="Search by name, phone, city…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-64"
          />
        </div>
      </div>

      {/* Stage filter chips */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setStageFilter("all")}
          className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${stageFilter === "all" ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border hover:bg-muted"}`}
        >
          All <span className="opacity-60">({stageCounts.all})</span>
        </button>
        {PIPELINE_STAGES.map((s) => (
          <button
            key={s}
            onClick={() => setStageFilter(s)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border capitalize transition ${stageFilter === s ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border hover:bg-muted"}`}
          >
            {s} <span className="opacity-60">({stageCounts[s] || 0})</span>
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        {loading ? (
          <div className="p-12 text-center"><Loader2 className="size-6 animate-spin mx-auto text-muted-foreground" /></div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            <Building2 className="size-10 mx-auto mb-3 opacity-40" />
            <p>No cases match your filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Phone</th>
                  <th className="px-4 py-3">City</th>
                  <th className="px-4 py-3">Product</th>
                  <th className="px-4 py-3">Loan Amount</th>
                  <th className="px-4 py-3">Stage</th>
                  <th className="px-4 py-3">Updated</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((c) => (
                  <tr key={c.id} className="hover:bg-muted/30 cursor-pointer" onClick={() => setActive(c)}>
                    <td className="px-4 py-3 font-medium">{c.leads?.applicant_name}</td>
                    <td className="px-4 py-3 font-mono text-xs">{isPlatformAdmin(role) || role === "lender" ? c.leads?.full_phone : c.leads?.masked_phone}</td>
                    <td className="px-4 py-3">{c.leads?.city}</td>
                    <td className="px-4 py-3 capitalize">{c.leads?.product_subtype?.replace(/_/g, " ") || c.leads?.product_category}</td>
                    <td className="px-4 py-3">₹{Number(c.leads?.loan_amount || 0).toLocaleString("en-IN")}</td>
                    <td className="px-4 py-3">
                      <Badge className={`${STAGE_BADGE[c.pipeline_stage] || "bg-muted"} capitalize`}>{c.pipeline_stage}</Badge>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(c.updated_at).toLocaleDateString()}</td>
                    <td className="px-4 py-3 text-right"><Button size="sm" variant="ghost">View</Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {active && <CaseDetail caseRow={active} onClose={() => { setActive(null); refresh(); }} canManage={isPlatformAdmin(role) || role === "lender" || active.dsa_id === user?.id} />}
    </div>
  );
}

function CaseDetail({ caseRow, onClose, canManage }: { caseRow: CaseRow; onClose: () => void; canManage: boolean }) {
  const { user } = useAuth();
  const [docs, setDocs] = useState<CaseDoc[]>([]);
  const [logs, setLogs] = useState<StatusLog[]>([]);
  const [stage, setStage] = useState(caseRow.pipeline_stage);
  const [dealValue, setDealValue] = useState(caseRow.deal_value || caseRow.leads?.loan_amount || 0);
  const [savingStage, setSavingStage] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [docType, setDocType] = useState("pan");

  const load = async () => {
    const [d, l] = await Promise.all([
      supabase.from("case_documents").select("*").eq("lead_purchase_id", caseRow.id).order("created_at", { ascending: false }),
      supabase.from("case_status_logs").select("*").eq("lead_purchase_id", caseRow.id).order("created_at", { ascending: false }),
    ]);
    setDocs((d.data as any) || []);
    setLogs((l.data as any) || []);
  };

  useEffect(() => { load(); }, [caseRow.id]);

  const updateStage = async () => {
    if (stage === caseRow.pipeline_stage) return;
    setSavingStage(true);
    const updates: any = { pipeline_stage: stage, updated_at: new Date().toISOString() };
    if (stage === "disbursed") {
      updates.converted = true;
      updates.deal_value = dealValue;
    }
    const { error } = await supabase.from("lead_purchases").update(updates).eq("id", caseRow.id);
    setSavingStage(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`Stage updated to ${stage}`);
    load();
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (file.size > 10 * 1024 * 1024) { toast.error("File too large (max 10MB)"); return; }
    setUploading(true);
    try {
      const path = `${user.id}/${caseRow.id}/${Date.now()}-${file.name}`;
      const { error: upErr } = await supabase.storage.from("case-documents").upload(path, file);
      if (upErr) throw upErr;
      const { data: signed } = await supabase.storage.from("case-documents").createSignedUrl(path, 60 * 60 * 24 * 365);
      const { error: insErr } = await supabase.from("case_documents").insert({
        lead_purchase_id: caseRow.id,
        lead_id: caseRow.lead_id,
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
      load();
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const lead = caseRow.leads;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 grid place-items-center p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-background rounded-3xl border border-border max-w-3xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-background border-b border-border p-5 flex items-start justify-between">
          <div>
            <h2 className="font-display text-xl font-bold">{lead?.applicant_name}</h2>
            <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
              <Phone className="size-3.5" /> {lead?.full_phone}
              <span className="mx-1">·</span>
              <MapPin className="size-3.5" /> {lead?.city}
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-muted rounded-lg"><X className="size-5" /></button>
        </div>

        <div className="p-5 space-y-6">
          {/* Loan summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat icon={IndianRupee} label="Loan Amount" value={`₹${Number(lead?.loan_amount || 0).toLocaleString("en-IN")}`} />
            <Stat icon={FileText} label="Product" value={lead?.product_subtype?.replace(/_/g, " ") || lead?.product_category || "—"} cap />
            <Stat icon={Clock} label="Current Stage" value={caseRow.pipeline_stage} cap />
            <Stat icon={IndianRupee} label="Lead Cost" value={`₹${caseRow.price_paid}`} />
          </div>

          {/* Stage update */}
          {canManage && (
            <div className="rounded-2xl bg-muted/50 p-4 space-y-3">
              <h3 className="font-semibold text-sm">Update Stage</h3>
              <div className="flex gap-2 flex-wrap">
                <Select value={stage} onValueChange={setStage}>
                  <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PIPELINE_STAGES.map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
                  </SelectContent>
                </Select>
                {stage === "disbursed" && (
                  <Input type="number" value={dealValue} onChange={(e) => setDealValue(Number(e.target.value))} placeholder="Disbursed amount" className="w-44" />
                )}
                <Button onClick={updateStage} disabled={savingStage || stage === caseRow.pipeline_stage}>
                  {savingStage ? <Loader2 className="size-4 animate-spin" /> : "Update"}
                </Button>
              </div>
            </div>
          )}

          {/* Documents */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-sm flex items-center gap-2"><FileText className="size-4" /> Documents ({docs.length})</h3>
              {canManage && (
                <div className="flex items-center gap-2">
                  <Select value={docType} onValueChange={setDocType}>
                    <SelectTrigger className="w-40 h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {DOC_TYPES.map((d) => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <label className="cursor-pointer">
                    <input type="file" hidden onChange={handleUpload} disabled={uploading} accept="image/*,application/pdf" />
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs bg-primary text-primary-foreground rounded-lg hover:opacity-90">
                      {uploading ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
                      Upload
                    </span>
                  </label>
                </div>
              )}
            </div>
            {docs.length === 0 ? (
              <div className="text-xs text-muted-foreground p-4 border border-dashed rounded-lg text-center">No documents uploaded yet.</div>
            ) : (
              <ul className="divide-y divide-border border border-border rounded-lg">
                {docs.map((d) => (
                  <li key={d.id} className="p-3 flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="size-4 text-muted-foreground shrink-0" />
                      <div className="truncate">
                        <div className="font-medium truncate">{d.file_name}</div>
                        <div className="text-xs text-muted-foreground capitalize">{d.doc_type.replace(/_/g, " ")}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {d.verified && <CheckCircle2 className="size-4 text-emerald-600" />}
                      <a href={d.file_url} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline">Open</a>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Status log timeline */}
          <div>
            <h3 className="font-semibold text-sm mb-3 flex items-center gap-2"><Clock className="size-4" /> Activity Timeline</h3>
            {logs.length === 0 ? (
              <div className="text-xs text-muted-foreground p-4 border border-dashed rounded-lg text-center">No activity yet.</div>
            ) : (
              <ol className="space-y-3">
                {logs.map((l) => (
                  <li key={l.id} className="flex gap-3 text-sm">
                    <div className="size-2 rounded-full bg-primary mt-1.5 shrink-0" />
                    <div className="flex-1">
                      <div>
                        <span className="text-muted-foreground">Stage changed: </span>
                        {l.from_stage && <Badge variant="outline" className="capitalize">{l.from_stage}</Badge>}
                        <span className="mx-1.5 text-muted-foreground">→</span>
                        <Badge className={`${STAGE_BADGE[l.to_stage] || ""} capitalize`}>{l.to_stage}</Badge>
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">{new Date(l.created_at).toLocaleString()}</div>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value, cap }: { icon: any; label: string; value: string; cap?: boolean }) {
  return (
    <div className="rounded-xl bg-muted/40 border border-border p-3">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Icon className="size-3.5" /> {label}</div>
      <div className={`font-semibold mt-1 ${cap ? "capitalize" : ""}`}>{value}</div>
    </div>
  );
}
