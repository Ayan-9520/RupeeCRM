import type { AppRole } from "@/lib/auth-context";

export type LoginDoor = "partner" | "employee";

const PARTNER_ROLES: AppRole[] = ["dsa", "affiliate", "customer"];
const EMPLOYEE_ROLES: AppRole[] = ["ceo", "super_admin", "admin", "caller", "coordinator", "lender"];

export const EMPLOYEE_DEPARTMENTS = [
  { id: "associate", label: "Associate" },
  { id: "operation", label: "Operation" },
  { id: "it_marketing", label: "IT & Marketing" },
  { id: "sales", label: "Sales" },
  { id: "hr", label: "Human Resource" },
  { id: "accounts", label: "Accounts" },
] as const;

type LoginType = { id: string; label: string; roles: AppRole[]; department?: string };

export const LOGIN_TYPES: Record<LoginDoor, LoginType[]> = {
  partner: [
    { id: "dsa", label: "DSA", roles: ["dsa"] },
    { id: "affiliate", label: "Affiliate", roles: ["affiliate"] },
    { id: "customer", label: "Customer", roles: ["customer"] },
  ],
  employee: [
    ...EMPLOYEE_DEPARTMENTS.map((item) => ({ id: item.id, label: item.label, roles: ["coordinator"] as AppRole[], department: item.id })),
    { id: "caller", label: "Telecaller", roles: ["caller"] },
    { id: "admin", label: "Admin", roles: ["ceo", "super_admin", "admin"] },
    { id: "lender", label: "Lender", roles: ["lender"] },
  ],
};

export function doorAllows(door: LoginDoor, role: string | null | undefined): boolean {
  const value = (role || "") as AppRole;
  return door === "partner" ? PARTNER_ROLES.includes(value) : EMPLOYEE_ROLES.includes(value);
}

export function loginTypeMatches(
  door: LoginDoor,
  typeId: string,
  role: string | null | undefined,
  department?: string | null,
): boolean {
  const chosen = LOGIN_TYPES[door].find((item) => item.id === typeId);
  if (!chosen || !chosen.roles.includes((role || "") as AppRole)) return false;
  if (chosen.department) return (department || "") === chosen.department;
  return true;
}

export function loginTypeLabel(door: LoginDoor, role: string | null | undefined, department?: string | null): string {
  const types = LOGIN_TYPES[door];
  const value = (role || "") as AppRole;
  const byDepartment = types.find((item) => item.department && item.department === department && item.roles.includes(value));
  if (byDepartment) return byDepartment.label;
  const byRole = types.find((item) => !item.department && item.roles.includes(value));
  return byRole?.label || "";
}

export function departmentLabel(id: string | null | undefined): string {
  return EMPLOYEE_DEPARTMENTS.find((item) => item.id === id)?.label || "";
}

export function wrongDoorMessage(door: LoginDoor): string {
  return door === "partner"
    ? "This account is an employee. Use Employee Login."
    : "This account is a partner. Use Partner Login.";
}
