import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useWorkspace } from "@/lib/workspace-context";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Play, FileText, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/dashboard/hrms/payroll")({
  component: PayrollPage,
});

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

function PayrollPage() {
  const { current, canManage } = useWorkspace();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [running, setRunning] = useState(false);
  const [slips, setSlips] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!current) return;
    setLoading(true);
    const { data } = await supabase
      .from("payslips")
      .select("id, employee_id, gross, total_deductions, net_pay, status, paid_days, working_days, employee:employees(full_name, employee_code)")
      .eq("workspace_id", current.id).eq("period_month", month).eq("period_year", year)
      .order("net_pay", { ascending: false });
    setSlips(data ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [current?.id, month, year]);

  const run = async () => {
    if (!current) return;
    setRunning(true);
    const { data, error } = await supabase.rpc("process_payroll", { _workspace_id: current.id, _month: month, _year: year });
    setRunning(false);
    if (error) { toast.error(error.message); return; }
    const result = data as any;
    toast.success(`Processed ${result.count} payslips for ${MONTHS[month-1]} ${year}`);
    load();
  };

  const markPaid = async (id: string) => {
    const { error } = await supabase.from("payslips").update({ status: "paid", paid_at: new Date().toISOString() }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Marked as paid");
    load();
  };

  const totalNet = slips.reduce((s, p) => s + Number(p.net_pay), 0);
  const totalGross = slips.reduce((s, p) => s + Number(p.gross), 0);

  return (
    <div className="space-y-4">
      {/* Period selector + run */}
      <div className="rounded-2xl bg-gradient-to-br from-accent/10 to-card border border-border p-5 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              {MONTHS.map((mo, i) => <SelectItem key={i} value={String(i+1)}>{mo}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
            <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
            <SelectContent>
              {[year-1, year, year+1].map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">{slips.length}</span> payslips · Gross <span className="font-mono font-semibold text-foreground">₹{totalGross.toLocaleString("en-IN")}</span> · Net <span className="font-mono font-semibold text-accent">₹{totalNet.toLocaleString("en-IN")}</span>
          </div>
        </div>
        {canManage && (
          <Button onClick={run} disabled={running} className="gap-2">
            {running ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
            Run Payroll
          </Button>
        )}
      </div>

      <div className="rounded-2xl bg-card border border-border overflow-hidden">
        {loading ? (
          <div className="py-16 grid place-items-center"><Loader2 className="size-6 animate-spin text-accent" /></div>
        ) : slips.length === 0 ? (
          <div className="py-16 text-center">
            <FileText className="size-10 mx-auto text-muted-foreground/40" />
            <p className="mt-3 text-sm text-muted-foreground">No payroll run yet for {MONTHS[month-1]} {year}. Click <strong>Run Payroll</strong> to generate payslips.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-secondary/50 text-xs">
              <tr>
                <th className="text-left p-3">Employee</th>
                <th className="text-center p-3">Days (Paid/Total)</th>
                <th className="text-right p-3">Gross</th>
                <th className="text-right p-3">Deductions</th>
                <th className="text-right p-3">Net Pay</th>
                <th className="text-center p-3">Status</th>
                <th className="text-right p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {slips.map((s) => (
                <tr key={s.id} className="border-t border-border hover:bg-secondary/30">
                  <td className="p-3">
                    <div className="font-medium">{s.employee?.full_name}</div>
                    <div className="text-xs text-muted-foreground font-mono">{s.employee?.employee_code}</div>
                  </td>
                  <td className="p-3 text-center text-xs text-muted-foreground">{s.paid_days}/{s.working_days}</td>
                  <td className="p-3 text-right font-mono">₹{Number(s.gross).toLocaleString("en-IN")}</td>
                  <td className="p-3 text-right font-mono text-destructive">−₹{Number(s.total_deductions).toLocaleString("en-IN")}</td>
                  <td className="p-3 text-right font-mono font-semibold">₹{Number(s.net_pay).toLocaleString("en-IN")}</td>
                  <td className="p-3 text-center">
                    <span className={`text-[10px] uppercase tracking-wide font-semibold px-2 py-0.5 rounded ${
                      s.status === "paid" ? "bg-accent/15 text-accent" :
                      s.status === "processed" ? "bg-blue-500/15 text-blue-600" :
                      "bg-muted text-muted-foreground"
                    }`}>{s.status}</span>
                  </td>
                  <td className="p-3 text-right">
                    <div className="flex justify-end gap-1">
                      <Link to="/dashboard/hrms/payslips/$id" params={{ id: s.id }}>
                        <Button variant="ghost" size="sm">View</Button>
                      </Link>
                      {canManage && s.status === "processed" && (
                        <Button size="sm" variant="outline" onClick={() => markPaid(s.id)} className="gap-1">
                          <CheckCircle2 className="size-3.5" /> Mark Paid
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
