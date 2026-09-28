import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useWorkspace } from "@/lib/workspace-context";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Building2, Users, Loader2, ShieldCheck, Sparkles, UserCheck, Globe, ArrowRight,
} from "lucide-react";
import { toast } from "sonner";
import { PLAN_LABEL, PLAN_SEATS, isUnlimited, formatSeats } from "@/lib/plans";
import { isPlatformAdmin } from "@/lib/role-access";

export const Route = createFileRoute("/dashboard/workspace")({
  head: () => ({ meta: [{ title: "Workspace — RupeeDial One" }] }),
  component: WorkspaceSettings,
});

function WorkspaceSettings() {
  const { current, members, canManage, loading, refresh, updateWorkspaceName } = useWorkspace();
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const admin = isPlatformAdmin(user?.role ?? null);

  useEffect(() => {
    if (current) setName(current.name);
  }, [current]);

  if (loading) {
    return (
      <div className="grid place-items-center py-24 text-[#5c4d72]">
        <Loader2 className="size-6 animate-spin text-[#10662A]" />
      </div>
    );
  }

  if (!current) {
    return (
      <div className="max-w-lg mx-auto mt-16 text-center space-y-3">
        <Building2 className="size-10 mx-auto text-[#10662A]" />
        <h1 className="font-display text-xl font-bold text-[#390A5D]">No workspace</h1>
        <p className="text-sm text-[#5c4d72]">Sign in again to load RupeeDial One CRM workspace.</p>
        <Link to="/auth" className="text-[#10662A] font-semibold text-sm hover:underline">
          Go to login
        </Link>
      </div>
    );
  }

  const limit = PLAN_SEATS[current.plan];
  const used = members.length;
  const usagePct = !isUnlimited(current.plan) ? Math.min(100, (used / Math.max(limit, 1)) * 100) : 0;

  const saveName = () => {
    if (!canManage) return;
    setBusy(true);
    updateWorkspaceName(name);
    setBusy(false);
    toast.success("Workspace name saved");
  };

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <div className="flex items-center gap-3 mb-1">
          <div className="size-10 rounded-xl bg-[#E8F7EC] grid place-items-center">
            <Building2 className="size-5 text-[#10662A]" />
          </div>
          <h1 className="font-display text-2xl font-bold text-[#390A5D]">Workspace</h1>
        </div>
        <p className="text-[#5c4d72] text-sm">
          Team & plan for <span className="font-medium text-[#390A5D]">{current.name}</span>
        </p>
      </div>

      <section className="rounded-2xl bg-gradient-to-br from-[#E8F7EC] to-white border border-[#d8ecdd] p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-[#10662A]/15 grid place-items-center">
              <Sparkles className="size-5 text-[#10662A]" />
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-[#5c4d72]">Current plan</div>
              <div className="font-display font-bold text-xl text-[#390A5D]">{PLAN_LABEL[current.plan]}</div>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            className="gap-2 border-[#d8ecdd]"
            onClick={() => {
              void refresh();
              toast.success("Team refreshed from CRM users");
            }}
          >
            <Users className="size-4" /> Refresh team
          </Button>
        </div>
        <div className="mt-5 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-[#390A5D]">Team seats</span>
            <span className="text-[#5c4d72]">{formatSeats(used, current.plan)} users</span>
          </div>
          {!isUnlimited(current.plan) && <Progress value={usagePct} />}
        </div>
      </section>

      <div className="grid sm:grid-cols-3 gap-3">
        {admin && (
          <>
            <QuickLink to="/dashboard/admin/partners" icon={UserCheck} label="Partner Applications" desc="Approve DSA logins" />
            <QuickLink to="/dashboard/admin/users" icon={Users} label="Manage Users" desc="CRM roles & passwords" />
            <QuickLink to="/dashboard/website-leads" icon={Globe} label="Website Leads" desc="Forms → CRM pipeline" />
          </>
        )}
        {!admin && (
          <>
            <QuickLink to="/dashboard/billing" icon={Sparkles} label="Billing & seats" desc="Plan and team invite" />
            <QuickLink to="/dashboard/leadboard" icon={Globe} label="Leadboard" desc="Buy marketplace leads" />
            <QuickLink to="/dashboard/profile" icon={UserCheck} label="Public profile" desc="Firm page & QR" />
          </>
        )}
      </div>

      <section className="rounded-2xl bg-white border border-[#d8ecdd] p-6 space-y-4">
        <h2 className="font-semibold text-[#390A5D]">General</h2>
        <div className="space-y-1.5">
          <Label htmlFor="ws-name">Workspace name</Label>
          <div className="flex gap-2">
            <Input
              id="ws-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={!canManage}
              className="border-[#d8ecdd]"
            />
            {canManage && (
              <Button
                onClick={saveName}
                disabled={busy || name === current.name}
                className="bg-[#10662A] hover:bg-[#0d5222]"
              >
                {busy && <Loader2 className="size-4 mr-2 animate-spin" />}
                Save
              </Button>
            )}
          </div>
        </div>
      </section>

      <section className="rounded-2xl bg-white border border-[#d8ecdd] p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-[#390A5D] flex items-center gap-2">
            <Users className="size-4" /> Team members
          </h2>
          <span className="text-xs text-[#5c4d72]">{used} from CRM users</span>
        </div>
        <p className="text-xs text-[#5c4d72]">
          Members sync from approved CRM users. Add partners via Partner Applications → Approve.
        </p>

        <div className="divide-y divide-[#d8ecdd]">
          {members.length === 0 ? (
            <div className="py-8 text-center text-sm text-[#5c4d72]">No members yet.</div>
          ) : (
            members.map((m) => (
              <div key={m.id} className="py-3 flex items-center gap-3">
                <div className="size-9 rounded-full bg-[#E8F7EC] grid place-items-center text-sm font-semibold text-[#10662A]">
                  {(m.full_name ?? "?").charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate flex items-center gap-2 text-[#390A5D]">
                    {m.full_name ?? "Unknown"}
                    {m.user_id === user?.id && <ShieldCheck className="size-3.5 text-[#10662A]" />}
                  </div>
                  <div className="text-xs text-[#5c4d72] truncate">
                    {m.email || m.dsa_id || "—"}
                    {m.joined_at ? ` · ${new Date(m.joined_at).toLocaleDateString()}` : ""}
                  </div>
                </div>
                <span className="text-[10px] uppercase tracking-wide font-bold text-[#10662A] px-2 py-1 rounded bg-[#E8F7EC]">
                  {m.role}
                </span>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

function QuickLink({
  to,
  icon: Icon,
  label,
  desc,
}: {
  to: string;
  icon: typeof Users;
  label: string;
  desc: string;
}) {
  return (
    <Link
      to={to}
      className="rounded-xl border border-[#d8ecdd] bg-white p-4 hover:bg-[#E8F7EC]/60 transition-colors group"
    >
      <div className="flex items-center gap-2 text-[#10662A] font-semibold text-sm">
        <Icon className="size-4" /> {label}
        <ArrowRight className="size-3.5 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
      <p className="text-xs text-[#5c4d72] mt-1">{desc}</p>
    </Link>
  );
}
