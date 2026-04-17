import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, Printer, Sparkles } from "lucide-react";

export const Route = createFileRoute("/dashboard/hrms/payslips/$id")({
  component: PayslipDetail,
});

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

function PayslipDetail() {
  const { id } = Route.useParams();
  const { current } = useWorkspace();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    supabase.from("payslips")
      .select("*, employee:employees(full_name, employee_code, designation, department, email, pan, bank_account, ifsc, join_date)")
      .eq("id", id).maybeSingle()
      .then(({ data }) => { setData(data); setLoading(false); });
  }, [id]);

  if (loading) return <div className="py-16 grid place-items-center"><Loader2 className="size-6 animate-spin text-accent" /></div>;
  if (!data) return <div className="text-muted-foreground">Payslip not found.</div>;

  const e = data.earnings as Record<string, number>;
  const d = data.deductions as Record<string, number>;
  const earningRows = Object.entries(e).filter(([_, v]) => v > 0);
  const deductionRows = Object.entries(d).filter(([_, v]) => v > 0);

  return (
    <div className="max-w-3xl space-y-4">
      <div className="flex items-center justify-between print:hidden">
        <Link to="/dashboard/hrms/payslips" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> Back to payslips
        </Link>
        <Button variant="outline" size="sm" onClick={() => window.print()} className="gap-2">
          <Printer className="size-4" /> Print / Save PDF
        </Button>
      </div>

      <div className="rounded-2xl bg-card border-2 border-border p-8 print:border-0 print:shadow-none">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-border pb-4">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-mint-gradient grid place-items-center"><Sparkles className="size-5 text-primary" strokeWidth={2.5} /></div>
            <div>
              <div className="font-display font-bold text-lg">{current?.name ?? "Workspace"}</div>
              <div className="text-xs text-muted-foreground">Payslip · {MONTHS[data.period_month - 1]} {data.period_year}</div>
            </div>
          </div>
          <span className={`text-xs uppercase tracking-wide font-semibold px-3 py-1 rounded ${
            data.status === "paid" ? "bg-accent/15 text-accent" :
            data.status === "processed" ? "bg-blue-500/15 text-blue-600" :
            "bg-muted text-muted-foreground"
          }`}>{data.status}</span>
        </div>

        {/* Employee details */}
        <div className="grid grid-cols-2 gap-4 py-4 border-b border-border text-sm">
          <Detail label="Employee Name" value={data.employee?.full_name} />
          <Detail label="Employee Code" value={data.employee?.employee_code} mono />
          <Detail label="Designation" value={data.employee?.designation ?? "—"} />
          <Detail label="Department" value={data.employee?.department ?? "—"} />
          <Detail label="Date of Joining" value={data.employee?.join_date ? new Date(data.employee.join_date).toLocaleDateString() : "—"} />
          <Detail label="PAN" value={data.employee?.pan ?? "—"} mono />
          <Detail label="Working Days" value={`${data.paid_days} / ${data.working_days}`} />
          <Detail label="Bank A/C" value={data.employee?.bank_account ?? "—"} mono />
        </div>

        {/* Earnings & Deductions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
          <div>
            <h3 className="text-xs uppercase tracking-wide font-bold text-accent mb-3 border-b pb-2">Earnings</h3>
            <div className="space-y-1.5 text-sm">
              {earningRows.map(([k, v]) => (
                <div key={k} className="flex justify-between"><span className="capitalize text-muted-foreground">{k.replace(/_/g, " ")}</span><span className="font-mono">₹{Number(v).toLocaleString("en-IN")}</span></div>
              ))}
              <div className="flex justify-between pt-2 mt-2 border-t font-semibold"><span>Gross</span><span className="font-mono text-accent">₹{Number(data.gross).toLocaleString("en-IN")}</span></div>
            </div>
          </div>
          <div>
            <h3 className="text-xs uppercase tracking-wide font-bold text-destructive mb-3 border-b pb-2">Deductions</h3>
            <div className="space-y-1.5 text-sm">
              {deductionRows.length === 0 ? (
                <div className="text-xs text-muted-foreground italic">No deductions</div>
              ) : deductionRows.map(([k, v]) => (
                <div key={k} className="flex justify-between"><span className="capitalize text-muted-foreground">{k.replace(/_/g, " ")}</span><span className="font-mono">₹{Number(v).toLocaleString("en-IN")}</span></div>
              ))}
              <div className="flex justify-between pt-2 mt-2 border-t font-semibold"><span>Total</span><span className="font-mono text-destructive">₹{Number(data.total_deductions).toLocaleString("en-IN")}</span></div>
            </div>
          </div>
        </div>

        {/* Net Pay */}
        <div className="rounded-xl bg-accent/10 border border-accent/30 p-4 flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-wide font-semibold text-accent">Net Pay</div>
            <div className="text-[10px] text-muted-foreground">For the month of {MONTHS[data.period_month - 1]} {data.period_year}</div>
          </div>
          <div className="font-display text-3xl font-bold">₹{Number(data.net_pay).toLocaleString("en-IN")}</div>
        </div>

        <div className="mt-6 pt-4 border-t text-[10px] text-muted-foreground text-center">
          This is a computer-generated payslip and does not require a signature.
        </div>
      </div>
    </div>
  );
}

function Detail({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`text-sm font-medium ${mono ? "font-mono" : ""}`}>{value}</div>
    </div>
  );
}
