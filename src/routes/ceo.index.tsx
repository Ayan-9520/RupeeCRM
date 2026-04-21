import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Building2, Users, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/ceo/")({
  component: CeoOverview,
  beforeLoad: async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw redirect({ to: "/auth" });
  },
});

type WsRow = { workspace_id: string; name: string; parent_workspace_id: string | null; depth: number };

function CeoOverview() {
  const [rows, setRows] = useState<WsRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setAllowed(false); setLoading(false); return; }
      const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
      const ok = (roles ?? []).some((r) => r.role === "ceo" || r.role === "super_admin" || r.role === "admin");
      setAllowed(ok);
      if (!ok) { setLoading(false); return; }
      const { data } = await supabase.rpc("get_ceo_workspaces", { _user_id: user.id });
      setRows((data as WsRow[]) ?? []);
      setLoading(false);
    })();
  }, []);

  if (loading) return <div className="p-10 text-muted-foreground">Loading…</div>;
  if (allowed === false) {
    return (
      <div className="p-10">
        <h1 className="text-2xl font-display font-semibold">Restricted</h1>
        <p className="text-muted-foreground mt-2">CEO / super-admin access required.</p>
        <Link to="/dashboard" className="text-accent text-sm mt-4 inline-flex items-center gap-1">Back to dashboard <ArrowRight className="size-4"/></Link>
      </div>
    );
  }

  const roots = rows.filter((r) => r.depth === 0);
  const children = (parentId: string) => rows.filter((r) => r.parent_workspace_id === parentId);

  return (
    <div className="min-h-screen bg-background text-foreground py-10 px-5">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <div className="size-10 rounded-xl bg-accent/15 grid place-items-center"><Building2 className="size-5 text-accent"/></div>
          <div>
            <h1 className="text-2xl font-display font-semibold">CEO overview</h1>
            <p className="text-sm text-muted-foreground">All workspaces in your organization, including partner sub-tenants.</p>
          </div>
        </div>

        {roots.length === 0 ? (
          <div className="rounded-2xl border border-border p-8 text-center text-muted-foreground">
            You don't own any top-level workspaces yet.
          </div>
        ) : (
          <div className="space-y-4">
            {roots.map((root) => (
              <div key={root.workspace_id} className="rounded-2xl border border-border p-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Building2 className="size-5 text-accent" />
                    <div>
                      <div className="font-display font-semibold">{root.name}</div>
                      <div className="text-xs text-muted-foreground">Main organization</div>
                    </div>
                  </div>
                  <Link to="/dashboard" className="text-sm text-accent inline-flex items-center gap-1">Open <ArrowRight className="size-4"/></Link>
                </div>
                {children(root.workspace_id).length > 0 && (
                  <div className="mt-4 pl-4 border-l border-border space-y-2">
                    <div className="text-xs uppercase tracking-wide text-muted-foreground flex items-center gap-1.5"><Users className="size-3.5"/> Partner sub-tenants</div>
                    {children(root.workspace_id).map((c) => (
                      <div key={c.workspace_id} className="flex items-center justify-between rounded-lg bg-card border border-border px-3 py-2">
                        <span className="text-sm">{c.name}</span>
                        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">depth {c.depth}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
