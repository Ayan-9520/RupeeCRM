import type { CustomerWorkspaceData } from "./types";
import type { EligibilityEngineResult } from "./eligibility-types";
import type { LenderCase } from "./phase4-api";
import type { CustomerDocument } from "./phase3-api";
import { runEnhancedEligibility } from "./eligibility-v2";
import type { CommChannel } from "./phase6-constants";

export type AiInsightDraft = {
  insight_type: string;
  channel: string;
  title: string;
  content: string;
  priority_score: number;
  intent_tags: string[];
  suggested_action?: string;
  scheduled_for?: string;
};

export type AssistantReply = {
  summary: string;
  nextActions: string[];
  missingDocs: string[];
  approvalProbability: number;
  riskNote: string;
  lenderTip: string;
};

function fillTemplate(tpl: string, vars: Record<string, string>) {
  return tpl.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? "");
}

export function generateAiInsights(ctx: {
  workspace: CustomerWorkspaceData;
  eligibility: EligibilityEngineResult | null;
  pipelineStage: string;
  pendingDocs: number;
  lenderCases: LenderCase[];
  latestFollowupNote?: string;
}): AiInsightDraft[] {
  const { workspace, eligibility, pipelineStage, pendingDocs, lenderCases, latestFollowupNote } = ctx;
  const name = workspace.profile.full_name ?? "Customer";
  const enhanced = eligibility ? runEnhancedEligibility({ ...workspace, leadCibil: workspace.purchase.lead?.cibil_score ?? null }) : null;
  const insights: AiInsightDraft[] = [];
  const tags: string[] = [];

  const foir = eligibility?.metrics.foirPercent;
  const prob = enhanced?.rejectionProbability ?? eligibility?.metrics.approvalProbability ?? 50;

  if (pendingDocs > 0) {
    tags.push("docs_pending");
    insights.push({
      insight_type: "followup_suggestion",
      channel: "whatsapp",
      title: "Documents pending",
      content: `${name} is interested but ${pendingDocs} document(s) still pending. Share checklist and set reminder for 2 days.`,
      priority_score: 75,
      intent_tags: ["docs_pending", "high_intent"],
      suggested_action: "Send WhatsApp doc reminder",
    });
  }

  if (foir != null && foir > 55) {
    tags.push("at_risk");
    insights.push({
      insight_type: "next_action",
      channel: "general",
      title: "High FOIR — consider LAP/BL",
      content: `FOIR is ${foir.toFixed(1)}%. Recommend LAP instead of PL or add co-applicant to improve eligibility.`,
      priority_score: 80,
      intent_tags: ["at_risk"],
      suggested_action: "Review product fit with customer",
    });
  }

  if (pipelineStage === "sanctioned" || pipelineStage === "approved") {
    tags.push("sanction_ready", "disbursal_probable");
    insights.push({
      insight_type: "followup_suggestion",
      channel: "call",
      title: "High disbursal probability",
      content: "Sanction in place — confirm disbursal date, UTR tracking, and payout expectation with banker.",
      priority_score: 90,
      intent_tags: ["disbursal_probable", "sanction_ready"],
      suggested_action: "Create disbursal coordination task",
    });
  }

  if (/unreachable|no response|not picking/i.test(latestFollowupNote ?? "")) {
    tags.push("unreachable");
    insights.push({
      insight_type: "followup_suggestion",
      channel: "sms",
      title: "Schedule retry outreach",
      content: "Customer unreachable — retry after salary credit date (1st–5th) via SMS + WhatsApp.",
      priority_score: 65,
      intent_tags: ["unreachable"],
      suggested_action: "Schedule follow-up in 2 days",
      scheduled_for: new Date(Date.now() + 2 * 86400_000).toISOString(),
    });
  }

  const rejected = lenderCases.filter((l) => l.login_status === "rejected");
  if (rejected.length > 0 && lenderCases.some((l) => l.login_status !== "rejected")) {
    insights.push({
      insight_type: "next_action",
      channel: "general",
      title: "Alternate lender available",
      content: `Login rejected at ${rejected[0].lender_name ?? "lender"} — push case to next best offer.`,
      priority_score: 70,
      intent_tags: ["high_intent"],
      suggested_action: "Login with alternate lender",
    });
  }

  if (prob >= 70 && pendingDocs === 0) {
    insights.push({
      insight_type: "intent_tag",
      channel: "general",
      title: "Strong approval outlook",
      content: `Approval probability ~${Math.round(prob)}%. Prioritize bank login this week.`,
      priority_score: 85,
      intent_tags: ["high_intent", "disbursal_probable"],
    });
  }

  if (workspace.profile.salary_credit_date) {
    insights.push({
      insight_type: "followup_suggestion",
      channel: "call",
      title: "Call after salary credit",
      content: `Salary credits around day ${workspace.profile.salary_credit_date} — ideal time for income verification call.`,
      priority_score: 60,
      intent_tags: ["salary_pending", "high_intent"],
      suggested_action: `Call on day ${workspace.profile.salary_credit_date}`,
    });
  }

  return insights.slice(0, 8);
}

export function generateMessageDraft(
  channel: CommChannel,
  workspace: CustomerWorkspaceData,
  purpose: string,
): string {
  const name = workspace.profile.full_name ?? "Customer";
  const product = workspace.loanRequirements[0]?.product_type ?? "loan";
  const vars = { name, dsa: "LeadMines", product };

  if (channel === "whatsapp") {
    if (purpose === "docs")
      return fillTemplate("Hi {{name}}, please share your pending documents for your {{product}} application. — {{dsa}}", vars);
    if (purpose === "sanction")
      return fillTemplate("Hi {{name}}, great news! Your {{product}} is progressing well. We will share sanction details shortly.", vars);
    return fillTemplate("Hi {{name}}, following up on your {{product}} application. When is a good time to speak?", vars);
  }
  if (channel === "sms") {
    return fillTemplate("Dear {{name}}, regarding your {{product}} application — please call us or reply to schedule a callback.", vars);
  }
  if (channel === "email") {
    return fillTemplate(
      "Dear {{name}},\n\nThank you for your {{product}} application with {{dsa}}. We are reviewing your profile and will update you shortly.\n\nRegards,\n{{dsa}}",
      vars,
    );
  }
  return `Call script: Greet ${name}, confirm ${product} requirement, check documents, note objections, schedule next follow-up.`;
}

export function generateCallNotes(workspace: CustomerWorkspaceData, eligibility: EligibilityEngineResult | null): string {
  const foir = eligibility?.metrics.foirPercent?.toFixed(1) ?? "—";
  const cibil = eligibility?.risk.cibilScore ?? workspace.purchase.lead?.cibil_score ?? "—";
  return [
    `Customer: ${workspace.profile.full_name ?? "—"}`,
    `Product: ${eligibility?.primaryProduct ?? "—"}`,
    `CIBIL: ${cibil} | FOIR: ${foir}%`,
    `Discussion: [add notes]`,
    `Outcome: Interested / Callback / Not reachable`,
    `Next: Share documents / Bank login / Co-applicant discussion`,
  ].join("\n");
}

export function buildAssistantReply(ctx: {
  workspace: CustomerWorkspaceData;
  eligibility: EligibilityEngineResult | null;
  pipelineStage: string;
  pendingDocs: number;
  lenderCases: LenderCase[];
  documents: CustomerDocument[];
}): AssistantReply {
  const enhanced = ctx.eligibility
    ? runEnhancedEligibility({ ...ctx.workspace, leadCibil: ctx.workspace.purchase.lead?.cibil_score ?? null })
    : null;

  const missingDocs = ctx.documents.filter((d) => ["pending", "requested"].includes(d.status)).map((d) => d.doc_label);
  const bestLender = enhanced?.lenderWiseEligibility[0] ?? ctx.eligibility?.lenders[0];
  const foir = ctx.eligibility?.metrics.foirPercent;

  let riskNote = "Profile within acceptable risk band.";
  if (foir != null && foir > 55) {
    riskNote = `FOIR is high (${foir.toFixed(1)}%) due to existing EMI — consider LAP instead of PL or add co-applicant.`;
  }

  const nextActions: string[] = [];
  if (missingDocs.length) nextActions.push(`Collect: ${missingDocs.slice(0, 3).join(", ")}`);
  if (ctx.pendingDocs > 0) nextActions.push("Send document checklist on WhatsApp");
  if (ctx.pipelineStage === "sanctioned") nextActions.push("Coordinate disbursal and payout tracking");
  if (!nextActions.length) nextActions.push("Proceed with bank login for best lender");

  return {
    summary: `${ctx.workspace.profile.full_name ?? "Customer"} — ${ctx.eligibility?.primaryProduct ?? "loan"} at stage ${ctx.pipelineStage.replace(/_/g, " ")}. ${ctx.eligibility?.risk.riskGrade ?? "moderate"} risk profile.`,
    nextActions,
    missingDocs,
    approvalProbability: enhanced?.metrics.approvalProbability ?? ctx.eligibility?.metrics.approvalProbability ?? 50,
    riskNote,
    lenderTip: bestLender
      ? `Best lender: ${bestLender.lenderName} (~${Math.round("approvalChance" in bestLender ? bestLender.approvalChance : bestLender.approvalProbability)}% approval). ${"reason" in bestLender ? bestLender.reason : bestLender.notes?.[0] ?? ""}`
      : "Add lender cases to compare offers.",
  };
}
