import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, type AppRole } from "@/lib/auth-context";
import { isPlatformAdmin } from "@/lib/role-access";
import { toast } from "sonner";
import { Users, Loader2, Search, ShieldCheck, ShieldOff, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/dashboard/admin/users")({
  head: () => ({ meta: [{ title: "Manage Users — LeadMines Admin" }] }),
  component: AdminUsersPage,
});

const ROLES: AppRole[] = ["ceo", "super_admin", "admin", "dsa", "caller", "coordinator", "lender", "affiliate", "customer"];

const ROLE_BADGE: Record<AppRole, string> = {
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

interface ProfileRow {
  id: string;
  full_name: string | null;
  phone: string | null;
  city: string | null;
  company_name: string | null;
  dsa_id: string | null;
  dsa_tier: string;
  kyc_status: string;
  kyc_approved_at: string | null;
  reputation_score: number;
  total_leads_purchased: number;
  total_conversions: number;
  created_at: string;
  roles: AppRole[];
}

function AdminUsersPage() {
  const { role } = useAuth();
  const [users, setUsers] = useState<ProfileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<AppRole | "all">("all");
  const [active, setActive] = useState<ProfileRow | null>(null);

  const refresh = async () => {
    setLoading(true);
    // Fetch profiles + their roles
    const [{ data: profs, error: pErr }, { data: roles }] = await Promise.all([
      supabase.from("profiles").select("*").order("created_at", { ascending: false }).limit(500),
      supabase.from("user_roles").select("user_id, role"),
    ]);
    if (pErr) { toast.error(pErr.message); setLoading(false); return; }
    const roleMap = new Map<string, AppRole[]>();
    (roles || []).forEach((r: any) => {
      const arr = roleMap.get(r.user_id) || [];
      arr.push(r.role);
      roleMap.set(r.user_id, arr);
    });
    const merged: ProfileRow[] = (profs || []).map((p: any) => ({
      ...p,
      roles: roleMap.get(p.id) || [],
    }));
    setUsers(merged);
    setLoading(false);
  };

  useEffect(() => { refresh(); }, []);

  const filtered = useMemo(() => {
    return users.filter((u) => {
      if (roleFilter !== "all" && !u.roles.includes(roleFilter)) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          u.full_name?.toLowerCase().includes(q) ||
          u.phone?.includes(q) ||
          u.dsa_id?.toLowerCase().includes(q) ||
          u.id.includes(q)
        );
      }
      return true;
    });
  }, [users, search, roleFilter]);

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
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-2xl font-bold flex items-center gap-2">
            <Users className="size-6 text-accent" /> Manage Users
          </h1>
          <p className="text-muted-foreground text-sm mt-1">{users.length} total users · approve KYC, assign roles</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search name, phone, DSA ID…" value={search} onChange={(e) => setSearch(e.target.value)} className="w-64 pl-9" />
          </div>
          <Select value={roleFilter} onValueChange={(v) => setRoleFilter(v as any)}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All roles</SelectItem>
              {ROLES.map((r) => <SelectItem key={r} value={r} className="capitalize">{r}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        {loading ? (
          <div className="p-12 text-center"><Loader2 className="size-6 animate-spin mx-auto text-muted-foreground" /></div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            <Users className="size-10 mx-auto mb-3 opacity-40" />
            <p>No users match your filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Phone</th>
                  <th className="px-4 py-3">City</th>
                  <th className="px-4 py-3">DSA ID</th>
                  <th className="px-4 py-3">Roles</th>
                  <th className="px-4 py-3">KYC</th>
                  <th className="px-4 py-3">Tier</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((u) => (
                  <tr key={u.id} className="hover:bg-muted/30 cursor-pointer" onClick={() => setActive(u)}>
                    <td className="px-4 py-3 font-medium">{u.full_name || "—"}</td>
                    <td className="px-4 py-3 font-mono text-xs">{u.phone || "—"}</td>
                    <td className="px-4 py-3">{u.city || "—"}</td>
                    <td className="px-4 py-3 font-mono text-xs">{u.dsa_id || "—"}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1 flex-wrap">
                        {u.roles.map((r) => <Badge key={r} className={`${ROLE_BADGE[r]} capitalize text-[10px]`}>{r}</Badge>)}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={u.kyc_status === "approved" ? "default" : "outline"} className="capitalize">{u.kyc_status}</Badge>
                    </td>
                    <td className="px-4 py-3 capitalize text-xs">{u.dsa_tier}</td>
                    <td className="px-4 py-3 text-right"><Button size="sm" variant="ghost">Manage</Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {active && <UserDetail user={active} onClose={() => { setActive(null); refresh(); }} />}
    </div>
  );
}

function UserDetail({ user, onClose }: { user: ProfileRow; onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  const [newRole, setNewRole] = useState<AppRole>("dsa");

  const addRole = async () => {
    if (user.roles.includes(newRole)) { toast.info("User already has this role"); return; }
    setBusy(true);
    const { error } = await supabase.from("user_roles").insert({ user_id: user.id, role: newRole });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`Granted ${newRole} role`);
    onClose();
  };

  const removeRole = async (r: AppRole) => {
    if (user.roles.length <= 1) { toast.error("User must have at least one role"); return; }
    setBusy(true);
    const { error } = await supabase.from("user_roles").delete().eq("user_id", user.id).eq("role", r);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`Removed ${r} role`);
    onClose();
  };

  const approveKyc = async () => {
    setBusy(true);
    const { error } = await supabase.from("profiles").update({
      kyc_status: "approved",
      kyc_approved_at: new Date().toISOString(),
    }).eq("id", user.id);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("KYC approved");
    onClose();
  };

  const rejectKyc = async () => {
    setBusy(true);
    const { error } = await supabase.from("profiles").update({ kyc_status: "rejected" }).eq("id", user.id);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("KYC marked rejected");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 grid place-items-center p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-background rounded-3xl border border-border max-w-xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-background border-b border-border p-5 flex items-start justify-between">
          <div>
            <h2 className="font-display text-xl font-bold">{user.full_name || "Unnamed user"}</h2>
            <div className="text-xs text-muted-foreground font-mono mt-1">{user.id}</div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-muted rounded-lg"><X className="size-5" /></button>
        </div>

        <div className="p-5 space-y-5">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <Field label="Phone" value={user.phone || "—"} />
            <Field label="City" value={user.city || "—"} />
            <Field label="Company" value={user.company_name || "—"} />
            <Field label="DSA ID" value={user.dsa_id || "—"} />
            <Field label="Tier" value={user.dsa_tier} cap />
            <Field label="Reputation" value={String(user.reputation_score)} />
            <Field label="Leads Purchased" value={String(user.total_leads_purchased)} />
            <Field label="Conversions" value={String(user.total_conversions)} />
          </div>

          {/* KYC */}
          <div className="rounded-2xl bg-muted/50 p-4">
            <h3 className="font-semibold text-sm mb-2">KYC Status</h3>
            <div className="flex items-center gap-3">
              <Badge variant={user.kyc_status === "approved" ? "default" : "outline"} className="capitalize">{user.kyc_status}</Badge>
              {user.kyc_status !== "approved" && (
                <Button size="sm" onClick={approveKyc} disabled={busy}>
                  <ShieldCheck className="size-4 mr-1" /> Approve
                </Button>
              )}
              {user.kyc_status !== "rejected" && (
                <Button size="sm" variant="outline" onClick={rejectKyc} disabled={busy}>
                  Reject
                </Button>
              )}
            </div>
          </div>

          {/* Roles */}
          <div className="rounded-2xl bg-muted/50 p-4 space-y-3">
            <h3 className="font-semibold text-sm">Roles</h3>
            <div className="flex flex-wrap gap-2">
              {user.roles.map((r) => (
                <button key={r} onClick={() => removeRole(r)} disabled={busy} className="group">
                  <Badge className={`${ROLE_BADGE[r]} capitalize cursor-pointer group-hover:opacity-70`}>
                    {r} <X className="size-3 ml-1" />
                  </Badge>
                </button>
              ))}
              {user.roles.length === 0 && <span className="text-xs text-muted-foreground">No roles assigned</span>}
            </div>
            <div className="flex items-center gap-2 pt-2 border-t border-border">
              <Select value={newRole} onValueChange={(v) => setNewRole(v as AppRole)}>
                <SelectTrigger className="w-40 h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROLES.filter((r) => !user.roles.includes(r)).map((r) => <SelectItem key={r} value={r} className="capitalize">{r}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button size="sm" onClick={addRole} disabled={busy}>
                <Plus className="size-4 mr-1" /> Grant
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">Click a role badge to remove it. Each user must have at least one role.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, cap }: { label: string; value: string; cap?: boolean }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`font-medium ${cap ? "capitalize" : ""}`}>{value}</div>
    </div>
  );
}
