/* Case audit entries are written by the Python API (audit_events) and read through loadAuditLogs in phase5-api. */

export type AuditLogInput = {
  customer_profile_id: string;
  lead_purchase_id: string;
  dsa_id: string;
  action_type: string;
  section_name: string;
  field_name?: string;
  old_value?: string | null;
  new_value?: string | null;
  metadata?: Record<string, unknown>;
  action_by: string;
};

export function humanAuditMessage(input: AuditLogInput): string {
  if (input.field_name) {
    return `${input.field_name}: ${input.old_value ?? "—"} → ${input.new_value ?? "—"}`;
  }
  return input.new_value ?? input.action_type;
}
