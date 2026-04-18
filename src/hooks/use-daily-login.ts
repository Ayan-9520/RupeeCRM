import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";

const STORAGE_KEY = "daily_login_claimed";

/** Claims +10 daily login points once per browser per day. Idempotent server-side. */
export function useDailyLogin() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;
    const today = new Date().toISOString().slice(0, 10);
    const key = `${STORAGE_KEY}:${user.id}:${today}`;
    if (localStorage.getItem(key)) return;

    (async () => {
      const { data, error } = await supabase.rpc("claim_daily_login_points");
      if (error) return;
      localStorage.setItem(key, "1");
      const result = data as { already_claimed?: boolean; awarded?: number; streak?: number };
      if (!result?.already_claimed && result?.awarded) {
        toast.success(`🎁 +${result.awarded} daily login points!`, {
          description: result.streak ? `${result.streak}-day streak 🔥` : undefined,
        });
      }
    })();
  }, [user]);
}
