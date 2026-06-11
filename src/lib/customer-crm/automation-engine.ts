import { supabase } from "@/integrations/supabase/client";
import { insertLosTask } from "./phase4-api";
import { createNotification } from "./notifications-service";
import type { CustomerWorkspaceData } from "./types";

export type AutomationContext = {
  workspace: CustomerWorkspaceData;
  userId: string;
  pipelineStage: string;
  pendingDocsCount: number;
  pendingDocsDays?: number;
  payoutPendingDays?: number;
  hasSanction: boolean;
  rejectedLenderCount: number;
  unreachableFollowup?: boolean;
};

function missingTable(msg: string): boolean {
  return /does not exist|42P01/i.test(msg);
}

export async function logAutomation(
  ruleKey: string,
  dsaId: string,
  purchaseId: string | null,
  profileId: string | null,
  status: string,
  message: string,
  taskId?: string,
  retryAt?: string,
) {
  const { error } = await supabase.from("customer_automation_logs").insert({
    rule_key: ruleKey,
    dsa_id: dsaId,
    lead_purchase_id: purchaseId,
    customer_profile_id: profileId,
    status,
    message,
    task_id: taskId ?? null,
    retry_at: retryAt ?? null,
    metadata: {},
  });
  if (error && !missingTable(error.message)) console.warn("automation log:", error.message);
}

async function taskExists(purchaseId: string, titlePrefix: string): Promise<boolean> {
  const { data } = await supabase
    .from("customer_tasks")
    .select("id")
    .eq("lead_purchase_id", purchaseId)
    .ilike("title", `${titlePrefix}%`)
    .neq("status", "completed")
    .limit(1);
  return (data?.length ?? 0) > 0;
}

export async function runAutomationForCase(ctx: AutomationContext): Promise<{ triggered: string[] }> {
  const triggered: string[] = [];
  const { workspace, userId } = ctx;
  const pid = workspace.profile.lead_purchase_id;
  const profId = workspace.profile.id;
  const dsaId = workspace.profile.dsa_id;

  if (ctx.pendingDocsCount > 0 && (ctx.pendingDocsDays ?? 0) >= 3) {
    const title = "Reminder: pending documents";
    if (!(await taskExists(pid, title))) {
      const { data } = await insertLosTask({
        customer_profile_id: profId,
        lead_purchase_id: pid,
        dsa_id: dsaId,
        title,
        task_type: "automation",
        description: `${ctx.pendingDocsCount} document(s) pending for 3+ days`,
        due_at: new Date(Date.now() + 86400_000).toISOString(),
        assigned_user_id: userId,
      });
      await logAutomation("docs_pending_reminder", dsaId, pid, profId, "success", title, data?.id as string | undefined);
      await createNotification(userId, "docs_pending", "Docs pending reminder", title, `/dashboard/customer/${pid}`);
      triggered.push("docs_pending_reminder");
    }
  }

  if (ctx.hasSanction && ctx.pipelineStage === "sanctioned") {
    const title = "Coordinate disbursal";
    if (!(await taskExists(pid, title))) {
      const { data } = await insertLosTask({
        customer_profile_id: profId,
        lead_purchase_id: pid,
        dsa_id: dsaId,
        title,
        task_type: "disbursal",
        description: "Sanction approved — initiate disbursal workflow",
        due_at: new Date(Date.now() + 2 * 86400_000).toISOString(),
        assigned_user_id: userId,
      });
      await logAutomation("sanction_disbursal_task", dsaId, pid, profId, "success", title, data?.id as string | undefined);
      triggered.push("sanction_disbursal_task");
    }
  }

  if ((ctx.payoutPendingDays ?? 0) >= 7) {
    const title = "Payout follow-up";
    if (!(await taskExists(pid, title))) {
      const { data } = await insertLosTask({
        customer_profile_id: profId,
        lead_purchase_id: pid,
        dsa_id: dsaId,
        title,
        task_type: "payout",
        description: "Payout pending over 7 days — chase with lender",
        due_at: new Date(Date.now() + 86400_000).toISOString(),
        assigned_user_id: userId,
      });
      await logAutomation("payout_followup", dsaId, pid, profId, "success", title, data?.id as string | undefined);
      triggered.push("payout_followup");
    }
  }

  if (ctx.unreachableFollowup) {
    const retryAt = new Date(Date.now() + 2 * 86400_000).toISOString();
    const title = "Retry: customer unreachable";
    if (!(await taskExists(pid, title))) {
      const { data } = await insertLosTask({
        customer_profile_id: profId,
        lead_purchase_id: pid,
        dsa_id: dsaId,
        title,
        task_type: "followup",
        description: "Schedule callback — prior attempt unreachable",
        due_at: retryAt,
        assigned_user_id: userId,
      });
      await logAutomation("unreachable_retry", dsaId, pid, profId, "success", title, data?.id as string | undefined, retryAt);
      await createNotification(userId, "followup_due", "Retry scheduled", title, `/dashboard/customer/${pid}`);
      triggered.push("unreachable_retry");
    }
  }

  if (ctx.rejectedLenderCount > 0) {
    await logAutomation(
      "rejected_lender_alt",
      dsaId,
      pid,
      profId,
      "success",
      "Recommend alternate lender login",
    );
    triggered.push("rejected_lender_alt");
  }

  return { triggered };
}

export async function loadAutomationRules(dsaId: string) {
  const { data, error } = await supabase
    .from("customer_automation_rules")
    .select("*")
    .or(`dsa_id.eq.${dsaId},dsa_id.is.null`)
    .order("rule_key");
  if (error && missingTable(error.message)) return { rows: [], migrationRequired: true };
  return { rows: data ?? [] };
}

export async function loadAutomationLogs(dsaId: string, limit = 50) {
  const { data, error } = await supabase
    .from("customer_automation_logs")
    .select("*")
    .eq("dsa_id", dsaId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error && missingTable(error.message)) return { rows: [], migrationRequired: true };
  return { rows: data ?? [] };
}

export async function toggleAutomationRule(ruleId: string, enabled: boolean) {
  return supabase.from("customer_automation_rules").update({ enabled }).eq("id", ruleId);
}
