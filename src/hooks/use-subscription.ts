import { useEffect, useState, useCallback } from "react";
import { useWorkspace } from "@/lib/workspace-context";
import {
  getActiveSubscription, checkLeadQuota, checkMarketingQuota,
  type ActiveSubscription, type QuotaCheck,
} from "@/lib/subscription";

export function useSubscription() {
  const { current } = useWorkspace();
  const [subscription, setSubscription] = useState<ActiveSubscription | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!current?.id) { setSubscription(null); setLoading(false); return; }
    setLoading(true);
    const sub = await getActiveSubscription(current.id);
    setSubscription(sub);
    setLoading(false);
  }, [current?.id]);

  useEffect(() => { refresh(); }, [refresh]);

  return { subscription, loading, refresh };
}

export function useQuota(kind: "leads" | "marketing") {
  const { current } = useWorkspace();
  const [quota, setQuota] = useState<QuotaCheck | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!current?.id) { setQuota(null); setLoading(false); return; }
    setLoading(true);
    const q = kind === "leads" ? await checkLeadQuota(current.id) : await checkMarketingQuota(current.id);
    setQuota(q);
    setLoading(false);
  }, [current?.id, kind]);

  useEffect(() => { refresh(); }, [refresh]);

  return { quota, loading, refresh };
}
