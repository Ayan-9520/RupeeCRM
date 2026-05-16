import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { runEligibilityEngine } from "@/lib/customer-crm/eligibility-engine";
import { persistEligibilitySnapshot, updateWorkflowStage } from "@/lib/customer-crm/eligibility-api";
import type { WorkflowStage } from "@/lib/customer-crm/eligibility-types";
import { Link } from "@tanstack/react-router";
import { useDebouncedCallback } from "@/hooks/useDebouncedCallback";
import { useCustomerWorkspace } from "@/hooks/useCustomerWorkspace";
import { NAV_SECTIONS } from "@/lib/customer-crm/constants";
import type { BankAccount, CoApplicant, CustomerProfile, LoanRequirement, Obligation } from "@/lib/customer-crm/types";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import {
  ArrowLeft,
  Loader2,
  Phone,
  MessageSquare,
  FileText,
  Save,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { CustomerRightPanel } from "./CustomerRightPanel";
import { EligibilityDashboard, EligibilityStickySummary } from "./EligibilityDashboard";
import {
  PersonalSection,
  EmploymentSection,
  BankingSection,
  ObligationsSection,
  CoApplicantsSection,
  LoanRequirementsSection,
  DocumentsSection,
  ProcessingSection,
} from "./CustomerSections";
import type { Json } from "@/integrations/supabase/types";

export function CustomerWorkspacePage({ purchaseId }: { purchaseId: string }) {
  const { user } = useAuth();
  const ws = useCustomerWorkspace(purchaseId);
  const [active, setActive] = useState("personal");
  const [crmProcessing, setCrmProcessing] = useState<Record<string, unknown>>({});
  const [docs, setDocs] = useState<{ id: string; file_name: string; file_url: string; doc_type: string }[]>([]);
  const [workflowStage, setWorkflowStage] = useState<WorkflowStage>("profile_completed");
  const [phase2MigrationHint, setPhase2MigrationHint] = useState(false);
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});
  const workflowInitialized = useRef(false);

  useEffect(() => {
    workflowInitialized.current = false;
  }, [purchaseId]);

  const scrollTo = (id: string) => {
    setActive(id);
    sectionRefs.current[id]?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const debouncedProfileSave = useDebouncedCallback((patch: Partial<CustomerProfile>) => {
    ws.saveProfile(patch);
  }, 700);

  const onProfileField = useCallback(
    (key: string, value: unknown) => {
      ws.setProfile({ [key]: value } as Partial<CustomerProfile>);
      debouncedProfileSave({ [key]: value } as Partial<CustomerProfile>);
    },
    [ws, debouncedProfileSave],
  );

  const eligibility = useMemo(() => {
    if (!ws.data) return null;
    const leadCibil = ws.data.purchase.lead?.cibil_score ?? null;
    const result = runEligibilityEngine({ ...ws.data, leadCibil });
    return result;
  }, [ws.data]);

  useEffect(() => {
    if (eligibility && !workflowInitialized.current) {
      setWorkflowStage(eligibility.risk.workflowStage);
      workflowInitialized.current = true;
    }
  }, [eligibility]);

  useEffect(() => {
    if (!ws.data || !eligibility) return;
    const t = window.setTimeout(async () => {
      const res = await persistEligibilitySnapshot(ws.data!.profile, eligibility);
      if (res.migrationRequired) setPhase2MigrationHint(true);
    }, 1200);
    return () => clearTimeout(t);
  }, [eligibility?.computedAt, ws.data?.profile.id]);

  const obligationSummary = useMemo(() => {
    if (eligibility) {
      const fin = eligibility.financial;
      return {
        totalEmi: fin.totalEmi,
        totalOutstanding: ws.data?.obligations.reduce((s, o) => s + (Number(o.outstanding_amount) || 0), 0) ?? 0,
        foir: eligibility.metrics.foirPercent,
        dbr: eligibility.metrics.dbrPercent,
        income: fin.householdIncome,
      };
    }
    if (!ws.data) return { totalEmi: 0, totalOutstanding: 0, foir: null as number | null, dbr: null as number | null, income: 0 };
    const totalEmi = ws.data.obligations.reduce((s, o) => s + (Number(o.emi) || 0), 0);
    const totalOutstanding = ws.data.obligations.reduce((s, o) => s + (Number(o.outstanding_amount) || 0), 0);
    const income = Number(ws.data.profile.monthly_income) || Number(ws.data.profile.net_salary) || 0;
    const foir = income > 0 ? (totalEmi / income) * 100 : null;
    const dbr = income > 0 ? (totalOutstanding / (income * 12)) * 100 : null;
    return { totalEmi, totalOutstanding, foir, dbr, income };
  }, [ws.data, eligibility]);

  const onWorkflowChange = useCallback(
    async (stage: WorkflowStage) => {
      setWorkflowStage(stage);
      if (ws.data) await updateWorkflowStage(ws.data.profile.id, stage);
    },
    [ws.data],
  );

  const loadDocs = useCallback(async () => {
    const { data } = await supabase
      .from("case_documents")
      .select("id,file_name,file_url,doc_type")
      .eq("lead_purchase_id", purchaseId)
      .order("created_at", { ascending: false });
    setDocs((data as typeof docs) ?? []);
  }, [purchaseId]);

  const loadProcessing = useCallback(async () => {
    const { data } = await supabase.from("lead_purchases").select("crm_profile").eq("id", purchaseId).maybeSingle();
    if (data?.crm_profile && typeof data.crm_profile === "object" && !Array.isArray(data.crm_profile)) {
      setCrmProcessing(data.crm_profile as Record<string, unknown>);
    }
  }, [purchaseId]);

  useEffect(() => {
    if (ws.data) {
      loadDocs();
      loadProcessing();
    }
  }, [ws.data, loadDocs, loadProcessing]);

  const saveProcessing = useDebouncedCallback(async (key: string, value: unknown) => {
    const next = { ...crmProcessing, [key]: value };
    setCrmProcessing(next);
    const { error } = await supabase.from("lead_purchases").update({ crm_profile: next as Json }).eq("id", purchaseId);
    if (error) toast.error(error.message);
  }, 600);

  const onBankField = (row: BankAccount, key: string, value: unknown) => {
    const patch: Partial<BankAccount> = { [key]: value } as Partial<BankAccount>;
    if (key === "average_balance") patch.average_balance = value === "" ? null : Number(value);
    ws.upsertBank(row, patch);
  };

  const onObligationField = (row: Obligation, key: string, value: unknown) => {
    const patch: Partial<Obligation> = { [key]: value } as Partial<Obligation>;
    if (["emi", "outstanding_amount", "sanction_amount", "remaining_tenure"].includes(key)) {
      const n = value === "" ? null : Number(value);
      (patch as Record<string, unknown>)[key] = Number.isFinite(n) ? n : null;
    }
    ws.upsertObligation(row, patch);
  };

  const onCoField = (row: CoApplicant, key: string, value: unknown) => {
    const patch: Partial<CoApplicant> = { [key]: value } as Partial<CoApplicant>;
    if (key === "income" || key === "cibil_score") {
      const n = value === "" ? null : Number(value);
      (patch as Record<string, unknown>)[key] = Number.isFinite(n) ? n : null;
    }
    ws.upsertCoApp(row, patch);
  };

  if (ws.loading) return <WorkspaceSkeleton />;

  if (ws.migrationRequired) {
    return (
      <div className="max-w-lg mx-auto py-16 text-center space-y-4">
        <AlertTriangle className="size-10 text-amber-500 mx-auto" />
        <h2 className="font-display text-xl font-bold">Database migration required</h2>
        <p className="text-sm text-muted-foreground">
          Run <code className="text-xs bg-secondary px-1 rounded">supabase/migrations/20260517100000_customer_los_phase1.sql</code> in Supabase SQL editor, then refresh.
        </p>
        <Link to="/dashboard/my-leads" className="text-accent text-sm font-semibold inline-flex items-center gap-1">
          <ArrowLeft className="size-4" /> Back to My Leads
        </Link>
      </div>
    );
  }

  if (ws.error || !ws.data) {
    return (
      <div className="py-16 text-center">
        <p className="text-destructive">{ws.error ?? "Failed to load"}</p>
        <Link to="/dashboard/my-leads" className="text-accent text-sm font-semibold mt-4 inline-block">
          Back to My Leads
        </Link>
      </div>
    );
  }

  const { purchase, profile } = ws.data;
  const lead = purchase.lead;
  const phone = lead?.full_phone ?? profile.mobile ?? "";
  const name = profile.full_name || lead?.applicant_name || "Customer";

  return (
    <div className="-m-4 lg:-m-6 min-h-[calc(100vh-3.5rem)] flex flex-col bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="px-4 lg:px-6 py-3 flex flex-wrap items-center gap-3">
          <Link to="/dashboard/my-leads" className="inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-4" /> My Leads
          </Link>
          <div className="h-4 w-px bg-border hidden sm:block" />
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-lg font-bold truncate">{name}</h1>
            <p className="text-xs text-muted-foreground capitalize">
              {purchase.pipeline_stage.replace(/_/g, " ")} · ₹{purchase.price_paid} paid
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <a href={`tel:${phone}`} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-accent text-accent-foreground text-xs font-semibold">
              <Phone className="size-3.5" /> Call
            </a>
            <a
              href={`https://wa.me/${phone.replace(/\D/g, "")}`}
              target="_blank"
              rel="noopener"
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-border text-xs font-semibold hover:bg-secondary"
            >
              <MessageSquare className="size-3.5" /> WhatsApp
            </a>
            <Link
              to="/dashboard/my-leads/$id/apply"
              params={{ id: purchaseId }}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-border text-xs font-semibold hover:bg-secondary"
            >
              <FileText className="size-3.5" /> Apply
            </Link>
          </div>
        </div>
      </header>

      <div className="flex flex-1 min-h-0 flex-col lg:flex-row">
        <aside className="lg:w-56 xl:w-64 shrink-0 border-b lg:border-b-0 lg:border-r border-border bg-card/40 p-4 space-y-4 overflow-y-auto">
          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Profile completion</span>
              <span className="font-bold text-accent">{ws.completion.overall}%</span>
            </div>
            <Progress value={ws.completion.overall} className="h-2" />
          </div>
          <nav className="space-y-1">
            {NAV_SECTIONS.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => scrollTo(s.id)}
                className={`w-full text-left px-3 py-2 rounded-lg text-xs font-semibold transition flex items-center gap-2 ${
                  active === s.id ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-secondary"
                }`}
              >
                <s.icon className="size-3.5 shrink-0" />
                <span className="flex-1">{s.label}</span>
                {ws.completion.sections[s.id] != null && (
                  <span className="text-[10px] opacity-80">{ws.completion.sections[s.id]}%</span>
                )}
              </button>
            ))}
          </nav>
        </aside>

        <main className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-6 min-w-0">
          <section ref={(el) => { sectionRefs.current.personal = el; }} id="personal">
            <PersonalSection profile={profile} onFieldChange={onProfileField} completion={ws.completion.sections.personal ?? 0} />
          </section>
          <section ref={(el) => { sectionRefs.current.employment = el; }} id="employment">
            <EmploymentSection profile={profile} onFieldChange={onProfileField} completion={ws.completion.sections.employment ?? 0} />
          </section>
          <section ref={(el) => { sectionRefs.current.banking = el; }} id="banking">
            <BankingSection
              accounts={ws.data.bankAccounts}
              onChange={onBankField}
              onAdd={ws.addBank}
              onRemove={ws.removeBank}
              completion={ws.completion.sections.banking ?? 0}
            />
          </section>
          <section ref={(el) => { sectionRefs.current.obligations = el; }} id="obligations">
            <ObligationsSection
              rows={ws.data.obligations}
              onChange={onObligationField}
              onAdd={ws.addObligation}
              onRemove={ws.removeObligation}
              completion={ws.completion.sections.obligations ?? 0}
              summary={obligationSummary}
            />
          </section>
          <section ref={(el) => { sectionRefs.current["co-applicants"] = el; }} id="co-applicants">
            <CoApplicantsSection
              rows={ws.data.coApplicants}
              onChange={onCoField}
              onAdd={ws.addCoApp}
              onRemove={ws.removeCoApp}
              completion={ws.completion.sections["co-applicants"] ?? 0}
            />
          </section>
          <section ref={(el) => { sectionRefs.current["loan-requirements"] = el; }} id="loan-requirements">
            <LoanRequirementsSection
              rows={ws.data.loanRequirements}
              onChange={ws.upsertLoan}
              onAdd={ws.addLoan}
              onRemove={ws.removeLoan}
              completion={ws.completion.sections["loan-requirements"] ?? 0}
            />
          </section>
          <section ref={(el) => { sectionRefs.current.eligibility = el; }} id="eligibility">
            {eligibility && (
              <EligibilityDashboard
                result={eligibility}
                cibilFromLead={ws.data.purchase.lead?.cibil_score ?? null}
                workflowStage={workflowStage}
                onWorkflowChange={onWorkflowChange}
                phase2MigrationHint={phase2MigrationHint}
              />
            )}
          </section>
          <section ref={(el) => { sectionRefs.current.documents = el; }} id="documents">
            <DocumentsSection>
              {docs.length === 0 ? (
                <p className="text-sm text-muted-foreground">No documents uploaded. Use the legacy CRM documents tab or upload via case documents API.</p>
              ) : (
                <ul className="space-y-2">
                  {docs.map((d) => (
                    <li key={d.id} className="flex justify-between items-center rounded-lg border p-3 text-sm">
                      <span className="truncate">{d.file_name}</span>
                      <a href={d.file_url} target="_blank" rel="noopener" className="text-accent text-xs font-semibold">
                        Open
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </DocumentsSection>
          </section>
          <section ref={(el) => { sectionRefs.current.processing = el; }} id="processing">
            <ProcessingSection values={crmProcessing} onChange={saveProcessing} />
          </section>
        </main>

        <CustomerRightPanel
          purchaseId={purchaseId}
          pipelineStage={purchase.pipeline_stage}
          nextFollowup={purchase.next_followup_at}
          onFollowupSaved={ws.reload}
        />
      </div>

      <footer className="sticky bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur px-4 py-2 flex items-center justify-between gap-3">
        <div className="text-xs text-muted-foreground flex items-center gap-2">
          {ws.saving ? (
            <>
              <Loader2 className="size-3.5 animate-spin" /> Saving…
            </>
          ) : ws.lastSaved ? (
            <>
              <CheckCircle2 className="size-3.5 text-emerald-500" />
              Saved {ws.lastSaved.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
            </>
          ) : (
            "Changes autosave as you edit"
          )}
        </div>
        <Button type="button" size="sm" variant="outline" onClick={() => ws.saveProfile(profile)}>
          <Save className="size-4 mr-1" /> Save now
        </Button>
      </footer>
    </div>
  );
}

function WorkspaceSkeleton() {
  return (
    <div className="space-y-4 p-4">
      <Skeleton className="h-12 w-full max-w-md" />
      <div className="grid lg:grid-cols-[240px_1fr_280px] gap-4">
        <Skeleton className="h-96 hidden lg:block" />
        <Skeleton className="h-[600px]" />
        <Skeleton className="h-96 hidden lg:block" />
      </div>
    </div>
  );
}
