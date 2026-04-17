import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Loader2, User, Briefcase, Mail, Phone, Calendar, Wallet2, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/dashboard/hrms/employees/$id")({
  component: EmployeeProfile,
});

interface SalaryStructure {
  id?: string;
  basic: number; hra: number; conveyance: number; medical: number; special_allowance: number;
  pf: number; professional_tax: number; tds: number; other_deductions: number;
}

const EMPTY_SAL: SalaryStructure = {
  basic: 0, hra: 0, conveyance: 0, medical: 0, special_allowance: 0,
  pf: 0, professional_tax: 0, tds: 0, other_deductions: 0,
};

function EmployeeProfile() {
  const { id } = Route.useParams();
  const { current, canManage } = useWorkspace();
  const [emp, setEmp] = useState<any>(null);
  const [salary, setSalary] = useState<SalaryStructure>(EMPTY_SAL);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data: e } = await supabase.from("employees").select("*").eq("id", id).maybeSingle();
    setEmp(e);
    const { data: s } = await supabase.from("salary_structures").select("*").eq("employee_id", id).eq("is_active", true).order("effective_from", { ascending: false }).limit(1).maybeSingle();
    if (s) setSalary({
      id: s.id, basic: Number(s.basic), hra: Number(s.hra), conveyance: Number(s.conveyance),
      medical: Number(s.medical), special_allowance: Number(s.special_allowance),
      pf: Number(s.pf), professional_tax: Number(s.professional_tax),
      tds: Number(s.tds), other_deductions: Number(s.other_deductions),
    });
    setLoading(false);
  };

  useEffect(() => { load(); }, [id]);

  const earnings = salary.basic + salary.hra + salary.conveyance + salary.medical + salary.special_allowance;
  const deductions = salary.pf + salary.professional_tax + salary.tds + salary.other_deductions;
  const net = earnings - deductions;

  const saveSalary = async () => {
    if (!current || !emp) return;
    setBusy(true);
    if (salary.id) {
      const { error } = await supabase.from("salary_structures").update({
        basic: salary.basic, hra: salary.hra, conveyance: salary.conveyance, medical: salary.medical,
        special_allowance: salary.special_allowance, pf: salary.pf,
        professional_tax: salary.professional_tax, tds: salary.tds, other_deductions: salary.other_deductions,
      }).eq("id", salary.id);
      if (error) { toast.error(error.message); setBusy(false); return; }
    } else {
      const { error } = await supabase.from("salary_structures").insert({
        workspace_id: current.id, employee_id: emp.id, ...salary,
      });
      if (error) { toast.error(error.message); setBusy(false); return; }
    }
    toast.success("Salary structure saved");
    setBusy(false);
    load();
  };

  const remove = async () => {
    if (!emp || !confirm(`Remove ${emp.full_name}?`)) return;
    const { error } = await supabase.from("employees").delete().eq("id", emp.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Employee removed");
    window.history.back();
  };

  if (loading) return <div className="py-16 grid place-items-center"><Loader2 className="size-6 animate-spin text-accent" /></div>;
  if (!emp) return <div className="text-muted-foreground">Employee not found.</div>;

  return (
    <div className="space-y-5">
      <Link to="/dashboard/hrms" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Back to employees
      </Link>

      {/* Profile header */}
      <div className="rounded-2xl bg-gradient-to-br from-accent/10 to-card border border-border p-6 flex items-start gap-4 flex-wrap">
        <div className="size-16 rounded-2xl bg-accent/20 grid place-items-center text-2xl font-bold text-accent shrink-0">
          {emp.full_name.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="font-display text-2xl font-bold">{emp.full_name}</h2>
            <span className={`text-[10px] uppercase tracking-wide font-semibold px-2 py-0.5 rounded ${
              emp.status === "active" ? "bg-accent/15 text-accent" :
              emp.status === "on_leave" ? "bg-yellow-500/15 text-yellow-600" :
              "bg-destructive/15 text-destructive"
            }`}>{emp.status.replace("_", " ")}</span>
          </div>
          <div className="text-sm text-muted-foreground mt-1">{emp.designation ?? "—"} · {emp.department ?? "—"} · <span className="font-mono text-xs">{emp.employee_code}</span></div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-xs text-muted-foreground">
            {emp.email && <span className="flex items-center gap-1"><Mail className="size-3" /> {emp.email}</span>}
            {emp.phone && <span className="flex items-center gap-1"><Phone className="size-3" /> {emp.phone}</span>}
            <span className="flex items-center gap-1"><Calendar className="size-3" /> Joined {new Date(emp.join_date).toLocaleDateString()}</span>
            <span className="flex items-center gap-1"><Wallet2 className="size-3" /> CTC ₹{Number(emp.ctc).toLocaleString("en-IN")}</span>
          </div>
        </div>
        {canManage && (
          <Button variant="ghost" size="sm" onClick={remove} className="text-destructive">
            <Trash2 className="size-4 mr-1" /> Remove
          </Button>
        )}
      </div>

      {/* Salary structure */}
      <div className="rounded-2xl bg-card border border-border p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold flex items-center gap-2"><Briefcase className="size-4" /> Salary Structure (Monthly)</h3>
          {canManage && (
            <Button onClick={saveSalary} disabled={busy} size="sm">
              {busy ? <Loader2 className="size-4 mr-2 animate-spin" /> : <Save className="size-4 mr-2" />}
              Save
            </Button>
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-3">
            <h4 className="text-xs uppercase tracking-wide font-semibold text-accent">Earnings</h4>
            <SalField label="Basic" value={salary.basic} onChange={(v) => setSalary({ ...salary, basic: v })} disabled={!canManage} />
            <SalField label="HRA" value={salary.hra} onChange={(v) => setSalary({ ...salary, hra: v })} disabled={!canManage} />
            <SalField label="Conveyance" value={salary.conveyance} onChange={(v) => setSalary({ ...salary, conveyance: v })} disabled={!canManage} />
            <SalField label="Medical" value={salary.medical} onChange={(v) => setSalary({ ...salary, medical: v })} disabled={!canManage} />
            <SalField label="Special Allowance" value={salary.special_allowance} onChange={(v) => setSalary({ ...salary, special_allowance: v })} disabled={!canManage} />
            <div className="pt-2 border-t flex justify-between text-sm font-semibold">
              <span>Gross Earnings</span><span className="font-mono text-accent">₹{earnings.toLocaleString("en-IN")}</span>
            </div>
          </div>
          <div className="space-y-3">
            <h4 className="text-xs uppercase tracking-wide font-semibold text-destructive">Deductions</h4>
            <SalField label="PF" value={salary.pf} onChange={(v) => setSalary({ ...salary, pf: v })} disabled={!canManage} />
            <SalField label="Professional Tax" value={salary.professional_tax} onChange={(v) => setSalary({ ...salary, professional_tax: v })} disabled={!canManage} />
            <SalField label="TDS" value={salary.tds} onChange={(v) => setSalary({ ...salary, tds: v })} disabled={!canManage} />
            <SalField label="Other" value={salary.other_deductions} onChange={(v) => setSalary({ ...salary, other_deductions: v })} disabled={!canManage} />
            <div className="pt-2 border-t flex justify-between text-sm font-semibold">
              <span>Total Deductions</span><span className="font-mono text-destructive">₹{deductions.toLocaleString("en-IN")}</span>
            </div>
            <div className="pt-2 border-t-2 border-accent flex justify-between text-base font-bold">
              <span>Net Pay</span><span className="font-mono">₹{net.toLocaleString("en-IN")}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SalField({ label, value, onChange, disabled }: { label: string; value: number; onChange: (v: number) => void; disabled?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <Label className="text-xs flex-1">{label}</Label>
      <Input
        type="number" value={value || ""} onChange={(e) => onChange(Number(e.target.value) || 0)}
        disabled={disabled} className="w-32 h-8 text-right font-mono text-sm"
      />
    </div>
  );
}
