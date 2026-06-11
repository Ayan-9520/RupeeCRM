export const LOS_PIPELINE_STAGES = [
  { value: "lead_purchased", label: "Lead Purchased", color: "bg-slate-500/15 text-slate-700 dark:text-slate-300" },
  { value: "calling_started", label: "Calling Started", color: "bg-blue-500/15 text-blue-700 dark:text-blue-400" },
  { value: "docs_pending", label: "Docs Pending", color: "bg-amber-500/15 text-amber-800 dark:text-amber-400" },
  { value: "docs_received", label: "Docs Received", color: "bg-cyan-500/15 text-cyan-800 dark:text-cyan-400" },
  { value: "eligibility_check", label: "Eligibility Check", color: "bg-violet-500/15 text-violet-800 dark:text-violet-400" },
  { value: "bank_login", label: "Bank Login", color: "bg-indigo-500/15 text-indigo-800 dark:text-indigo-400" },
  { value: "underwriting", label: "Underwriting", color: "bg-purple-500/15 text-purple-800 dark:text-purple-400" },
  { value: "approved", label: "Approved", color: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" },
  { value: "sanctioned", label: "Sanctioned", color: "bg-green-600/15 text-green-800 dark:text-green-400" },
  { value: "disbursed", label: "Disbursed", color: "bg-teal-600/15 text-teal-800 dark:text-teal-400" },
  { value: "rejected", label: "Rejected", color: "bg-destructive/15 text-destructive" },
  { value: "hold", label: "Hold", color: "bg-orange-500/15 text-orange-800 dark:text-orange-400" },
  { value: "closed", label: "Closed", color: "bg-muted text-muted-foreground" },
] as const;

export type LosPipelineStage = (typeof LOS_PIPELINE_STAGES)[number]["value"];

export const LENDER_LOGIN_STATUSES = [
  "draft",
  "logged_in",
  "under_review",
  "approved",
  "rejected",
  "sanctioned",
  "disbursed",
  "closed",
] as const;

export const TASK_STATUSES = ["pending", "in_progress", "completed", "hold"] as const;

export const TASK_TYPES = [
  "collect_docs",
  "call_customer",
  "bank_login",
  "eligibility_check",
  "verify_profile",
  "send_sanction",
  "disbursal_followup",
  "general",
] as const;

export const FOLLOWUP_NOTE_TYPES = ["call", "whatsapp", "meeting", "email", "other"] as const;

export const DOCUMENT_STATUSES_V4 = [
  "pending",
  "requested",
  "received",
  "uploaded",
  "under_review",
  "verified",
  "rejected",
  "expired",
] as const;

export function stageMeta(stage: string) {
  return LOS_PIPELINE_STAGES.find((s) => s.value === stage) ?? LOS_PIPELINE_STAGES[0];
}

export function stageLabel(stage: string) {
  return stageMeta(stage).label;
}
