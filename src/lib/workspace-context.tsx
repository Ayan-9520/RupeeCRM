import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import { useAuth } from "@/lib/auth-context";
import { listCrmUsers } from "@/lib/python-api";

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
  hrms_enabled: boolean;
  hrms_price_per_employee: number;
  role: WorkspaceRole;
}

export interface WorkspaceMember {
  id: string;
  user_id: string;
  role: string;
  joined_at: string;
  full_name: string | null;
  email?: string | null;
  phone?: string | null;
  dsa_id?: string | null;
}

interface WorkspaceContextValue {
  workspaces: Workspace[];
  current: Workspace | null;
  members: WorkspaceMember[];
  loading: boolean;
  switchWorkspace: (id: string) => void;
  refresh: () => Promise<void>;
  updateWorkspaceName: (name: string) => void;
  canManage: boolean;
}

const Ctx = createContext<WorkspaceContextValue | undefined>(undefined);
const STORAGE_KEY = "leadmines.current_workspace";
const NAME_KEY = "rd_crm_workspace_name";
const DEFAULT_ID = "rd-crm-main";

function buildDefaultWorkspace(userId: string, name: string, role: string): Workspace {
  const isAdmin = role === "admin" || role === "ceo" || role === "super_admin";
  return {
    id: DEFAULT_ID,
    name,
    slug: "rupeedial-one",
    owner_id: userId,
    plan: "enterprise",
    seat_limit: 9999,
    logo_url: null,
    hrms_enabled: true,
    hrms_price_per_employee: 0,
    role: isAdmin ? "owner" : "employee",
  };
}

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { user, role } = useAuth();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [current, setCurrent] = useState<Workspace | null>(null);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) {
      setWorkspaces([]);
      setCurrent(null);
      setMembers([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const storedName =
      (typeof window !== "undefined" && localStorage.getItem(NAME_KEY)) || "RupeeDial One CRM";
    const ws = buildDefaultWorkspace(user.id, storedName, role || "admin");
    setWorkspaces([ws]);
    setCurrent(ws);
    if (typeof window !== "undefined") localStorage.setItem(STORAGE_KEY, ws.id);

    const isAdmin = role === "admin" || role === "ceo" || role === "super_admin";
    if (isAdmin) {
      try {
        const data = await listCrmUsers();
        setMembers(
          data.items.map((u) => ({
            id: u.id,
            user_id: u.id,
            role: u.role,
            joined_at: u.created_at || new Date().toISOString(),
            full_name: u.full_name,
            email: u.email,
            phone: u.phone,
            dsa_id: u.dsa_id,
          })),
        );
      } catch {
        setMembers([
          {
            id: user.id,
            user_id: user.id,
            role: role || "admin",
            joined_at: new Date().toISOString(),
            full_name: user.full_name || user.email,
            email: user.email,
          },
        ]);
      }
    } else {
      setMembers([
        {
          id: user.id,
          user_id: user.id,
          role: role || "dsa",
          joined_at: new Date().toISOString(),
          full_name: user.full_name || user.email,
          email: user.email,
        },
      ]);
    }
    setLoading(false);
  }, [user, role]);

  useEffect(() => {
    void load();
  }, [load]);

  const switchWorkspace = (id: string) => {
    const w = workspaces.find((x) => x.id === id);
    if (w) {
      setCurrent(w);
      if (typeof window !== "undefined") localStorage.setItem(STORAGE_KEY, id);
    }
  };

  const updateWorkspaceName = (name: string) => {
    const trimmed = name.trim() || "RupeeDial One CRM";
    if (typeof window !== "undefined") localStorage.setItem(NAME_KEY, trimmed);
    setCurrent((prev) => (prev ? { ...prev, name: trimmed } : prev));
    setWorkspaces((prev) => prev.map((w) => (w.id === DEFAULT_ID ? { ...w, name: trimmed } : w)));
  };

  const canManage = current?.role === "owner" || current?.role === "admin";

  return (
    <Ctx.Provider
      value={{
        workspaces,
        current,
        members,
        loading,
        switchWorkspace,
        refresh: load,
        updateWorkspaceName,
        canManage,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useWorkspace() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useWorkspace must be used within WorkspaceProvider");
  return ctx;
}
