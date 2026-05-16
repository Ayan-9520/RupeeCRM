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
} from "lucide-react";

export type NavSection = {
  id: string;
  label: string;
  icon: LucideIcon;
  group: "profile" | "financial" | "ops";
};

export const NAV_SECTIONS: NavSection[] = [
  { id: "personal", label: "Personal Details", icon: User, group: "profile" },
  { id: "employment", label: "Employment", icon: Briefcase, group: "profile" },
  { id: "banking", label: "Banking", icon: Landmark, group: "financial" },
  { id: "obligations", label: "Existing Obligations", icon: Scale, group: "financial" },
  { id: "co-applicants", label: "Co-Applicants", icon: Users, group: "financial" },
  { id: "loan-requirements", label: "Loan Requirements", icon: FileStack, group: "financial" },
  { id: "eligibility", label: "Eligibility Summary", icon: Calculator, group: "financial" },
  { id: "documents", label: "Documents", icon: FolderOpen, group: "ops" },
  { id: "processing", label: "Bank Processing", icon: Building2, group: "ops" },
];

export const EMPLOYMENT_TYPES = ["Salaried", "Self-employed", "Business"] as const;
export const GENDER_OPTIONS = ["Male", "Female", "Other"] as const;
export const MARITAL_OPTIONS = ["Single", "Married", "Divorced", "Widowed"] as const;
export const RESIDENCE_TYPES = ["Owned", "Rented", "Parental", "Company provided"] as const;
export const ACCOUNT_TYPES = ["Savings", "Current", "OD", "CC"] as const;
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
