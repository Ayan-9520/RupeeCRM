import { useState } from "react";
import { Check, ChevronsUpDown, Plus, Building2, Loader2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useWorkspace } from "@/lib/workspace-context";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { PLAN_LABEL, formatSeats } from "@/lib/plans";

export function WorkspaceSwitcher() {
  const { workspaces, current, switchWorkspace, refresh, loading } = useWorkspace();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const handleCreate = async () => {
    if (!user || !name.trim()) return;
    setBusy(true);
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-") + "-" + Math.random().toString(36).slice(2, 8);
    const { data, error } = await supabase
      .from("workspaces")
      .insert({ name: name.trim(), slug, owner_id: user.id, plan: "starter", seat_limit: 1 })
      .select()
      .single();
    if (error) { toast.error(error.message); setBusy(false); return; }
    await supabase.from("workspace_members").insert({ workspace_id: data.id, user_id: user.id, role: "owner" });
    toast.success("Workspace created");
    setName("");
    setCreateOpen(false);
    await refresh();
    switchWorkspace(data.id);
    setBusy(false);
  };

  if (loading) {
    return <div className="h-9 w-56 rounded-md bg-muted animate-pulse" />;
  }

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" role="combobox" className="w-56 justify-between gap-2 h-9">
            <Building2 className="size-4 shrink-0 text-accent" />
            <span className="truncate flex-1 text-left text-sm">{current?.name ?? "Select workspace"}</span>
            <ChevronsUpDown className="size-3.5 opacity-50 shrink-0" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-1" align="start">
          <div className="px-2 py-1.5 text-xs uppercase tracking-wide text-muted-foreground">Your workspaces</div>
          <div className="max-h-72 overflow-auto">
            {workspaces.map((w) => (
              <button
                key={w.id}
                onClick={() => { switchWorkspace(w.id); setOpen(false); }}
                className={cn(
                  "w-full flex items-center gap-2 px-2 py-2 rounded-md text-sm hover:bg-accent/10 text-left",
                  current?.id === w.id && "bg-accent/15"
                )}
              >
                <Building2 className="size-4 text-accent shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="truncate font-medium">{w.name}</div>
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{w.role} · {PLAN_LABEL[w.plan]}</div>
                </div>
                {current?.id === w.id && <Check className="size-4 text-accent" />}
              </button>
            ))}
          </div>
          <div className="border-t mt-1 pt-1">
            <button
              onClick={() => { setOpen(false); setCreateOpen(true); }}
              className="w-full flex items-center gap-2 px-2 py-2 rounded-md text-sm hover:bg-accent/10"
            >
              <Plus className="size-4" /> Create workspace
            </button>
          </div>
        </PopoverContent>
      </Popover>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create workspace</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="ws-name">Workspace name</Label>
              <Input id="ws-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme Lending Co." autoFocus />
            </div>
            <p className="text-xs text-muted-foreground">You'll be the owner. Invite team members from workspace settings after creating.</p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCreateOpen(false)} disabled={busy}>Cancel</Button>
            <Button onClick={handleCreate} disabled={busy || !name.trim()}>
              {busy && <Loader2 className="size-4 mr-2 animate-spin" />}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
