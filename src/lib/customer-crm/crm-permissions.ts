import type { AppRole } from "@/lib/auth-context";

export type CrmSection =
  | "personal"
  | "employment"
  | "banking"
  | "obligations"
  | "co-applicants"
  | "loan-requirements"
  | "eligibility"
  | "documents"
  | "los-ops"
  | "finance"
  | "intelligence"
  | "customer-360"
  | "processing"
  | "payouts"
  | "audit";

export type CrmPermission = "view" | "edit" | "none";

type RoleMatrix = Record<CrmSection, CrmPermission>;

const FULL: CrmPermission = "edit";
const VIEW: CrmPermission = "view";
const NONE: CrmPermission = "none";

function matrix(partial: Partial<RoleMatrix>): RoleMatrix {
  const base: RoleMatrix = {
    personal: VIEW,
    employment: VIEW,
    banking: VIEW,
    obligations: VIEW,
    "co-applicants": VIEW,
    "loan-requirements": VIEW,
    eligibility: VIEW,
    documents: VIEW,
    "los-ops": VIEW,
    finance: VIEW,
    intelligence: VIEW,
    "customer-360": VIEW,
    processing: VIEW,
    payouts: VIEW,
    audit: VIEW,
  };
  return { ...base, ...partial };
}

/** Maps platform AppRole → CRM section access (view/edit/none). */
export const CRM_ROLE_PERMISSIONS: Record<AppRole, RoleMatrix> = {
  ceo: matrix({}),
  super_admin: matrix({}),
  admin: matrix({ audit: FULL, payouts: FULL, finance: FULL }),
  dsa: matrix({
    personal: FULL,
    employment: FULL,
    banking: FULL,
    obligations: FULL,
    "co-applicants": FULL,
    "loan-requirements": FULL,
    eligibility: FULL,
    documents: FULL,
    "los-ops": FULL,
    finance: FULL,
    intelligence: FULL,
    "customer-360": FULL,
    processing: FULL,
    payouts: FULL,
    audit: VIEW,
  }),
  caller: matrix({
    personal: VIEW,
    employment: VIEW,
    documents: VIEW,
    intelligence: FULL,
    "customer-360": VIEW,
    finance: NONE,
    payouts: NONE,
    audit: NONE,
  }),
  coordinator: matrix({
    documents: FULL,
    "los-ops": VIEW,
    intelligence: VIEW,
    finance: VIEW,
    payouts: NONE,
  }),
  lender: matrix({
    "los-ops": VIEW,
    finance: VIEW,
    documents: VIEW,
    personal: NONE,
    payouts: VIEW,
  }),
  affiliate: matrix({ intelligence: VIEW, "customer-360": VIEW, finance: NONE, payouts: NONE }),
  customer: matrix({ personal: VIEW, "customer-360": VIEW, finance: NONE, payouts: NONE, audit: NONE }),
};

export function canAccessSection(role: AppRole | null, section: CrmSection, mode: "view" | "edit" = "view"): boolean {
  if (!role) return false;
  const perm = CRM_ROLE_PERMISSIONS[role]?.[section] ?? NONE;
  if (perm === NONE) return false;
  if (mode === "edit") return perm === FULL;
  return perm === FULL || perm === VIEW;
}

export function canViewPayouts(role: AppRole | null): boolean {
  return canAccessSection(role, "payouts", "view");
}

export function canViewAudit(role: AppRole | null): boolean {
  return canAccessSection(role, "audit", "view");
}
