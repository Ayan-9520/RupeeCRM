import { request } from "@/lib/python-api";
import { insertLosTask, loadLosTasks } from "./phase4-api";
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
  if (!purchaseId) return;
  try {
    await request(`/api/my-leads/${purchaseId}/automation-logs`, {
      method: "POST",
      body: JSON.stringify({
        rule_key: ruleKey,
        status,
        message,
        task_id: taskId ?? null,
        retry_at: retryAt ?? null,
        dsa_id: dsaId,
        customer_profile_id: profileId,
      }),
    });
  } catch {
    /* The task or notification is the user-visible result. A log failure must not look like the rule succeeded. */
  }
}

async function taskExists(purchaseId: string, titlePrefix: string): Promise<boolean> {
  const res = await loadLosTasks(purchaseId);
  if (res.error) return true;
  const prefix = titlePrefix.toLowerCase();
  return res.rows.some((task) => task.status !== "completed" && task.title.toLowerCase().startsWith(prefix));
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
      const { data, error } = await insertLosTask({
        customer_profile_id: profId,
        lead_purchase_id: pid,
        dsa_id: dsaId,
        title,
        task_type: "automation",
        description: `${ctx.pendingDocsCount} document(s) pending for 3+ days`,
        due_at: new Date(Date.now() + 86400_000).toISOString(),
        assigned_user_id: userId,
      });
      if (error) {
        await logAutomation("docs_pending_reminder", dsaId, pid, profId, "failed", error.message);
      } else {
        await logAutomation("docs_pending_reminder", dsaId, pid, profId, "success", title, data?.id);
        const note = await createNotification(userId, "docs_pending", "Docs pending reminder", title, `/dashboard/customer/${pid}`);
        if (!note.error) triggered.push("docs_pending_reminder");
      }
    }
  }

  if (ctx.hasSanction && ctx.pipelineStage === "sanctioned") {
    const title = "Coordinate disbursal";
    if (!(await taskExists(pid, title))) {
      const { data, error } = await insertLosTask({
        customer_profile_id: profId,
        lead_purchase_id: pid,
        dsa_id: dsaId,
        title,
        task_type: "disbursal",
        description: "Sanction approved — initiate disbursal workflow",
        due_at: new Date(Date.now() + 2 * 86400_000).toISOString(),
        assigned_user_id: userId,
      });
      if (error) {
        await logAutomation("sanction_disbursal_task", dsaId, pid, profId, "failed", error.message);
      } else {
        await logAutomation("sanction_disbursal_task", dsaId, pid, profId, "success", title, data?.id);
        triggered.push("sanction_disbursal_task");
      }
    }
  }

  if ((ctx.payoutPendingDays ?? 0) >= 7) {
    const title = "Payout follow-up";
    if (!(await taskExists(pid, title))) {
      const { data, error } = await insertLosTask({
        customer_profile_id: profId,
        lead_purchase_id: pid,
        dsa_id: dsaId,
        title,
        task_type: "payout",
        description: "Payout pending over 7 days — chase with lender",
        due_at: new Date(Date.now() + 86400_000).toISOString(),
        assigned_user_id: userId,
      });
      if (error) {
        await logAutomation("payout_followup", dsaId, pid, profId, "failed", error.message);
      } else {
        await logAutomation("payout_followup", dsaId, pid, profId, "success", title, data?.id);
        triggered.push("payout_followup");
      }
    }
  }

  if (ctx.unreachableFollowup) {
    const retryAt = new Date(Date.now() + 2 * 86400_000).toISOString();
    const title = "Retry: customer unreachable";
    if (!(await taskExists(pid, title))) {
      const { data, error } = await insertLosTask({
        customer_profile_id: profId,
        lead_purchase_id: pid,
        dsa_id: dsaId,
        title,
        task_type: "followup",
        description: "Schedule callback — prior attempt unreachable",
        due_at: retryAt,
        assigned_user_id: userId,
      });
      if (error) {
        await logAutomation("unreachable_retry", dsaId, pid, profId, "failed", error.message);
      } else {
        await logAutomation("unreachable_retry", dsaId, pid, profId, "success", title, data?.id, retryAt);
        const note = await createNotification(userId, "followup_due", "Retry scheduled", title, `/dashboard/customer/${pid}`);
        if (!note.error) triggered.push("unreachable_retry");
      }
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

export async function loadAutomationRules(_dsaId: string) {
  return { rows: [] as { id: string; rule_key: string; name: string; enabled: boolean }[] };
}

export async function loadAutomationLogs(_dsaId: string, _limit = 50) {
  try {
    const data = await request<{ rows: { id: string; rule_key: string; status: string; message: string; retry_at: string | null; created_at: string }[] }>(
      "/api/automation-logs",
    );
    return { rows: data.rows ?? [] };
  } catch (err) {
    return { rows: [], error: err instanceof Error ? err.message : "Could not load automation logs" };
  }
}

export async function toggleAutomationRule(_ruleId: string, _enabled: boolean) {
  return { error: { message: "These rules are part of the product and cannot be turned off here." } };
}
