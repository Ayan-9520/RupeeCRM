import { Link } from "@tanstack/react-router";
import { AlertTriangle, Crown, Sparkles, ArrowRight } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import type { QuotaCheck } from "@/lib/subscription";
import { PLAN_DISPLAY } from "@/lib/subscription";
import { cn } from "@/lib/utils";

interface Props {
  quota: QuotaCheck | null;
  kind: "leads" | "marketing";
  className?: string;
}

export function PlanQuotaBanner({ quota, kind, className }: Props) {
  if (!quota) return null;
  if (quota.unlimited) return null;

  const pct = quota.limit > 0 ? Math.min(100, (quota.used / quota.limit) * 100) : 100;
  const exceeded = !quota.allowed;
  const nearLimit = !exceeded && pct >= 80;
  const planName = quota.plan_code ? PLAN_DISPLAY[quota.plan_code].name : "Free";

  const labels = kind === "leads"
    ? { unit: "leads", period: "today", upgrade: "Upgrade for more daily leads" }
    : { unit: "posts", period: "this month", upgrade: "Upgrade for more marketing posts" };

  if (!exceeded && !nearLimit) {
    // friendly compact strip
    return (
      <div className={cn("flex items-center gap-2 text-xs text-muted-foreground", className)}>
        <Sparkles className="size-3.5 text-accent" />
        <span>{quota.used} / {quota.limit} {labels.unit} used {labels.period} on <strong className="text-foreground">{planName}</strong></span>
        <Link to="/dashboard/billing" className="ml-auto text-accent font-semibold hover:underline">
          Upgrade →
        </Link>
      </div>
    );
  }

  return (
    <div className={cn(
      "rounded-2xl border px-4 py-3 flex items-start gap-3 flex-wrap",
      exceeded
        ? "border-destructive/40 bg-destructive/10 text-destructive"
        : "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300",
      className,
    )}>
      {exceeded ? <AlertTriangle className="size-5 shrink-0 mt-0.5" /> : <Crown className="size-5 shrink-0 mt-0.5" />}
      <div className="flex-1 min-w-[220px]">
        <div className="font-semibold text-sm">
          {exceeded
            ? `${labels.unit[0].toUpperCase() + labels.unit.slice(1)} limit reached on ${planName}`
            : `Almost out of ${labels.unit} ${labels.period}`}
        </div>
        <div className="text-xs mt-1 opacity-90">
          You've used <strong>{quota.used}</strong> of <strong>{quota.limit}</strong> {labels.unit} {labels.period}.
          {" "}{labels.upgrade}.
        </div>
        <Progress value={pct} className="h-1.5 mt-2 bg-background/60" />
      </div>
      <Link
        to="/dashboard/billing"
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-foreground text-background text-xs font-bold hover:opacity-90 transition-smooth shrink-0"
      >
        See plans <ArrowRight className="size-3.5" />
      </Link>
    </div>
  );
}
