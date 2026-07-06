import type { ReactNode } from "react";
import { Link, useLocation } from "@tanstack/react-router";
import { ShieldAlert, ArrowLeft, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { canAccessPath, getRoleLabel } from "@/lib/role-access";
import { Button } from "@/components/ui/button";

export function RoleGuard({ children }: { children: ReactNode }) {
  const { role, loading } = useAuth();
  const { pathname } = useLocation();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <Loader2 className="size-6 animate-spin text-[var(--wa-green)]" />
      </div>
    );
  }

  if (!role || !canAccessPath(role, pathname)) {
    return (
      <div className="max-w-md mx-auto mt-16 rounded-2xl border border-border bg-card p-8 text-center shadow-card">
        <ShieldAlert className="size-10 text-amber-500 mx-auto mb-3" />
        <h2 className="font-display text-xl font-bold">Access restricted</h2>
        <p className="text-sm text-muted-foreground mt-2">
          {role
            ? `Your role (${getRoleLabel(role)}) doesn't have permission to view this page.`
            : "We couldn't verify your role. Try signing in again."}
        </p>
        <Button asChild className="mt-6 bg-[var(--wa-green)] hover:bg-[var(--wa-green-dark)] text-white">
          <Link to="/dashboard">
            <ArrowLeft className="size-4 mr-2" />
            Back to dashboard
          </Link>
        </Button>
      </div>
    );
  }

  return <>{children}</>;
}
