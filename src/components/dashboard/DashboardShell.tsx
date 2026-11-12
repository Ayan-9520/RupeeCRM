import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/dashboard/AppSidebar";
import { WorkspaceSwitcher } from "@/components/dashboard/WorkspaceSwitcher";
import { useAuth } from "@/lib/auth-context";
import { useDailyLogin } from "@/hooks/use-daily-login";
import { Loader2, LogOut, UserCircle } from "lucide-react";
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
            <ProfileMenu />
          </header>
          <main className="flex-1 p-4 lg:p-6 overflow-auto">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function ProfileMenu() {
  const { user, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const initial = (user?.full_name || user?.email || "?").trim().charAt(0).toUpperCase();
  const today = new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (!box.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  return (
    <div className="relative" ref={box}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="grid size-9 place-items-center rounded-full bg-[#10662A] text-sm font-bold text-white"
        aria-label="Account menu"
      >
        {initial}
      </button>
      {open ? (
        <div className="absolute right-0 top-11 z-40 w-64 rounded-2xl border border-[#d8ecdd] bg-white p-4 shadow-[0_16px_40px_rgba(16,102,42,0.12)]">
          <div className="flex items-center gap-3">
            <div className="grid size-12 place-items-center rounded-full bg-[#E8F7EC] font-display text-lg font-bold text-[#10662A]">{initial}</div>
            <div className="min-w-0">
              <div className="truncate font-semibold text-[#390A5D]">{user?.full_name || "Account"}</div>
              <div className="text-[11px] text-[#5c4d72]">{today}</div>
            </div>
          </div>
          <Link
            to="/dashboard/profile"
            onClick={() => setOpen(false)}
            className="mt-4 flex h-10 items-center justify-center gap-2 rounded-xl bg-[#10662A] text-sm font-semibold text-white"
          >
            <UserCircle className="size-4" /> My Profile
          </Link>
          <button
            type="button"
            onClick={() => void signOut()}
            className="mt-2 flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-[#d8ecdd] text-sm font-semibold text-[#390A5D]"
          >
            <LogOut className="size-4" /> Sign out
          </button>
        </div>
      ) : null}
    </div>
  );
}
