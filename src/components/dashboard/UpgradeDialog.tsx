import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Sparkles, Check, Zap } from "lucide-react";
import { PLAN_LABEL, PLAN_PRICE, PLAN_SEATS, nextPlan, isUnlimited } from "@/lib/plans";
import type { WorkspacePlan } from "@/lib/workspace-context";

interface UpgradeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentPlan: WorkspacePlan;
  currentSeats: number;
  onUpgrade?: (plan: WorkspacePlan) => void;
}

const FEATURES: Record<WorkspacePlan, string[]> = {
  starter: ["1 user seat", "Basic CRM", "Community access"],
  growth: ["3 user seats", "Full CRM + Pipeline", "Priority support", "Basic payroll"],
  pro: ["10 user seats", "Unlimited leads", "Full HRMS + Payroll", "Org chart"],
  enterprise: ["Unlimited seats", "Custom payroll rules", "Dedicated support", "API access"],
};

export function UpgradeDialog({ open, onOpenChange, currentPlan, currentSeats, onUpgrade }: UpgradeDialogProps) {
  const suggested = nextPlan(currentPlan);
  const limit = PLAN_SEATS[currentPlan];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-gradient-to-br from-accent/30 to-accent/10 grid place-items-center">
              <Sparkles className="size-5 text-accent" />
            </div>
            <div>
              <DialogTitle className="text-xl">Seat limit reached</DialogTitle>
              <p className="text-sm text-muted-foreground mt-0.5">
                You're using {currentSeats} of {isUnlimited(currentPlan) ? "∞" : limit} seats on the {PLAN_LABEL[currentPlan]} plan.
              </p>
            </div>
          </div>
        </DialogHeader>

        {suggested ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 my-2">
            <div className="rounded-xl border border-border p-4 bg-secondary/40">
              <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Current</div>
              <div className="font-semibold">{PLAN_LABEL[currentPlan]}</div>
              <div className="text-2xl font-display font-bold mt-1">{PLAN_PRICE[currentPlan]}</div>
              <ul className="mt-3 space-y-1.5">
                {FEATURES[currentPlan].map((f) => (
                  <li key={f} className="text-xs flex items-center gap-2 text-muted-foreground">
                    <Check className="size-3.5" /> {f}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-xl border-2 border-accent p-4 bg-accent/5 relative">
              <div className="absolute -top-2.5 left-4 px-2 py-0.5 rounded-full bg-accent text-accent-foreground text-[10px] font-bold uppercase tracking-wide">Upgrade to</div>
              <div className="text-xs uppercase tracking-wide text-accent mb-1 mt-1">Recommended</div>
              <div className="font-semibold">{PLAN_LABEL[suggested]}</div>
              <div className="text-2xl font-display font-bold mt-1">{PLAN_PRICE[suggested]}</div>
              <ul className="mt-3 space-y-1.5">
                {FEATURES[suggested].map((f) => (
                  <li key={f} className="text-xs flex items-center gap-2">
                    <Check className="size-3.5 text-accent" /> {f}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : (
          <div className="py-4 text-sm text-muted-foreground">You're already on the highest plan. Contact us for custom enterprise expansion.</div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Maybe later</Button>
          {suggested && (
            <Button onClick={() => onUpgrade?.(suggested)} className="gap-2">
              <Zap className="size-4" /> Upgrade to {PLAN_LABEL[suggested]}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
