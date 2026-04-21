import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, CalendarCheck, FileText, CalendarRange, ArrowRight, IndianRupee } from "lucide-react";

export const Route = createFileRoute("/dashboard/hrms/me")({
  head: () => ({ meta: [{ title: "My HRMS — LeadMines" }] }),
  component: SelfServicePage,
});

type Employee = {
  id: string; full_name: string; designation: string | null; department: string | null;
  grade: string | null; employee_code: string; ctc: number; join_date: string; workspace_id: string;
};

function fmt(n: number) { return `₹${Number(n).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`; }

function SelfServicePage() {
  const { user } = useAuth();
  const [emp, setEmp] = useState<Employee | null>(null);
  const [attendance, setAttendance] = useState<{ date: string; status: string }[]>([]);
  const [payslips, setPayslips] = useState<{ id: string; period_year: number; period_month: number; net_pay: number; status: string }[]>([]);
  const [balances, setBalances] = useState<{ leave_type_code: string; allocated: number; used: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: e } = await supabase
        .from("employees")
        .select("id,full_name,designation,department,grade,employee_code,ctc,join_date,workspace_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!e) { setLoading(false); return; }
      setEmp(e as Employee);

      const monthStart = new Date(); monthStart.setDate(1);
      const [{ data: att }, { data: ps }, { data: bals }] = await Promise.all([
        supabase.from("attendance").select("date,status").eq("employee_id", e.id)
          .gte("date", monthStart.toISOString().slice(0, 10)).order("date", { ascending: false }),
        supabase.from("payslips").select("id,period_year,period_month,net_pay,status").eq("employee_id", e.id)
          .order("period_year", { ascending: false }).order("period_month", { ascending: false }).limit(6),
        supabase.from("leave_balances").select("leave_type_code,allocated,used").eq("employee_id", e.id).eq("year", new Date().getFullYear()),
      ]);

      setAttendance((att as any) ?? []);
      setPayslips((ps as any) ?? []);
      setBalances((bals as any) ?? []);
      setLoading(false);
    })();
  }, [user?.id]);

  const summary = useMemo(() => {
    const present = attendance.filter((a) => a.status === "present").length;
    const onLeave = attendance.filter((a) => a.status === "on_leave" || a.status === "leave").length;
    const absent = attendance.filter((a) => a.status === "absent").length;
    return { present, onLeave, absent, total: attendance.length };
  }, [attendance]);

  if (loading) return <div className="py-12 flex justify-center"><Loader2 className="animate-spin" /></div>;

  if (!emp) {
    return (
      <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">
        You're not currently registered as an employee. Contact your HR admin.
      </CardContent></Card>
    );
  }

  return (
    <div className="space-y-5">
      <Card>
        <CardContent className="p-5 flex flex-wrap gap-6 items-center">
          <div className="size-14 rounded-full bg-primary/10 grid place-items-center font-display text-xl font-bold">
            {emp.full_name.split(" ").map((n) => n[0]).slice(0, 2).join("")}
          </div>
          <div className="flex-1 min-w-[200px]">
            <div className="font-display text-xl font-semibold">{emp.full_name}</div>
            <div className="text-sm text-muted-foreground">
              {emp.designation ?? "—"} {emp.grade && <Badge variant="outline" className="ml-2">{emp.grade}</Badge>}
            </div>
            <div className="text-xs text-muted-foreground">Code: {emp.employee_code} • {emp.department ?? "No dept"} • Joined {emp.join_date}</div>
          </div>
          <div className="text-right">
            <div className="text-xs text-muted-foreground">Annual CTC</div>
            <div className="font-display text-2xl font-bold">{fmt(emp.ctc)}</div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><CalendarCheck className="size-4" />This month</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">
            <div className="flex justify-between"><span>Present</span><span className="font-semibold text-green-600">{summary.present}</span></div>
            <div className="flex justify-between"><span>On leave</span><span className="font-semibold text-blue-600">{summary.onLeave}</span></div>
            <div className="flex justify-between"><span>Absent</span><span className="font-semibold text-destructive">{summary.absent}</span></div>
            <div className="flex justify-between border-t pt-1 mt-1"><span>Total marked</span><span className="font-semibold">{summary.total}</span></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2"><CalendarRange className="size-4" />Leave balance</CardTitle>
            <Link to="/dashboard/hrms/leaves" className="text-xs text-primary inline-flex items-center gap-1">Apply <ArrowRight className="size-3" /></Link>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            {balances.length === 0 && <div className="text-xs text-muted-foreground">No balances allocated yet.</div>}
            {balances.map((b) => (
              <div key={b.leave_type_code} className="flex justify-between">
                <span>{b.leave_type_code}</span>
                <span className="font-semibold">{Math.max(0, b.allocated - b.used)} / {b.allocated}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2"><FileText className="size-4" />Recent payslips</CardTitle>
            <Link to="/dashboard/hrms/payslips" className="text-xs text-primary inline-flex items-center gap-1">All <ArrowRight className="size-3" /></Link>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            {payslips.length === 0 && <div className="text-xs text-muted-foreground">No payslips yet.</div>}
            {payslips.map((p) => (
              <Link key={p.id} to="/dashboard/hrms/payslips/$id" params={{ id: p.id }} className="flex justify-between hover:bg-muted/50 rounded px-2 py-1">
                <span>{p.period_year}-{String(p.period_month).padStart(2, "0")}</span>
                <span className="inline-flex items-center gap-1 font-semibold"><IndianRupee className="size-3" />{Number(p.net_pay).toLocaleString("en-IN")}</span>
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
