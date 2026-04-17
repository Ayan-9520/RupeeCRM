import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useWorkspace } from "@/lib/workspace-context";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2, Users, Trash2, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/dashboard/workspace")({
  head: () => ({ meta: [{ title: "Workspace Settings — LeadMines" }] }),
  component: WorkspaceSettings,
});

interface MemberRow {
  id: string;
  user_id: string;
  role: string;
  joined_at: string;
  full_name: string | null;
}

function WorkspaceSettings() {
  const { current, canManage, refresh } = useWorkspace();
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("employee");
  const [busy, setBusy] = useState(false);
  const [loadingMembers, setLoadingMembers] = useState(true);

  useEffect(() => {
    if (current) setName(current.name);
  }, [current]);

  const loadMembers = async () => {
    if (!current) return;
    setLoadingMembers(true);
    const { data } = await supabase
      .from("workspace_members")
      .select("id, user_id, role, joined_at")
      .eq("workspace_id", current.id);
    if (!data) { setMembers([]); setLoadingMembers(false); return; }
    const ids = data.map((m) => m.user_id);
    const { data: profs } = await supabase.from("profiles").select("id, full_name").in("id", ids);
    const profMap = new Map((profs ?? []).map((p: any) => [p.id, p.full_name]));
    setMembers(data.map((m) => ({ ...m, full_name: profMap.get(m.user_id) ?? null })));
    setLoadingMembers(false);
  };

  useEffect(() => { loadMembers(); }, [current?.id]);

  const saveName = async () => {
    if (!current || !canManage) return;
    setBusy(true);
    const { error } = await supabase.from("workspaces").update({ name }).eq("id", current.id);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Workspace updated");
    refresh();
  };

  const invite = async () => {
    if (!current || !canManage || !inviteEmail.trim()) return;
    setBusy(true);
    const { data: profs } = await supabase.from("profiles").select("id, full_name").ilike("full_name", `%${inviteEmail.trim()}%`).limit(1);
    if (!profs || profs.length === 0) {
      toast.error("User not found. They must sign up first.");
      setBusy(false);
      return;
    }
    if (members.length >= current.seat_limit) {
      toast.error(`Seat limit reached (${current.seat_limit}). Upgrade your plan.`);
      setBusy(false);
      return;
    }
    const { error } = await supabase.from("workspace_members").insert({
      workspace_id: current.id,
      user_id: profs[0].id,
      role: inviteRole as any,
      invited_by: user?.id,
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Member added");
    setInviteEmail("");
    loadMembers();
  };

  const updateRole = async (memberId: string, role: string) => {
    const { error } = await supabase.from("workspace_members").update({ role: role as any }).eq("id", memberId);
    if (error) { toast.error(error.message); return; }
    toast.success("Role updated");
    loadMembers();
  };

  const removeMember = async (memberId: string) => {
    const { error } = await supabase.from("workspace_members").delete().eq("id", memberId);
    if (error) { toast.error(error.message); return; }
    toast.success("Member removed");
    loadMembers();
  };

  if (!current) {
    return <div className="text-muted-foreground">No workspace selected.</div>;
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <div className="flex items-center gap-3 mb-1">
          <div className="size-10 rounded-xl bg-accent/15 grid place-items-center"><Building2 className="size-5 text-accent" /></div>
          <h1 className="font-display text-2xl font-bold">Workspace Settings</h1>
        </div>
        <p className="text-muted-foreground text-sm">Manage <span className="font-medium text-foreground">{current.name}</span> · Plan: <span className="uppercase text-xs font-semibold">{current.plan}</span> · {members.length}/{current.seat_limit} seats</p>
      </div>

      <section className="rounded-2xl bg-card border border-border p-6 space-y-4">
        <h2 className="font-semibold">General</h2>
        <div className="space-y-1.5">
          <Label htmlFor="ws-name">Workspace name</Label>
          <div className="flex gap-2">
            <Input id="ws-name" value={name} onChange={(e) => setName(e.target.value)} disabled={!canManage} />
            {canManage && (
              <Button onClick={saveName} disabled={busy || name === current.name}>
                {busy && <Loader2 className="size-4 mr-2 animate-spin" />}Save
              </Button>
            )}
          </div>
        </div>
      </section>

      <section className="rounded-2xl bg-card border border-border p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold flex items-center gap-2"><Users className="size-4" /> Members</h2>
          <span className="text-xs text-muted-foreground">{members.length} of {current.seat_limit} seats used</span>
        </div>

        {canManage && (
          <div className="flex gap-2 p-3 rounded-lg bg-secondary/50 border border-border">
            <Input
              placeholder="Search by name (user must already have an account)"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              className="flex-1"
            />
            <Select value={inviteRole} onValueChange={setInviteRole}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="manager">Manager</SelectItem>
                <SelectItem value="employee">Employee</SelectItem>
                <SelectItem value="viewer">Viewer</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={invite} disabled={busy || !inviteEmail.trim()}>Add</Button>
          </div>
        )}

        <div className="divide-y divide-border">
          {loadingMembers ? (
            <div className="py-8 grid place-items-center"><Loader2 className="size-5 animate-spin text-accent" /></div>
          ) : members.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">No members yet.</div>
          ) : members.map((m) => (
            <div key={m.id} className="py-3 flex items-center gap-3">
              <div className="size-9 rounded-full bg-accent/15 grid place-items-center text-sm font-semibold text-accent">
                {(m.full_name ?? "?").charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm truncate flex items-center gap-2">
                  {m.full_name ?? "Unknown user"}
                  {m.user_id === current.owner_id && <ShieldCheck className="size-3.5 text-accent" />}
                </div>
                <div className="text-xs text-muted-foreground">Joined {new Date(m.joined_at).toLocaleDateString()}</div>
              </div>
              {canManage && m.user_id !== current.owner_id ? (
                <>
                  <Select value={m.role} onValueChange={(v) => updateRole(m.id, v)}>
                    <SelectTrigger className="w-32 h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="manager">Manager</SelectItem>
                      <SelectItem value="employee">Employee</SelectItem>
                      <SelectItem value="viewer">Viewer</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button variant="ghost" size="icon" onClick={() => removeMember(m.id)}>
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </>
              ) : (
                <span className="text-xs uppercase tracking-wide font-semibold text-accent px-2 py-1 rounded bg-accent/10">{m.role}</span>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
