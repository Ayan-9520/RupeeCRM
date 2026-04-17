import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

export type WorkspaceRole = "owner" | "admin" | "manager" | "employee" | "viewer";
export type WorkspacePlan = "starter" | "growth" | "pro" | "enterprise";

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  owner_id: string;
  plan: WorkspacePlan;
  seat_limit: number;
  logo_url: string | null;
  role: WorkspaceRole;
}

interface WorkspaceContextValue {
  workspaces: Workspace[];
  current: Workspace | null;
  loading: boolean;
  switchWorkspace: (id: string) => void;
  refresh: () => Promise<void>;
  canManage: boolean;
}

const Ctx = createContext<WorkspaceContextValue | undefined>(undefined);
const STORAGE_KEY = "leadmines.current_workspace";

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [current, setCurrent] = useState<Workspace | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) {
      setWorkspaces([]);
      setCurrent(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data: members } = await supabase
      .from("workspace_members")
      .select("role, workspace:workspaces(id, name, slug, owner_id, plan, seat_limit, logo_url)")
      .eq("user_id", user.id);

    const list: Workspace[] = (members ?? [])
      .filter((m: any) => m.workspace)
      .map((m: any) => ({ ...m.workspace, role: m.role as WorkspaceRole }));

    setWorkspaces(list);
    const stored = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    const found = list.find((w) => w.id === stored) ?? list[0] ?? null;
    setCurrent(found);
    if (found && typeof window !== "undefined") localStorage.setItem(STORAGE_KEY, found.id);
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const switchWorkspace = (id: string) => {
    const w = workspaces.find((x) => x.id === id);
    if (w) {
      setCurrent(w);
      if (typeof window !== "undefined") localStorage.setItem(STORAGE_KEY, id);
    }
  };

  const canManage = current?.role === "owner" || current?.role === "admin";

  return (
    <Ctx.Provider value={{ workspaces, current, loading, switchWorkspace, refresh: load, canManage }}>
      {children}
    </Ctx.Provider>
  );
}

export function useWorkspace() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useWorkspace must be used within WorkspaceProvider");
  return ctx;
}
