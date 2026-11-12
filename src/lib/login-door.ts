import type { AppRole } from "@/lib/auth-context";

export type LoginDoor = "partner" | "employee";

const PARTNER_ROLES: AppRole[] = ["dsa", "affiliate", "customer"];
const EMPLOYEE_ROLES: AppRole[] = ["ceo", "super_admin", "admin", "caller", "coordinator", "lender"];

export function doorAllows(door: LoginDoor, role: string | null | undefined): boolean {
  const value = (role || "") as AppRole;
  return door === "partner" ? PARTNER_ROLES.includes(value) : EMPLOYEE_ROLES.includes(value);
}

export function wrongDoorMessage(door: LoginDoor): string {
  return door === "partner"
    ? "This account is an employee. Use Employee Login."
    : "This account is a partner. Use Partner Login.";
}
