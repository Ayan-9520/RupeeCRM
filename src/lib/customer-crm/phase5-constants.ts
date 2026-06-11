export const DISBURSAL_STATUSES = [
  { value: "pending", label: "Pending", color: "bg-secondary text-muted-foreground" },
  { value: "approved", label: "Approved", color: "bg-blue-500/15 text-blue-700 dark:text-blue-400" },
  { value: "sanctioned", label: "Sanctioned", color: "bg-violet-500/15 text-violet-800" },
  { value: "partially_disbursed", label: "Partially Disbursed", color: "bg-amber-500/15 text-amber-800" },
  { value: "fully_disbursed", label: "Fully Disbursed", color: "bg-emerald-500/15 text-emerald-700" },
  { value: "cancelled", label: "Cancelled", color: "bg-muted text-muted-foreground" },
  { value: "rejected", label: "Rejected", color: "bg-destructive/15 text-destructive" },
] as const;

export const PAYOUT_STATUSES = [
  { value: "expected", label: "Expected" },
  { value: "in_process", label: "In Process" },
  { value: "received", label: "Received" },
  { value: "hold", label: "Hold" },
  { value: "rejected", label: "Rejected" },
] as const;

export const PAYOUT_TYPES = ["commission", "incentive", "trail", "referral", "other"] as const;

export const TIMELINE_FILTERS = [
  "all",
  "call",
  "whatsapp",
  "docs",
  "login",
  "sanction",
  "disbursal",
  "payout",
  "followup",
  "task",
  "note",
  "banker",
  "stage_changed",
] as const;

export const RISK_LEVELS = ["low", "medium", "high"] as const;

export function disbursalStatusMeta(status: string) {
  return DISBURSAL_STATUSES.find((s) => s.value === status) ?? DISBURSAL_STATUSES[0];
}
