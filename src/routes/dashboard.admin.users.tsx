import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useAuth, type AppRole } from "@/lib/auth-context";
import { isPlatformAdmin } from "@/lib/role-access";
import { toast } from "sonner";
import { Users, Loader2, Search, ShieldOff, UserCheck, Copy, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { listCrmUsers, resetCrmUserPassword } from "@/lib/python-api";

export const Route = createFileRoute("/dashboard/admin/users")({
  head: () => ({ meta: [{ title: "Manage Users — RupeeDial One" }] }),
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
  created_at: string | null;
};

function AdminUsersPage() {
  const { role } = useAuth();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [pendingPartners, setPendingPartners] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<AppRole | "all">("all");
  const [busyId, setBusyId] = useState<string | null>(null);

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
          u.id.includes(q)
        );
      }
      return true;
    });
  }, [users, search, roleFilter]);

  const onResetPassword = async (u: UserRow) => {
    setBusyId(u.id);
    try {
      const res = await resetCrmUserPassword(u.id);
      await navigator.clipboard.writeText(`Email: ${res.email}\nPassword: ${res.temporary_password}`);
      toast.success(`New password copied for ${res.email}`);
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
                  {r}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

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
            <table className="w-full text-sm">
              <thead className="bg-[#E8F7EC]/70 text-left text-xs uppercase tracking-wide text-[#5c4d72]">
                <tr>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Phone</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">DSA ID</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#d8ecdd]">
                {filtered.map((u) => (
                  <tr key={u.id} className="hover:bg-[#f5fcf7]">
                    <td className="px-4 py-3 font-medium text-[#390A5D]">{u.full_name || "—"}</td>
                    <td className="px-4 py-3 text-[#5c4d72]">{u.email}</td>
                    <td className="px-4 py-3 font-mono text-xs text-[#5c4d72]">{u.phone || "—"}</td>
                    <td className="px-4 py-3">
                      <Badge className={`${ROLE_BADGE[u.role] || ""} capitalize text-[10px]`}>{u.role}</Badge>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-[#10662A]">{u.dsa_id || "—"}</td>
                    <td className="px-4 py-3">
                      <Badge variant={u.is_active ? "default" : "outline"}>
                        {u.is_active ? "active" : "disabled"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-[#10662A]"
                        disabled={busyId === u.id}
                        onClick={() => void onResetPassword(u)}
                      >
                        {busyId === u.id ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <Copy className="size-3.5 mr-1" />
                        )}
                        Reset password
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
