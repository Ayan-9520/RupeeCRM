import type { AppRole } from "@/lib/auth-context";

export type LoginDoor = "partner" | "employee";

const PARTNER_ROLES: AppRole[] = ["dsa", "affiliate", "customer"];
const EMPLOYEE_ROLES: AppRole[] = ["ceo", "super_admin", "admin", "caller", "coordinator", "lender"];

export const LOGIN_TYPES: Record<LoginDoor, { id: string; label: string; roles: AppRole[] }[]> = {
  partner: [
    { id: "dsa", label: "DSA", roles: ["dsa"] },
    { id: "affiliate", label: "Affiliate", roles: ["affiliate"] },
    { id: "customer", label: "Customer", roles: ["customer"] },
  ],
  employee: [
    { id: "caller", label: "Telecaller", roles: ["caller"] },
    { id: "coordinator", label: "Employee", roles: ["coordinator"] },
    { id: "admin", label: "Admin", roles: ["ceo", "super_admin", "admin"] },
    { id: "lender", label: "Lender", roles: ["lender"] },
  ],
};

export function doorAllows(door: LoginDoor, role: string | null | undefined): boolean {
  const value = (role || "") as AppRole;
  return door === "partner" ? PARTNER_ROLES.includes(value) : EMPLOYEE_ROLES.includes(value);
}

export function loginTypeMatches(door: LoginDoor, typeId: string, role: string | null | undefined): boolean {
  const chosen = LOGIN_TYPES[door].find((item) => item.id === typeId);
  return Boolean(chosen && chosen.roles.includes((role || "") as AppRole));
}

export function loginTypeLabel(door: LoginDoor, role: string | null | undefined): string {
  const match = LOGIN_TYPES[door].find((item) => item.roles.includes((role || "") as AppRole));
  return match?.label || "the right user type";
}

export function wrongDoorMessage(door: LoginDoor): string {
  return door === "partner"
    ? "This account is an employee. Use Employee Login."
    : "This account is a partner. Use Partner Login.";
}
