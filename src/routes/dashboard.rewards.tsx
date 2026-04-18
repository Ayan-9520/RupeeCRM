import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Gift, Sparkles, Wallet, Check } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/dashboard/rewards")({
  component: RewardsPage,
});

type Reward = { id: string; points_used: number; reward_amount: number; created_at: string };

const TIERS = [
  { points: 500, bonus: 100, label: "Starter Bonus" },
  { points: 1000, bonus: 300, label: "Power Bonus" },
  { points: 5000, bonus: 2000, label: "Elite Bonus" },
];

function RewardsPage() {
  const { user } = useAuth();
  const [points, setPoints] = useState(0);
  const [history, setHistory] = useState<Reward[]>([]);
  const [redeeming, setRedeeming] = useState<number | null>(null);

  const refresh = async () => {
    if (!user) return;
    const [{ data: pts }, { data: hist }] = await Promise.all([
      supabase.from("user_points").select("total_points").eq("user_id", user.id).maybeSingle(),
      supabase
        .from("rewards")
        .select("id, points_used, reward_amount, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20),
    ]);
    setPoints(pts?.total_points ?? 0);
    setHistory((hist as Reward[]) ?? []);
  };

  useEffect(() => {
    refresh();
  }, [user]);

  const redeem = async (tierPoints: number) => {
    setRedeeming(tierPoints);
    const { data, error } = await supabase.rpc("redeem_points_for_bonus", { _points: tierPoints });
    setRedeeming(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    const result = data as { bonus_credited: number; new_balance: number };
    toast.success(`🎁 ₹${result.bonus_credited} credited to your wallet!`, {
      description: `New balance: ₹${result.new_balance}`,
    });
    refresh();
  };

  const nextTier = TIERS.find((t) => t.points > points);
  const progressToNext = nextTier
    ? Math.min(100, (points / nextTier.points) * 100)
    : 100;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl font-bold flex items-center gap-2">
          <Gift className="size-7 text-primary" /> Rewards
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Redeem your earned points for wallet bonus credits.
        </p>
      </header>

      <Card className="p-6 bg-gradient-to-br from-primary/15 via-accent/10 to-transparent">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Your points</div>
            <div className="font-display text-4xl font-bold flex items-baseline gap-1.5">
              {points.toLocaleString()}
              <Sparkles className="size-5 text-primary" />
            </div>
          </div>
          {nextTier && (
            <div className="text-right">
              <div className="text-xs text-muted-foreground">Next reward</div>
              <div className="text-sm font-semibold">{nextTier.points - points} pts away</div>
            </div>
          )}
        </div>
        {nextTier && <Progress value={progressToNext} className="h-2" />}
      </Card>

      <div className="grid sm:grid-cols-3 gap-4">
        {TIERS.map((t) => {
          const canRedeem = points >= t.points;
          return (
            <Card
              key={t.points}
              className={cn(
                "p-5 relative overflow-hidden",
                canRedeem && "ring-2 ring-primary/40"
              )}
            >
              <div className="text-xs uppercase tracking-wider text-muted-foreground">{t.label}</div>
              <div className="font-display text-3xl font-bold mt-1">₹{t.bonus}</div>
              <div className="text-xs text-muted-foreground mb-4">for {t.points.toLocaleString()} pts</div>
              <Button
                className="w-full"
                disabled={!canRedeem || redeeming !== null}
                onClick={() => redeem(t.points)}
              >
                {redeeming === t.points ? "Redeeming…" : canRedeem ? "Redeem now" : `Need ${t.points - points} more`}
              </Button>
            </Card>
          );
        })}
      </div>

      <Card>
        <div className="p-4 border-b">
          <h2 className="font-semibold flex items-center gap-2">
            <Wallet className="size-4" /> Redemption history
          </h2>
        </div>
        <div className="divide-y">
          {history.length === 0 && (
            <div className="p-8 text-center text-sm text-muted-foreground">
              No redemptions yet. Earn points by completing courses, converting leads, and logging in daily.
            </div>
          )}
          {history.map((r) => (
            <div key={r.id} className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="size-9 rounded-full bg-primary/15 grid place-items-center">
                  <Check className="size-4 text-primary" />
                </div>
                <div>
                  <div className="text-sm font-medium">₹{r.reward_amount} credited</div>
                  <div className="text-[11px] text-muted-foreground">
                    {new Date(r.created_at).toLocaleDateString()} · {r.points_used} pts used
                  </div>
                </div>
              </div>
              <Badge variant="secondary">+₹{r.reward_amount}</Badge>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
