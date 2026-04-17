import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useWorkspace } from "@/lib/workspace-context";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, FileText } from "lucide-react";

export const Route = createFileRoute("/dashboard/hrms/payslips/")({
  component: PayslipsList,
});

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function PayslipsList() {
  const { current } = useWorkspace();
  const [slips, setSlips] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!current) return;
    setLoading(true);
    supabase.from("payslips")
      .select("id, period_month, period_year, gross, net_pay, status, employee:employees(full_name, employee_code)")
      .eq("workspace_id", current.id)
      .order("period_year", { ascending: false }).order("period_month", { ascending: false })
      .then(({ data }) => { setSlips(data ?? []); setLoading(false); });
  }, [current?.id]);

  return (
    <div className="rounded-2xl bg-card border border-border overflow-hidden">
      {loading ? (
        <div className="py-16 grid place-items-center"><Loader2 className="size-6 animate-spin text-accent" /></div>
      ) : slips.length === 0 ? (
        <div className="py-16 text-center">
          <FileText className="size-10 mx-auto text-muted-foreground/40" />
          <p className="mt-3 text-sm text-muted-foreground">No payslips yet. Run payroll first.</p>
        </div>
      ) : (
        <table className="w-full text-sm">
          <thead className="bg-secondary/50 text-xs">
            <tr>
              <th className="text-left p-3">Period</th>
              <th className="text-left p-3">Employee</th>
              <th className="text-right p-3">Gross</th>
              <th className="text-right p-3">Net Pay</th>
              <th className="text-center p-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {slips.map((s) => (
              <tr key={s.id} className="border-t border-border hover:bg-secondary/30">
                <td className="p-3 font-medium">{MONTHS[s.period_month - 1]} {s.period_year}</td>
                <td className="p-3">
                  <Link to="/dashboard/hrms/payslips/$id" params={{ id: s.id }} className="hover:text-accent">
                    {s.employee?.full_name}
                    <span className="text-xs text-muted-foreground ml-2 font-mono">{s.employee?.employee_code}</span>
                  </Link>
                </td>
                <td className="p-3 text-right font-mono">₹{Number(s.gross).toLocaleString("en-IN")}</td>
                <td className="p-3 text-right font-mono font-semibold">₹{Number(s.net_pay).toLocaleString("en-IN")}</td>
                <td className="p-3 text-center">
                  <span className={`text-[10px] uppercase tracking-wide font-semibold px-2 py-0.5 rounded ${
                    s.status === "paid" ? "bg-accent/15 text-accent" :
                    s.status === "processed" ? "bg-blue-500/15 text-blue-600" :
                    "bg-muted text-muted-foreground"
                  }`}>{s.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
