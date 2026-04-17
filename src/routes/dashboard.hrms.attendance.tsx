import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useWorkspace } from "@/lib/workspace-context";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/dashboard/hrms/attendance")({
  component: AttendancePage,
});

type Status = "present" | "absent" | "half_day" | "leave" | "holiday" | "weekend";

const COLORS: Record<Status, string> = {
  present: "bg-accent/30 text-accent hover:bg-accent/50",
  absent: "bg-destructive/30 text-destructive hover:bg-destructive/50",
  half_day: "bg-yellow-500/30 text-yellow-600 hover:bg-yellow-500/50",
  leave: "bg-blue-500/30 text-blue-600 hover:bg-blue-500/50",
  holiday: "bg-purple-500/30 text-purple-600 hover:bg-purple-500/50",
  weekend: "bg-muted text-muted-foreground",
};

const NEXT: Record<Status, Status> = {
  present: "absent", absent: "half_day", half_day: "leave",
  leave: "holiday", holiday: "present", weekend: "present",
};

function AttendancePage() {
  const { current, canManage } = useWorkspace();
  const [month, setMonth] = useState(new Date());
  const [employees, setEmployees] = useState<{ id: string; full_name: string; employee_code: string }[]>([]);
  const [att, setAtt] = useState<Map<string, Status>>(new Map());
  const [loading, setLoading] = useState(true);

  const y = month.getFullYear();
  const m = month.getMonth();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const load = async () => {
    if (!current) return;
    setLoading(true);
    const [{ data: emps }, { data: rows }] = await Promise.all([
      supabase.from("employees").select("id, full_name, employee_code").eq("workspace_id", current.id).eq("status", "active").order("full_name"),
      supabase.from("attendance").select("employee_id, date, status").eq("workspace_id", current.id)
        .gte("date", `${y}-${String(m + 1).padStart(2, "0")}-01`)
        .lte("date", `${y}-${String(m + 1).padStart(2, "0")}-${daysInMonth}`),
    ]);
    setEmployees(emps ?? []);
    const map = new Map<string, Status>();
    (rows ?? []).forEach((r: any) => map.set(`${r.employee_id}_${r.date}`, r.status));
    setAtt(map);
    setLoading(false);
  };

  useEffect(() => { load(); }, [current?.id, y, m]);

  const cycle = async (empId: string, day: number) => {
    if (!current || !canManage) return;
    const date = `${y}-${String(m + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const key = `${empId}_${date}`;
    const cur = att.get(key) ?? "present";
    const next = NEXT[cur];
    setAtt(new Map(att).set(key, next));
    const { error } = await supabase.from("attendance").upsert(
      { workspace_id: current.id, employee_id: empId, date, status: next },
      { onConflict: "employee_id,date" }
    );
    if (error) toast.error(error.message);
  };

  const monthLabel = month.toLocaleString("default", { month: "long", year: "numeric" });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setMonth(new Date(y, m - 1, 1))}><ChevronLeft className="size-4" /></Button>
          <div className="font-semibold min-w-[160px] text-center">{monthLabel}</div>
          <Button variant="outline" size="icon" onClick={() => setMonth(new Date(y, m + 1, 1))}><ChevronRight className="size-4" /></Button>
        </div>
        <div className="flex items-center gap-3 text-xs flex-wrap">
          {(["present", "absent", "half_day", "leave", "holiday"] as Status[]).map((s) => (
            <div key={s} className="flex items-center gap-1.5">
              <div className={cn("size-3 rounded", COLORS[s])} />
              <span className="capitalize text-muted-foreground">{s.replace("_", " ")}</span>
            </div>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="py-16 grid place-items-center"><Loader2 className="size-6 animate-spin text-accent" /></div>
      ) : employees.length === 0 ? (
        <div className="py-16 text-center text-sm text-muted-foreground rounded-2xl bg-card border border-border">No active employees. Add some first.</div>
      ) : (
        <div className="rounded-2xl bg-card border border-border overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-secondary/50">
              <tr>
                <th className="text-left p-2 sticky left-0 bg-secondary/80 backdrop-blur min-w-[180px]">Employee</th>
                {days.map((d) => (
                  <th key={d} className="p-1 font-medium text-center w-8">{d}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {employees.map((emp) => (
                <tr key={emp.id} className="border-t border-border">
                  <td className="p-2 sticky left-0 bg-card z-10">
                    <div className="font-medium text-sm">{emp.full_name}</div>
                    <div className="text-[10px] text-muted-foreground font-mono">{emp.employee_code}</div>
                  </td>
                  {days.map((d) => {
                    const date = `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
                    const status = att.get(`${emp.id}_${date}`) ?? "present";
                    return (
                      <td key={d} className="p-0.5 text-center">
                        <button
                          onClick={() => cycle(emp.id, d)}
                          disabled={!canManage}
                          className={cn(
                            "size-7 rounded text-[10px] font-bold uppercase transition-colors",
                            COLORS[status],
                            !canManage && "cursor-default"
                          )}
                          title={status}
                        >
                          {status.charAt(0).toUpperCase()}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {canManage && <p className="text-xs text-muted-foreground">Click a cell to cycle: Present → Absent → Half-day → Leave → Holiday → Present.</p>}
    </div>
  );
}
