import { useNavigate } from "@tanstack/react-router";
import { useEffect, type CSSProperties, type ReactNode } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/dashboard/AppSidebar";
import { WorkspaceSwitcher } from "@/components/dashboard/WorkspaceSwitcher";
import { useAuth } from "@/lib/auth-context";
import { useDailyLogin } from "@/hooks/use-daily-login";
import { Loader2 } from "lucide-react";
import { NotificationCenter } from "@/components/dashboard/NotificationCenter";

export function DashboardShell({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  useDailyLogin();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [user, loading, navigate]);

  if (loading || !user) {
    return (
      <div className="min-h-screen grid place-items-center bg-[#f5fcf7]">
        <Loader2 className="size-6 animate-spin text-[#10662A]" />
      </div>
    );
  }

  return (
    <SidebarProvider style={{ "--sidebar-width": "19.5rem", "--sidebar-width-icon": "4.75rem" } as CSSProperties}>
      <div className="min-h-screen flex w-full bg-[#f5fcf7]">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center gap-3 border-b border-[#d8ecdd] bg-white px-4 sticky top-0 z-30 shadow-[0_1px_0_rgba(16,102,42,0.04)]">
            <SidebarTrigger className="text-[#10662A]" />
            <WorkspaceSwitcher />
            <NotificationCenter />
            <div className="flex-1" />
          </header>
          <main className="flex-1 p-4 lg:p-6 overflow-auto">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}
