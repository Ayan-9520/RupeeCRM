import type { LucideIcon } from "lucide-react";
import {
  User,
  Briefcase,
  Landmark,
  Scale,
  Users,
  FileStack,
  Calculator,
  FolderOpen,
  Building2,
  Workflow,
  Banknote,
  Bot,
} from "lucide-react";

export type NavGroup = "profile" | "financial" | "processing" | "operations" | "analytics";

export type NavSection = {
  id: string;
  label: string;
  icon: LucideIcon;
  group: NavGroup;
};

export const NAV_GROUP_LABELS: Record<NavGroup, string> = {
  profile: "Profile",
  financial: "Financial",
  processing: "Processing",
  operations: "Operations",
  analytics: "Analytics",
};

/** Order matches scroll order in CustomerWorkspacePage */
export const NAV_SECTIONS: NavSection[] = [
  { id: "personal", label: "Personal", icon: User, group: "profile" },
  { id: "employment", label: "Employment", icon: Briefcase, group: "profile" },
  { id: "banking", label: "Banking", icon: Landmark, group: "financial" },
  { id: "obligations", label: "Obligations", icon: Scale, group: "financial" },
  { id: "co-applicants", label: "Co-Applicants", icon: Users, group: "financial" },
  { id: "loan-requirements", label: "Loan Requirements", icon: FileStack, group: "financial" },
  { id: "eligibility", label: "Eligibility", icon: Calculator, group: "analytics" },
  { id: "documents", label: "Documents", icon: FolderOpen, group: "processing" },
  { id: "los-ops", label: "LOS Operations", icon: Workflow, group: "operations" },
  { id: "finance", label: "Finance & Reports", icon: Banknote, group: "analytics" },
  { id: "intelligence", label: "AI & Automation", icon: Bot, group: "analytics" },
  { id: "processing", label: "Bank Logins", icon: Building2, group: "processing" },
];

export const NAV_GROUP_ORDER: NavGroup[] = ["profile", "financial", "processing", "operations", "analytics"];

export const EMPLOYMENT_TYPES = ["Salaried", "Self-employed", "Business"] as const;
export const GENDER_OPTIONS = ["Male", "Female", "Other"] as const;
export const MARITAL_OPTIONS = ["Single", "Married", "Divorced", "Widowed"] as const;
export const RESIDENCE_TYPES = ["Owned", "Rented", "Parental", "Company provided"] as const;
export const ACCOUNT_TYPES = ["Savings", "Current", "OD", "CC", "Salary"] as const;
export const LOAN_TYPES = ["HL", "BL", "PL", "LAP", "CC", "OD", "Auto", "Credit Card"] as const;
export const PRODUCT_TYPES = [
  "Home Loan",
  "Business Loan",
  "Personal Loan",
  "LAP",
  "OD",
  "CC",
  "Insurance",
  "Credit Card",
  "Auto Loan",
] as const;

export function amountLabel(productType: string | null | undefined): string {
  const p = (productType ?? "").toLowerCase();
  if (p.includes("insurance")) return "Sum Insured";
  if (p.includes("credit card") || p === "cc") return "Requested Limit";
  return "Requested Amount";
}
