import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type PlanCode = Database["public"]["Enums"]["workspace_plan"];
export type BillingCycle = Database["public"]["Enums"]["billing_cycle"];

export interface ActiveSubscription {
  subscription_id: string | null;
  plan_id: string | null;
  plan_code: PlanCode;
  plan_name: string;
  cycle: BillingCycle | null;
  status: string;
  current_period_end: string | null;
  seat_limit: number;
  leads_per_day: number;
  marketing_posts_per_month: number;
  hrms_user_limit: number;
  withdrawal_enabled: boolean;
  whatsapp_enabled: boolean;
  affiliate_enabled: boolean;
  api_access: boolean;
  custom_branding: boolean;
  priority_leads: boolean;
  recharge_bonus_max_pct: number;
  features: string[];
}

export interface QuotaCheck {
  allowed: boolean;
  used: number;
  limit: number;
  reason?: string;
  unlimited?: boolean;
  plan_code?: PlanCode;
}

export const PLAN_DISPLAY: Record<PlanCode, { name: string; tagline: string; color: string }> = {
  free: { name: "Free", tagline: "Try the platform", color: "text-muted-foreground" },
  starter: { name: "Starter", tagline: "Solo DSAs starting out", color: "text-blue-500" },
  growth: { name: "Growth", tagline: "Small teams scaling up", color: "text-emerald-500" },
  pro: { name: "Pro", tagline: "Established agencies", color: "text-violet-500" },
  enterprise: { name: "Enterprise", tagline: "Large lenders & networks", color: "text-amber-500" },
};

export const CYCLE_LABEL: Record<BillingCycle, string> = {
  monthly: "Monthly",
  quarterly: "Quarterly",
  yearly: "Yearly",
};

export const CYCLE_DISCOUNT: Record<BillingCycle, string> = {
  monthly: "",
  quarterly: "Save 10%",
  yearly: "Save 20%",
};

export async function getActiveSubscription(workspaceId: string): Promise<ActiveSubscription | null> {
  const { data, error } = await supabase.rpc("get_active_subscription", { _workspace_id: workspaceId });
  if (error || !data) return null;
  return data as unknown as ActiveSubscription;
}

export async function checkLeadQuota(workspaceId: string | null): Promise<QuotaCheck> {
  if (!workspaceId) return { allowed: false, used: 0, limit: 0, reason: "no_workspace" };
  const { data, error } = await supabase.rpc("can_buy_lead", { _workspace_id: workspaceId });
  if (error || !data) return { allowed: false, used: 0, limit: 0, reason: "error" };
  return data as unknown as QuotaCheck;
}

export async function checkMarketingQuota(workspaceId: string | null): Promise<QuotaCheck> {
  if (!workspaceId) return { allowed: false, used: 0, limit: 0, reason: "no_workspace" };
  const { data, error } = await supabase.rpc("can_create_marketing_post", { _workspace_id: workspaceId });
  if (error || !data) return { allowed: false, used: 0, limit: 0, reason: "error" };
  return data as unknown as QuotaCheck;
}

export function priceForCycle(plan: { price_monthly: number; price_quarterly: number; price_yearly: number }, cycle: BillingCycle): number {
  if (cycle === "monthly") return Number(plan.price_monthly);
  if (cycle === "quarterly") return Number(plan.price_quarterly);
  return Number(plan.price_yearly);
}

export function monthlyEquivalent(plan: { price_monthly: number; price_quarterly: number; price_yearly: number }, cycle: BillingCycle): number {
  const total = priceForCycle(plan, cycle);
  if (cycle === "monthly") return total;
  if (cycle === "quarterly") return Math.round(total / 3);
  return Math.round(total / 12);
}

export function inr(n: number): string {
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}
