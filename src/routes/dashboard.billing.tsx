import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useWorkspace, type WorkspacePlan } from "@/lib/workspace-context";
import { supabase } from "@/integrations/supabase/client";
import { PLAN_LABEL, PLAN_PRICE, PLAN_SEATS, isUnlimited } from "@/lib/plans";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Crown, Users, Briefcase, Sparkles, Check, Zap, Receipt, ArrowRight, Loader2, CreditCard, ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/dashboard/billing")({
  head: () => ({ meta: [{ title: "Billing & Subscription — LeadMines" }] }),
  component: BillingPage,
});

const PLAN_PRICE_NUM: Record<WorkspacePlan, number> = {
  starter: 999,
  growth: 4999,
  pro: 24999 / 12, // shown monthly
  enterprise: 0,
};

const PLAN_FEATURES: Record<WorkspacePlan, string[]> = {
  starter: ["1 user seat", "Basic CRM", "Community access", "Wallet & lead marketplace"],
  growth: ["3 user seats", "Full CRM + Pipeline", "Priority support", "HRMS add-on eligible"],
  pro: ["10 user seats", "Unlimited leads", "Full HRMS + Payroll", "Org chart & reports"],
  enterprise: ["Unlimited seats", "Custom payroll rules", "Dedicated CSM", "API access"],
};

const PLAN_TAGLINE: Record<WorkspacePlan, string> = {
  starter: "For solo DSAs starting out",
  growth: "Small teams scaling up",
  pro: "Established agencies",
  enterprise: "Large lenders & networks",
};

function BillingPage() {
  const { current, canManage, refresh } = useWorkspace();
  const [seatCount, setSeatCount] = useState(0);
  const [empCount, setEmpCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [checkoutPlan, setCheckoutPlan] = useState<WorkspacePlan | null>(null);

  useEffect(() => {
    if (!current) return;
    setLoading(true);
    Promise.all([
      supabase.from("workspace_members").select("id", { count: "exact", head: true }).eq("workspace_id", current.id),
      supabase.from("employees").select("id", { count: "exact", head: true }).eq("workspace_id", current.id).eq("status", "active"),
    ]).then(([m, e]) => {
      setSeatCount(m.count ?? 0);
      setEmpCount(e.count ?? 0);
      setLoading(false);
    });
  }, [current?.id]);

  if (!current || loading) {
    return <div className="py-16 grid place-items-center"><Loader2 className="size-6 animate-spin text-accent" /></div>;
  }

  const plan = current.plan;
  const seatLimit = PLAN_SEATS[plan];
  const seatPct = isUnlimited(plan) ? 0 : Math.min(100, (seatCount / seatLimit) * 100);
  const planPrice = PLAN_PRICE_NUM[plan];
  const hrmsPrice = current.hrms_price_per_employee ?? 99;
  const hrmsTotal = current.hrms_enabled ? empCount * hrmsPrice : 0;
  const grandTotal = Math.round(planPrice + hrmsTotal);

  const toggleHrms = async (next: boolean) => {
    if (!canManage) return;
    setBusy(true);
    const { error } = await supabase.from("workspaces").update({ hrms_enabled: next }).eq("id", current.id);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(next ? "HRMS add-on enabled" : "HRMS add-on disabled");
    refresh();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">Billing &amp; Subscription</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage your plan, add-ons and monthly bill for <span className="font-medium text-foreground">{current.name}</span>.</p>
        </div>
        <Badge variant="secondary" className="gap-1.5">
          <ShieldCheck className="size-3" /> Secure billing via Razorpay
        </Badge>
      </div>

      {/* Top stats */}
      <div className="grid md:grid-cols-3 gap-4">
        <StatCard
          icon={Crown}
          label="Current plan"
          value={PLAN_LABEL[plan]}
          sub={PLAN_PRICE[plan]}
          accent
        />
        <StatCard
          icon={Users}
          label="Seats used"
          value={`${seatCount} / ${isUnlimited(plan) ? "∞" : seatLimit}`}
          sub={isUnlimited(plan) ? "Unlimited" : `${Math.round(seatPct)}% of plan`}
          progress={isUnlimited(plan) ? null : seatPct}
        />
        <StatCard
          icon={Briefcase}
          label="HRMS employees"
          value={String(empCount)}
          sub={current.hrms_enabled ? `Billed at ₹${hrmsPrice}/each` : "Add-on disabled"}
        />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Bill summary */}
        <div className="lg:col-span-1 order-2 lg:order-1 space-y-5">
          <div className="rounded-2xl bg-card border border-border overflow-hidden sticky top-4">
            <div className="px-5 py-4 border-b border-border flex items-center gap-2">
              <Receipt className="size-4 text-accent" />
              <h3 className="font-semibold text-sm">This month's bill</h3>
            </div>
            <div className="p-5 space-y-3">
              <Row label={`${PLAN_LABEL[plan]} plan`} value={planPrice > 0 ? `₹${planPrice.toLocaleString("en-IN", { maximumFractionDigits: 0 })}` : "Custom"} />
              <Row
                label="HRMS add-on"
                value={current.hrms_enabled ? `₹${hrmsTotal.toLocaleString("en-IN")}` : "—"}
                sub={current.hrms_enabled ? `${empCount} × ₹${hrmsPrice}` : "Not enabled"}
              />
              <div className="border-t border-dashed border-border pt-3">
                <div className="flex items-end justify-between">
                  <div>
                    <div className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">Total / month</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">Excludes 18% GST</div>
                  </div>
                  <div className="font-display text-3xl font-bold">₹{grandTotal.toLocaleString("en-IN")}</div>
                </div>
              </div>
              <Button className="w-full gap-2" disabled={!canManage} onClick={() => setCheckoutPlan(plan)}>
                <CreditCard className="size-4" /> Pay now
              </Button>
              <p className="text-[11px] text-muted-foreground text-center">
                Auto-charges on the 1st of every month. Cancel anytime.
              </p>
            </div>
          </div>

          {/* HRMS toggle */}
          <div className="rounded-2xl bg-card border border-border p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="size-9 rounded-xl bg-accent/15 grid place-items-center shrink-0">
                  <Sparkles className="size-4 text-accent" />
                </div>
                <div>
                  <div className="font-semibold text-sm">HRMS &amp; Payroll add-on</div>
                  <div className="text-xs text-muted-foreground mt-0.5">₹{hrmsPrice}/employee/month</div>
                </div>
              </div>
              <Switch checked={current.hrms_enabled} onCheckedChange={toggleHrms} disabled={busy || !canManage} />
            </div>
          </div>
        </div>

        {/* Plans */}
        <div className="lg:col-span-2 order-1 lg:order-2 space-y-3">
          <h2 className="font-display text-lg font-bold">Choose a plan</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {(Object.keys(PLAN_LABEL) as WorkspacePlan[]).map((p) => (
              <PlanCard
                key={p}
                plan={p}
                isCurrent={p === plan}
                onSelect={() => setCheckoutPlan(p)}
                disabled={!canManage}
              />
            ))}
          </div>
        </div>
      </div>

      <CheckoutDialog
        plan={checkoutPlan}
        currentPlan={plan}
        open={!!checkoutPlan}
        onOpenChange={(o) => !o && setCheckoutPlan(null)}
        hrmsEnabled={current.hrms_enabled}
        empCount={empCount}
        hrmsPrice={hrmsPrice}
        workspaceId={current.id}
        onSuccess={() => { setCheckoutPlan(null); refresh(); }}
      />
    </div>
  );
}

function StatCard({ icon: Icon, label, value, sub, progress, accent }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  sub?: string;
  progress?: number | null;
  accent?: boolean;
}) {
  return (
    <div className={cn(
      "rounded-2xl border p-5",
      accent ? "border-accent/40 bg-gradient-to-br from-accent/10 to-transparent" : "border-border bg-card",
    )}>
      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground font-semibold">
        <Icon className="size-3.5" /> {label}
      </div>
      <div className="font-display text-2xl font-bold mt-2">{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
      {typeof progress === "number" && (
        <Progress value={progress} className={cn("h-1.5 mt-3", progress >= 100 && "[&>div]:bg-destructive")} />
      )}
    </div>
  );
}

function Row({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div className="flex items-start justify-between gap-3 text-sm">
      <div>
        <div>{label}</div>
        {sub && <div className="text-[11px] text-muted-foreground mt-0.5">{sub}</div>}
      </div>
      <div className="font-mono font-medium">{value}</div>
    </div>
  );
}

function PlanCard({ plan, isCurrent, onSelect, disabled }: {
  plan: WorkspacePlan; isCurrent: boolean; onSelect: () => void; disabled: boolean;
}) {
  const recommended = plan === "growth";
  return (
    <div className={cn(
      "rounded-2xl border p-5 relative flex flex-col",
      isCurrent ? "border-accent bg-accent/5" : recommended ? "border-accent/50" : "border-border bg-card",
    )}>
      {recommended && !isCurrent && (
        <div className="absolute -top-2.5 left-4 px-2 py-0.5 rounded-full bg-accent text-accent-foreground text-[10px] font-bold uppercase tracking-wide">
          Popular
        </div>
      )}
      {isCurrent && (
        <div className="absolute -top-2.5 left-4 px-2 py-0.5 rounded-full bg-foreground text-background text-[10px] font-bold uppercase tracking-wide">
          Current
        </div>
      )}
      <div className="font-display text-lg font-bold">{PLAN_LABEL[plan]}</div>
      <div className="text-xs text-muted-foreground">{PLAN_TAGLINE[plan]}</div>
      <div className="font-display text-2xl font-bold mt-3">{PLAN_PRICE[plan]}</div>
      <ul className="mt-4 space-y-2 flex-1">
        {PLAN_FEATURES[plan].map((f) => (
          <li key={f} className="text-xs flex items-start gap-2">
            <Check className="size-3.5 text-accent mt-0.5 shrink-0" /> {f}
          </li>
        ))}
      </ul>
      <Button
        variant={isCurrent ? "secondary" : "default"}
        className="mt-5 w-full gap-2"
        onClick={onSelect}
        disabled={disabled || isCurrent}
      >
        {isCurrent ? "Active plan" : <>Switch to {PLAN_LABEL[plan]} <ArrowRight className="size-4" /></>}
      </Button>
    </div>
  );
}

function CheckoutDialog({
  plan, currentPlan, open, onOpenChange, hrmsEnabled, empCount, hrmsPrice, workspaceId, onSuccess,
}: {
  plan: WorkspacePlan | null;
  currentPlan: WorkspacePlan;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  hrmsEnabled: boolean;
  empCount: number;
  hrmsPrice: number;
  workspaceId: string;
  onSuccess: () => void;
}) {
  const [busy, setBusy] = useState(false);
  if (!plan) return null;

  const planPrice = PLAN_PRICE_NUM[plan];
  const hrmsTotal = hrmsEnabled ? empCount * hrmsPrice : 0;
  const subtotal = Math.round(planPrice + hrmsTotal);
  const gst = Math.round(subtotal * 0.18);
  const total = subtotal + gst;
  const isSwitch = plan !== currentPlan;

  const pay = async () => {
    setBusy(true);
    // Update plan in DB to simulate successful payment for the demo flow.
    if (isSwitch) {
      const { error } = await supabase.from("workspaces").update({ plan }).eq("id", workspaceId);
      if (error) { setBusy(false); toast.error(error.message); return; }
    }
    setTimeout(() => {
      setBusy(false);
      toast.success(isSwitch ? `Upgraded to ${PLAN_LABEL[plan]}` : "Payment successful");
      onSuccess();
    }, 900);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-gradient-to-br from-accent/30 to-accent/10 grid place-items-center">
              <Zap className="size-5 text-accent" />
            </div>
            <div>
              <DialogTitle>{isSwitch ? `Switch to ${PLAN_LABEL[plan]}` : "Pay monthly bill"}</DialogTitle>
              <DialogDescription>Secure checkout powered by Razorpay</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="rounded-xl border border-border bg-secondary/30 p-4 space-y-2.5 text-sm">
          <Row label={`${PLAN_LABEL[plan]} plan`} value={`₹${planPrice.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`} />
          {hrmsEnabled && (
            <Row label="HRMS add-on" value={`₹${hrmsTotal.toLocaleString("en-IN")}`} sub={`${empCount} × ₹${hrmsPrice}`} />
          )}
          <div className="flex justify-between text-xs text-muted-foreground border-t border-dashed border-border pt-2">
            <span>GST (18%)</span><span className="font-mono">₹{gst.toLocaleString("en-IN")}</span>
          </div>
          <div className="flex justify-between font-semibold pt-1">
            <span>Total</span><span className="font-mono">₹{total.toLocaleString("en-IN")}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <ShieldCheck className="size-3.5 text-accent" />
          UPI, Cards, Netbanking & Wallets supported
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button onClick={pay} disabled={busy} className="gap-2">
            {busy ? <Loader2 className="size-4 animate-spin" /> : <CreditCard className="size-4" />}
            Pay ₹{total.toLocaleString("en-IN")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
