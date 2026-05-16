import { supabase } from "@/integrations/supabase/client";
import type {
  BankAccount,
  CoApplicant,
  CustomerProfile,
  CustomerWorkspaceData,
  LoanRequirement,
  Obligation,
  PurchaseContext,
} from "./types";
import { overallCompletion } from "./completion";

const LEADS_SELECT =
  "id,applicant_name,full_phone,alternate_phone,email,city,state,loan_amount,monthly_income,employment_type,company_name,cibil_score,age,gender,product_category,product_subtype,product_details";

const PURCHASE_SELECT = `id,lead_id,pipeline_stage,price_paid,converted,next_followup_at,leads(${LEADS_SELECT})`;

function normalizeLead(lead: Record<string, unknown> | null): PurchaseContext["lead"] {
  if (!lead) return null;
  const details =
    lead.product_details && typeof lead.product_details === "object" && !Array.isArray(lead.product_details)
      ? (lead.product_details as Record<string, unknown>)
      : {};
  return {
    id: String(lead.id ?? ""),
    applicant_name: String(lead.applicant_name ?? ""),
    full_phone: String(lead.full_phone ?? ""),
    alternate_phone: (lead.alternate_phone as string | null) ?? null,
    email: (lead.email as string | null) ?? null,
    city: String(lead.city ?? ""),
    state: (lead.state as string | null) ?? null,
    loan_amount: Number(lead.loan_amount) || 0,
    monthly_income: lead.monthly_income != null ? Number(lead.monthly_income) : null,
    employment_type: (lead.employment_type as string | null) ?? null,
    company_name: (lead.company_name as string | null) ?? null,
    cibil_score: lead.cibil_score != null ? Number(lead.cibil_score) : null,
    age: lead.age != null ? Number(lead.age) : null,
    gender: (lead.gender as string | null) ?? null,
    product_category: String(lead.product_category ?? "loan"),
    product_subtype: (lead.product_subtype as string | null) ?? null,
    product_details: details,
  };
}

function seedFromLead(
  purchaseId: string,
  leadId: string,
  dsaId: string,
  lead: NonNullable<PurchaseContext["lead"]>,
  details: Record<string, unknown>,
): Partial<CustomerProfile> {
  return {
    lead_purchase_id: purchaseId,
    lead_id: leadId,
    dsa_id: dsaId,
    full_name: lead.applicant_name,
    mobile: lead.full_phone.replace(/\D/g, "").slice(-10),
    alternate_mobile: lead.alternate_phone?.replace(/\D/g, "").slice(-10) ?? null,
    email: lead.email,
    city: lead.city,
    state: lead.state,
    gender: lead.gender,
    employment_type: lead.employment_type,
    company_name: lead.company_name,
    monthly_income: lead.monthly_income,
    pan: (details.pan as string) ?? null,
    family_members: details.family_members != null ? Number(details.family_members) : null,
  };
}

export async function loadCustomerWorkspace(
  purchaseId: string,
  userId: string,
): Promise<{ data: CustomerWorkspaceData | null; error: string | null; migrationRequired?: boolean }> {
  const { data: purchaseRow, error: pErr } = await supabase
    .from("lead_purchases")
    .select(PURCHASE_SELECT)
    .eq("id", purchaseId)
    .eq("dsa_id", userId)
    .maybeSingle();

  if (pErr) return { data: null, error: pErr.message };
  if (!purchaseRow) return { data: null, error: "Lead not found or access denied" };

  const lead = normalizeLead(purchaseRow.leads as Record<string, unknown> | null);
  const purchase: PurchaseContext = {
    id: purchaseRow.id,
    lead_id: purchaseRow.lead_id,
    pipeline_stage: purchaseRow.pipeline_stage,
    price_paid: Number(purchaseRow.price_paid),
    converted: purchaseRow.converted,
    next_followup_at: purchaseRow.next_followup_at ?? null,
    lead,
  };

  let profileRes = await supabase.from("customer_profiles").select("*").eq("lead_purchase_id", purchaseId).maybeSingle();

  if (profileRes.error?.message?.includes("customer_profiles")) {
    return { data: null, error: profileRes.error.message, migrationRequired: true };
  }
  if (profileRes.error) return { data: null, error: profileRes.error.message };

  let profile = profileRes.data as CustomerProfile | null;

  if (!profile && lead) {
    const details = lead.product_details ?? {};
    const insert = seedFromLead(purchaseId, purchase.lead_id, userId, lead, details);
    const { data: created, error: cErr } = await supabase
      .from("customer_profiles")
      .insert(insert as never)
      .select("*")
      .single();
    if (cErr?.message?.includes("customer_profiles")) {
      return { data: null, error: cErr.message, migrationRequired: true };
    }
    if (cErr) return { data: null, error: cErr.message };
    profile = created as CustomerProfile;

    if (lead.loan_amount > 0) {
      await supabase.from("customer_loan_requirements").insert({
        customer_profile_id: profile.id,
        lead_purchase_id: purchaseId,
        dsa_id: userId,
        product_type: mapProductType(lead.product_category, lead.product_subtype),
        loan_amount: lead.loan_amount,
        sort_order: 0,
      } as never);
    }
  }

  if (!profile) return { data: null, error: "Could not create customer profile" };

  const [banks, obligations, coApps, loans] = await Promise.all([
    supabase.from("customer_bank_accounts").select("*").eq("customer_profile_id", profile.id).order("sort_order"),
    supabase.from("customer_obligations").select("*").eq("customer_profile_id", profile.id).order("sort_order"),
    supabase.from("customer_co_applicants").select("*").eq("customer_profile_id", profile.id).order("sort_order"),
    supabase.from("customer_loan_requirements").select("*").eq("customer_profile_id", profile.id).order("sort_order"),
  ]);

  const childErr =
    banks.error?.message ||
    obligations.error?.message ||
    coApps.error?.message ||
    loans.error?.message;
  if (childErr?.includes("customer_")) {
    return { data: null, error: childErr, migrationRequired: true };
  }

  const bankAccounts = (banks.data ?? []) as BankAccount[];
  const obligationRows = (obligations.data ?? []) as Obligation[];
  const coApplicants = (coApps.data ?? []) as CoApplicant[];
  const loanRequirements = (loans.data ?? []) as LoanRequirement[];

  const completion = overallCompletion(profile, bankAccounts, obligationRows, coApplicants, loanRequirements);
  if (completion !== profile.profile_completion) {
    await supabase.from("customer_profiles").update({ profile_completion: completion } as never).eq("id", profile.id);
    profile = { ...profile, profile_completion: completion };
  }

  return {
    data: {
      purchase,
      profile,
      bankAccounts,
      obligations: obligationRows,
      coApplicants,
      loanRequirements,
    },
    error: null,
  };
}

function mapProductType(category: string, subtype: string | null): string {
  if (subtype) return subtype.replace(/_/g, " ");
  const map: Record<string, string> = {
    loan: "Personal Loan",
    insurance: "Insurance",
    credit_card: "Credit Card",
    investment: "Investment",
  };
  return map[category] ?? "Personal Loan";
}

export async function updateCustomerProfile(
  profileId: string,
  patch: Partial<CustomerProfile>,
): Promise<{ error: string | null }> {
  const { error } = await supabase.from("customer_profiles").update(patch as never).eq("id", profileId);
  return { error: error?.message ?? null };
}

export async function insertBankAccount(row: Omit<BankAccount, "id" | "created_at" | "updated_at">) {
  return supabase.from("customer_bank_accounts").insert(row as never).select("*").single();
}

export async function updateBankAccount(id: string, patch: Partial<BankAccount>) {
  return supabase.from("customer_bank_accounts").update(patch as never).eq("id", id).select("*").single();
}

export async function deleteBankAccount(id: string) {
  return supabase.from("customer_bank_accounts").delete().eq("id", id);
}

export async function insertObligation(row: Omit<Obligation, "id" | "created_at" | "updated_at">) {
  return supabase.from("customer_obligations").insert(row as never).select("*").single();
}

export async function updateObligation(id: string, patch: Partial<Obligation>) {
  return supabase.from("customer_obligations").update(patch as never).eq("id", id).select("*").single();
}

export async function deleteObligation(id: string) {
  return supabase.from("customer_obligations").delete().eq("id", id);
}

export async function insertCoApplicant(row: Omit<CoApplicant, "id" | "created_at" | "updated_at">) {
  return supabase.from("customer_co_applicants").insert(row as never).select("*").single();
}

export async function updateCoApplicant(id: string, patch: Partial<CoApplicant>) {
  return supabase.from("customer_co_applicants").update(patch as never).eq("id", id).select("*").single();
}

export async function deleteCoApplicant(id: string) {
  return supabase.from("customer_co_applicants").delete().eq("id", id);
}

export async function insertLoanRequirement(row: Omit<LoanRequirement, "id" | "created_at" | "updated_at">) {
  return supabase.from("customer_loan_requirements").insert(row as never).select("*").single();
}

export async function updateLoanRequirement(id: string, patch: Partial<LoanRequirement>) {
  return supabase.from("customer_loan_requirements").update(patch as never).eq("id", id).select("*").single();
}

export async function deleteLoanRequirement(id: string) {
  return supabase.from("customer_loan_requirements").delete().eq("id", id);
}
