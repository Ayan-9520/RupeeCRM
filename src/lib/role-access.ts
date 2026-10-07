import type { AppRole } from "@/lib/auth-context";

export const ALL_ROLES: AppRole[] = [
  "ceo",
  "super_admin",
  "admin",
  "dsa",
  "caller",
  "coordinator",
  "lender",
  "affiliate",
  "customer",
];

export const ADMIN_ROLES: AppRole[] = ["ceo", "super_admin", "admin"];

export type NavItem = {
  title: string;
  url: string;
  roles: AppRole[];
  group?: "main" | "admin";
};

/** Sidebar navigation — single source of truth for menu + route access */
export const NAV_ITEMS: NavItem[] = [
  { title: "CEO Overview", url: "/ceo", roles: ADMIN_ROLES, group: "main" },
  { title: "Dashboard", url: "/dashboard", roles: ALL_ROLES, group: "main" },
  { title: "Workspace", url: "/dashboard/workspace", roles: ALL_ROLES, group: "main" },
  {
    title: "Billing",
    url: "/dashboard/billing",
    roles: ["ceo", "super_admin", "admin", "dsa", "lender", "coordinator", "affiliate"],
    group: "main",
  },
  {
    title: "Public profile",
    url: "/dashboard/profile",
    roles: ["ceo", "super_admin", "admin", "dsa", "coordinator", "affiliate"],
    group: "main",
  },
  {
    title: "HRMS & Payroll",
    url: "/dashboard/hrms",
    roles: ["ceo", "super_admin", "admin", "dsa", "lender", "coordinator"],
    group: "main",
  },
  { title: "Website Leads", url: "/dashboard/website-leads", roles: ADMIN_ROLES, group: "main" },
  {
    title: "Business Cases",
    url: "/dashboard/business",
    roles: ["ceo", "super_admin", "admin", "caller", "coordinator"],
    group: "main",
  },
  { title: "Partner Applications", url: "/dashboard/admin/partners", roles: ADMIN_ROLES, group: "main" },
  { title: "Leadboard", url: "/dashboard/leadboard", roles: ["ceo", "super_admin", "admin", "dsa"], group: "main" },
  {
    title: "My Leads",
    url: "/dashboard/my-leads",
    roles: ["ceo", "super_admin", "admin", "dsa", "coordinator"],
    group: "main",
  },
  {
    title: "LOS Analytics",
    url: "/dashboard/los-analytics",
    roles: ["ceo", "super_admin", "admin", "dsa"],
    group: "main",
  },
  {
    title: "Executive Analytics",
    url: "/dashboard/los-executive",
    roles: ADMIN_ROLES,
    group: "main",
  },
  { title: "Automation", url: "/dashboard/automation", roles: ["ceo", "super_admin", "admin", "dsa"], group: "main" },
  {
    title: "Wallet",
    url: "/dashboard/wallet",
    roles: ["ceo", "super_admin", "admin", "dsa", "affiliate"],
    group: "main",
  },
  { title: "TeleSales", url: "/dashboard/calls", roles: ["ceo", "super_admin", "admin", "caller"], group: "main" },
  {
    title: "Submissions",
    url: "/dashboard/submissions",
    roles: ["ceo", "super_admin", "admin", "coordinator"],
    group: "main",
  },
  { title: "Cases", url: "/dashboard/cases", roles: ["ceo", "super_admin", "admin", "lender", "dsa", "coordinator"], group: "main" },
  {
    title: "Invoices",
    url: "/dashboard/earnings",
    roles: ["ceo", "super_admin", "admin", "dsa", "affiliate"],
    group: "main",
  },
  {
    title: "Commissions",
    url: "/dashboard/commissions",
    roles: ["ceo", "super_admin", "admin", "dsa", "affiliate"],
    group: "main",
  },
  {
    title: "Network",
    url: "/dashboard/network",
    roles: ["ceo", "super_admin", "admin", "dsa", "affiliate"],
    group: "main",
  },
  {
    title: "Marketing",
    url: "/dashboard/marketing",
    roles: ["ceo", "super_admin", "admin", "dsa", "caller", "coordinator", "lender", "affiliate"],
    group: "main",
  },
  {
    title: "Community",
    url: "/dashboard/community",
    roles: ["ceo", "super_admin", "admin", "dsa", "caller", "coordinator", "lender", "affiliate"],
    group: "main",
  },
  {
    title: "Learn & Earn",
    url: "/dashboard/learn",
    roles: ["ceo", "super_admin", "admin", "dsa", "caller", "coordinator", "affiliate", "customer"],
    group: "main",
  },
  {
    title: "Certificates",
    url: "/dashboard/certificates",
    roles: ["ceo", "super_admin", "admin", "dsa", "caller", "coordinator", "affiliate"],
    group: "main",
  },
  {
    title: "Academy",
    url: "/dashboard/training",
    roles: ["ceo", "super_admin", "admin", "dsa", "caller", "coordinator", "affiliate"],
    group: "main",
  },
  {
    title: "Leaderboard",
    url: "/dashboard/leaderboard",
    roles: ["ceo", "super_admin", "admin", "dsa", "caller", "coordinator", "lender", "affiliate"],
    group: "main",
  },
  {
    title: "Rewards",
    url: "/dashboard/rewards",
    roles: ["ceo", "super_admin", "admin", "dsa", "caller", "coordinator", "affiliate"],
    group: "main",
  },
  { title: "Control Centre", url: "/dashboard/admin/control", roles: ADMIN_ROLES, group: "admin" },
  { title: "Data Pipeline", url: "/dashboard/admin/pipeline", roles: ADMIN_ROLES, group: "admin" },
  { title: "Users", url: "/dashboard/admin/users", roles: ADMIN_ROLES, group: "admin" },
  { title: "Add Leads", url: "/dashboard/admin/leads", roles: ADMIN_ROLES, group: "admin" },
  { title: "Lead Pricing", url: "/dashboard/admin/pricing", roles: ADMIN_ROLES, group: "admin" },
  { title: "Commission Rules", url: "/dashboard/admin/commissions", roles: ADMIN_ROLES, group: "admin" },
  { title: "Payouts", url: "/dashboard/admin/payouts", roles: ADMIN_ROLES, group: "admin" },
  { title: "Trust & Audit", url: "/dashboard/admin/trust", roles: ADMIN_ROLES, group: "admin" },
  { title: "Billing Overview", url: "/dashboard/admin/billing", roles: ADMIN_ROLES, group: "admin" },
  { title: "MKT Templates", url: "/dashboard/admin/marketing", roles: ADMIN_ROLES, group: "admin" },
  { title: "MKT Media", url: "/dashboard/admin/marketing-media", roles: ADMIN_ROLES, group: "admin" },
  { title: "Network Rules", url: "/dashboard/admin/network", roles: ADMIN_ROLES, group: "admin" },
];

/** Routes not listed in sidebar but need explicit access */
const EXTRA_ROUTE_RULES: { prefix: string; roles: AppRole[] }[] = [
  { prefix: "/dashboard/customer", roles: ["ceo", "super_admin", "admin", "dsa", "caller", "coordinator"] },
  { prefix: "/dashboard/my-leads/", roles: ["ceo", "super_admin", "admin", "dsa", "coordinator"] },
  { prefix: "/dashboard/settings", roles: ALL_ROLES },
  { prefix: "/dashboard/profile", roles: ["ceo", "super_admin", "admin", "dsa", "coordinator", "affiliate"] },
  { prefix: "/dashboard/marketing/", roles: ["ceo", "super_admin", "admin", "dsa", "caller", "coordinator", "lender", "affiliate"] },
  { prefix: "/dashboard/hrms/", roles: ["ceo", "super_admin", "admin", "dsa", "lender", "coordinator"] },
];

export function isPlatformAdmin(role: AppRole | null): boolean {
  return role !== null && ADMIN_ROLES.includes(role);
}

export function hasRole(role: AppRole | null, allowed: AppRole[]): boolean {
  if (!role) return false;
  return allowed.includes(role);
}

export function canAccessPath(role: AppRole | null, pathname: string): boolean {
  if (!role) return false;

  const path = pathname.replace(/\/$/, "") || "/";

  for (const rule of EXTRA_ROUTE_RULES) {
    if (path === rule.prefix.replace(/\/$/, "") || path.startsWith(rule.prefix)) {
      return rule.roles.includes(role);
    }
  }

  // Longest nav prefix match wins
  const sorted = [...NAV_ITEMS].sort((a, b) => b.url.length - a.url.length);
  for (const item of sorted) {
    const base = item.url.replace(/\/$/, "") || item.url;
    if (path === base || (base !== "/dashboard" && path.startsWith(base + "/")) || (base === "/dashboard" && path === "/dashboard")) {
      return item.roles.includes(role);
    }
    if (base === "/ceo" && path.startsWith("/ceo")) {
      return item.roles.includes(role);
    }
  }

  // Authenticated dashboard sub-routes inherit parent when parent nav matches
  if (path.startsWith("/dashboard")) {
    const segment = path.split("/")[2];
    if (!segment) return true;
    const parent = NAV_ITEMS.find((n) => {
      const parts = n.url.split("/").filter(Boolean);
      return parts[1] === segment && path.startsWith(n.url);
    });
    if (parent) return parent.roles.includes(role);
  }

  return path === "/dashboard" || path.startsWith("/dashboard/settings");
}

export function getNavForRole(role: AppRole | null): NavItem[] {
  if (!role) return [];
  return NAV_ITEMS.filter((item) => item.roles.includes(role));
}

export function getRoleLabel(role: AppRole): string {
  const labels: Record<AppRole, string> = {
    ceo: "CEO",
    super_admin: "Super Admin",
    admin: "Admin",
    dsa: "DSA Partner",
    caller: "Telecaller",
    coordinator: "Coordinator",
    lender: "Lender",
    affiliate: "Affiliate",
    customer: "Customer",
  };
  return labels[role];
}

export type RoleDashboardConfig = {
  title: string;
  subtitle: string;
  stats: ("wallet" | "leads_available" | "leads_purchased" | "spent" | "calls" | "cases" | "earnings")[];
  quickLinks: { title: string; desc: string; url: string; roles: AppRole[] }[];
};

export function getDashboardConfig(role: AppRole | null): RoleDashboardConfig {
  switch (role) {
    case "ceo":
    case "super_admin":
    case "admin":
      return {
        title: "Platform overview",
        subtitle: "Leads · DSAs · Revenue · Operations across RupeeDial One.",
        stats: ["wallet", "leads_available", "leads_purchased", "spent"],
        quickLinks: [
          { title: "Website Leads", desc: "rupeedial.com form leads from CRM API.", url: "/dashboard/website-leads", roles: ADMIN_ROLES },
          { title: "CEO Overview", desc: "Workspaces, revenue & top performers.", url: "/ceo", roles: ADMIN_ROLES },
          { title: "Partner Applications", desc: "Approve website partners → DSA login.", url: "/dashboard/admin/partners", roles: ADMIN_ROLES },
          { title: "Admin — Users", desc: "CRM logins after partner approve.", url: "/dashboard/admin/users", roles: ADMIN_ROLES },
          { title: "Leadboard", desc: "Marketplace inventory & pricing.", url: "/dashboard/leadboard", roles: ["ceo", "super_admin", "admin", "dsa"] },
          { title: "My Leads", desc: "Pipeline CRM · New → Disbursed.", url: "/dashboard/my-leads", roles: ["ceo", "super_admin", "admin", "dsa"] },
          { title: "Executive Analytics", desc: "LOS funnel, TAT & conversion.", url: "/dashboard/los-executive", roles: ADMIN_ROLES },
        ],
      };
    case "dsa":
      return {
        title: "DSA command center",
        subtitle: "Buy leads, run CRM pipeline, close to disbursal.",
        stats: ["wallet", "leads_available", "leads_purchased", "spent"],
        quickLinks: [
          { title: "Browse Leadboard", desc: "AI-verified leads by product & city.", url: "/dashboard/leadboard", roles: ["dsa"] },
          { title: "My Leads CRM", desc: "Kanban pipeline & customer workspaces.", url: "/dashboard/my-leads", roles: ["dsa"] },
          { title: "Recharge Wallet", desc: "Add funds via Razorpay.", url: "/dashboard/wallet", roles: ["dsa"] },
          { title: "LOS Analytics", desc: "Login, sanction & disbursal metrics.", url: "/dashboard/los-analytics", roles: ["dsa"] },
        ],
      };
    case "caller":
      return {
        title: "TeleSales",
        subtitle: "Call queue, follow-ups, scripts and dispositions.",
        stats: ["calls", "leads_purchased"],
        quickLinks: [
          { title: "TeleSales", desc: "Queue, callbacks, scripts and conversion.", url: "/dashboard/calls", roles: ["caller"] },
          { title: "Learn & Earn", desc: "Scripts, product training & quizzes.", url: "/dashboard/learn", roles: ["caller"] },
          { title: "Community", desc: "Tips from top-performing DSAs.", url: "/dashboard/community", roles: ["caller"] },
        ],
      };
    case "coordinator":
      return {
        title: "Sales coordination",
        subtitle: "Collect documents, verify profiles, route to lenders.",
        stats: ["cases", "leads_purchased"],
        quickLinks: [
          { title: "Submissions", desc: "Pending doc packs & lender routing.", url: "/dashboard/submissions", roles: ["coordinator"] },
          { title: "My Leads", desc: "Cases you're coordinating.", url: "/dashboard/my-leads", roles: ["coordinator", "ceo", "super_admin", "admin", "dsa"] },
          { title: "Cases", desc: "Track lender decisions.", url: "/dashboard/cases", roles: ["coordinator"] },
        ],
      };
    case "lender":
      return {
        title: "Lender portal",
        subtitle: "Review cases, update approval & disbursal status.",
        stats: ["cases"],
        quickLinks: [
          { title: "Cases", desc: "Applications assigned to your bank.", url: "/dashboard/cases", roles: ["lender"] },
          { title: "Billing", desc: "Payouts & commission statements.", url: "/dashboard/billing", roles: ["lender"] },
        ],
      };
    case "affiliate":
      return {
        title: "Affiliate hub",
        subtitle: "Share referral links and track disbursal commissions.",
        stats: ["wallet"],
        quickLinks: [
          { title: "Earnings", desc: "Referral income & pending payouts.", url: "/dashboard/earnings", roles: ["affiliate"] },
          { title: "Commissions", desc: "Per-product commission breakdown.", url: "/dashboard/commissions", roles: ["affiliate"] },
          { title: "Marketing Kit", desc: "Posts, cards & WhatsApp creatives.", url: "/dashboard/marketing", roles: ["affiliate"] },
          { title: "Wallet", desc: "Lead credits (not withdrawable).", url: "/dashboard/wallet", roles: ["affiliate"] },
        ],
      };
    case "customer":
      return {
        title: "Your loan journey",
        subtitle: "Track application status, upload docs & get updates.",
        stats: [],
        quickLinks: [
          { title: "My applications", desc: "Eligibility, offers, documents and status.", url: "/dashboard", roles: ["customer"] },
          { title: "Learn", desc: "Loan products and eligibility basics.", url: "/dashboard/learn", roles: ["customer"] },
        ],
      };
    default:
      return {
        title: "Welcome",
        subtitle: "Your RupeeDial One workspace.",
        stats: [],
        quickLinks: [{ title: "Settings", desc: "Profile & preferences.", url: "/dashboard/settings", roles: ALL_ROLES }],
      };
  }
}
