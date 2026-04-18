import { supabase } from "@/integrations/supabase/client";

export type ReferralStats = {
  dsa_id: string | null;
  leads_generated: number;
  leads_sold: number;
  conversion_rate: number;
  pending_earnings: number;
  approved_earnings: number;
  total_earnings: number;
};

export async function getReferralStats(userId: string): Promise<ReferralStats> {
  const { data, error } = await supabase.rpc("get_referral_stats", { _user_id: userId });
  if (error) throw error;
  return data as unknown as ReferralStats;
}

/** Build a public referral link for a partner */
export function buildReferralLink(dsaId: string, productSlug: string = "personal-loan", origin?: string): string {
  const base = origin ?? (typeof window !== "undefined" ? window.location.origin : "");
  return `${base}/apply/${productSlug}?ref=${encodeURIComponent(dsaId)}`;
}

export const APPLY_PRODUCTS: { slug: string; label: string }[] = [
  { slug: "personal-loan", label: "Personal Loan" },
  { slug: "home-loan", label: "Home Loan" },
  { slug: "business-loan", label: "Business Loan" },
  { slug: "credit-card", label: "Credit Card" },
  { slug: "insurance", label: "Insurance" },
  { slug: "mutual-fund", label: "Mutual Funds" },
];
