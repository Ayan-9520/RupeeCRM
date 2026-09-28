import { useCallback, useEffect, useState } from "react";
import { getBillingMe, type BillingEntitlements } from "@/lib/python-api";

const EMPTY: BillingEntitlements = {
  plan_id: null,
  plan_cycle: null,
  plan_status: "none",
  plan_started_at: null,
  plan_ends_at: null,
  wallet_balance: 0,
  seat_limit: 1,
  modules: {},
  has_active_plan: false,
};

export function useBillingEntitlements() {
  const [entitlements, setEntitlements] = useState<BillingEntitlements>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const me = await getBillingMe();
      setEntitlements(me.entitlements);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Billing load failed");
      setEntitlements(EMPTY);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const has = useCallback(
    (module: string) => Boolean(entitlements.modules?.[module]),
    [entitlements],
  );

  return {
    entitlements,
    loading,
    error,
    refresh,
    has,
    marketingBasic: has("marketing_basic"),
    marketingFull: has("marketing_full"),
    visitingCard: has("visiting_card"),
    hrmsSoft: has("hrms_soft"),
    hrmsFull: has("hrms_full"),
    teamAssign: has("team_assign"),
  };
}
