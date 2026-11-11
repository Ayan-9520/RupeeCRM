import { useEffect, useMemo, useState } from "react";
import { useSidebar } from "@/components/ui/sidebar";
import { Sidebar } from "@/components/ui/sidebar";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard, Store, Wallet, Users, Phone, FileText, Building2,
  Settings, LogOut, BarChart3, GraduationCap, Megaphone,
  UserCog, KanbanSquare, Building, BriefcaseBusiness, CreditCard, Banknote, ListPlus,
  Palette, Image as ImageIcon, Award, UserCheck, Trophy, Percent, Cog, Globe, Network, Database, SlidersHorizontal,
  Home, Target, FolderKanban, IndianRupee, Rocket, ShieldCheck, UserCircle, MessagesSquare, ScrollText, Receipt,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { getNavForRole, getRoleLabel, type NavItem } from "@/lib/role-access";

type IconType = React.ComponentType<{ className?: string }>;

const ICONS: Record<string, IconType> = {
  "/ceo": Building,
  "/dashboard": LayoutDashboard,
  "/dashboard/workspace": Building,
  "/dashboard/billing": CreditCard,
  "/dashboard/profile": UserCircle,
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
  "/dashboard/earnings": Receipt,
  "/dashboard/invoice-approvals": FileText,
  "/dashboard/commissions": Percent,
  "/dashboard/marketing": Megaphone,
  "/dashboard/community": MessagesSquare,
  "/dashboard/learn": GraduationCap,
  "/dashboard/certificates": Award,
  "/dashboard/training": GraduationCap,
  "/dashboard/leaderboard": Trophy,
  "/dashboard/admin/users": Users,
  "/dashboard/admin/leads": ListPlus,
  "/dashboard/website-leads": Globe,
  "/dashboard/business": BriefcaseBusiness,
  "/dashboard/admin/pricing": UserCog,
  "/dashboard/admin/commissions": Percent,
  "/dashboard/admin/payout-grids": SlidersHorizontal,
  "/dashboard/admin/payouts": Banknote,
  "/dashboard/admin/trust": ScrollText,
  "/dashboard/admin/billing": CreditCard,
  "/dashboard/admin/partners": UserCheck,
  "/dashboard/admin/marketing": Palette,
  "/dashboard/admin/marketing-media": ImageIcon,
  "/dashboard/network": Network,
  "/dashboard/admin/network": Network,
  "/dashboard/admin/pipeline": Database,
  "/dashboard/admin/control": SlidersHorizontal,
};

type SectionId = "home" | "leads" | "cases" | "money" | "growth" | "learn" | "admin";

const SECTIONS: { id: SectionId; label: string; title: string; icon: IconType }[] = [
  { id: "home", label: "Home", title: "Home", icon: Home },
  { id: "leads", label: "Leads", title: "Leads & sales", icon: Target },
  { id: "cases", label: "Cases", title: "Cases & LOS", icon: FolderKanban },
  { id: "money", label: "Money", title: "Money", icon: IndianRupee },
  { id: "growth", label: "Growth", title: "Growth", icon: Rocket },
  { id: "learn", label: "Learn", title: "Learning", icon: GraduationCap },
  { id: "admin", label: "Admin", title: "Administration", icon: ShieldCheck },
];

const SECTION_OF: Record<string, SectionId> = {
  "/ceo": "home",
  "/dashboard": "home",
  "/dashboard/workspace": "home",
  "/dashboard/profile": "home",
  "/dashboard/hrms": "home",
  "/dashboard/website-leads": "leads",
  "/dashboard/leadboard": "leads",
  "/dashboard/upload-leads": "leads",
  "/dashboard/my-leads": "leads",
  "/dashboard/business": "leads",
  "/dashboard/admin/partners": "leads",
  "/dashboard/calls": "leads",
  "/dashboard/submissions": "leads",
  "/dashboard/cases": "cases",
  "/dashboard/los-analytics": "cases",
  "/dashboard/los-executive": "cases",
  "/dashboard/automation": "cases",
  "/dashboard/wallet": "money",
  "/dashboard/billing": "money",
  "/dashboard/earnings": "money",
  "/dashboard/invoice-approvals": "money",
  "/dashboard/commissions": "money",
  "/dashboard/network": "growth",
  "/dashboard/marketing": "growth",
  "/dashboard/community": "growth",
  "/dashboard/leaderboard": "growth",
  "/dashboard/learn": "learn",
  "/dashboard/training": "learn",
  "/dashboard/certificates": "learn",
};

function sectionOf(item: NavItem): SectionId {
  return item.group === "admin" ? "admin" : SECTION_OF[item.url] ?? "home";
}

export function AppSidebar() {
  const { state, isMobile, setOpen, setOpenMobile } = useSidebar();
  const collapsed = state === "collapsed" && !isMobile;
  const location = useLocation();
  const navigate = useNavigate();
  const { role, signOut, user } = useAuth();

  const items = getNavForRole(role, user?.finance_level);

  const isActive = (path: string) =>
    path === "/dashboard" ? location.pathname === path : location.pathname.startsWith(path);

  const activeItem = useMemo(
    () => [...items].sort((a, b) => b.url.length - a.url.length).find((i) => isActive(i.url)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [items.length, location.pathname],
  );
  const routeSection: SectionId | null = activeItem
    ? sectionOf(activeItem)
    : location.pathname.startsWith("/dashboard/customer")
      ? "leads"
      : null;
  const [selected, setSelected] = useState<SectionId>(routeSection ?? "home");

  useEffect(() => {
    if (routeSection) setSelected(routeSection);
  }, [routeSection]);

  const sections = SECTIONS.map((s) => ({ ...s, items: items.filter((i) => sectionOf(i) === s.id) })).filter(
    (s) => s.items.length > 0,
  );
  const current = sections.find((s) => s.id === selected) ?? sections[0];

  const onRail = (id: SectionId) => {
    setSelected(id);
    if (state === "collapsed" && !isMobile) setOpen(true);
    const section = sections.find((s) => s.id === id);
    if (!isMobile && section && id !== routeSection && section.items[0]) {
      void navigate({ to: section.items[0].url });
    }
  };

  const railBtn = (active: boolean) =>
    `group/rail flex w-full flex-col items-center gap-1 rounded-xl px-1 py-2 text-[10.5px] font-semibold transition-colors ${
      active ? "bg-[#E8F7EC] text-[#10662A]" : "text-[#5c4d72] hover:bg-[#f3f7f4] hover:text-[#10662A]"
    }`;

  return (
    <Sidebar collapsible="icon" className="border-r border-[#e3ece6]">
      <div className="flex h-full min-h-0">
        <div className="flex w-[4.75rem] shrink-0 flex-col items-center border-r border-[#e3ece6] bg-white py-3">
          <Link
            to="/dashboard"
            className="mb-3 grid size-10 place-items-center rounded-xl bg-[#10662A] font-display text-base font-bold text-white shadow-[0_6px_16px_rgba(16,102,42,0.3)]"
            title="RupeeOne"
          >
            R
          </Link>
          <nav className="flex w-full flex-1 flex-col gap-1 overflow-y-auto px-1.5">
            {sections.map((s) => {
              const Icon = s.icon;
              const active = current?.id === s.id;
              return (
                <button key={s.id} type="button" onClick={() => onRail(s.id)} className={railBtn(active)} title={s.title}>
                  <Icon className="size-5" />
                  <span className="leading-none">{s.label}</span>
                </button>
              );
            })}
          </nav>
          <div className="flex w-full flex-col gap-1 px-1.5 pt-2">
            <Link
              to="/dashboard/settings"
              onClick={() => isMobile && setOpenMobile(false)}
              className={railBtn(location.pathname.startsWith("/dashboard/settings"))}
              title="Settings"
            >
              <Settings className="size-5" />
              <span className="leading-none">Settings</span>
            </Link>
            <button type="button" onClick={() => signOut()} className={railBtn(false)} title="Sign out">
              <LogOut className="size-5" />
              <span className="leading-none">Logout</span>
            </button>
          </div>
        </div>

        {!collapsed && current ? (
          <div className="flex min-w-0 flex-1 flex-col bg-[#F7FAF8]">
            <div className="px-4 pb-2 pt-4">
              <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#10662A]">RupeeOne</div>
              <div className="mt-0.5 text-base font-bold text-[#1f1a2e]">{current.title}</div>
            </div>
            <nav className="flex-1 space-y-0.5 overflow-y-auto px-2.5 pb-3">
              {current.items.map((item) => {
                const Icon = ICONS[item.url] ?? LayoutDashboard;
                const active = activeItem?.url === item.url;
                return (
                  <Link
                    key={item.url}
                    to={item.url}
                    onClick={() => isMobile && setOpenMobile(false)}
                    className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13.5px] transition-colors ${
                      active
                        ? "bg-white font-semibold text-[#10662A] shadow-[0_2px_10px_rgba(16,102,42,0.08)] ring-1 ring-[#d8ecdd]"
                        : "font-medium text-[#3d3550] hover:bg-white hover:text-[#10662A]"
                    }`}
                  >
                    <Icon className={`size-[18px] shrink-0 ${active ? "text-[#10662A]" : "text-[#7a7190]"}`} />
                    <span className="truncate">{item.title}</span>
                  </Link>
                );
              })}
            </nav>
            {user ? (
              <div className="border-t border-[#e3ece6] px-4 py-3">
                <div className="truncate text-xs font-medium text-[#3d3550]">{user.email}</div>
                {role ? (
                  <span className="mt-1 inline-block rounded-full border border-[#d8ecdd] bg-[#E8F7EC] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#10662A]">
                    {getRoleLabel(role)}
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </Sidebar>
  );
}
