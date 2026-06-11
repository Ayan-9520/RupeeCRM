import { supabase } from "@/integrations/supabase/client";

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

function missingTable(msg: string): boolean {
  return /does not exist|42P01/i.test(msg);
}

export async function createAuditLog(input: AuditLogInput): Promise<void> {
  const { error } = await supabase.from("customer_audit_logs").insert({
    customer_profile_id: input.customer_profile_id,
    lead_purchase_id: input.lead_purchase_id,
    dsa_id: input.dsa_id,
    action_type: input.action_type,
    section_name: input.section_name,
    field_name: input.field_name ?? null,
    old_value: input.old_value != null ? String(input.old_value).slice(0, 2000) : null,
    new_value: input.new_value != null ? String(input.new_value).slice(0, 2000) : null,
    metadata: input.metadata ?? {},
    action_by: input.action_by,
  });
  if (error && !missingTable(error.message)) {
    console.warn("audit log:", error.message);
  }

  if (!error) {
    await supabase.from("customer_timeline").insert({
      customer_profile_id: input.customer_profile_id,
      lead_purchase_id: input.lead_purchase_id,
      dsa_id: input.dsa_id,
      activity_type: input.action_type,
      title: input.section_name,
      body: humanAuditMessage(input),
      metadata: input.metadata ?? {},
      created_by: input.action_by,
    });
  }
}

export function humanAuditMessage(input: AuditLogInput): string {
  if (input.field_name) {
    return `${input.field_name}: ${input.old_value ?? "—"} → ${input.new_value ?? "—"}`;
  }
  return input.new_value ?? input.action_type;
}
