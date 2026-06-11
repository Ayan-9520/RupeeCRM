export const AI_INSIGHT_TYPES = [
  "followup_suggestion",
  "intent_tag",
  "message_draft",
  "next_action",
  "banker_summary",
] as const;

export const COMM_CHANNELS = ["call", "whatsapp", "sms", "email"] as const;
export type CommChannel = (typeof COMM_CHANNELS)[number];

export const SLA_TYPES = [
  { key: "lead_response", label: "Lead response", hours: 4 },
  { key: "login", label: "Bank login", hours: 48 },
  { key: "sanction", label: "Sanction", hours: 120 },
  { key: "disbursal", label: "Disbursal", hours: 72 },
  { key: "payout", label: "Payout", hours: 168 },
] as const;

export const SLA_STATUS_COLORS: Record<string, string> = {
  on_track: "bg-emerald-500/15 text-emerald-700",
  at_risk: "bg-amber-500/15 text-amber-800",
  breached: "bg-destructive/15 text-destructive",
  completed: "bg-blue-500/15 text-blue-700",
};

export const DEFAULT_AUTOMATION_RULES = [
  { rule_key: "docs_pending_reminder", name: "Docs pending > 3 days", days: 3 },
  { rule_key: "sanction_disbursal_task", name: "Sanction → disbursal task" },
  { rule_key: "payout_followup", name: "Payout pending > 7 days", days: 7 },
  { rule_key: "unreachable_retry", name: "Unreachable retry", days: 2 },
  { rule_key: "rejected_lender_alt", name: "Rejected lender → alternate" },
] as const;

export const INTENT_TAGS = [
  "high_intent",
  "docs_pending",
  "salary_pending",
  "unreachable",
  "sanction_ready",
  "disbursal_probable",
  "at_risk",
] as const;
