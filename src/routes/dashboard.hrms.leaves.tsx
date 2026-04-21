import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Loader2, CalendarPlus, CheckCircle2, XCircle, Ban } from "lucide-react";

export const Route = createFileRoute("/dashboard/hrms/leaves")({
  head: () => ({ meta: [{ title: "Leaves — HRMS" }] }),
  component: LeavesPage,
});

type Leave = {
  id: string;
  workspace_id: string;
  employee_id: string;
  user_id: string | null;
  leave_type_code: string;
  start_date: string;
  end_date: string;
  days: number;
  reason: string | null;
  status: "pending" | "approved" | "rejected" | "cancelled";
  approver_id: string | null;
  decision_notes: string | null;
  decided_at: string | null;
  created_at: string;
};

type LeaveType = { code: string; name: string; default_annual_quota: number; color: string | null };
type Balance = { leave_type_code: string; allocated: number; used: number; year: number };
type Employee = { id: string; full_name: string; user_id: string | null; workspace_id: string };

function diffDays(a: string, b: string) {
  const d1 = new Date(a); const d2 = new Date(b);
  return Math.floor((d2.getTime() - d1.getTime()) / 86400000) + 1;
}

const STATUS_VARIANT: Record<Leave["status"], "default" | "secondary" | "destructive" | "outline"> = {
  approved: "default", pending: "secondary", rejected: "destructive", cancelled: "outline",
};

function LeavesPage() {
  const { user, role } = useAuth();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [leaves, setLeaves] = useState<Leave[]>([]);
  const [types, setTypes] = useState<LeaveType[]>([]);
  const [balances, setBalances] = useState<Balance[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const isAdmin = role === "admin" || role === "ceo" || role === "super_admin";

  // form
  const [typeCode, setTypeCode] = useState("ANNUAL");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    if (!user) return;
    setLoading(true);

    const [{ data: emp }, { data: tps }, { data: lvs }, { data: bals }] = await Promise.all([
      supabase.from("employees").select("id,full_name,user_id,workspace_id").eq("user_id", user.id).maybeSingle(),
      supabase.from("leave_types").select("code,name,default_annual_quota,color").eq("is_active", true).order("name"),
      supabase.from("leaves").select("*").order("created_at", { ascending: false }).limit(200),
      supabase.from("leave_balances").select("leave_type_code,allocated,used,year").eq("year", new Date().getFullYear()),
    ]);

    setEmployee((emp as Employee) ?? null);
    setTypes((tps as LeaveType[]) ?? []);
    setLeaves((lvs as Leave[]) ?? []);
    setBalances((bals as Balance[]) ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [user?.id]);

  const myLeaves = useMemo(() => leaves.filter((l) => l.user_id === user?.id), [leaves, user]);
  const pendingForApproval = useMemo(() => leaves.filter((l) => l.status === "pending" && l.user_id !== user?.id), [leaves, user]);

  const myBalances = useMemo(() => {
    const map = new Map<string, Balance>();
    balances.forEach((b) => {
      if (!employee) return;
      // balances filtered by RLS; show types with computed balance fallback
    });
    return types.map((t) => {
      const b = balances.find((x) => x.leave_type_code === t.code);
      const allocated = b?.allocated ?? t.default_annual_quota;
      const used = b?.used ?? 0;
      return { code: t.code, name: t.name, color: t.color, allocated, used, remaining: Math.max(0, allocated - used) };
    });
  }, [balances, types, employee]);

  async function submitLeave() {
    if (!employee) { toast.error("You're not registered as an employee"); return; }
    if (!startDate || !endDate) { toast.error("Pick dates"); return; }
    const days = diffDays(startDate, endDate);
    if (days < 1) { toast.error("Invalid date range"); return; }

    setSubmitting(true);
    const { error } = await supabase.from("leaves").insert({
      workspace_id: employee.workspace_id,
      employee_id: employee.id,
      user_id: user!.id,
      leave_type_code: typeCode,
      start_date: startDate,
      end_date: endDate,
      days,
      reason: reason.trim() || null,
    });
    setSubmitting(false);

    if (error) { toast.error(error.message); return; }
    toast.success("Leave submitted");
    setOpen(false);
    setReason(""); setStartDate(""); setEndDate("");
    load();
  }

  async function approve(id: string) {
    const { error } = await supabase.rpc("approve_leave", { _leave_id: id, _notes: null });
    if (error) toast.error(error.message);
    else { toast.success("Approved"); load(); }
  }
  async function reject(id: string) {
    const notes = prompt("Reason for rejection?") || null;
    const { error } = await supabase.rpc("reject_leave", { _leave_id: id, _notes: notes });
    if (error) toast.error(error.message);
    else { toast.success("Rejected"); load(); }
  }
  async function cancel(id: string) {
    const { error } = await supabase.rpc("cancel_own_leave", { _leave_id: id });
    if (error) toast.error(error.message);
    else { toast.success("Cancelled"); load(); }
  }

  if (loading) return <div className="py-12 flex justify-center"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-xl font-semibold">Leaves</h2>
          <p className="text-muted-foreground text-sm">Apply for leave, view balances and approve requests.</p>
        </div>
        {employee && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><CalendarPlus className="size-4 mr-2" />Apply leave</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Apply for leave</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>Type</Label>
                  <Select value={typeCode} onValueChange={setTypeCode}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {types.map((t) => <SelectItem key={t.code} value={t.code}>{t.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Start</Label><Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></div>
                  <div><Label>End</Label><Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} /></div>
                </div>
                {startDate && endDate && diffDays(startDate, endDate) > 0 && (
                  <p className="text-xs text-muted-foreground">Total: {diffDays(startDate, endDate)} day(s)</p>
                )}
                <div><Label>Reason</Label><Textarea value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} /></div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button onClick={submitLeave} disabled={submitting}>
                  {submitting && <Loader2 className="size-4 animate-spin mr-2" />}Submit
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Balances */}
      {employee && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {myBalances.map((b) => (
            <Card key={b.code}>
              <CardContent className="p-4">
                <div className="text-xs text-muted-foreground">{b.name}</div>
                <div className="font-display text-2xl font-bold mt-1" style={{ color: b.color ?? undefined }}>
                  {b.remaining}<span className="text-sm text-muted-foreground font-normal"> / {b.allocated}</span>
                </div>
                <div className="text-[10px] text-muted-foreground mt-1">Used: {b.used}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Tabs defaultValue="mine">
        <TabsList>
          <TabsTrigger value="mine">My leaves ({myLeaves.length})</TabsTrigger>
          {(isAdmin || pendingForApproval.length > 0) && (
            <TabsTrigger value="approve">Approvals ({pendingForApproval.length})</TabsTrigger>
          )}
          <TabsTrigger value="all">All ({leaves.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="mine">
          <LeaveTable rows={myLeaves} onCancel={cancel} canCancelOwn />
        </TabsContent>
        <TabsContent value="approve">
          <LeaveTable rows={pendingForApproval} onApprove={approve} onReject={reject} canApprove />
        </TabsContent>
        <TabsContent value="all">
          <LeaveTable rows={leaves} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function LeaveTable({
  rows, onApprove, onReject, onCancel, canApprove, canCancelOwn,
}: {
  rows: Leave[];
  onApprove?: (id: string) => void;
  onReject?: (id: string) => void;
  onCancel?: (id: string) => void;
  canApprove?: boolean;
  canCancelOwn?: boolean;
}) {
  if (rows.length === 0) {
    return <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">No leaves to show.</CardContent></Card>;
  }
  return (
    <Card>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b text-left">
              <th className="py-2 px-3">Type</th>
              <th className="py-2 px-3">Dates</th>
              <th className="py-2 px-3">Days</th>
              <th className="py-2 px-3">Reason</th>
              <th className="py-2 px-3">Status</th>
              <th className="py-2 px-3 text-right">Actions</th>
            </tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b last:border-b-0">
                  <td className="py-2 px-3">{r.leave_type_code}</td>
                  <td className="py-2 px-3">{r.start_date} → {r.end_date}</td>
                  <td className="py-2 px-3">{r.days}</td>
                  <td className="py-2 px-3 max-w-[240px] truncate" title={r.reason ?? ""}>{r.reason}</td>
                  <td className="py-2 px-3"><Badge variant={STATUS_VARIANT[r.status]}>{r.status}</Badge></td>
                  <td className="py-2 px-3 text-right">
                    {canApprove && r.status === "pending" && (
                      <div className="flex gap-1 justify-end">
                        <Button size="sm" variant="outline" onClick={() => onApprove?.(r.id)}><CheckCircle2 className="size-4 text-green-600" /></Button>
                        <Button size="sm" variant="outline" onClick={() => onReject?.(r.id)}><XCircle className="size-4 text-destructive" /></Button>
                      </div>
                    )}
                    {canCancelOwn && (r.status === "pending" || r.status === "approved") && (
                      <Button size="sm" variant="ghost" onClick={() => onCancel?.(r.id)}><Ban className="size-4" /></Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
