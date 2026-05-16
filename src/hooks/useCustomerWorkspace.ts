import { useCallback, useEffect, useMemo, useState } from "react";
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
import type {
  BankAccount,
  CoApplicant,
  CustomerProfile,
  CustomerWorkspaceData,
  LoanRequirement,
  Obligation,
} from "@/lib/customer-crm/types";
import { validateEmail, validateMobile, validatePan, validatePincode, normalizeMobile, normalizePan } from "@/lib/customer-crm/validation";

export function useCustomerWorkspace(purchaseId: string) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [migrationRequired, setMigrationRequired] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<CustomerWorkspaceData | null>(null);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

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
      const errPan = patch.pan != null ? validatePan(String(patch.pan)) : null;
      const errMob = patch.mobile != null ? validateMobile(String(patch.mobile)) : null;
      const errEmail = patch.email != null ? validateEmail(String(patch.email)) : null;
      const errPin = patch.pincode != null ? validatePincode(String(patch.pincode)) : null;
      if (errPan || errMob || errEmail || errPin) {
        toast.error(errPan || errMob || errEmail || errPin || "Validation failed");
        return false;
      }
      const normalized = { ...patch };
      if (normalized.pan) normalized.pan = normalizePan(String(normalized.pan));
      if (normalized.mobile) normalized.mobile = normalizeMobile(String(normalized.mobile));
      setSaving(true);
      const { error: e } = await updateCustomerProfile(data.profile.id, normalized);
      setSaving(false);
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

  const upsertBank = async (row: BankAccount, patch: Partial<BankAccount>) => {
    const { data: updated, error: e } = await updateBankAccount(row.id, patch);
    if (e?.message) {
      toast.error(e.message);
      return;
    }
    setData((d) =>
      d
        ? {
            ...d,
            bankAccounts: d.bankAccounts.map((b) => (b.id === row.id ? { ...b, ...(updated.data as BankAccount) } : b)),
          }
        : d,
    );
    setLastSaved(new Date());
  };

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
    setData((d) => (d && row.data ? { ...d, bankAccounts: [...d.bankAccounts, row.data as BankAccount] } : d));
  };

  const removeBank = async (id: string) => {
    const { error: e } = await deleteBankAccount(id);
    if (e?.message) {
      toast.error(e.message);
      return;
    }
    setData((d) => (d ? { ...d, bankAccounts: d.bankAccounts.filter((b) => b.id !== id) } : d));
  };

  const upsertObligation = async (row: Obligation, patch: Partial<Obligation>) => {
    const { data: updated, error: e } = await updateObligation(row.id, patch);
    if (e?.message) {
      toast.error(e.message);
      return;
    }
    setData((d) =>
      d
        ? {
            ...d,
            obligations: d.obligations.map((o) => (o.id === row.id ? { ...o, ...(updated.data as Obligation) } : o)),
          }
        : d,
    );
    setLastSaved(new Date());
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
    setData((d) => (d && row.data ? { ...d, obligations: [...d.obligations, row.data as Obligation] } : d));
  };

  const removeObligation = async (id: string) => {
    const { error: e } = await deleteObligation(id);
    if (e?.message) {
      toast.error(e.message);
      return;
    }
    setData((d) => (d ? { ...d, obligations: d.obligations.filter((o) => o.id !== id) } : d));
  };

  const upsertCoApp = async (row: CoApplicant, patch: Partial<CoApplicant>) => {
    const { data: updated, error: e } = await updateCoApplicant(row.id, patch);
    if (e?.message) {
      toast.error(e.message);
      return;
    }
    setData((d) =>
      d
        ? {
            ...d,
            coApplicants: d.coApplicants.map((c) => (c.id === row.id ? { ...c, ...(updated.data as CoApplicant) } : c)),
          }
        : d,
    );
    setLastSaved(new Date());
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
    setData((d) => (d && row.data ? { ...d, coApplicants: [...d.coApplicants, row.data as CoApplicant] } : d));
  };

  const removeCoApp = async (id: string) => {
    const { error: e } = await deleteCoApplicant(id);
    if (e?.message) {
      toast.error(e.message);
      return;
    }
    setData((d) => (d ? { ...d, coApplicants: d.coApplicants.filter((c) => c.id !== id) } : d));
  };

  const upsertLoan = async (row: LoanRequirement, patch: Partial<LoanRequirement>) => {
    const { data: updated, error: e } = await updateLoanRequirement(row.id, patch);
    if (e?.message) {
      toast.error(e.message);
      return;
    }
    setData((d) =>
      d
        ? {
            ...d,
            loanRequirements: d.loanRequirements.map((l) =>
              l.id === row.id ? { ...l, ...(updated.data as LoanRequirement) } : l,
            ),
          }
        : d,
    );
    setLastSaved(new Date());
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
    setData((d) => (d && row.data ? { ...d, loanRequirements: [...d.loanRequirements, row.data as LoanRequirement] } : d));
  };

  const removeLoan = async (id: string) => {
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
