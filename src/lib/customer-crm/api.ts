import { request } from "@/lib/python-api";
import type {
  BankAccount,
  CoApplicant,
  CustomerProfile,
  CustomerWorkspaceData,
  LoanRequirement,
  Obligation,
} from "./types";

type RowError = { message: string } | null;

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : "Request failed";
}

/** userId is ignored. The API uses the signed-in user and the purchase owner. */
export async function loadCustomerWorkspace(
  purchaseId: string,
  _userId: string,
): Promise<{ data: CustomerWorkspaceData | null; error: string | null }> {
  try {
    const data = await request<CustomerWorkspaceData>(`/api/my-leads/${purchaseId}/workspace`);
    return { data, error: null };
  } catch (error) {
    return { data: null, error: messageOf(error) };
  }
}

export async function updateCustomerProfile(
  profileId: string,
  patch: Partial<CustomerProfile>,
): Promise<{ error: string | null }> {
  try {
    await request(`/api/customer-workspace/profiles/${profileId}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
    return { error: null };
  } catch (error) {
    return { error: messageOf(error) };
  }
}

async function insertRow<T>(path: string, row: unknown): Promise<{ data: T | null; error: RowError }> {
  try {
    const data = await request<T>(path, { method: "POST", body: JSON.stringify(row) });
    return { data, error: null };
  } catch (error) {
    return { data: null, error: { message: messageOf(error) } };
  }
}

async function updateRow<T>(path: string, patch: unknown): Promise<{ data: T | null; error: RowError }> {
  try {
    const data = await request<T>(path, { method: "PATCH", body: JSON.stringify(patch) });
    return { data, error: null };
  } catch (error) {
    return { data: null, error: { message: messageOf(error) } };
  }
}

async function deleteRow(path: string): Promise<{ error: RowError }> {
  try {
    await request(path, { method: "DELETE" });
    return { error: null };
  } catch (error) {
    return { error: { message: messageOf(error) } };
  }
}

export function insertBankAccount(row: Omit<BankAccount, "id">) {
  return insertRow<BankAccount>("/api/customer-workspace/banks", row);
}

export function updateBankAccount(id: string, patch: Partial<BankAccount>) {
  return updateRow<BankAccount>(`/api/customer-workspace/banks/${id}`, patch);
}

export function deleteBankAccount(id: string) {
  return deleteRow(`/api/customer-workspace/banks/${id}`);
}

export function insertObligation(row: Omit<Obligation, "id">) {
  return insertRow<Obligation>("/api/customer-workspace/obligations", row);
}

export function updateObligation(id: string, patch: Partial<Obligation>) {
  return updateRow<Obligation>(`/api/customer-workspace/obligations/${id}`, patch);
}

export function deleteObligation(id: string) {
  return deleteRow(`/api/customer-workspace/obligations/${id}`);
}

export function insertCoApplicant(row: Omit<CoApplicant, "id">) {
  return insertRow<CoApplicant>("/api/customer-workspace/co-applicants", row);
}

export function updateCoApplicant(id: string, patch: Partial<CoApplicant>) {
  return updateRow<CoApplicant>(`/api/customer-workspace/co-applicants/${id}`, patch);
}

export function deleteCoApplicant(id: string) {
  return deleteRow(`/api/customer-workspace/co-applicants/${id}`);
}

export function insertLoanRequirement(row: Omit<LoanRequirement, "id">) {
  return insertRow<LoanRequirement>("/api/customer-workspace/loan-requirements", row);
}

export function updateLoanRequirement(id: string, patch: Partial<LoanRequirement>) {
  return updateRow<LoanRequirement>(`/api/customer-workspace/loan-requirements/${id}`, patch);
}

export function deleteLoanRequirement(id: string) {
  return deleteRow(`/api/customer-workspace/loan-requirements/${id}`);
}
