import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader, SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { Link, useLocation } from "@tanstack/react-router";
import {
  LayoutDashboard, Store, Wallet, Users, Phone, FileText, Building2,
  Settings, LogOut, Sparkles, BarChart3, GraduationCap, Megaphone,
  UserCog, KanbanSquare, Building, BriefcaseBusiness, CreditCard, Banknote,
} from "lucide-react";
import { useAuth, type AppRole } from "@/lib/auth-context";

type NavItem = {
  title: string;
  url: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: AppRole[];
};

const NAV: NavItem[] = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard, roles: ["admin", "dsa", "caller", "coordinator", "lender", "affiliate", "customer"] },
  { title: "Workspace", url: "/dashboard/workspace", icon: Building, roles: ["admin", "dsa", "caller", "coordinator", "lender", "affiliate", "customer"] },
  { title: "Billing", url: "/dashboard/billing", icon: CreditCard, roles: ["admin", "dsa", "lender", "coordinator", "affiliate"] },
  { title: "HRMS & Payroll", url: "/dashboard/hrms", icon: BriefcaseBusiness, roles: ["admin", "dsa", "lender", "coordinator"] },
  { title: "Leadboard", url: "/dashboard/leadboard", icon: Store, roles: ["admin", "dsa"] },
  { title: "My Leads", url: "/dashboard/my-leads", icon: KanbanSquare, roles: ["dsa", "admin"] },
  { title: "Wallet", url: "/dashboard/wallet", icon: Wallet, roles: ["admin", "dsa", "affiliate"] },
  { title: "Call Queue", url: "/dashboard/calls", icon: Phone, roles: ["caller", "admin"] },
  { title: "Submissions", url: "/dashboard/submissions", icon: FileText, roles: ["coordinator", "admin"] },
  { title: "Cases", url: "/dashboard/cases", icon: Building2, roles: ["lender", "admin"] },
  { title: "Earnings", url: "/dashboard/earnings", icon: BarChart3, roles: ["dsa", "affiliate", "admin"] },
  { title: "Community", url: "/dashboard/community", icon: Megaphone, roles: ["admin", "dsa", "caller", "coordinator", "lender", "affiliate"] },
  { title: "Training", url: "/dashboard/training", icon: GraduationCap, roles: ["admin", "dsa", "caller", "coordinator", "affiliate"] },
  { title: "Users", url: "/dashboard/admin/users", icon: Users, roles: ["admin"] },
  { title: "Lead Pricing", url: "/dashboard/admin/pricing", icon: UserCog, roles: ["admin"] },
  { title: "Payouts", url: "/dashboard/admin/payouts", icon: Banknote, roles: ["admin"] },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const { role, signOut, user } = useAuth();

  const items = NAV.filter((i) => !role || i.roles.includes(role));
  const isActive = (path: string) =>
    path === "/dashboard" ? location.pathname === path : location.pathname.startsWith(path);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <Link to="/dashboard" className="flex items-center gap-2.5 px-2 py-1.5">
          <div className="size-8 rounded-lg bg-mint-gradient grid place-items-center shadow-mint shrink-0">
            <Sparkles className="size-4 text-primary" strokeWidth={2.5} />
          </div>
          {!collapsed && (
            <div className="leading-tight">
              <div className="font-display font-bold text-sidebar-foreground text-sm">LeadMines</div>
              <div className="text-[9px] uppercase tracking-[0.16em] text-sidebar-foreground/60 -mt-0.5">by MoneyMines</div>
            </div>
          )}
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Workspace</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => {
                const active = isActive(item.url);
                return (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton asChild isActive={active}>
                      <Link
                        to={item.url}
                        className={active ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium" : ""}
                      >
                        <item.icon className="size-4" />
                        {!collapsed && <span>{item.title}</span>}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <Link to="/dashboard/settings">
                <Settings className="size-4" />
                {!collapsed && <span>Settings</span>}
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={() => signOut()}>
              <LogOut className="size-4" />
              {!collapsed && <span>Sign out</span>}
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        {!collapsed && user && (
          <div className="px-2 py-2 text-xs text-sidebar-foreground/60 truncate">
            {user.email}
            {role && <div className="mt-0.5 inline-block px-1.5 py-0.5 rounded bg-accent/20 text-[10px] uppercase tracking-wide font-semibold text-accent">{role}</div>}
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
