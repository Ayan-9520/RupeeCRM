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
  {
    title: "Performance",
    url: "/dashboard/performance",
    roles: ["ceo", "super_admin", "admin", "dsa", "affiliate", "caller", "coordinator"],
    group: "main",
  },
  { title: "Workspace", url: "/dashboard/workspace", roles: ["ceo", "super_admin", "admin", "dsa", "affiliate", "coordinator"], group: "main" },
  {
    title: "Billing",
    url: "/dashboard/billing",
    roles: ["ceo", "super_admin", "admin", "dsa", "affiliate"],
    group: "main",
  },
  {
    title: "My profile",
    url: "/dashboard/profile",
    roles: ["ceo", "super_admin", "admin", "dsa", "affiliate"],
    group: "main",
  },
  {
    title: "HRMS & Payroll",
    url: "/dashboard/hrms",
    roles: ["ceo", "super_admin", "admin", "dsa", "coordinator"],
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
    roles: ["ceo", "super_admin", "admin", "dsa", "affiliate", "caller", "coordinator"],
    group: "main",
  },
  {
    title: "Telecallers",
    url: "/dashboard/callers",
    roles: ["dsa", "affiliate"],
    group: "main",
  },
  {
    title: "Upload leads",
    url: "/dashboard/upload-leads",
    roles: ["ceo", "super_admin", "admin", "dsa", "affiliate", "caller"],
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
  { title: "Case Files", url: "/dashboard/cases", roles: ["ceo", "super_admin", "admin", "lender", "dsa", "coordinator"], group: "main" },
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
    roles: ["ceo", "super_admin", "admin", "dsa", "affiliate"],
    group: "main",
  },
  {
    title: "Community",
    url: "/dashboard/community",
    roles: ["ceo", "super_admin", "admin", "dsa", "affiliate"],
    group: "main",
  },
  {
    title: "Learn & Earn",
    url: "/dashboard/learn",
    roles: ["ceo", "super_admin", "admin", "dsa", "caller", "coordinator", "affiliate", "customer"],
    group: "main",
  },
  {
    title: "EMI calculator",
    url: "/dashboard/emi",
    roles: ["ceo", "super_admin", "admin", "dsa", "caller", "coordinator", "affiliate"],
    group: "main",
  },
  {
    title: "Certificates",
    url: "/dashboard/certificates",
    roles: ["ceo", "super_admin", "admin", "dsa", "affiliate"],
    group: "main",
  },
  {
    title: "Academy",
    url: "/dashboard/training",
    roles: ["ceo", "super_admin", "admin", "dsa", "affiliate"],
    group: "main",
  },
  {
    title: "Leaderboard",
    url: "/dashboard/leaderboard",
    roles: ["ceo", "super_admin", "admin", "dsa", "affiliate"],
    group: "main",
  },
  { title: "Control Centre", url: "/dashboard/admin/control", roles: ADMIN_ROLES, group: "admin" },
  { title: "Data Pipeline", url: "/dashboard/admin/pipeline", roles: ADMIN_ROLES, group: "admin" },
  { title: "Users", url: "/dashboard/admin/users", roles: ADMIN_ROLES, group: "admin" },
  { title: "Call queue", url: "/dashboard/admin/call-queue", roles: ADMIN_ROLES, group: "admin" },
  { title: "Add Leads", url: "/dashboard/admin/leads", roles: ADMIN_ROLES, group: "admin" },
  { title: "Lead Pricing", url: "/dashboard/admin/pricing", roles: ADMIN_ROLES, group: "admin" },
  { title: "Commission Rules", url: "/dashboard/admin/commissions", roles: ADMIN_ROLES, group: "admin" },
  { title: "Payout Grids", url: "/dashboard/admin/payout-grids", roles: ADMIN_ROLES, group: "admin" },
  { title: "Payouts", url: "/dashboard/admin/payouts", roles: ADMIN_ROLES, group: "admin" },
  { title: "Invoice approvals", url: "/dashboard/invoice-approvals", roles: ADMIN_ROLES, group: "main" },
  { title: "Trust & Audit", url: "/dashboard/admin/trust", roles: ADMIN_ROLES, group: "admin" },
  { title: "Billing Overview", url: "/dashboard/admin/billing", roles: ADMIN_ROLES, group: "admin" },
  { title: "MKT Templates", url: "/dashboard/admin/marketing", roles: ADMIN_ROLES, group: "admin" },
  { title: "MKT Media", url: "/dashboard/admin/marketing-media", roles: ADMIN_ROLES, group: "admin" },
  { title: "Network Rules", url: "/dashboard/admin/network", roles: ADMIN_ROLES, group: "admin" },
];

/** Routes not listed in sidebar but need explicit access */
const EXTRA_ROUTE_RULES: { prefix: string; roles: AppRole[] }[] = [
  { prefix: "/dashboard/customer", roles: ["ceo", "super_admin", "admin", "dsa", "caller", "coordinator"] },
  { prefix: "/dashboard/my-leads/", roles: ["ceo", "super_admin", "admin", "dsa", "affiliate", "caller", "coordinator"] },
  { prefix: "/dashboard/settings", roles: ALL_ROLES },
  { prefix: "/dashboard/invoice-approvals", roles: ["ceo", "super_admin", "admin", "coordinator"] },
  { prefix: "/dashboard/profile", roles: ["ceo", "super_admin", "admin", "dsa", "affiliate", "caller", "coordinator", "lender", "customer"] },
  { prefix: "/dashboard/marketing/", roles: ["ceo", "super_admin", "admin", "dsa", "affiliate"] },
  { prefix: "/dashboard/hrms/", roles: ["ceo", "super_admin", "admin", "dsa", "coordinator"] },
];

export function isPlatformAdmin(role: AppRole | null): boolean {
  return role !== null && ADMIN_ROLES.includes(role);
}

export function hasRole(role: AppRole | null, allowed: AppRole[]): boolean {
  if (!role) return false;
  return allowed.includes(role);
}

const FINANCE_SEATS = new Set(["rm", "manager", "business_head", "accounts"]);

function financeSeatUrls(level: string): Set<string> {
  const urls = new Set(["/dashboard", "/dashboard/performance", "/dashboard/invoice-approvals", "/dashboard/profile", "/dashboard/settings"]);
  if (level === "accounts" || level === "business_head") urls.add("/dashboard/admin/payouts");
  return urls;
}

function opsDesk(role: AppRole | null, level: string, department?: string | null): boolean {
  return role === "coordinator" && department === "OPS" && !FINANCE_SEATS.has(level);
}

function opsUrls(): Set<string> {
  return new Set(["/dashboard", "/dashboard/performance", "/dashboard/cases", "/dashboard/submissions", "/dashboard/profile", "/dashboard/settings"]);
}

function callerUrls(): Set<string> {
  return new Set(["/dashboard", "/dashboard/performance", "/dashboard/calls", "/dashboard/learn", "/dashboard/profile", "/dashboard/settings"]);
}

function pathAllowed(path: string, urls: Set<string>): boolean {
  return [...urls].some((url) => path === url || (url !== "/dashboard" && path.startsWith(url + "/")));
}

export function canAccessPath(role: AppRole | null, pathname: string, financeLevel?: string | null, department?: string | null): boolean {
  if (!role) return false;
  const level = financeLevel || "";
  const path = pathname.replace(/\/$/, "") || "/";
  if (FINANCE_SEATS.has(level) && !isPlatformAdmin(role)) return pathAllowed(path, financeSeatUrls(level));
  if (opsDesk(role, level, department)) return pathAllowed(path, opsUrls());
  if (role === "caller") return pathAllowed(path, callerUrls());
  if (level && (pathname === "/dashboard/invoice-approvals" || pathname.startsWith("/dashboard/invoice-approvals/"))) return true;
  if ((level === "accounts" || level === "business_head") && (pathname === "/dashboard/admin/payouts" || pathname.startsWith("/dashboard/admin/payouts/"))) return true;

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

export function getNavForRole(role: AppRole | null, financeLevel?: string | null, department?: string | null): NavItem[] {
  if (!role) return [];
  if (financeLevel && FINANCE_SEATS.has(financeLevel) && !isPlatformAdmin(role)) {
    const allow = financeSeatUrls(financeLevel);
    return NAV_ITEMS.filter((item) => allow.has(item.url));
  }
  if (opsDesk(role, financeLevel || "", department)) {
    const allow = opsUrls();
    return NAV_ITEMS.filter((item) => allow.has(item.url));
  }
  if (role === "caller") {
    const allow = callerUrls();
    return NAV_ITEMS.filter((item) => allow.has(item.url));
  }
  const items = NAV_ITEMS.filter((item) => item.roles.includes(role));
  if (!financeLevel || isPlatformAdmin(role)) return items;
  const allowed = new Set<string>(["/dashboard/invoice-approvals"]);
  if (financeLevel === "accounts" || financeLevel === "business_head") allowed.add("/dashboard/admin/payouts");
  const extra = NAV_ITEMS.filter((item) => allowed.has(item.url) && !items.some((have) => have.url === item.url));
  return [...items, ...extra];
}

export function getRoleLabel(role: AppRole): string {
  const labels: Record<AppRole, string> = {
    ceo: "CEO",
    super_admin: "Super Admin",
    admin: "Admin",
    dsa: "Partner",
    caller: "Telecaller",
    coordinator: "Employee",
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
      return {
        title: "Company view",
        subtitle: "Every lead, partner, invoice and payout. You approve the last step.",
        stats: ["leads_available", "leads_purchased", "earnings", "spent"],
        quickLinks: [
          { title: "CEO Overview", desc: "Company totals, sales and disbursed value.", url: "/ceo", roles: ["ceo", "super_admin"] },
          { title: "Invoice approvals", desc: "Final authority after RM1, RM2 and Accounts.", url: "/dashboard/invoice-approvals", roles: ["ceo", "super_admin"] },
          { title: "Payouts", desc: "Paid and pending partner payouts.", url: "/dashboard/admin/payouts", roles: ["ceo", "super_admin"] },
          { title: "Partners", desc: "Who is approved to buy and work leads.", url: "/dashboard/admin/partners", roles: ["ceo", "super_admin"] },
        ],
      };
    case "admin":
      return {
        title: "Operations",
        subtitle: "Approve partners, price leads, and move invoices to the right team.",
        stats: ["leads_available", "leads_purchased", "spent", "earnings"],
        quickLinks: [
          { title: "Partner applications", desc: "Approve a partner, then their login is created.", url: "/dashboard/admin/partners", roles: ["admin"] },
          { title: "Website leads", desc: "Forms from rupeedial.com.", url: "/dashboard/website-leads", roles: ["admin"] },
          { title: "Invoice approvals", desc: "RM1, RM2, then Accounts.", url: "/dashboard/invoice-approvals", roles: ["admin"] },
          { title: "Users", desc: "Staff and partner logins.", url: "/dashboard/admin/users", roles: ["admin"] },
        ],
      };
    case "dsa":
      return {
        title: "Partner desk",
        subtitle: "After the telecaller marks the call, collect the papers, submit the file to the bank, then raise the invoice.",
        stats: ["wallet", "leads_available", "leads_purchased", "earnings"],
        quickLinks: [
          { title: "Leadboard", desc: "Leads from RupeeDial. Identity stays masked until you buy.", url: "/dashboard/leadboard", roles: ["dsa"] },
          { title: "My Leads", desc: "Call, documents, bank, sanction, disbursed.", url: "/dashboard/my-leads", roles: ["dsa"] },
          { title: "Telecallers", desc: "Your own callers. They see only your leads.", url: "/dashboard/callers", roles: ["dsa"] },
          { title: "Wallet", desc: "Lead credits and earnings, kept separate.", url: "/dashboard/wallet", roles: ["dsa"] },
          { title: "Invoices", desc: "Raise after disbursement. Track payout date and transaction ID.", url: "/dashboard/earnings", roles: ["dsa"] },
        ],
      };
    case "caller":
      return {
        title: "Call desk",
        subtitle: "Mark each lead: interested, not interested, switched off, not reachable, sent to bank, or forwarded.",
        stats: ["calls"],
        quickLinks: [
          { title: "TeleSales", desc: "Today's call queue and dispositions.", url: "/dashboard/calls", roles: ["caller"] },
          { title: "Scripts", desc: "What to say for each loan.", url: "/dashboard/learn", roles: ["caller"] },
        ],
      };
    case "coordinator":
      return {
        title: "Employee desk",
        subtitle: "Files sent by sales. Log in with the bank, then move sanction, disbursed, or rejected.",
        stats: ["cases"],
        quickLinks: [
          { title: "Case files", desc: "Login, WIP, sanction, disbursed, rejected.", url: "/dashboard/cases", roles: ["coordinator"] },
          { title: "Submissions", desc: "Files forwarded from the call desk.", url: "/dashboard/submissions", roles: ["coordinator"] },
          { title: "Invoices", desc: "Shown when you are RM1, RM2, or Accounts.", url: "/dashboard/invoice-approvals", roles: ["coordinator"] },
        ],
      };
    case "lender":
      return {
        title: "Lender portal",
        subtitle: "Review cases, update approval & disbursal status.",
        stats: ["cases"],
        quickLinks: [
          { title: "Cases", desc: "Applications assigned to your bank.", url: "/dashboard/cases", roles: ["lender"] },
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
        subtitle: "Your RupeeOne workspace.",
        stats: [],
        quickLinks: [{ title: "Settings", desc: "Profile & preferences.", url: "/dashboard/settings", roles: ALL_ROLES }],
      };
  }
}
