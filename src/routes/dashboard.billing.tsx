import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useWorkspace } from "@/lib/workspace-context";
import { supabase } from "@/integrations/supabase/client";
import {
  PLAN_DISPLAY, CYCLE_LABEL, CYCLE_DISCOUNT,
  priceForCycle, monthlyEquivalent, inr,
  type PlanCode, type BillingCycle,
} from "@/lib/subscription";
import { useSubscription } from "@/hooks/use-subscription";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Crown, Check, Zap, Receipt, ArrowRight, Loader2, CreditCard,
  ShieldCheck, Download, Sparkles, Users, Star, X, Calendar,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/dashboard/billing")({
  head: () => ({ meta: [{ title: "Billing & Subscription — LeadMines" }] }),
  component: BillingPage,
});

interface PlanRow {
  id: string;
  code: PlanCode;
  name: string;
  tagline: string | null;
  description: string | null;
  price_monthly: number;
  price_quarterly: number;
  price_yearly: number;
  gst_percent: number;
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
  is_popular: boolean;
  display_order: number;
}

interface InvoiceRow {
  id: string;
  invoice_number: string;
  plan_code: PlanCode;
  cycle: BillingCycle;
  subtotal: number;
  gst_amount: number;
  total_amount: number;
  status: string;
  paid_at: string | null;
  created_at: string;
  billing_name: string | null;
  gstin: string | null;
}

function BillingPage() {
  const { current, canManage, refresh } = useWorkspace();
  const { subscription, loading: subLoading, refresh: refreshSub } = useSubscription();
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [cycle, setCycle] = useState<BillingCycle>("monthly");
  const [checkout, setCheckout] = useState<PlanRow | null>(null);
  const [loading, setLoading] = useState(true);

  const loadAll = async () => {
    if (!current) return;
    setLoading(true);
    const [plansRes, invRes] = await Promise.all([
      supabase.from("subscription_plans").select("*").eq("is_active", true).order("display_order"),
      supabase.from("invoices").select("id,invoice_number,plan_code,cycle,subtotal,gst_amount,total_amount,status,paid_at,created_at,billing_name,gstin")
        .eq("workspace_id", current.id).order("created_at", { ascending: false }).limit(20),
    ]);
    setPlans((plansRes.data ?? []) as PlanRow[]);
    setInvoices((invRes.data ?? []) as InvoiceRow[]);
    setLoading(false);
  };

  useEffect(() => { loadAll(); /* eslint-disable-next-line */ }, [current?.id]);

  if (!current || loading || subLoading) {
    return <div className="py-16 grid place-items-center"><Loader2 className="size-6 animate-spin text-accent" /></div>;
  }

  const currentPlanCode = subscription?.plan_code ?? "free";
  const periodEnd = subscription?.current_period_end
    ? new Date(subscription.current_period_end).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
    : null;

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl lg:text-3xl font-bold">Billing &amp; Subscription</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage <span className="font-semibold text-foreground">{current.name}</span>'s plan, invoices and add-ons.
          </p>
        </div>
        <Badge variant="secondary" className="gap-1.5 py-1.5 px-3">
          <ShieldCheck className="size-3.5" /> Test mode · Razorpay mock
        </Badge>
      </div>

      {/* Current subscription summary */}
      {subscription && (
        <div className="rounded-2xl border border-accent/40 bg-gradient-to-br from-accent/10 via-card to-card p-5 lg:p-6">
          <div className="grid lg:grid-cols-4 gap-4 lg:gap-6 items-center">
            <div className="lg:col-span-2">
              <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground font-semibold">
                <Crown className="size-3.5 text-accent" /> Current plan
              </div>
              <div className="font-display text-3xl font-bold mt-1">
                {subscription.plan_name}
                <span className="text-muted-foreground text-base font-normal ml-2 capitalize">{subscription.cycle ?? ""}</span>
              </div>
              <div className="text-xs text-muted-foreground mt-1.5 flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className="capitalize">{subscription.status}</Badge>
                {periodEnd && (
                  <span className="inline-flex items-center gap-1">
                    <Calendar className="size-3" /> Renews {periodEnd}
                  </span>
                )}
              </div>
            </div>
            <UsageStat
              label="Daily leads"
              value={subscription.leads_per_day < 0 ? "Unlimited" : `${subscription.leads_per_day} / day`}
              icon={Sparkles}
            />
            <UsageStat
              label="Team seats"
              value={subscription.seat_limit < 0 ? "Unlimited" : `${subscription.seat_limit} seats`}
              icon={Users}
            />
          </div>
        </div>
      )}

      {/* Plan picker */}
      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="font-display text-xl font-bold">Choose a plan</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Switch anytime · GST inclusive on checkout</p>
          </div>
          <CycleToggle value={cycle} onChange={setCycle} />
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-4">
          {plans.map((p) => (
            <PlanCard
              key={p.id}
              plan={p}
              cycle={cycle}
              isCurrent={p.code === currentPlanCode}
              disabled={!canManage}
              onSelect={() => setCheckout(p)}
            />
          ))}
        </div>
      </div>

      {/* Invoices */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl font-bold flex items-center gap-2">
            <Receipt className="size-5 text-accent" /> Invoices
          </h2>
          <span className="text-xs text-muted-foreground">{invoices.length} record{invoices.length === 1 ? "" : "s"}</span>
        </div>
        {invoices.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-10 text-center text-muted-foreground text-sm">
            No invoices yet. Upgrade to a paid plan to generate your first GST invoice.
          </div>
        ) : (
          <div className="rounded-2xl border border-border bg-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-secondary/50 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="text-left px-4 py-3">Invoice #</th>
                    <th className="text-left px-4 py-3">Plan</th>
                    <th className="text-left px-4 py-3">Cycle</th>
                    <th className="text-right px-4 py-3">Subtotal</th>
                    <th className="text-right px-4 py-3">GST</th>
                    <th className="text-right px-4 py-3">Total</th>
                    <th className="text-left px-4 py-3">Status</th>
                    <th className="text-left px-4 py-3">Date</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv) => (
                    <tr key={inv.id} className="border-t border-border hover:bg-secondary/30">
                      <td className="px-4 py-3 font-mono text-xs">{inv.invoice_number}</td>
                      <td className="px-4 py-3 capitalize">{PLAN_DISPLAY[inv.plan_code].name}</td>
                      <td className="px-4 py-3 capitalize text-muted-foreground">{inv.cycle}</td>
                      <td className="px-4 py-3 text-right font-mono">{inr(Number(inv.subtotal))}</td>
                      <td className="px-4 py-3 text-right font-mono text-muted-foreground">{inr(Number(inv.gst_amount))}</td>
                      <td className="px-4 py-3 text-right font-mono font-semibold">{inr(Number(inv.total_amount))}</td>
                      <td className="px-4 py-3">
                        <Badge variant={inv.status === "paid" ? "default" : "secondary"} className="capitalize">
                          {inv.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        {new Date(inv.paid_at ?? inv.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          variant="ghost" size="sm"
                          onClick={() => downloadInvoice(inv, current.name)}
                          className="gap-1.5 h-8"
                        >
                          <Download className="size-3.5" /> PDF
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <CheckoutDialog
        plan={checkout}
        cycle={cycle}
        open={!!checkout}
        currentPlan={currentPlanCode}
        workspaceId={current.id}
        onOpenChange={(o) => !o && setCheckout(null)}
        onSuccess={() => {
          setCheckout(null);
          refresh();
          refreshSub();
          loadAll();
        }}
      />
    </div>
  );
}

function CycleToggle({ value, onChange }: { value: BillingCycle; onChange: (c: BillingCycle) => void }) {
  const cycles: BillingCycle[] = ["monthly", "quarterly", "yearly"];
  return (
    <div className="inline-flex items-center gap-1 p-1 rounded-full bg-secondary border border-border">
      {cycles.map((c) => (
        <button
          key={c}
          onClick={() => onChange(c)}
          className={cn(
            "px-3 py-1.5 rounded-full text-xs font-semibold transition-smooth flex items-center gap-1.5",
            value === c ? "bg-foreground text-background shadow-sm" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {CYCLE_LABEL[c]}
          {CYCLE_DISCOUNT[c] && (
            <span className={cn(
              "text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase",
              value === c ? "bg-accent/30 text-accent" : "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400",
            )}>
              {CYCLE_DISCOUNT[c]}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

function UsageStat({ label, value, icon: Icon }: { label: string; value: string; icon: React.ComponentType<{ className?: string }> }) {
  return (
    <div className="rounded-xl bg-background/60 border border-border p-3">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">
        <Icon className="size-3" /> {label}
      </div>
      <div className="font-display text-lg font-bold mt-0.5">{value}</div>
    </div>
  );
}

function PlanCard({ plan, cycle, isCurrent, disabled, onSelect }: {
  plan: PlanRow; cycle: BillingCycle; isCurrent: boolean; disabled: boolean; onSelect: () => void;
}) {
  const total = priceForCycle(plan, cycle);
  const monthly = monthlyEquivalent(plan, cycle);
  const isFree = plan.code === "free";
  const display = PLAN_DISPLAY[plan.code];

  return (
    <div className={cn(
      "rounded-2xl border p-5 relative flex flex-col bg-card transition-smooth",
      isCurrent ? "border-accent ring-1 ring-accent/40" :
        plan.is_popular ? "border-accent/50 shadow-mint" : "border-border hover:border-accent/30",
    )}>
      {plan.is_popular && !isCurrent && (
        <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full bg-accent text-accent-foreground text-[10px] font-bold uppercase tracking-wide flex items-center gap-1">
          <Star className="size-2.5 fill-current" /> Most popular
        </div>
      )}
      {isCurrent && (
        <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full bg-foreground text-background text-[10px] font-bold uppercase tracking-wide">
          Current plan
        </div>
      )}

      <div className="font-display text-lg font-bold">{plan.name}</div>
      <div className="text-[11px] text-muted-foreground min-h-[28px] mt-0.5">{plan.tagline ?? display.tagline}</div>

      <div className="mt-4">
        {isFree ? (
          <div className="font-display text-3xl font-bold">Free</div>
        ) : (
          <>
            <div className="font-display text-3xl font-bold">{inr(monthly)}<span className="text-sm font-normal text-muted-foreground">/mo</span></div>
            <div className="text-[11px] text-muted-foreground mt-0.5">
              {cycle === "monthly" ? "Billed monthly" : `${inr(total)} billed ${cycle}`}
            </div>
          </>
        )}
      </div>

      <ul className="mt-5 space-y-2 flex-1 text-xs">
        <PlanFeature label={plan.seat_limit < 0 ? "Unlimited seats" : `${plan.seat_limit} team seat${plan.seat_limit > 1 ? "s" : ""}`} />
        <PlanFeature label={plan.leads_per_day < 0 ? "Unlimited daily leads" : `${plan.leads_per_day} leads / day`} />
        <PlanFeature label={plan.marketing_posts_per_month < 0 ? "Unlimited marketing posts" : `${plan.marketing_posts_per_month} marketing posts / mo`} />
        {plan.hrms_user_limit > 0 && <PlanFeature label={`HRMS for ${plan.hrms_user_limit < 0 ? "unlimited" : plan.hrms_user_limit} employees`} />}
        {plan.withdrawal_enabled && <PlanFeature label="Wallet withdrawals enabled" />}
        {plan.recharge_bonus_max_pct > 0 && <PlanFeature label={`Up to ${plan.recharge_bonus_max_pct}% recharge bonus`} highlight />}
        {plan.priority_leads && <PlanFeature label="Priority access to hot leads" highlight />}
        {plan.whatsapp_enabled && <PlanFeature label="WhatsApp automation" />}
        {plan.api_access && <PlanFeature label="API access" />}
        {plan.custom_branding && <PlanFeature label="Custom branding" />}
        {plan.affiliate_enabled && <PlanFeature label="Affiliate program" />}
      </ul>

      <Button
        variant={isCurrent ? "secondary" : plan.is_popular ? "default" : "outline"}
        className="mt-5 w-full gap-2"
        onClick={onSelect}
        disabled={disabled || isCurrent}
      >
        {isCurrent ? "Active" : isFree ? <>Switch to Free</> : <>Choose {plan.name} <ArrowRight className="size-4" /></>}
      </Button>
    </div>
  );
}

function PlanFeature({ label, highlight }: { label: string; highlight?: boolean }) {
  return (
    <li className={cn("flex items-start gap-2", highlight && "font-semibold")}>
      <Check className={cn("size-3.5 mt-0.5 shrink-0", highlight ? "text-accent" : "text-muted-foreground")} /> {label}
    </li>
  );
}

function CheckoutDialog({
  plan, cycle, open, currentPlan, workspaceId, onOpenChange, onSuccess,
}: {
  plan: PlanRow | null;
  cycle: BillingCycle;
  open: boolean;
  currentPlan: PlanCode;
  workspaceId: string;
  onOpenChange: (o: boolean) => void;
  onSuccess: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [billingName, setBillingName] = useState("");
  const [billingEmail, setBillingEmail] = useState("");
  const [billingPhone, setBillingPhone] = useState("");
  const [gstin, setGstin] = useState("");

  if (!plan) return null;

  const subtotal = priceForCycle(plan, cycle);
  const gst = Math.round((subtotal * Number(plan.gst_percent)) / 100);
  const total = subtotal + gst;
  const isSwitch = plan.code !== currentPlan;
  const isFree = plan.code === "free";

  const pay = async () => {
    setBusy(true);
    const { data, error } = await supabase.rpc("subscribe_workspace", {
      _workspace_id: workspaceId,
      _plan_code: plan.code,
      _cycle: cycle,
      _billing_name: billingName || undefined,
      _billing_email: billingEmail || undefined,
      _billing_phone: billingPhone || undefined,
      _gstin: gstin || undefined,
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    const result = data as { success: boolean; invoice_number?: string };
    toast.success(
      isFree ? `Switched to ${plan.name} plan`
        : isSwitch ? `Upgraded to ${plan.name}! Invoice ${result.invoice_number ?? ""}`
          : `Renewed ${plan.name} successfully`,
    );
    onSuccess();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-gradient-to-br from-accent/30 to-accent/10 grid place-items-center shrink-0">
              <Zap className="size-5 text-accent" />
            </div>
            <div className="min-w-0">
              <DialogTitle className="truncate">{isFree ? `Switch to ${plan.name}` : `Subscribe to ${plan.name}`}</DialogTitle>
              <DialogDescription>
                {isFree ? "No payment required" : `Test-mode checkout · ${CYCLE_LABEL[cycle]} billing`}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {!isFree && (
          <div className="space-y-3 pt-1">
            <div className="grid grid-cols-2 gap-2.5">
              <div className="col-span-2">
                <Label className="text-xs">Billing name</Label>
                <Input value={billingName} onChange={(e) => setBillingName(e.target.value)} placeholder="Your company / your name" className="mt-1 h-9" />
              </div>
              <div>
                <Label className="text-xs">Email</Label>
                <Input type="email" value={billingEmail} onChange={(e) => setBillingEmail(e.target.value)} placeholder="billing@…" className="mt-1 h-9" />
              </div>
              <div>
                <Label className="text-xs">Phone</Label>
                <Input value={billingPhone} onChange={(e) => setBillingPhone(e.target.value)} placeholder="+91…" className="mt-1 h-9" />
              </div>
              <div className="col-span-2">
                <Label className="text-xs">GSTIN <span className="text-muted-foreground">(optional)</span></Label>
                <Input value={gstin} onChange={(e) => setGstin(e.target.value.toUpperCase())} placeholder="29ABCDE1234F1Z5" className="mt-1 h-9 font-mono" />
              </div>
            </div>
          </div>
        )}

        <div className="rounded-xl border border-border bg-secondary/30 p-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <span>{plan.name} ({cycle})</span>
            <span className="font-mono">{inr(subtotal)}</span>
          </div>
          {!isFree && (
            <>
              <div className="flex justify-between text-xs text-muted-foreground border-t border-dashed border-border pt-2">
                <span>GST ({plan.gst_percent}%)</span>
                <span className="font-mono">{inr(gst)}</span>
              </div>
              <div className="flex justify-between font-bold pt-1 border-t border-border">
                <span>Total</span>
                <span className="font-mono text-base">{inr(total)}</span>
              </div>
            </>
          )}
        </div>

        {!isFree && (
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <ShieldCheck className="size-3.5 text-accent" />
            Test mode · No real charge · GST invoice generated instantly
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button onClick={pay} disabled={busy} className="gap-2">
            {busy ? <Loader2 className="size-4 animate-spin" /> : isFree ? <Check className="size-4" /> : <CreditCard className="size-4" />}
            {isFree ? "Confirm switch" : `Pay ${inr(total)}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function downloadInvoice(inv: InvoiceRow, workspaceName: string) {
  const lines = [
    `INVOICE`,
    `${inv.invoice_number}`,
    ``,
    `Workspace: ${workspaceName}`,
    `Billed to: ${inv.billing_name ?? "—"}`,
    `GSTIN: ${inv.gstin ?? "—"}`,
    `Date: ${new Date(inv.paid_at ?? inv.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}`,
    ``,
    `Plan:        ${PLAN_DISPLAY[inv.plan_code].name} (${inv.cycle})`,
    `Subtotal:    ${inr(Number(inv.subtotal))}`,
    `GST:         ${inr(Number(inv.gst_amount))}`,
    `Total:       ${inr(Number(inv.total_amount))}`,
    ``,
    `Status:      ${inv.status.toUpperCase()}`,
    ``,
    `Thank you for choosing LeadMines by MoneyMines.`,
    `For support: support@leadmines.in`,
  ].join("\n");
  const blob = new Blob([lines], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${inv.invoice_number}.txt`;
  a.click();
  URL.revokeObjectURL(url);
  toast.success("Invoice downloaded");
}
