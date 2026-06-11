import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { runEligibilityEngine } from "@/lib/customer-crm/eligibility-engine";
import { persistEligibilitySnapshot, updateWorkflowStage } from "@/lib/customer-crm/eligibility-api";
import type { WorkflowStage } from "@/lib/customer-crm/eligibility-types";
import { Link } from "@tanstack/react-router";
import { useDebouncedCallback } from "@/hooks/useDebouncedCallback";
import { useSectionObserver } from "@/hooks/useSectionObserver";
import { useCustomerWorkspace } from "@/hooks/useCustomerWorkspace";
import { NAV_SECTIONS } from "@/lib/customer-crm/constants";
import { normalizeProfilePatch, toNumberOrNull } from "@/lib/customer-crm/normalize";
import { computeCustomerRisk } from "@/lib/customer-crm/risk-scoring";
import { buildAssistantReply } from "@/lib/customer-crm/ai-intelligence";
import type { BankAccount, CoApplicant, CustomerProfile, LoanRequirement, Obligation } from "@/lib/customer-crm/types";
import { useAuth } from "@/lib/auth-context";
import { ArrowLeft, Loader2, Save, CheckCircle2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CustomerRightPanel } from "./CustomerRightPanel";
import { CustomerWorkspaceHeader } from "./CustomerWorkspaceHeader";
import { EligibilityDashboard } from "./EligibilityDashboard";
import { WorkspaceSidebar } from "./WorkspaceSidebar";
import { DocumentsCenter } from "./DocumentsCenter";
import { BankLoginsSection } from "./BankLoginsSection";
import { LosOperationsHub } from "./los/LosOperationsHub";
import { CaseSummaryPanel } from "./phase5/CaseSummaryPanel";
import { Phase5Hub } from "./phase5/Phase5Hub";
import { Phase6Hub } from "./phase6/Phase6Hub";
import { CrmAssistant } from "./phase6/CrmAssistant";
import { loadLosDashboardStats, ensureLosPipeline, loadLenderCases, type LosDashboardStats } from "@/lib/customer-crm/phase4-api";
import { loadDisbursals, loadPayouts } from "@/lib/customer-crm/phase5-api";
import { loadFollowups } from "@/lib/customer-crm/phase3-api";
import { runAutomationForCase } from "@/lib/customer-crm/automation-engine";
import { loadCustomerDocuments } from "@/lib/customer-crm/phase3-api";
import type { CustomerDocument } from "@/lib/customer-crm/phase3-api";
import {
  PersonalSection,
  EmploymentSection,
  BankingSection,
  ObligationsSection,
  CoApplicantsSection,
  LoanRequirementsSection,
} from "./CustomerSections";

export function CustomerWorkspacePage({ purchaseId }: { purchaseId: string }) {
  const { user } = useAuth();
  const ws = useCustomerWorkspace(purchaseId);
  const [navOverride, setNavOverride] = useState<string | null>(null);
  const [focusNote, setFocusNote] = useState(false);
  const [pendingDocs, setPendingDocs] = useState(0);
  const [activeBankLogins, setActiveBankLogins] = useState(0);
  const [losStats, setLosStats] = useState<LosDashboardStats | null>(null);
  const [pipelineStage, setPipelineStage] = useState<string>("lead_purchased");
  const [workflowStage, setWorkflowStage] = useState<WorkflowStage>("profile_completed");
  const [phase2MigrationHint, setPhase2MigrationHint] = useState(false);
  const [documents, setDocuments] = useState<CustomerDocument[]>([]);
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});
  const mainScrollRef = useRef<HTMLElement | null>(null);
  const sectionIds = useMemo(() => NAV_SECTIONS.map((s) => s.id), []);
  const observedSection = useSectionObserver(sectionIds, sectionRefs, mainScrollRef);
  const active = navOverride ?? observedSection;
  const workflowInitialized = useRef(false);

  useEffect(() => {
    workflowInitialized.current = false;
  }, [purchaseId]);

  const scrollTo = (id: string) => {
    setNavOverride(id);
    sectionRefs.current[id]?.scrollIntoView({ behavior: "smooth", block: "start" });
    window.setTimeout(() => setNavOverride(null), 800);
  };

  const debouncedProfileSave = useDebouncedCallback((patch: Partial<CustomerProfile>) => {
    ws.saveProfile(patch);
  }, 700);

  const onProfileField = useCallback(
    (key: string, value: unknown) => {
      const patch = normalizeProfilePatch({ [key]: value }) as Partial<CustomerProfile>;
      ws.setProfile(patch);
      debouncedProfileSave(patch);
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

  useEffect(() => {
    if (!user || !ws.data) return;
    (async () => {
      const stats = await loadLosDashboardStats(user.id);
      setLosStats(stats);
      const pipe = await ensureLosPipeline(ws.data!.profile.id, purchaseId, user.id);
      if (pipe.pipeline) setPipelineStage(pipe.pipeline.current_stage);
      const docs = await loadCustomerDocuments(purchaseId);
      setDocuments(docs.docs);
    })();
  }, [user, ws.data, purchaseId]);

  useEffect(() => {
    if (!user || !ws.data || !eligibility) return;
    (async () => {
      const [lenders, disb, payouts, fu] = await Promise.all([
        loadLenderCases(purchaseId),
        loadDisbursals(purchaseId),
        loadPayouts(purchaseId),
        loadFollowups(purchaseId),
      ]);
      const hasSanction = lenders.rows.some((l) => Number(l.sanctioned_amount) > 0);
      const rejected = lenders.rows.filter((l) => l.login_status === "rejected").length;
      const unreachable = fu.rows.some((f) => /unreachable|no response/i.test(f.discussion_notes ?? ""));
      const payoutPending = payouts.rows.filter((p) => !["received", "rejected"].includes(p.payout_status));
      const oldestPayout = payoutPending[0]?.created_at;
      const payoutDays = oldestPayout
        ? Math.floor((Date.now() - new Date(oldestPayout).getTime()) / 86400_000)
        : 0;
      await runAutomationForCase({
        workspace: ws.data!,
        userId: user.id,
        pipelineStage,
        pendingDocsCount: pendingDocs,
        pendingDocsDays: pendingDocs > 0 ? 3 : 0,
        payoutPendingDays: payoutDays,
        hasSanction,
        rejectedLenderCount: rejected,
        unreachableFollowup: unreachable,
      });
    })();
  }, [user, ws.data?.profile.id, pipelineStage, pendingDocs, purchaseId]);

  const pendingFollowups = useMemo(() => {
    if (!ws.data?.purchase.next_followup_at) return false;
    return ws.data.purchase.next_followup_at.slice(0, 10) <= new Date().toISOString().slice(0, 10);
  }, [ws.data?.purchase.next_followup_at]);

  const risk = useMemo(() => {
    if (!ws.data) return { level: "medium" as const };
    return computeCustomerRisk(ws.data, eligibility);
  }, [ws.data, eligibility]);

  const aiSuggestion = useMemo(() => {
    if (!ws.data) return undefined;
    const reply = buildAssistantReply({
      workspace: ws.data,
      eligibility,
      pipelineStage,
      pendingDocs,
      lenderCases: [],
      documents,
    });
    return reply.nextActions[0] ?? reply.summary;
  }, [ws.data, eligibility, pipelineStage, pendingDocs, documents]);

  const onBankField = (row: BankAccount, key: string, value: unknown) => {
    const patch: Partial<BankAccount> = { [key]: value } as Partial<BankAccount>;
    if (key === "average_balance") patch.average_balance = toNumberOrNull(value);
    ws.upsertBank(row, patch);
  };

  const onObligationField = (row: Obligation, key: string, value: unknown) => {
    const patch: Partial<Obligation> = { [key]: value } as Partial<Obligation>;
    if (["emi", "outstanding_amount", "sanction_amount", "remaining_tenure"].includes(key)) {
      (patch as Record<string, unknown>)[key] = toNumberOrNull(value);
    }
    ws.upsertObligation(row, patch);
  };

  const onCoField = (row: CoApplicant, key: string, value: unknown) => {
    const patch: Partial<CoApplicant> = { [key]: value } as Partial<CoApplicant>;
    if (key === "income" || key === "cibil_score") {
      patch[key] = toNumberOrNull(value) as never;
    }
    ws.upsertCoApp(row, patch);
  };

  const onLoanChange = (row: LoanRequirement, patch: Partial<LoanRequirement>) => {
    ws.upsertLoan(row, patch);
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
  return (
    <div className="-m-4 lg:-m-6 min-h-[calc(100vh-3.5rem)] flex flex-col bg-background">
      <CustomerWorkspaceHeader
        purchaseId={purchaseId}
        workspace={ws.data}
        pipelineStage={pipelineStage}
        eligibility={eligibility}
        pendingDocs={pendingDocs}
        activeLenders={activeBankLogins}
        pendingFollowups={pendingFollowups}
        riskLevel={risk.level}
        onAddNote={() => setFocusNote(true)}
      />
      <div className="flex flex-1 min-h-0 flex-col lg:flex-row">
        <WorkspaceSidebar
          completionOverall={ws.completion.overall}
          sectionCompletion={ws.completion.sections}
          navSections={NAV_SECTIONS}
          active={active}
          onNavigate={scrollTo}
          eligibility={eligibility}
          pendingDocs={pendingDocs}
          activeBankLogins={activeBankLogins}
          pendingFollowups={pendingFollowups}
          losStats={losStats}
          pipelineStage={pipelineStage}
        />

        <main
          ref={mainScrollRef}
          className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-5 min-w-0 scroll-smooth"
        >
          <div className="sticky top-0 z-10 -mx-1 px-1 pb-2 bg-gradient-to-b from-background via-background/95 to-transparent">
            <CaseSummaryPanel workspace={ws.data} eligibility={eligibility} pipelineStage={pipelineStage} />
          </div>
          <section ref={(el) => { sectionRefs.current.personal = el; }} id="personal" className="scroll-mt-28">
            <PersonalSection profile={profile} onFieldChange={onProfileField} completion={ws.completion.sections.personal ?? 0} />
          </section>
          <section ref={(el) => { sectionRefs.current.employment = el; }} id="employment" className="scroll-mt-28">
            <EmploymentSection profile={profile} onFieldChange={onProfileField} completion={ws.completion.sections.employment ?? 0} />
          </section>
          <section ref={(el) => { sectionRefs.current.banking = el; }} id="banking" className="scroll-mt-28">
            <BankingSection
              accounts={ws.data.bankAccounts}
              onChange={onBankField}
              onAdd={ws.addBank}
              onRemove={ws.removeBank}
              completion={ws.completion.sections.banking ?? 0}
            />
          </section>
          <section ref={(el) => { sectionRefs.current.obligations = el; }} id="obligations" className="scroll-mt-28">
            <ObligationsSection
              rows={ws.data.obligations}
              onChange={onObligationField}
              onAdd={ws.addObligation}
              onRemove={ws.removeObligation}
              completion={ws.completion.sections.obligations ?? 0}
              summary={obligationSummary}
            />
          </section>
          <section ref={(el) => { sectionRefs.current["co-applicants"] = el; }} id="co-applicants" className="scroll-mt-28">
            <CoApplicantsSection
              rows={ws.data.coApplicants}
              onChange={onCoField}
              onAdd={ws.addCoApp}
              onRemove={ws.removeCoApp}
              completion={ws.completion.sections["co-applicants"] ?? 0}
            />
          </section>
          <section ref={(el) => { sectionRefs.current["loan-requirements"] = el; }} id="loan-requirements" className="scroll-mt-28">
            <LoanRequirementsSection
              rows={ws.data.loanRequirements}
              onChange={onLoanChange}
              onAdd={ws.addLoan}
              onRemove={ws.removeLoan}
              completion={ws.completion.sections["loan-requirements"] ?? 0}
            />
          </section>
          <section ref={(el) => { sectionRefs.current.eligibility = el; }} id="eligibility" className="scroll-mt-28">
            {eligibility && (
              <EligibilityDashboard
                result={eligibility}
                workspace={ws.data}
                cibilFromLead={ws.data.purchase.lead?.cibil_score ?? null}
                workflowStage={workflowStage}
                onWorkflowChange={onWorkflowChange}
                phase2MigrationHint={phase2MigrationHint}
              />
            )}
          </section>
          <section ref={(el) => { sectionRefs.current.documents = el; }} id="documents" className="scroll-mt-28">
            <DocumentsCenter
              profile={profile}
              leadId={ws.data.purchase.lead_id}
              onDocsChange={setPendingDocs}
            />
          </section>
          <section ref={(el) => { sectionRefs.current["los-ops"] = el; }} id="los-ops" className="scroll-mt-28">
            {user && (
              <LosOperationsHub
                profile={profile}
                dsaId={user.id}
                onPipelineStage={setPipelineStage}
                onLenderCount={setActiveBankLogins}
              />
            )}
          </section>
          <section ref={(el) => { sectionRefs.current.finance = el; }} id="finance" className="scroll-mt-28">
            {user && (
              <Phase5Hub
                profile={profile}
                userId={user.id}
                workspace={ws.data}
                eligibility={eligibility}
                pipelineStage={pipelineStage}
              />
            )}
          </section>
          <section ref={(el) => { sectionRefs.current.intelligence = el; }} id="intelligence" className="scroll-mt-28">
            {user && (
              <Phase6Hub
                profile={profile}
                workspace={ws.data}
                eligibility={eligibility}
                pipelineStage={pipelineStage}
                pendingDocs={pendingDocs}
                phone={phone}
                documents={documents}
              />
            )}
          </section>
          <section ref={(el) => { sectionRefs.current.processing = el; }} id="processing" className="scroll-mt-28">
            {user && (
              <BankLoginsSection profile={profile} dsaId={user.id} onCountChange={setActiveBankLogins} />
            )}
          </section>
        </main>

        <CustomerRightPanel
          purchaseId={purchaseId}
          profile={profile}
          pipelineStage={purchase.pipeline_stage}
          nextFollowup={purchase.next_followup_at}
          onFollowupSaved={ws.reload}
          focusNote={focusNote}
          aiSuggestion={aiSuggestion}
        />
      </div>

      {eligibility && (
        <CrmAssistant
          workspace={ws.data}
          eligibility={eligibility}
          pipelineStage={pipelineStage}
          pendingDocs={pendingDocs}
          documents={documents}
        />
      )}

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

