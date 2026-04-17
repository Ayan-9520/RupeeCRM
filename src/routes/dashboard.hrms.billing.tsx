import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useWorkspace } from "@/lib/workspace-context";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { Loader2, Receipt, Users, Sparkles, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/dashboard/hrms/billing")({
  head: () => ({ meta: [{ title: "HRMS Billing — LeadMines" }] }),
  component: BillingPage,
});

function BillingPage() {
  const { current, canManage, refresh } = useWorkspace();
  const [employeeCount, setEmployeeCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const enabled = current?.hrms_enabled ?? false;
  const price = current?.hrms_price_per_employee ?? 99;
  const total = enabled ? employeeCount * price : 0;

  useEffect(() => {
    if (!current) return;
    setLoading(true);
    supabase
      .from("employees")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", current.id)
      .eq("status", "active")
      .then(({ count }) => {
        setEmployeeCount(count ?? 0);
        setLoading(false);
      });
  }, [current?.id]);

  const toggle = async (next: boolean) => {
    if (!current || !canManage) return;
    setBusy(true);
    const { error } = await supabase
      .from("workspaces")
      .update({ hrms_enabled: next })
      .eq("id", current.id);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(next ? "HRMS add-on enabled" : "HRMS add-on disabled");
    refresh();
  };

  if (loading || !current) {
    return <div className="py-16 grid place-items-center"><Loader2 className="size-6 animate-spin text-accent" /></div>;
  }

  return (
    <div className="grid lg:grid-cols-3 gap-5">
      {/* Toggle + summary */}
      <div className="lg:col-span-2 space-y-5">
        <div className="rounded-2xl bg-card border border-border p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <div className="size-9 rounded-xl bg-accent/15 grid place-items-center">
                  <Sparkles className="size-4 text-accent" />
                </div>
                <h2 className="font-display text-lg font-bold">HRMS &amp; Payroll Add-on</h2>
              </div>
              <p className="text-sm text-muted-foreground mt-2 max-w-md">
                Pay only for active employees you manage. Toggle off any time — billing stops immediately.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className={`text-xs font-semibold uppercase tracking-wide ${enabled ? "text-accent" : "text-muted-foreground"}`}>
                {enabled ? "Active" : "Off"}
              </span>
              <Switch checked={enabled} onCheckedChange={toggle} disabled={busy || !canManage} />
            </div>
          </div>
        </div>

        {/* Bill calculation */}
        <div className="rounded-2xl bg-card border border-border overflow-hidden">
          <div className="px-6 py-4 border-b border-border flex items-center gap-2">
            <Receipt className="size-4 text-accent" />
            <h3 className="font-semibold text-sm">Monthly Bill Summary</h3>
          </div>
          <div className="p-6 space-y-4">
            <Row label="Active employees" value={
              <span className="flex items-center gap-1.5"><Users className="size-3.5 text-muted-foreground" />{employeeCount}</span>
            } />
            <Row label="Price per employee / month" value={`₹${price.toLocaleString("en-IN")}`} />
            <div className="border-t border-dashed border-border pt-4 flex items-end justify-between">
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">Total this month</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">{employeeCount} × ₹{price} {enabled ? "" : "(disabled)"}</div>
              </div>
              <div className={`font-display text-3xl font-bold ${enabled ? "text-foreground" : "text-muted-foreground line-through"}`}>
                ₹{total.toLocaleString("en-IN")}
              </div>
            </div>
          </div>
        </div>

        {/* Quick scale preview */}
        <div className="rounded-2xl bg-muted/30 border border-border p-5">
          <div className="text-xs uppercase tracking-wide text-muted-foreground font-semibold mb-3">Scale preview</div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[5, 10, 25, 50].map((n) => (
              <div key={n} className="rounded-xl bg-card border border-border p-3 text-center">
                <div className="text-[11px] text-muted-foreground">{n} employees</div>
                <div className="font-mono font-semibold mt-1">₹{(n * price).toLocaleString("en-IN")}/mo</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Includes */}
      <div className="rounded-2xl bg-card border border-border p-6 h-fit">
        <h3 className="font-semibold text-sm mb-4">What's included</h3>
        <ul className="space-y-3 text-sm">
          {[
            "Unlimited employee records",
            "Attendance tracking",
            "Salary structures",
            "Auto payslip generation",
            "Monthly payroll processing",
            "Org hierarchy",
          ].map((f) => (
            <li key={f} className="flex items-start gap-2">
              <CheckCircle2 className="size-4 text-accent mt-0.5 shrink-0" />
              <span>{f}</span>
            </li>
          ))}
        </ul>
        {!canManage && (
          <p className="text-xs text-muted-foreground mt-4 pt-4 border-t border-border">
            Only owners and admins can change billing.
          </p>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono font-medium">{value}</span>
    </div>
  );
}
