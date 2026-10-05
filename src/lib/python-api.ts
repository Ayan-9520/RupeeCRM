const API_URL = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") || "http://127.0.0.1:8000";
const TOKEN_KEY = "rd_crm_token";
const USER_KEY = "rd_crm_user";

export type CrmUser = {
  email: string;
  full_name: string;
  role: string;
  id?: string;
  phone?: string | null;
  dsa_id?: string | null;
};

export type CrmLead = {
  id: string;
  applicant_name: string;
  full_phone: string;
  masked_phone: string;
  email: string | null;
  city: string;
  state?: string | null;
  loan_amount: number;
  monthly_income: number | null;
  employment_type: string | null;
  company_name?: string | null;
  loan_type?: string;
  product_category: string;
  product_subtype: string | null;
  status: string;
  score: string;
  price: number;
  source: string | null;
  utm_source?: string | null;
  is_marketplace: boolean;
  sale_available?: boolean;
  phone_verified?: boolean;
  product_details: Record<string, unknown>;
  quality_score?: number | null;
  lead_grade?: string;
  listing_type?: string;
  website_lead_id: string | null;
  raw_payload?: Record<string, unknown> | null;
  created_at: string;
  updated_at?: string;
};

type LoginResponse = {
  access_token: string;
  token_type: string;
  role: string;
  full_name: string;
  email: string;
};

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function getCrmUser(): CrmUser | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as CrmUser;
  } catch {
    return null;
  }
}

export function clearCrmSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (!headers.has("Content-Type") && init.body) {
    headers.set("Content-Type", "application/json");
  }
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(`${API_URL}${path}`, { ...init, headers });
  if (!res.ok) {
    let detail = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (typeof body?.detail === "string") detail = body.detail;
    } catch {
      /* ignore */
    }
    throw new Error(detail);
  }
  return res.json() as Promise<T>;
}

export async function crmLogin(email: string, password: string): Promise<CrmUser> {
  const data = await request<LoginResponse>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  localStorage.setItem(TOKEN_KEY, data.access_token);
  const user: CrmUser = { email: data.email, full_name: data.full_name, role: data.role };
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  return user;
}

/** Ping Docker CRM API — used by Website Leads connect panel */
export async function crmHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${API_URL}/health`, { method: "GET" });
    if (!res.ok) return false;
    const body = (await res.json()) as { status?: string };
    return body?.status === "ok" || res.ok;
  } catch {
    return false;
  }
}

export async function crmMe(): Promise<CrmUser> {
  const user = await request<CrmUser>("/api/auth/me");
  if (typeof window !== "undefined") {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  }
  return user;
}

export async function updateCrmProfile(body: {
  full_name?: string;
  phone?: string;
}): Promise<CrmUser> {
  const user = await request<CrmUser>("/api/auth/me", {
    method: "PATCH",
    body: JSON.stringify(body),
  });
  if (typeof window !== "undefined") {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  }
  return user;
}

export async function listCrmLeads(params?: {
  q?: string;
  source?: string;
  limit?: number;
}): Promise<{ items: CrmLead[]; total: number }> {
  const qs = new URLSearchParams();
  if (params?.q) qs.set("q", params.q);
  if (params?.source) qs.set("source", params.source);
  if (params?.limit) qs.set("limit", String(params.limit));
  const suffix = qs.toString() ? `?${qs}` : "";
  return request(`/api/leads${suffix}`);
}

export async function purchaseCrmLead(leadId: string): Promise<{
  success: boolean;
  purchase_id: string;
  full_phone: string;
  pipeline_stage: string;
  message: string;
}> {
  return request(`/api/leads/${leadId}/purchase`, { method: "POST" });
}

export async function createCrmLead(body: {
  applicant_name: string;
  full_phone: string;
  city?: string;
  email?: string | null;
  loan_amount?: number;
  monthly_income?: number | null;
  employment_type?: string | null;
  company_name?: string | null;
  product_category?: string;
  product_subtype?: string | null;
  loan_type?: string;
  source?: string | null;
  score?: string;
  price?: number;
  is_marketplace?: boolean;
  sale_available?: boolean;
  product_details?: Record<string, unknown>;
}): Promise<CrmLead> {
  return request("/api/leads", { method: "POST", body: JSON.stringify(body) });
}

export type CrmPurchase = {
  id: string;
  lead_id: string;
  price_paid: number;
  pipeline_stage: string;
  notes: { at: string; text: string; by?: string; kind?: string; code?: string }[];
  next_followup_at: string | null;
  converted: boolean;
  deal_value: number | null;
  created_at: string;
  updated_at?: string;
  lead: CrmLead | null;
};

export async function listMyLeads(): Promise<{
  items: CrmPurchase[];
  total: number;
  stages: string[];
}> {
  return request("/api/my-leads");
}

export async function patchMyLead(
  purchaseId: string,
  body: {
    pipeline_stage?: string;
    notes_text?: string;
    disposition?: string;
    next_followup_at?: string | null;
    clear_followup?: boolean;
    converted?: boolean;
    deal_value?: number | null;
    lead?: Partial<CrmLead> & { product_details?: Record<string, unknown> };
  },
): Promise<CrmPurchase> {
  return request(`/api/my-leads/${purchaseId}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export type CrmPartnerApplication = {
  id: string;
  website_lead_id: string;
  ref_code: string | null;
  dsa_type: string | null;
  full_name: string;
  phone: string;
  email: string;
  city: string;
  state: string | null;
  status: "pending" | "under_review" | "approved" | "rejected" | string;
  generated_dsa_id: string | null;
  rejection_reason: string | null;
  internal_notes: string | null;
  documents: Record<string, unknown>;
  user_id: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
};

export async function listCrmPartners(status?: string): Promise<{ items: CrmPartnerApplication[]; total: number }> {
  const qs = status && status !== "all" ? `?status=${encodeURIComponent(status)}` : "";
  return request(`/api/partners${qs}`);
}

export async function approveCrmPartner(
  id: string,
  notes?: string,
): Promise<{
  success: boolean;
  dsa_id: string;
  application_id: string;
  user_id: string;
  email: string;
  temporary_password: string;
  message: string;
}> {
  return request(`/api/partners/${id}/approve`, {
    method: "POST",
    body: JSON.stringify({ notes: notes || null }),
  });
}

export async function rejectCrmPartner(id: string, reason: string): Promise<{ success: boolean }> {
  return request(`/api/partners/${id}/reject`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

/** Admin can import an existing Hostinger row into CRM (one-time sync). */
export async function importCrmPartner(payload: {
  website_lead_id: string;
  ref_code?: string;
  dsa_type?: string;
  full_name: string;
  phone: string;
  email: string;
  city: string;
  documents?: Record<string, string>;
}): Promise<{ success: boolean; id: string; website_lead_id: string }> {
  const key = (import.meta.env.VITE_PUBLIC_API_KEY as string | undefined) || "rupeedial-website-key-change-me";
  const res = await fetch(`${API_URL}/api/public/partners`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": key,
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    let detail = `Import failed (${res.status})`;
    try {
      const body = await res.json();
      if (typeof body?.detail === "string") detail = body.detail;
    } catch {
      /* ignore */
    }
    throw new Error(detail);
  }
  return res.json();
}

export async function listCrmUsers(): Promise<{
  items: {
    id: string;
    email: string;
    full_name: string;
    role: string;
    phone: string | null;
    dsa_id: string | null;
    is_active: boolean;
    kyc_verified?: boolean;
    created_at: string | null;
  }[];
  total: number;
  pending_partners: number;
}> {
  return request("/api/users");
}

export async function resetCrmUserPassword(userId: string): Promise<{
  success: boolean;
  email: string;
  temporary_password: string;
}> {
  return request(`/api/users/${userId}/reset-password`, { method: "POST", body: "{}" });
}

export type BillingEntitlements = {
  plan_id: string | null;
  plan_name?: string | null;
  plan_cycle: string | null;
  plan_status: string;
  plan_started_at: string | null;
  plan_ends_at: string | null;
  wallet_balance: number;
  seat_limit: number;
  modules: Record<string, boolean>;
  has_active_plan: boolean;
};

export type BillingMe = {
  entitlements: BillingEntitlements;
  seats_used: number;
  team: {
    id: string;
    email: string;
    full_name: string;
    role: string;
    is_owner: boolean;
    is_active: boolean;
  }[];
  available_plans: {
    id: string;
    name: string;
    seats: number;
    lead_credits_monthly: number;
    modules: Record<string, boolean>;
    price: { monthly: number; quarterly: number; yearly: number };
  }[];
};

export async function getBillingMe(): Promise<BillingMe> {
  return request("/api/billing/me");
}

export async function activateBillingPlan(
  planId: string,
  cycle: "monthly" | "quarterly" | "yearly" = "monthly",
): Promise<{ success: boolean; message: string; entitlements: BillingEntitlements }> {
  return request("/api/billing/activate", {
    method: "POST",
    body: JSON.stringify({ plan_id: planId, cycle }),
  });
}

export async function cancelBillingPlan(): Promise<{
  success: boolean;
  message: string;
  entitlements: BillingEntitlements;
}> {
  return request("/api/billing/cancel", { method: "POST", body: "{}" });
}

export async function inviteBillingSeat(body: {
  email: string;
  full_name: string;
  role?: string;
}): Promise<{
  success: boolean;
  email: string;
  temporary_password: string;
  role: string;
  message: string;
}> {
  return request("/api/billing/team/invite", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export type PartnerProfile = {
  id?: string | null;
  firm_name: string;
  slug: string;
  tagline?: string | null;
  bio?: string | null;
  city: string;
  state?: string | null;
  phone?: string | null;
  email?: string | null;
  logo_url?: string | null;
  cover_url?: string | null;
  products: string[];
  theme: Record<string, string>;
  published: boolean;
  directory_featured: boolean;
  public_url?: string | null;
  can_publish: boolean;
  can_feature: boolean;
};

export type VisitingCardData = {
  id?: string | null;
  full_name: string;
  designation?: string | null;
  company_name?: string | null;
  phone?: string | null;
  email?: string | null;
  whatsapp?: string | null;
  website?: string | null;
  city?: string | null;
  photo_url?: string | null;
  logo_url?: string | null;
  products: string[];
  theme: Record<string, string>;
  qr_target_url?: string | null;
};

export async function getPartnerProfile(): Promise<PartnerProfile> {
  return request("/api/partner/profile");
}

export async function savePartnerProfile(
  body: Partial<PartnerProfile>,
): Promise<PartnerProfile> {
  return request("/api/partner/profile", {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

export async function getVisitingCard(): Promise<VisitingCardData> {
  return request("/api/partner/visiting-card");
}

export async function saveVisitingCard(
  body: Partial<VisitingCardData>,
): Promise<VisitingCardData> {
  return request("/api/partner/visiting-card", {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

export type PayoutBank = {
  account_holder: string;
  account_number: string;
  ifsc: string;
  bank_name: string;
  pan: string;
  complete?: boolean;
};

export type PayoutSummary = {
  earned: number;
  paid_out: number;
  pending: number;
  available: number;
  payout_min: number;
  bank: PayoutBank;
  can_request: boolean;
  kyc_verified?: boolean;
  policy: string;
};

export type PayoutRequest = {
  id: string;
  user_id: string;
  amount: number;
  status: string;
  bank_snapshot: Record<string, unknown>;
  note?: string | null;
  rejection_reason?: string | null;
  utr?: string | null;
  created_at?: string | null;
  reviewed_at?: string | null;
  user_email?: string | null;
  user_name?: string | null;
};

export async function getPayoutSummary(): Promise<PayoutSummary> {
  return request("/api/payouts/summary");
}

export async function getPayoutBank(): Promise<PayoutBank> {
  return request("/api/payouts/bank");
}

export async function savePayoutBank(body: Omit<PayoutBank, "complete">): Promise<PayoutBank> {
  return request("/api/payouts/bank", { method: "PUT", body: JSON.stringify(body) });
}

export async function listMyPayoutRequests(): Promise<PayoutRequest[]> {
  return request("/api/payouts/requests");
}

export async function createPayoutRequest(amount: number, note?: string): Promise<PayoutRequest> {
  return request("/api/payouts/requests", {
    method: "POST",
    body: JSON.stringify({ amount, note: note || null }),
  });
}

export async function listAdminPayoutRequests(status?: string): Promise<PayoutRequest[]> {
  const qs = status && status !== "all" ? `?status=${encodeURIComponent(status)}` : "";
  return request(`/api/payouts/admin/requests${qs}`);
}

export type InvoiceCase = {
  purchase_id: string;
  applicant_name: string;
  product: string;
  city: string;
  disbursed: number;
  commission: number;
  invoiced: boolean;
};

export type InvoiceCentre = {
  rate: number;
  expected: number;
  pending: number;
  invoice_raised: number;
  approved: number;
  processing: number;
  paid: number;
  rejected: number;
  cases: InvoiceCase[];
  requests: PayoutRequest[];
};

export async function getInvoiceCentre(): Promise<InvoiceCentre> {
  return request("/api/payouts/centre");
}

export async function raiseInvoice(): Promise<PayoutRequest> {
  return request("/api/payouts/invoices", { method: "POST" });
}

export async function adminPayoutAction(
  id: string,
  action: "approve" | "reject" | "paid" | "processing" | "query",
  extra?: { utr?: string; rejection_reason?: string },
): Promise<PayoutRequest> {
  return request(`/api/payouts/admin/requests/${id}`, {
    method: "POST",
    body: JSON.stringify({ action, ...extra }),
  });
}

export type NetworkConnector = {
  id: string;
  name: string;
  email: string;
  phone: string;
  code: string;
  status: string;
  business: number;
};

export type NetworkReward = {
  level: number;
  label: string;
  share_percent: number;
  connectors: number;
  business: number;
  reward: number;
};

export type NetworkLevel = { level?: number; label: string; share_percent: number };

export type NetworkMe = {
  levels: NetworkLevel[];
  connectors: NetworkConnector[];
  connector_count: number;
  active_count: number;
  business: number;
  revenue: number;
  performance: number;
  rewards: NetworkReward[];
};

export type CustomerApplication = {
  id: string;
  reference: string;
  product: string;
  city: string;
  amount: number;
  income: number;
  lender: string;
  rate: number | null;
  emi: number | null;
  status: string;
  documents: string[];
  sanction: number | null;
  disbursement: number | null;
  created_at: string | null;
  recommended: string[];
};

export async function askRupeeDial(question: string): Promise<{ answer: string; note: string }> {
  return request("/api/assistant/ask", { method: "POST", body: JSON.stringify({ question }) });
}

export async function getCustomerHome(): Promise<{ applications: CustomerApplication[]; advisor: string; support_path: string }> {
  return request("/api/customer/home");
}

export async function getMyNetwork(): Promise<NetworkMe> {
  return request("/api/network/me");
}

export async function inviteNetworkPartner(body: {
  full_name: string;
  phone?: string;
  email?: string;
}): Promise<{ id: string; code: string; name: string; status: string }> {
  return request("/api/network/invites", { method: "POST", body: JSON.stringify(body) });
}

export async function getNetworkSettings(): Promise<{ levels: NetworkLevel[] }> {
  return request("/api/network/settings");
}

export async function saveNetworkSettings(levels: NetworkLevel[]): Promise<{ levels: NetworkLevel[] }> {
  return request("/api/network/settings", { method: "PUT", body: JSON.stringify({ levels }) });
}

export async function adminSetKyc(userId: string, verified = true): Promise<{ success: boolean }> {
  return request("/api/admin/trust/kyc", {
    method: "POST",
    body: JSON.stringify({ user_id: userId, verified }),
  });
}

export async function adminSuspendProfile(
  ownerUserId: string,
  suspended = true,
  reason?: string,
): Promise<{ success: boolean; slug: string; suspended: boolean }> {
  return request("/api/admin/trust/suspend-profile", {
    method: "POST",
    body: JSON.stringify({ owner_user_id: ownerUserId, suspended, reason: reason || null }),
  });
}

export async function adminDeadNumberCredit(body: {
  purchase_id: string;
  credit_wallet?: boolean;
  reopen_lead?: boolean;
  reason: string;
}): Promise<{ success: boolean; credited: number; wallet_balance: number }> {
  return request("/api/admin/trust/dead-number-credit", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export type AuditEvent = {
  id: string;
  actor_user_id: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  detail: Record<string, unknown>;
  created_at: string | null;
};

export async function listAuditEvents(action?: string): Promise<AuditEvent[]> {
  const qs = action ? `?action=${encodeURIComponent(action)}` : "";
  return request(`/api/admin/trust/audit${qs}`);
}

export type PipelineRow = {
  id: string;
  name: string;
  phone: string;
  city: string;
  product: string;
  source: string | null;
  source_label: string;
  campaign: string;
  stage: string;
  consent: boolean;
  allocated_to: string;
  marketplace: boolean;
};

export type PipelineView = {
  total: number;
  sources: { key: string; label: string; count: number }[];
  stages: { key: string; count: number }[];
  oneflo: string;
  rows: PipelineRow[];
};

export async function getPipeline(source?: string, stage?: string): Promise<PipelineView> {
  const params = new URLSearchParams();
  if (source) params.set("source", source);
  if (stage) params.set("stage", stage);
  const qs = params.toString();
  return request(`/api/admin/pipeline${qs ? `?${qs}` : ""}`);
}

export async function importPipeline(body: {
  source: string;
  campaign: string;
  consent: boolean;
  rows: { name: string; phone: string; city: string; product: string }[];
}): Promise<{ created: number; duplicates: number; results: { name: string; status: string; reason?: string }[] }> {
  return request("/api/admin/pipeline/import", { method: "POST", body: JSON.stringify(body) });
}

export async function advancePipeline(
  leadId: string,
  body: { step: string; campaign?: string; assignee_email?: string; note?: string },
): Promise<PipelineRow> {
  return request(`/api/admin/pipeline/${leadId}`, { method: "POST", body: JSON.stringify(body) });
}

export async function getCommissionRule(): Promise<{ rate_percent: number }> {
  return request("/api/admin/commission");
}

export async function saveCommissionRule(ratePercent: number): Promise<{ rate_percent: number }> {
  return request("/api/admin/commission", { method: "PUT", body: JSON.stringify({ rate_percent: ratePercent }) });
}

export { API_URL };
