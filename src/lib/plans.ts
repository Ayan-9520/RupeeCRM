import type { WorkspacePlan } from "@/lib/workspace-context";

export const PLAN_SEATS: Record<WorkspacePlan, number> = {
  starter: 1,
  growth: 3,
  pro: 10,
  enterprise: 9999,
};

export const PLAN_LABEL: Record<WorkspacePlan, string> = {
  starter: "Starter",
  growth: "Growth",
  pro: "Pro",
  enterprise: "Enterprise",
};

export const PLAN_PRICE: Record<WorkspacePlan, string> = {
  starter: "₹999/mo",
  growth: "₹4,999/mo",
  pro: "₹24,999/yr",
  enterprise: "Custom",
};

export function isUnlimited(plan: WorkspacePlan) {
  return plan === "enterprise";
}

export function formatSeats(used: number, plan: WorkspacePlan) {
  return isUnlimited(plan) ? `${used} / ∞` : `${used} / ${PLAN_SEATS[plan]}`;
}

export function nextPlan(plan: WorkspacePlan): WorkspacePlan | null {
  const order: WorkspacePlan[] = ["starter", "growth", "pro", "enterprise"];
  const i = order.indexOf(plan);
  return i >= 0 && i < order.length - 1 ? order[i + 1] : null;
}
