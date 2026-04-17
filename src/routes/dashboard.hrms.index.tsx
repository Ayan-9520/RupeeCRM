import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useWorkspace } from "@/lib/workspace-context";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Loader2, Search, Users, Mail, Phone } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

export const Route = createFileRoute("/dashboard/hrms/")({
  component: EmployeesPage,
});

const empSchema = z.object({
  employee_code: z.string().trim().min(1).max(20),
  full_name: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(255).optional().or(z.literal("")),
  phone: z.string().trim().max(20).optional().or(z.literal("")),
  department: z.string().trim().max(60).optional().or(z.literal("")),
  designation: z.string().trim().max(60).optional().or(z.literal("")),
  join_date: z.string(),
  ctc: z.coerce.number().min(0).max(100000000),
  status: z.enum(["active", "on_leave", "terminated"]),
});

interface Employee {
  id: string;
  employee_code: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  department: string | null;
  designation: string | null;
  status: string;
  ctc: number;
  join_date: string;
}

function EmployeesPage() {
  const { current, canManage } = useWorkspace();
  const [list, setList] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    employee_code: "", full_name: "", email: "", phone: "",
    department: "", designation: "", join_date: new Date().toISOString().slice(0, 10),
    ctc: "", status: "active" as const,
  });

  const load = async () => {
    if (!current) return;
    setLoading(true);
    const { data } = await supabase
      .from("employees")
      .select("id, employee_code, full_name, email, phone, department, designation, status, ctc, join_date")
      .eq("workspace_id", current.id)
      .order("created_at", { ascending: false });
    setList((data ?? []) as Employee[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, [current?.id]);

  const submit = async () => {
    if (!current) return;
    const parsed = empSchema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setBusy(true);
    const { error } = await supabase.from("employees").insert({
      workspace_id: current.id,
      employee_code: parsed.data.employee_code,
      full_name: parsed.data.full_name,
      email: parsed.data.email || null,
      phone: parsed.data.phone || null,
      department: parsed.data.department || null,
      designation: parsed.data.designation || null,
      join_date: parsed.data.join_date,
      ctc: parsed.data.ctc,
      status: parsed.data.status,
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Employee added");
    setOpen(false);
    setForm({ employee_code: "", full_name: "", email: "", phone: "", department: "", designation: "", join_date: new Date().toISOString().slice(0, 10), ctc: "", status: "active" });
    load();
  };

  const filtered = list.filter((e) =>
    !search || e.full_name.toLowerCase().includes(search.toLowerCase()) ||
    e.employee_code.toLowerCase().includes(search.toLowerCase()) ||
    (e.department ?? "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search employees..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <div className="text-xs text-muted-foreground">{list.length} total</div>
        {canManage && (
          <Button onClick={() => setOpen(true)} className="gap-2"><Plus className="size-4" /> Add Employee</Button>
        )}
      </div>

      <div className="rounded-2xl bg-card border border-border overflow-hidden">
        {loading ? (
          <div className="py-16 grid place-items-center"><Loader2 className="size-6 animate-spin text-accent" /></div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <Users className="size-10 mx-auto text-muted-foreground/40" />
            <p className="mt-3 text-sm text-muted-foreground">No employees yet. Add your first one to get started.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Designation</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead className="text-right">CTC (₹)</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((e) => (
                <TableRow key={e.id} className="cursor-pointer">
                  <TableCell className="font-mono text-xs">
                    <Link to="/dashboard/hrms/employees/$id" params={{ id: e.id }} className="hover:text-accent">{e.employee_code}</Link>
                  </TableCell>
                  <TableCell className="font-medium">
                    <Link to="/dashboard/hrms/employees/$id" params={{ id: e.id }} className="hover:text-accent">{e.full_name}</Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{e.department ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{e.designation ?? "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    <div className="flex flex-col gap-0.5">
                      {e.email && <span className="flex items-center gap-1"><Mail className="size-3" />{e.email}</span>}
                      {e.phone && <span className="flex items-center gap-1"><Phone className="size-3" />{e.phone}</span>}
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-mono">{e.ctc.toLocaleString("en-IN")}</TableCell>
                  <TableCell>
                    <span className={`text-[10px] uppercase tracking-wide font-semibold px-2 py-0.5 rounded ${
                      e.status === "active" ? "bg-accent/15 text-accent" :
                      e.status === "on_leave" ? "bg-yellow-500/15 text-yellow-600" :
                      "bg-destructive/15 text-destructive"
                    }`}>{e.status.replace("_", " ")}</span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Add Employee</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Employee Code *">
              <Input value={form.employee_code} onChange={(e) => setForm({ ...form, employee_code: e.target.value })} placeholder="EMP001" maxLength={20} />
            </Field>
            <Field label="Full Name *">
              <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} maxLength={100} />
            </Field>
            <Field label="Email">
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} maxLength={255} />
            </Field>
            <Field label="Phone">
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} maxLength={20} />
            </Field>
            <Field label="Department">
              <Input value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} placeholder="Sales" maxLength={60} />
            </Field>
            <Field label="Designation">
              <Input value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })} placeholder="DSA Manager" maxLength={60} />
            </Field>
            <Field label="Join Date">
              <Input type="date" value={form.join_date} onChange={(e) => setForm({ ...form, join_date: e.target.value })} />
            </Field>
            <Field label="Annual CTC (₹) *">
              <Input type="number" value={form.ctc} onChange={(e) => setForm({ ...form, ctc: e.target.value })} placeholder="600000" />
            </Field>
            <Field label="Status">
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as any })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="on_leave">On Leave</SelectItem>
                  <SelectItem value="terminated">Terminated</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button>
            <Button onClick={submit} disabled={busy}>
              {busy && <Loader2 className="size-4 mr-2 animate-spin" />}Add Employee
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}
