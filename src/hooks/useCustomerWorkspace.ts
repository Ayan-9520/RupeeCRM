import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import {
  deleteBankAccount,
  deleteCoApplicant,
  deleteLoanRequirement,
  deleteObligation,
  insertBankAccount,
  insertCoApplicant,
  insertLoanRequirement,
  insertObligation,
  loadCustomerWorkspace,
  updateBankAccount,
  updateCoApplicant,
  updateCustomerProfile,
  updateLoanRequirement,
  updateObligation,
} from "@/lib/customer-crm/api";
import { overallCompletion, sectionCompletion } from "@/lib/customer-crm/completion";
import { normalizeProfilePatch } from "@/lib/customer-crm/normalize";
import type {
  BankAccount,
  CoApplicant,
  CustomerProfile,
  CustomerWorkspaceData,
  LoanRequirement,
  Obligation,
} from "@/lib/customer-crm/types";
import { validateEmail, validateMobile, validatePan, validatePincode, normalizeMobile, normalizePan } from "@/lib/customer-crm/validation";
function mergeRow<T extends { id: string }>(rows: T[], id: string, patch: Partial<T>): T[] {
  return rows.map((r) => (r.id === id ? { ...r, ...patch } : r));
}

export function useCustomerWorkspace(purchaseId: string) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [migrationRequired, setMigrationRequired] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<CustomerWorkspaceData | null>(null);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const saveInFlight = useRef(0);

  const reload = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const res = await loadCustomerWorkspace(purchaseId, user.id);
    if (res.migrationRequired) setMigrationRequired(true);
    if (res.error) setError(res.error);
    else {
      setError(null);
      setData(res.data);
    }
    setLoading(false);
  }, [purchaseId, user]);

  useEffect(() => {
    reload();
  }, [reload]);

  const setProfile = useCallback((patch: Partial<CustomerProfile>) => {
    setData((d) => (d ? { ...d, profile: { ...d.profile, ...patch } } : d));
  }, []);

  const saveProfile = useCallback(
    async (patch: Partial<CustomerProfile>) => {
      if (!data) return false;
      const normalizedPatch = normalizeProfilePatch(patch as Record<string, unknown>) as Partial<CustomerProfile>;
      const errPan = normalizedPatch.pan != null ? validatePan(String(normalizedPatch.pan)) : null;
      const errMob = normalizedPatch.mobile != null ? validateMobile(String(normalizedPatch.mobile)) : null;
      const errEmail = normalizedPatch.email != null ? validateEmail(String(normalizedPatch.email)) : null;
      const errPin = normalizedPatch.pincode != null ? validatePincode(String(normalizedPatch.pincode)) : null;
      if (errPan || errMob || errEmail || errPin) {
        toast.error(errPan || errMob || errEmail || errPin || "Validation failed");
        return false;
      }
      const normalized = { ...normalizedPatch };
      if (normalized.pan) normalized.pan = normalizePan(String(normalized.pan));
      if (normalized.mobile) normalized.mobile = normalizeMobile(String(normalized.mobile));
      saveInFlight.current += 1;
      setSaving(true);
      const { error: e } = await updateCustomerProfile(data.profile.id, normalized);
      saveInFlight.current -= 1;
      if (saveInFlight.current <= 0) setSaving(false);
      if (e) {
        toast.error(e);
        return false;
      }
      setProfile(normalized);
      setLastSaved(new Date());
      return true;
    },
    [data, setProfile],
  );

  const completion = useMemo(() => {
    if (!data) return { overall: 0, sections: {} as Record<string, number> };
    const { profile, bankAccounts, obligations, coApplicants, loanRequirements } = data;
    const sections: Record<string, number> = {};
    for (const id of ["personal", "employment", "banking", "obligations", "co-applicants", "loan-requirements"]) {
      sections[id] = sectionCompletion(id, profile, bankAccounts, obligations, coApplicants, loanRequirements);
    }
    return {
      overall: overallCompletion(profile, bankAccounts, obligations, coApplicants, loanRequirements),
      sections,
    };
  }, [data]);

  const persistChild = useCallback(
    async <T extends { id: string }>(
      id: string,
      patch: Partial<T>,
      updater: (rowId: string, p: Partial<T>) => ReturnType<typeof updateBankAccount>,
      key: "bankAccounts" | "obligations" | "coApplicants" | "loanRequirements",
    ) => {
      saveInFlight.current += 1;
      setSaving(true);
      const { data: row, error: e } = await updater(id, patch as never);
      saveInFlight.current -= 1;
      if (saveInFlight.current <= 0) setSaving(false);
      if (e?.message) {
        toast.error(e.message);
        return;
      }
      if (row) {
        setData((d) => (d ? { ...d, [key]: mergeRow(d[key] as T[], id, row as T) } : d));
        setLastSaved(new Date());
      }
    },
    [],
  );

  const bankQueue = useRef(new Map<string, Partial<BankAccount>>());
  const bankTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const flushBank = useCallback(async (id: string) => {
    const patch = bankQueue.current.get(id);
    bankQueue.current.delete(id);
    bankTimers.current.delete(id);
    if (!patch) return;
    await persistChild<BankAccount>(id, patch, updateBankAccount, "bankAccounts");
  }, [persistChild]);

  const upsertBank = useCallback(
    (row: BankAccount, patch: Partial<BankAccount>) => {
      setData((d) => (d ? { ...d, bankAccounts: mergeRow(d.bankAccounts, row.id, patch) } : d));
      const prev = bankQueue.current.get(row.id) ?? {};
      bankQueue.current.set(row.id, { ...prev, ...patch });
      const t = bankTimers.current.get(row.id);
      if (t) clearTimeout(t);
      bankTimers.current.set(row.id, setTimeout(() => void flushBank(row.id), 650));
    },
    [flushBank],
  );

  const oblQueue = useRef(new Map<string, Partial<Obligation>>());
  const oblTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const flushObl = useCallback(
    async (id: string) => {
      const patch = oblQueue.current.get(id);
      oblQueue.current.delete(id);
      oblTimers.current.delete(id);
      if (!patch) return;
      await persistChild<Obligation>(id, patch, updateObligation, "obligations");
    },
    [persistChild],
  );

  const upsertObligation = useCallback(
    (row: Obligation, patch: Partial<Obligation>) => {
      setData((d) => (d ? { ...d, obligations: mergeRow(d.obligations, row.id, patch) } : d));
      const prev = oblQueue.current.get(row.id) ?? {};
      oblQueue.current.set(row.id, { ...prev, ...patch });
      const t = oblTimers.current.get(row.id);
      if (t) clearTimeout(t);
      oblTimers.current.set(row.id, setTimeout(() => void flushObl(row.id), 650));
    },
    [flushObl],
  );

  const coQueue = useRef(new Map<string, Partial<CoApplicant>>());
  const coTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const flushCo = useCallback(
    async (id: string) => {
      const patch = coQueue.current.get(id);
      coQueue.current.delete(id);
      coTimers.current.delete(id);
      if (!patch) return;
      await persistChild<CoApplicant>(id, patch, updateCoApplicant, "coApplicants");
    },
    [persistChild],
  );

  const upsertCoApp = useCallback(
    (row: CoApplicant, patch: Partial<CoApplicant>) => {
      setData((d) => (d ? { ...d, coApplicants: mergeRow(d.coApplicants, row.id, patch) } : d));
      const prev = coQueue.current.get(row.id) ?? {};
      coQueue.current.set(row.id, { ...prev, ...patch });
      const t = coTimers.current.get(row.id);
      if (t) clearTimeout(t);
      coTimers.current.set(row.id, setTimeout(() => void flushCo(row.id), 650));
    },
    [flushCo],
  );

  const loanQueue = useRef(new Map<string, Partial<LoanRequirement>>());
  const loanTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const flushLoan = useCallback(
    async (id: string) => {
      const patch = loanQueue.current.get(id);
      loanQueue.current.delete(id);
      loanTimers.current.delete(id);
      if (!patch) return;
      await persistChild<LoanRequirement>(id, patch, updateLoanRequirement, "loanRequirements");
    },
    [persistChild],
  );

  const upsertLoan = useCallback(
    (row: LoanRequirement, patch: Partial<LoanRequirement>) => {
      setData((d) => (d ? { ...d, loanRequirements: mergeRow(d.loanRequirements, row.id, patch) } : d));
      const prev = loanQueue.current.get(row.id) ?? {};
      loanQueue.current.set(row.id, { ...prev, ...patch });
      const t = loanTimers.current.get(row.id);
      if (t) clearTimeout(t);
      loanTimers.current.set(row.id, setTimeout(() => void flushLoan(row.id), 650));
    },
    [flushLoan],
  );

  const addBank = async () => {
    if (!data || !user) return;
    const { data: row, error: e } = await insertBankAccount({
      customer_profile_id: data.profile.id,
      lead_purchase_id: purchaseId,
      dsa_id: user.id,
      bank_name: null,
      account_type: null,
      account_vintage: null,
      average_balance: null,
      is_salary_account: false,
      emi_bounce_history: null,
      statement_available: false,
      is_primary: data.bankAccounts.length === 0,
      sort_order: data.bankAccounts.length,
    });
    if (e?.message) {
      toast.error(e.message);
      return;
    }
    if (row) setData((d) => (d ? { ...d, bankAccounts: [...d.bankAccounts, row as BankAccount] } : d));
  };

  const removeBank = async (id: string) => {
    const t = bankTimers.current.get(id);
    if (t) clearTimeout(t);
    bankQueue.current.delete(id);
    const { error: e } = await deleteBankAccount(id);
    if (e?.message) {
      toast.error(e.message);
      return;
    }
    setData((d) => (d ? { ...d, bankAccounts: d.bankAccounts.filter((b) => b.id !== id) } : d));
  };

  const addObligation = async () => {
    if (!data || !user) return;
    const { data: row, error: e } = await insertObligation({
      customer_profile_id: data.profile.id,
      lead_purchase_id: purchaseId,
      dsa_id: user.id,
      loan_type: null,
      bank_name: null,
      emi: null,
      outstanding_amount: null,
      sanction_amount: null,
      remaining_tenure: null,
      start_date: null,
      overdue_status: null,
      sort_order: data.obligations.length,
    });
    if (e?.message) {
      toast.error(e.message);
      return;
    }
    if (row) setData((d) => (d ? { ...d, obligations: [...d.obligations, row as Obligation] } : d));
  };

  const removeObligation = async (id: string) => {
    const t = oblTimers.current.get(id);
    if (t) clearTimeout(t);
    oblQueue.current.delete(id);
    const { error: e } = await deleteObligation(id);
    if (e?.message) {
      toast.error(e.message);
      return;
    }
    setData((d) => (d ? { ...d, obligations: d.obligations.filter((o) => o.id !== id) } : d));
  };

  const addCoApp = async () => {
    if (!data || !user) return;
    const { data: row, error: e } = await insertCoApplicant({
      customer_profile_id: data.profile.id,
      lead_purchase_id: purchaseId,
      dsa_id: user.id,
      relation: null,
      full_name: null,
      mobile: null,
      pan: null,
      aadhaar: null,
      employment_type: null,
      income: null,
      obligations_summary: null,
      cibil_score: null,
      sort_order: data.coApplicants.length,
    });
    if (e?.message) {
      toast.error(e.message);
      return;
    }
    if (row) setData((d) => (d ? { ...d, coApplicants: [...d.coApplicants, row as CoApplicant] } : d));
  };

  const removeCoApp = async (id: string) => {
    const t = coTimers.current.get(id);
    if (t) clearTimeout(t);
    coQueue.current.delete(id);
    const { error: e } = await deleteCoApplicant(id);
    if (e?.message) {
      toast.error(e.message);
      return;
    }
    setData((d) => (d ? { ...d, coApplicants: d.coApplicants.filter((c) => c.id !== id) } : d));
  };

  const addLoan = async () => {
    if (!data || !user) return;
    const { data: row, error: e } = await insertLoanRequirement({
      customer_profile_id: data.profile.id,
      lead_purchase_id: purchaseId,
      dsa_id: user.id,
      product_type: null,
      loan_amount: null,
      tenure_months: null,
      purpose: null,
      property_value: null,
      has_existing_loan: false,
      balance_transfer: false,
      top_up_required: false,
      insurance_type: null,
      sort_order: data.loanRequirements.length,
    });
    if (e?.message) {
      toast.error(e.message);
      return;
    }
    if (row) setData((d) => (d ? { ...d, loanRequirements: [...d.loanRequirements, row as LoanRequirement] } : d));
  };

  const removeLoan = async (id: string) => {
    const t = loanTimers.current.get(id);
    if (t) clearTimeout(t);
    loanQueue.current.delete(id);
    const { error: e } = await deleteLoanRequirement(id);
    if (e?.message) {
      toast.error(e.message);
      return;
    }
    setData((d) => (d ? { ...d, loanRequirements: d.loanRequirements.filter((l) => l.id !== id) } : d));
  };

  return {
    loading,
    error,
    migrationRequired,
    data,
    saving,
    lastSaved,
    completion,
    reload,
    setProfile,
    saveProfile,
    upsertBank,
    addBank,
    removeBank,
    upsertObligation,
    addObligation,
    removeObligation,
    upsertCoApp,
    addCoApp,
    removeCoApp,
    upsertLoan,
    addLoan,
    removeLoan,
  };
}
