import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Percent, Save } from "lucide-react";

export const Route = createFileRoute("/dashboard/admin/commissions")({
  head: () => ({ meta: [{ title: "Commission Rules — Admin" }] }),
  component: CommissionRulesPage,
});

type Rule = {
  id: string;
  role: "company" | "manager" | "employee" | "partner" | "referrer";
  percentage: number;
  description: string | null;
  is_active: boolean;
};

function CommissionRulesPage() {
  const { role } = useAuth();
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const isAdmin = role === "admin" || role === "ceo" || role === "super_admin";

  useEffect(() => {
    if (!isAdmin) return;
    (async () => {
      const { data, error } = await supabase
        .from("commission_rules")
        .select("*")
        .order("role");
      if (error) toast.error(error.message);
      else setRules((data as Rule[]) ?? []);
      setLoading(false);
    })();
  }, [isAdmin]);

  const total = rules.filter((r) => r.is_active).reduce((s, r) => s + Number(r.percentage), 0);

  async function save() {
    if (Math.abs(total - 100) > 0.01) {
      toast.error(`Active percentages must total 100% (currently ${total}%)`);
      return;
    }
    setSaving(true);
    for (const r of rules) {
      const { error } = await supabase
        .from("commission_rules")
        .update({ percentage: r.percentage, is_active: r.is_active, description: r.description })
        .eq("id", r.id);
      if (error) {
        toast.error(error.message);
        setSaving(false);
        return;
      }
    }
    toast.success("Commission rules updated");
    setSaving(false);
  }

  if (!isAdmin) return <div className="p-6">Admin only.</div>;
  if (loading) return <div className="p-6 flex justify-center"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="container max-w-3xl py-6 space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold">Commission Rules</h1>
        <p className="text-muted-foreground text-sm">
          Set how each disbursal commission is split. Active rows must total 100%.
        </p>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2"><Percent className="size-5" /> Split percentages</CardTitle>
            <CardDescription>Applied automatically when a disbursal is marked disbursed.</CardDescription>
          </div>
          <Badge variant={Math.abs(total - 100) < 0.01 ? "default" : "destructive"}>Total: {total}%</Badge>
        </CardHeader>
        <CardContent className="space-y-4">
          {rules.map((r, idx) => (
            <div key={r.id} className="grid grid-cols-12 gap-3 items-center border rounded-lg p-3">
              <div className="col-span-3">
                <Label className="capitalize font-semibold">{r.role}</Label>
                <p className="text-xs text-muted-foreground">{r.description}</p>
              </div>
              <div className="col-span-4">
                <Input
                  type="number"
                  min={0} max={100} step={0.5}
                  value={r.percentage}
                  onChange={(e) => {
                    const v = Math.max(0, Math.min(100, Number(e.target.value)));
                    setRules((prev) => prev.map((x, i) => (i === idx ? { ...x, percentage: v } : x)));
                  }}
                />
              </div>
              <div className="col-span-3 text-sm text-muted-foreground">
                e.g. ₹1000 → ₹{Math.round((1000 * r.percentage) / 100)}
              </div>
              <div className="col-span-2 flex items-center gap-2 justify-end">
                <Switch
                  checked={r.is_active}
                  onCheckedChange={(v) => setRules((prev) => prev.map((x, i) => (i === idx ? { ...x, is_active: v } : x)))}
                />
                <span className="text-xs">{r.is_active ? "On" : "Off"}</span>
              </div>
            </div>
          ))}

          <div className="flex justify-end pt-2">
            <Button onClick={save} disabled={saving}>
              {saving ? <Loader2 className="size-4 animate-spin mr-2" /> : <Save className="size-4 mr-2" />}
              Save changes
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>How it works</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>• When a lender marks a disbursal as <Badge variant="outline">disbursed</Badge>, the engine reads active rules and credits each recipient's wallet automatically.</p>
          <p>• <b>Company</b> share is retained by the platform (no wallet credit).</p>
          <p>• <b>Manager</b> = workspace owner of the DSA who closed the lead.</p>
          <p>• <b>Employee</b> = the DSA on the lead purchase.</p>
          <p>• <b>Partner</b> = parent workspace owner (for sub-tenants).</p>
          <p>• <b>Referrer</b> = the DSA whose referral code was used (if any).</p>
          <p>• Every entry is logged in <code>commissions</code> for full audit.</p>
        </CardContent>
      </Card>
    </div>
  );
}
