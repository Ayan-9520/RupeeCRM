import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { isPlatformAdmin } from "@/lib/role-access";
import { toast } from "sonner";
import {
  Building2, Loader2, Phone, MapPin, IndianRupee, FileText, Upload,
  Clock, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { listMyLeads, patchMyLead, type CrmPurchase } from "@/lib/python-api";

export const Route = createFileRoute("/dashboard/cases")({
  head: () => ({ meta: [{ title: "Cases — RupeeDial One" }] }),
  component: CasesPage,
});

/** Show all known pipeline / legacy stage values */
const PIPELINE_STAGES = [
  "new",
  "contacted",
  "docs_collected",
  "docs",
  "bank_submitted",
  "submitted",
  "sanctioned",
  "approved",
  "disbursed",
  "rejected",
] as const;

type Stage = (typeof PIPELINE_STAGES)[number];

const STAGE_LABEL: Record<string, string> = {
  new: "new",
  contacted: "contacted",
  docs_collected: "docs collected",
  docs: "docs",
  bank_submitted: "bank submitted",
  submitted: "submitted",
  sanctioned: "sanctioned",
  approved: "approved",
  disbursed: "disbursed",
  rejected: "rejected",
};

const STAGE_BADGE: Record<string, string> = {
  new: "bg-muted text-muted-foreground",
  contacted: "bg-blue-500/15 text-blue-600",
  docs_collected: "bg-amber-500/15 text-amber-600",
  docs: "bg-amber-500/15 text-amber-600",
  bank_submitted: "bg-purple-500/15 text-purple-600",
  submitted: "bg-purple-500/15 text-purple-600",
  sanctioned: "bg-emerald-500/15 text-emerald-600",
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
  deal_value: number | null;
  converted: boolean;
  created_at: string;
  updated_at: string;
  notes: { at: string; text: string; by?: string; kind?: string }[];
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
  } | null;
}

function mapPurchase(p: CrmPurchase): CaseRow {
  return {
    id: p.id,
    lead_id: p.lead_id,
    pipeline_stage: p.pipeline_stage,
    price_paid: p.price_paid,
    deal_value: p.deal_value,
    converted: p.converted,
    created_at: p.created_at,
    updated_at: p.updated_at || p.created_at,
    notes: p.notes ?? [],
    leads: p.lead
      ? {
          applicant_name: p.lead.applicant_name,
          full_phone: p.lead.full_phone,
          masked_phone: p.lead.masked_phone,
          city: p.lead.city,
          state: p.lead.state ?? null,
          product_subtype: p.lead.product_subtype,
          loan_amount: p.lead.loan_amount,
          product_category: p.lead.product_category,
          email: p.lead.email,
        }
      : null,
  };
}

function CasesPage() {
  const { role } = useAuth();
  const [cases, setCases] = useState<CaseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [stageFilter, setStageFilter] = useState<Stage | "all">("all");
  const [search, setSearch] = useState("");
  const [active, setActive] = useState<CaseRow | null>(null);

  const refresh = async () => {
    setLoading(true);
    try {
      const data = await listMyLeads();
      setCases((data.items ?? []).map(mapPurchase));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load cases");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

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
    cases.forEach((x) => {
      c[x.pipeline_stage] = (c[x.pipeline_stage] || 0) + 1;
    });
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
            {isPlatformAdmin(role)
              ? "Cases from your CRM purchases"
              : role === "lender"
                ? "Cases assigned to you"
                : "Your active cases from My Leads"}
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

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setStageFilter("all")}
          className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${stageFilter === "all" ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border hover:bg-muted"}`}
        >
          All <span className="opacity-60">({stageCounts.all})</span>
        </button>
        {PIPELINE_STAGES.map((s) => (
          <button
            type="button"
            key={s}
            onClick={() => setStageFilter(s)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border capitalize transition ${stageFilter === s ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border hover:bg-muted"}`}
          >
            {STAGE_LABEL[s]} <span className="opacity-60">({stageCounts[s] || 0})</span>
          </button>
        ))}
      </div>

      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <Loader2 className="size-6 animate-spin mx-auto text-muted-foreground" />
          </div>
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
                    <td className="px-4 py-3 font-mono text-xs">{c.leads?.full_phone}</td>
                    <td className="px-4 py-3">{c.leads?.city}</td>
                    <td className="px-4 py-3 capitalize">
                      {c.leads?.product_subtype?.replace(/_/g, " ") || c.leads?.product_category}
                    </td>
                    <td className="px-4 py-3">₹{Number(c.leads?.loan_amount || 0).toLocaleString("en-IN")}</td>
                    <td className="px-4 py-3">
                      <Badge className={`${STAGE_BADGE[c.pipeline_stage] || "bg-muted"} capitalize`}>
                        {STAGE_LABEL[c.pipeline_stage] || c.pipeline_stage}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {new Date(c.updated_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button size="sm" variant="ghost">
                        View
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {active && (
        <CaseDetail
          caseRow={active}
          onClose={() => {
            setActive(null);
            void refresh();
          }}
        />
      )}
    </div>
  );
}

function CaseDetail({ caseRow, onClose }: { caseRow: CaseRow; onClose: () => void }) {
  const [notes, setNotes] = useState(caseRow.notes);
  const [stage, setStage] = useState(caseRow.pipeline_stage);
  const [dealValue, setDealValue] = useState(caseRow.deal_value || caseRow.leads?.loan_amount || 0);
  const [converted, setConverted] = useState(caseRow.converted);
  const [noteText, setNoteText] = useState("");
  const [saving, setSaving] = useState(false);
  const [docType, setDocType] = useState("pan");

  useEffect(() => {
    setNotes(caseRow.notes);
    setStage(caseRow.pipeline_stage);
    setDealValue(caseRow.deal_value || caseRow.leads?.loan_amount || 0);
    setConverted(caseRow.converted);
  }, [caseRow]);

  const save = async () => {
    setSaving(true);
    try {
      const body: Parameters<typeof patchMyLead>[1] = {
        pipeline_stage: stage,
        deal_value: dealValue,
        converted,
      };
      if (noteText.trim()) body.notes_text = noteText.trim();
      const updated = await patchMyLead(caseRow.id, body);
      toast.success("Case updated");
      setNotes(updated.notes ?? []);
      setNoteText("");
      caseRow.pipeline_stage = updated.pipeline_stage;
      caseRow.notes = updated.notes ?? [];
      caseRow.deal_value = updated.deal_value;
      caseRow.converted = updated.converted;
      setConverted(updated.converted);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    } finally {
      setSaving(false);
    }
  };

  const handleUploadClick = () => {
    toast.message("Use My Leads notes for document tracking");
  };

  const timeline = [...notes].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  const lead = caseRow.leads;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 grid place-items-center p-4 overflow-y-auto" onClick={onClose}>
      <div
        className="bg-background rounded-3xl border border-border max-w-3xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-background border-b border-border p-5 flex items-start justify-between">
          <div>
            <h2 className="font-display text-xl font-bold">{lead?.applicant_name}</h2>
            <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
              <Phone className="size-3.5" /> {lead?.full_phone}
              <span className="mx-1">·</span>
              <MapPin className="size-3.5" /> {lead?.city}
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-2 hover:bg-muted rounded-lg">
            <X className="size-5" />
          </button>
        </div>

        <div className="p-5 space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat icon={IndianRupee} label="Loan Amount" value={`₹${Number(lead?.loan_amount || 0).toLocaleString("en-IN")}`} />
            <Stat
              icon={FileText}
              label="Product"
              value={lead?.product_subtype?.replace(/_/g, " ") || lead?.product_category || "—"}
              cap
            />
            <Stat icon={Clock} label="Current Stage" value={STAGE_LABEL[caseRow.pipeline_stage] || caseRow.pipeline_stage} cap />
            <Stat icon={IndianRupee} label="Lead Cost" value={`₹${caseRow.price_paid}`} />
          </div>

          <div className="rounded-2xl bg-muted/50 p-4 space-y-3">
            <h3 className="font-semibold text-sm">Update case</h3>
            <div className="flex gap-2 flex-wrap items-center">
              <Select value={stage} onValueChange={setStage}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PIPELINE_STAGES.map((s) => (
                    <SelectItem key={s} value={s} className="capitalize">
                      {STAGE_LABEL[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                type="number"
                value={dealValue}
                onChange={(e) => setDealValue(Number(e.target.value))}
                placeholder="Deal value"
                className="w-44"
              />
              <label className="flex items-center gap-2 text-sm px-2">
                <input type="checkbox" checked={converted} onChange={(e) => setConverted(e.target.checked)} />
                Converted
              </label>
            </div>
            <Input
              placeholder="Add a note…"
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
            />
            <Button onClick={save} disabled={saving}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : "Save"}
            </Button>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <FileText className="size-4" /> Documents
              </h3>
              <div className="flex items-center gap-2">
                <Select value={docType} onValueChange={setDocType}>
                  <SelectTrigger className="w-40 h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DOC_TYPES.map((d) => (
                      <SelectItem key={d.value} value={d.value}>
                        {d.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <button
                  type="button"
                  onClick={handleUploadClick}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs bg-primary text-primary-foreground rounded-lg hover:opacity-90"
                >
                  <Upload className="size-3.5" />
                  Upload
                </button>
              </div>
            </div>
            <div className="text-xs text-muted-foreground p-4 border border-dashed rounded-lg text-center">
              Use My Leads notes for document tracking
            </div>
          </div>

          <div>
            <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
              <Clock className="size-4" /> Status timeline
            </h3>
            {timeline.length === 0 ? (
              <div className="text-xs text-muted-foreground p-4 border border-dashed rounded-lg text-center">
                No notes yet.
              </div>
            ) : (
              <ol className="space-y-3">
                {timeline.map((n, i) => (
                  <li key={`${n.at}-${i}`} className="flex gap-3 text-sm">
                    <div className="size-2 rounded-full bg-primary mt-1.5 shrink-0" />
                    <div className="flex-1">
                      <div>{n.text || (n.kind ? `[${n.kind}]` : "Note")}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {new Date(n.at).toLocaleString()}
                        {n.by ? ` · ${n.by}` : ""}
                      </div>
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

function Stat({
  icon: Icon,
  label,
  value,
  cap,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  cap?: boolean;
}) {
  return (
    <div className="rounded-xl bg-muted/40 border border-border p-3">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="size-3.5" /> {label}
      </div>
      <div className={`font-semibold mt-1 ${cap ? "capitalize" : ""}`}>{value}</div>
    </div>
  );
}
