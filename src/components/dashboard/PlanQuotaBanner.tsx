import { Link } from "@tanstack/react-router";
import { AlertTriangle, Crown, Loader2 } from "lucide-react";
import type { BillingMe } from "@/lib/python-api";
import { cn } from "@/lib/utils";

interface Props {
  billing: BillingMe | null;
  loading: boolean;
  error: string | null;
  className?: string;
}

function inr(n: number) {
  return `₹${Math.round(Number(n) || 0).toLocaleString("en-IN")}`;
}

/** Plan and wallet summary from GET /api/billing/me. Purchases are limited by wallet balance, not a lead count. */
export function PlanQuotaBanner({ billing, loading, error, className }: Props) {
  if (loading) {
    return (
      <div className={cn("flex items-center gap-2 text-xs text-muted-foreground", className)}>
        <Loader2 className="size-3.5 animate-spin" /> Loading plan and wallet…
      </div>
    );
  }

  if (error || !billing) {
    return (
      <div className={cn("flex items-center gap-2 text-xs text-destructive", className)}>
        <AlertTriangle className="size-3.5 shrink-0" />
        <span>Plan and wallet details are unavailable{error ? `: ${error}` : ""}.</span>
      </div>
    );
  }

  const ent = billing.entitlements;
  const plan = billing.available_plans.find((p) => p.id === ent.plan_id);
  const endsAt = ent.plan_ends_at ? new Date(ent.plan_ends_at).toLocaleDateString("en-IN") : null;

  if (!ent.has_active_plan) {
    return (
      <div className={cn("flex flex-wrap items-center gap-2 text-xs text-muted-foreground", className)}>
        <Crown className="size-3.5 text-accent" />
        <span>
          No active plan ({ent.plan_status}). Purchases use your wallet balance of{" "}
          <strong className="text-foreground">{inr(ent.wallet_balance)}</strong>.
        </span>
        <Link to="/dashboard/billing" className="ml-auto text-accent font-semibold hover:underline">
          See plans →
        </Link>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-wrap items-center gap-2 text-xs text-muted-foreground", className)}>
      <Crown className="size-3.5 text-accent" />
      <span>
        <strong className="text-foreground">{ent.plan_name ?? plan?.name ?? ent.plan_id}</strong>
        {ent.plan_cycle ? ` · ${ent.plan_cycle}` : ""}
        {endsAt ? ` · ends ${endsAt}` : ""}
        {plan ? ` · ${inr(plan.lead_credits_monthly)} lead credits per month, added on activation` : ""}
        {" · "}Each purchase deducts the lead's listed price from the wallet.
      </span>
      <Link to="/dashboard/billing" className="ml-auto text-accent font-semibold hover:underline">
        Billing →
      </Link>
    </div>
  );
}
