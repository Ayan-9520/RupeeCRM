import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useAuth, type AppRole } from "@/lib/auth-context";
import { getRoleLabel, isPlatformAdmin } from "@/lib/role-access";
import { toast } from "sonner";
import { Users, Loader2, Search, ShieldOff, UserCheck, Copy, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createEmployee, listCrmUsers, resetCrmUserPassword, updateCrmUser } from "@/lib/python-api";
import { departmentLabel, EMPLOYEE_DEPARTMENTS } from "@/lib/login-door";

export const Route = createFileRoute("/dashboard/admin/users")({
  head: () => ({ meta: [{ title: "Manage Users — RupeeOne" }] }),
  component: AdminUsersPage,
});

const ROLES: AppRole[] = ["ceo", "super_admin", "admin", "dsa", "caller", "coordinator", "lender", "affiliate", "customer"];

const ROLE_BADGE: Record<string, string> = {
  ceo: "bg-accent/20 text-accent",
  super_admin: "bg-orange-500/15 text-orange-600",
  admin: "bg-red-500/15 text-red-600",
  dsa: "bg-emerald-500/15 text-emerald-600",
  lender: "bg-purple-500/15 text-purple-600",
  caller: "bg-blue-500/15 text-blue-600",
  coordinator: "bg-amber-500/15 text-amber-600",
  affiliate: "bg-pink-500/15 text-pink-600",
  customer: "bg-muted text-muted-foreground",
};

type UserRow = {
  id: string;
  email: string;
  full_name: string;
  role: string;
  phone: string | null;
  dsa_id: string | null;
  is_active: boolean;
  finance_level?: string | null;
  department?: string | null;
  created_at: string | null;
  sales_title?: string | null;
  sales_grade?: string | null;
  reports_to_name?: string | null;
  employee_code?: string;
  gender?: string;
  base_location?: string;
  office?: string;
  kyc_verified?: boolean;
  agreement_percent?: number | null;
};

function joiningDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function AdminUsersPage() {
  const { role, user: me } = useAuth();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [pendingPartners, setPendingPartners] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<AppRole | "all">("all");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [staff, setStaff] = useState({ full_name: "", email: "", role: "coordinator" as "coordinator" | "caller", department: "SALES" });
  const [edit, setEdit] = useState<UserRow | null>(null);
  const [detail, setDetail] = useState<UserRow | null>(null);

  const refresh = async () => {
    setLoading(true);
    try {
      const data = await listCrmUsers();
      setUsers(data.items);
      setPendingPartners(data.pending_partners);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to load users");
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const filtered = useMemo(() => {
    return users.filter((u) => {
      if (roleFilter !== "all" && u.role !== roleFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          u.full_name?.toLowerCase().includes(q) ||
          u.email?.toLowerCase().includes(q) ||
          u.phone?.includes(q) ||
          u.dsa_id?.toLowerCase().includes(q) ||
          u.employee_code?.toLowerCase().includes(q) ||
          u.base_location?.toLowerCase().includes(q) ||
          u.reports_to_name?.toLowerCase().includes(q) ||
          u.id.includes(q)
        );
      }
      return true;
    });
  }, [users, search, roleFilter]);

  const onCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusyId("create");
    try {
      const res = await createEmployee({
        full_name: staff.full_name,
        email: staff.email,
        role: staff.role,
        department: staff.role === "coordinator" ? staff.department : null,
      });
      await navigator.clipboard.writeText(`Email: ${res.email}\nPassword: ${res.temporary_password}`);
      toast.success(
        res.emailed
          ? `${res.full_name} can sign in. Password emailed to ${res.email} and to admin.`
          : `${res.full_name} can sign in. Email is not set up, so the password was copied.`,
      );
      setStaff({ full_name: "", email: "", role: "coordinator", department: "SALES" });
      await refresh();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Could not create the employee");
    } finally {
      setBusyId(null);
    }
  };

  const onSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!edit) return;
    setBusyId(edit.id);
    try {
      const saved = await updateCrmUser(edit.id, {
        full_name: edit.full_name,
        phone: edit.phone || "",
        department: edit.department,
        is_active: edit.is_active,
        role: edit.role,
        gender: edit.gender || "",
        base_location: edit.base_location || "",
        office: edit.office || "",
        agreement_percent: edit.role === "dsa" || edit.role === "affiliate" ? Number(edit.agreement_percent) || null : null,
      });
      setUsers((rows) => rows.map((row) => (row.id === edit.id ? { ...row, ...saved } : row)));
      setEdit(null);
      toast.success("Login updated");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Could not update the login");
    } finally {
      setBusyId(null);
    }
  };

  const onToggleActive = async (u: UserRow) => {
    if (u.id === me?.id) {
      toast.error("You cannot disable your own login");
      return;
    }
    setBusyId(u.id);
    try {
      const saved = await updateCrmUser(u.id, {
        full_name: u.full_name,
        phone: u.phone || "",
        department: u.department,
        is_active: !u.is_active,
        role: u.role,
        gender: u.gender || "",
        base_location: u.base_location || "",
        office: u.office || "",
        agreement_percent: u.role === "dsa" || u.role === "affiliate" ? u.agreement_percent ?? null : null,
      });
      setUsers((rows) => rows.map((row) => (row.id === u.id ? { ...row, ...saved } : row)));
      toast.success(`${u.full_name} is ${u.is_active ? "inactive" : "active"}`);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Could not update the login");
    } finally {
      setBusyId(null);
    }
  };

  const onResetPassword = async (u: UserRow) => {
    setBusyId(u.id);
    try {
      const res = await resetCrmUserPassword(u.id);
      await navigator.clipboard.writeText(`Email: ${res.email}\nPassword: ${res.temporary_password}`);
      toast.success(
        res.emailed
          ? `New password emailed to ${res.email} and to admin.`
          : `Email is not set up. New password copied for ${res.email}.`,
      );
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Reset failed");
    } finally {
      setBusyId(null);
    }
  };

  if (!isPlatformAdmin(role)) {
    return (
      <div className="max-w-md mx-auto mt-20 text-center">
        <ShieldOff className="size-12 mx-auto text-muted-foreground mb-3" />
        <h2 className="font-display text-xl font-bold">Admin only</h2>
        <p className="text-muted-foreground text-sm mt-1">You don't have permission to manage users.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-[#390A5D] flex items-center gap-2">
            <Users className="size-6 text-[#10662A]" /> Manage Users
          </h1>
          <p className="text-[#5c4d72] text-sm mt-1">
            {users.length} CRM logins · DSA appears here <strong>after</strong> Partner Approve
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#5c4d72]" />
            <Input
              placeholder="Search name, email, DSA ID…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-64 pl-9 border-[#d8ecdd]"
            />
          </div>
          <Select value={roleFilter} onValueChange={(v) => setRoleFilter(v as AppRole | "all")}>
            <SelectTrigger className="w-36 border-[#d8ecdd]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All roles</SelectItem>
              {ROLES.map((r) => (
                <SelectItem key={r} value={r} className="capitalize">
                  {getRoleLabel(r)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <form onSubmit={(event) => void onCreate(event)} className="grid gap-3 rounded-2xl border border-[#d8ecdd] bg-white p-4 md:grid-cols-[1fr_1fr_150px_180px_auto]">
        <input required value={staff.full_name} onChange={(e) => setStaff((s) => ({ ...s, full_name: e.target.value }))} placeholder="Employee name" className="h-10 rounded-xl border border-[#d8ecdd] px-3 text-sm" />
        <input required type="email" value={staff.email} onChange={(e) => setStaff((s) => ({ ...s, email: e.target.value }))} placeholder="Email" className="h-10 rounded-xl border border-[#d8ecdd] px-3 text-sm" />
        <select value={staff.role} onChange={(e) => setStaff((s) => ({ ...s, role: e.target.value as "coordinator" | "caller" }))} className="h-10 rounded-xl border border-[#d8ecdd] px-3 text-sm">
          <option value="coordinator">Employee</option>
          <option value="caller">Telecaller</option>
        </select>
        {staff.role === "coordinator" ? (
          <select value={staff.department} onChange={(e) => setStaff((s) => ({ ...s, department: e.target.value }))} className="h-10 rounded-xl border border-[#d8ecdd] px-3 text-sm">
            {EMPLOYEE_DEPARTMENTS.map((item) => (
              <option key={item.id} value={item.id}>{item.label}</option>
            ))}
          </select>
        ) : (
          <div />
        )}
        <button type="submit" disabled={busyId === "create"} className="h-10 rounded-xl bg-[#10662A] px-4 text-sm font-semibold text-white disabled:opacity-60">
          {busyId === "create" ? "Creating…" : "Create login"}
        </button>
      </form>

      {detail ? (
        <UserDetail
          row={detail}
          onClose={() => setDetail(null)}
          onEdit={() => {
            setEdit(detail);
            setDetail(null);
          }}
          onReset={() => void onResetPassword(detail)}
          resetting={busyId === detail.id}
        />
      ) : null}

      {edit ? (
        <Popup title="Edit login" subtitle={edit.email} onClose={() => setEdit(null)}>
          <form onSubmit={(event) => void onSave(event)} className="grid gap-3 sm:grid-cols-2">
            <Field label="Name" value={edit.full_name} onChange={(full_name) => setEdit({ ...edit, full_name })} />
            <Field label="Phone" value={edit.phone || ""} onChange={(phone) => setEdit({ ...edit, phone })} />
            <Field label="Email" value={edit.email} readOnly />
            <Field label="Employee ID" value={edit.employee_code || "—"} readOnly />
            <Field label="Title" value={edit.sales_title || "—"} readOnly />
            <Field label="Reports to" value={edit.reports_to_name || "—"} readOnly />
            {edit.role === "dsa" || edit.role === "affiliate" ? (
              <Field label="Agreement % of lender payout" value={edit.agreement_percent == null ? "" : String(edit.agreement_percent)} onChange={(value) => setEdit({ ...edit, agreement_percent: value === "" ? null : Number(value) })} />
            ) : null}
            <label className="block text-xs font-semibold text-[#5c4d72]">Gender
              <select value={edit.gender || ""} onChange={(e) => setEdit({ ...edit, gender: e.target.value })} className="mt-1 h-10 w-full rounded-xl border border-[#d8ecdd] bg-white px-3 text-sm text-[#390A5D]">
                <option value="">—</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </label>
            <Field label="Location" value={edit.base_location || ""} onChange={(base_location) => setEdit({ ...edit, base_location })} />
            <Field label="Branch" value={edit.office || ""} onChange={(office) => setEdit({ ...edit, office })} />
            <Field label="Joining date" value={joiningDate(edit.created_at)} readOnly />
            {(edit.role === "coordinator" || edit.role === "caller") && !edit.finance_level ? (
              <>
                <label className="block text-xs font-semibold text-[#5c4d72]">Role
                  <select value={edit.role} onChange={(e) => setEdit({ ...edit, role: e.target.value })} className="mt-1 h-10 w-full rounded-xl border border-[#d8ecdd] bg-white px-3 text-sm text-[#390A5D]">
                    <option value="coordinator">Employee</option>
                    <option value="caller">Telecaller</option>
                  </select>
                </label>
                {edit.role === "coordinator" ? (
                  <label className="block text-xs font-semibold text-[#5c4d72]">Department
                    <select value={edit.department || "SALES"} onChange={(e) => setEdit({ ...edit, department: e.target.value })} className="mt-1 h-10 w-full rounded-xl border border-[#d8ecdd] bg-white px-3 text-sm text-[#390A5D]">
                      {EMPLOYEE_DEPARTMENTS.map((item) => (
                        <option key={item.id} value={item.id}>{item.label}</option>
                      ))}
                    </select>
                  </label>
                ) : (
                  <div className="flex items-end text-sm text-[#5c4d72]">Telecaller stays in Sales.</div>
                )}
              </>
            ) : (
              <div className="flex items-end text-sm text-[#5c4d72] sm:col-span-2">This role stays as it is. Invoice seats, the CEO and partner logins are not retitled here.</div>
            )}
            <label className="inline-flex items-center gap-2 text-sm font-medium text-[#390A5D]">
              <input
                type="checkbox"
                checked={edit.is_active}
                disabled={edit.id === me?.id}
                onChange={(e) => setEdit({ ...edit, is_active: e.target.checked })}
              />
              Login active
            </label>
            <div className="flex justify-end gap-2 sm:col-span-2">
              <button type="button" onClick={() => setEdit(null)} className="h-10 rounded-xl border border-[#d8ecdd] px-4 text-sm font-semibold text-[#390A5D]">Cancel</button>
              <button type="submit" disabled={busyId === edit.id} className="h-10 rounded-xl bg-[#10662A] px-5 text-sm font-semibold text-white disabled:opacity-60">Save</button>
            </div>
          </form>
        </Popup>
      ) : null}

      {pendingPartners > 0 && (
        <Link
          to="/dashboard/admin/partners"
          className="flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 hover:bg-amber-100/80 transition-colors"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="size-10 rounded-xl bg-amber-500/20 grid place-items-center shrink-0">
              <UserCheck className="size-5 text-amber-700" />
            </div>
            <div className="min-w-0">
              <div className="font-bold text-amber-900 text-sm">
                {pendingPartners} partner application{pendingPartners === 1 ? "" : "s"} waiting for approval
              </div>
              <div className="text-xs text-amber-800/80">
                Website partners are NOT users yet — open Partner Applications → Approve → login is created
              </div>
            </div>
          </div>
          <span className="inline-flex items-center gap-1 text-sm font-bold text-amber-900 shrink-0">
            Approve now <ArrowRight className="size-4" />
          </span>
        </Link>
      )}

      <div className="rounded-2xl border border-[#d8ecdd] bg-white overflow-hidden shadow-[0_4px_20px_rgba(16,102,42,0.06)]">
        {loading ? (
          <div className="p-12 text-center">
            <Loader2 className="size-6 animate-spin mx-auto text-[#10662A]" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-[#5c4d72]">
            <Users className="size-10 mx-auto mb-3 opacity-40 text-[#10662A]" />
            <p className="font-medium">No CRM users yet</p>
            <p className="text-sm mt-1">
              Approve a partner first →{" "}
              <Link to="/dashboard/admin/partners" className="text-[#10662A] font-bold hover:underline">
                Partner Applications
              </Link>
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-max min-w-full border-separate border-spacing-0 text-sm">
              <thead className="text-left text-[11px] uppercase tracking-wide text-[#5c4d72]">
                <tr>
                  <th className="whitespace-nowrap bg-[#E8F7EC] px-4 py-3">Name</th>
                  <th className="whitespace-nowrap bg-[#E8F7EC] px-4 py-3">Role</th>
                  <th className="whitespace-nowrap bg-[#E8F7EC] px-4 py-3">Email</th>
                  {["Employee ID", "Reports to", "Phone", "Location", "Joining date", "Status", ""].map((head) => (
                    <th key={head || "action"} className="whitespace-nowrap bg-[#E8F7EC] px-4 py-3">{head}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((u) => (
                  <tr key={u.id} className="group">
                    <td className="whitespace-nowrap border-t border-[#d8ecdd] px-4 py-3 font-semibold text-[#390A5D]">
                      <button type="button" className="text-left hover:underline" onClick={() => setDetail(u)}>{u.full_name || "—"}</button>
                    </td>
                    <td className="whitespace-nowrap border-t border-[#d8ecdd] px-4 py-3">
                      <Badge className={`${ROLE_BADGE[u.role] || ""} text-[10px]`}>
                        {getRoleLabel(u.role as AppRole)}
                        {u.department ? ` · ${departmentLabel(u.department)}` : ""}
                        {u.finance_level ? ` · ${u.finance_level.replaceAll("_", " ")}` : ""}
                      </Badge>
                    </td>
                    <td className="whitespace-nowrap border-t border-[#d8ecdd] px-4 py-3 text-[#5c4d72]">{u.email}</td>
                    <td className="whitespace-nowrap border-t border-[#d8ecdd] px-4 py-3 font-mono text-xs text-[#10662A]">{u.employee_code || "—"}</td>
                    <td className="whitespace-nowrap border-t border-[#d8ecdd] px-4 py-3 text-[#5c4d72]">{u.reports_to_name || "—"}</td>
                    <td className="whitespace-nowrap border-t border-[#d8ecdd] px-4 py-3 font-mono text-xs text-[#5c4d72]">{u.phone || "—"}</td>
                    <td className="whitespace-nowrap border-t border-[#d8ecdd] px-4 py-3 text-[#5c4d72]">{u.base_location || "—"}</td>
                    <td className="whitespace-nowrap border-t border-[#d8ecdd] px-4 py-3 text-[#5c4d72]">{joiningDate(u.created_at)}</td>
                    <td className="whitespace-nowrap border-t border-[#d8ecdd] px-4 py-3">
                      <button
                        type="button"
                        disabled={busyId === u.id || u.id === me?.id}
                        onClick={() => void onToggleActive(u)}
                        className={`rounded-full px-3 py-1 text-xs font-semibold disabled:opacity-60 ${
                          u.is_active ? "bg-[#10662A] text-white" : "border border-[#d8ecdd] text-[#5c4d72]"
                        }`}
                      >
                        {busyId === u.id ? "Saving…" : u.is_active ? "Active" : "Inactive"}
                      </button>
                    </td>
                    <td className="whitespace-nowrap border-t border-[#d8ecdd] px-4 py-3 text-right">
                      <Button size="sm" variant="ghost" className="text-[#390A5D]" onClick={() => setDetail(u)}>View</Button>
                      <Button size="sm" variant="ghost" className="text-[#390A5D]" onClick={() => { setDetail(null); setEdit(u); }}>Edit</Button>
                      <Button size="sm" variant="ghost" className="text-[#10662A]" disabled={busyId === u.id} onClick={() => void onResetPassword(u)}>
                        {busyId === u.id ? "Sending…" : "Email password"}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function Popup({ title, subtitle, onClose, children }: { title: string; subtitle?: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[#14281c]/45 p-4" onClick={onClose}>
      <div
        className="max-h-[88vh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-[#d8ecdd] bg-white shadow-[0_24px_60px_rgba(20,40,28,0.22)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-[#d8ecdd] bg-white px-6 py-4">
          <div>
            <h2 className="font-display text-xl font-bold text-[#390A5D]">{title}</h2>
            {subtitle ? <p className="mt-0.5 text-sm text-[#5c4d72]">{subtitle}</p> : null}
          </div>
          <button type="button" onClick={onClose} className="rounded-full border border-[#d8ecdd] px-3 py-1 text-sm font-semibold text-[#390A5D]">Close</button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

function UserDetail({
  row,
  onClose,
  onEdit,
  onReset,
  resetting,
}: {
  row: UserRow;
  onClose: () => void;
  onEdit: () => void;
  onReset: () => void;
  resetting: boolean;
}) {
  const facts: [string, string][] = [
    ["Employee ID", row.employee_code || "—"],
    ["Name", row.full_name || "—"],
    ["Role", getRoleLabel(row.role as AppRole)],
    ["Email", row.email],
    ["Phone", row.phone || "—"],
    ["Title", row.sales_title || "—"],
    ["Grade", row.sales_grade || "—"],
    ["Department", row.department ? departmentLabel(row.department) : "—"],
    ["Seat", row.finance_level ? row.finance_level.replaceAll("_", " ") : "—"],
    ["Reports to", row.reports_to_name || "—"],
    ["Partner ID", row.dsa_id || "—"],
    ["Agreement %", row.agreement_percent == null ? "—" : `${row.agreement_percent}%`],
    ["Gender", row.gender || "—"],
    ["Location", row.base_location || "—"],
    ["Branch", row.office || "—"],
    ["Joining date", joiningDate(row.created_at)],
    ["Status", row.is_active ? "Active" : "Disabled"],
    ["KYC", row.kyc_verified ? "Verified" : "Not verified"],
  ];
  const initial = (row.full_name || "?").trim().charAt(0).toUpperCase();
  return (
    <Popup title={row.full_name || "User"} subtitle={row.email} onClose={onClose}>
      <div className="mb-4 flex items-center gap-3">
        <div className="grid size-12 place-items-center rounded-2xl bg-[#10662A] text-lg font-bold text-white">{initial}</div>
        <div>
          <Badge className={`${ROLE_BADGE[row.role] || ""} text-[10px]`}>{getRoleLabel(row.role as AppRole)}</Badge>
          <p className="mt-1 text-xs text-[#5c4d72]">Joined {joiningDate(row.created_at)}</p>
        </div>
      </div>
      <dl className="grid gap-3 sm:grid-cols-2">
        {facts.map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-[#d8ecdd] bg-[#f7fdf8] px-3 py-2.5">
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-[#5c4d72]">{label}</dt>
            <dd className="mt-1 text-sm font-semibold text-[#390A5D]">{value}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-5 flex justify-end gap-2">
        <button type="button" onClick={onReset} disabled={resetting} className="inline-flex h-10 items-center gap-1 rounded-xl border border-[#d8ecdd] px-4 text-sm font-semibold text-[#10662A] disabled:opacity-60">
          {resetting ? <Loader2 className="size-3.5 animate-spin" /> : <Copy className="size-3.5" />}
          Email new password
        </button>
        <button type="button" onClick={onEdit} className="h-10 rounded-xl bg-[#10662A] px-5 text-sm font-semibold text-white">Edit</button>
      </div>
    </Popup>
  );
}

function Field({
  label,
  value,
  onChange,
  readOnly = false,
}: {
  label: string;
  value: string;
  onChange?: (value: string) => void;
  readOnly?: boolean;
}) {
  return (
    <label className="block text-xs font-semibold text-[#5c4d72]">
      {label}
      <input
        value={value}
        readOnly={readOnly}
        onChange={(event) => onChange?.(event.target.value)}
        className="mt-1 h-10 w-full rounded-xl border border-[#d8ecdd] px-3 text-sm text-[#390A5D] read-only:bg-[#f7fdf8]"
      />
    </label>
  );
}
