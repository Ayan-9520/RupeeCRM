import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader, SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { Link, useLocation } from "@tanstack/react-router";
import {
  LayoutDashboard, Store, Wallet, Users, Phone, FileText, Building2,
  Settings, LogOut, BarChart3, GraduationCap, Megaphone,
  UserCog, KanbanSquare, Building, BriefcaseBusiness, CreditCard, Banknote, ListPlus,
  Palette, Image as ImageIcon, Award, UserCheck, Trophy, Gift, Percent, Cog, Globe,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { getNavForRole, type NavItem } from "@/lib/role-access";

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  "/ceo": Building,
  "/dashboard": LayoutDashboard,
  "/dashboard/workspace": Building,
  "/dashboard/billing": CreditCard,
  "/dashboard/hrms": BriefcaseBusiness,
  "/dashboard/leadboard": Store,
  "/dashboard/my-leads": KanbanSquare,
  "/dashboard/los-analytics": BarChart3,
  "/dashboard/los-executive": BarChart3,
  "/dashboard/automation": Cog,
  "/dashboard/wallet": Wallet,
  "/dashboard/calls": Phone,
  "/dashboard/submissions": FileText,
  "/dashboard/cases": Building2,
  "/dashboard/earnings": BarChart3,
  "/dashboard/commissions": Percent,
  "/dashboard/marketing": Megaphone,
  "/dashboard/community": Megaphone,
  "/dashboard/learn": GraduationCap,
  "/dashboard/certificates": Award,
  "/dashboard/training": GraduationCap,
  "/dashboard/leaderboard": Trophy,
  "/dashboard/rewards": Gift,
  "/dashboard/admin/users": Users,
  "/dashboard/admin/leads": ListPlus,
  "/dashboard/website-leads": Globe,
  "/dashboard/admin/pricing": UserCog,
  "/dashboard/admin/commissions": Percent,
  "/dashboard/admin/payouts": Banknote,
  "/dashboard/admin/billing": CreditCard,
  "/dashboard/admin/partners": UserCheck,
  "/dashboard/admin/marketing": Palette,
  "/dashboard/admin/marketing-media": ImageIcon,
};

function navIcon(item: NavItem) {
  return ICONS[item.url] ?? LayoutDashboard;
}

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const { role, signOut, user } = useAuth();

  const items = getNavForRole(role);
  const mainItems = items.filter((i) => i.group !== "admin");
  const adminItems = items.filter((i) => i.group === "admin");

  const isActive = (path: string) =>
    path === "/dashboard" ? location.pathname === path : location.pathname.startsWith(path);

  const renderItems = (list: NavItem[]) =>
    list.map((item) => {
      const Icon = navIcon(item);
      const active = isActive(item.url);
      return (
        <SidebarMenuItem key={item.url}>
          <SidebarMenuButton asChild isActive={active}>
            <Link to={item.url}>
              <Icon className="size-4" />
              {!collapsed && <span>{item.title}</span>}
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
      );
    });

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <Link to="/dashboard" className="flex items-center gap-2.5 px-2 py-1.5">
          <div className="size-8 rounded-full bg-[#10662A] grid place-items-center shrink-0 text-white font-display font-bold text-sm">
            R
          </div>
          {!collapsed && (
            <div className="leading-tight">
              <div className="font-display font-bold text-[#390A5D] text-sm">RupeeDial One</div>
              <div className="text-[9px] uppercase tracking-[0.16em] text-[#10662A] font-semibold -mt-0.5">
                CRM workspace
              </div>
            </div>
          )}
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Workspace</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>{renderItems(mainItems)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {adminItems.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>Administration</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>{renderItems(adminItems)}</SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
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
          <div className="px-2 py-2 text-xs text-[#5c4d72] truncate">
            {user.email}
            {role && (
              <button
                type="button"
                className="mt-0.5 inline-block px-1.5 py-0.5 rounded-full bg-[#E8F7EC] border border-[#d8ecdd] text-[10px] uppercase tracking-wide font-bold text-[#10662A] cursor-pointer hover:bg-[#d8ecdd] transition-colors"
              >
                {role}
              </button>
            )}
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
