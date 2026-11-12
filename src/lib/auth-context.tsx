import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import {
  API_URL,
  clearCrmSession,
  crmLogin,
  rememberCrmUser,
  takeAuthHandoff,
  type CrmUser,
} from "@/lib/python-api";
import { doorAllows, loginTypeLabel, loginTypeMatches, wrongDoorMessage, type LoginDoor } from "@/lib/login-door";

export type AppRole =
  | "ceo"
  | "super_admin"
  | "admin"
  | "dsa"
  | "caller"
  | "coordinator"
  | "lender"
  | "affiliate"
  | "customer";

/** Minimal user shape used across the CRM UI (replaces Supabase User). */
export type AuthUser = {
  id: string;
  email: string;
  full_name?: string;
  finance_level?: string | null;
};

interface AuthContextValue {
  session: { access_token: string } | null;
  user: AuthUser | null;
  role: AppRole | null;
  loading: boolean;
  authMode: "python";
  signIn: (email: string, password: string, door?: "partner" | "employee", loginType?: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshRole: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const TOKEN_KEY = "rd_crm_token";

function clearLegacySupabaseKeys() {
  if (typeof window === "undefined") return;
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k) continue;
    if (k.startsWith("sb-") || k.includes("supabase")) keys.push(k);
  }
  keys.forEach((k) => localStorage.removeItem(k));
}

function toAuthUser(u: CrmUser, id = "python-admin", financeLevel?: string | null): AuthUser {
  return { id, email: u.email, full_name: u.full_name, finance_level: financeLevel ?? null };
}

async function fetchMe(
  token: string,
): Promise<{ id: string; email: string; full_name: string; role: string; finance_level?: string | null; department?: string | null } | null> {
  try {
    const res = await fetch(`${API_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<{ access_token: string } | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);

  const applyCrmUser = useCallback((u: CrmUser, token: string, id?: string, financeLevel?: string | null) => {
    setSession({ access_token: token });
    setUser(toAuthUser(u, id, financeLevel));
    setRole((u.role as AppRole) || "admin");
  }, []);

  useEffect(() => {
    clearLegacySupabaseKeys();

    (async () => {
      takeAuthHandoff();
      const token = localStorage.getItem(TOKEN_KEY);
      if (!token) {
        setLoading(false);
        return;
      }
      const me = await fetchMe(token);
      if (!me) {
        clearCrmSession();
        setSession(null);
        setUser(null);
        setRole(null);
        setLoading(false);
        return;
      }
      const crmUser = { email: me.email, full_name: me.full_name, role: me.role };
      rememberCrmUser(crmUser);
      applyCrmUser(crmUser, token, me.id, me.finance_level);
      setLoading(false);
    })();
  }, [applyCrmUser]);

  const signIn = async (email: string, password: string, door?: LoginDoor, loginType?: string) => {
    clearLegacySupabaseKeys();
    const u = await crmLogin(email.trim().toLowerCase(), password);
    if (door && !doorAllows(door, u.role)) {
      clearCrmSession();
      throw new Error(wrongDoorMessage(door));
    }
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) throw new Error("Login succeeded but no token stored");
    const me = await fetchMe(token);
    if (door && loginType && !loginTypeMatches(door, loginType, u.role, me?.department)) {
      clearCrmSession();
      const label = loginTypeLabel(door, u.role, me?.department);
      throw new Error(label ? `This account signs in as ${label}.` : "This account has no department yet. Ask an admin to set it.");
    }
    applyCrmUser(u, token, me?.id, me?.finance_level);
  };

  const signOut = async () => {
    clearCrmSession();
    clearLegacySupabaseKeys();
    setSession(null);
    setUser(null);
    setRole(null);
  };

  const refreshRole = async () => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return;
    const me = await fetchMe(token);
    if (me) setRole((me.role as AppRole) || "admin");
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        role,
        loading,
        authMode: "python",
        signIn,
        signOut,
        refreshRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
