import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Trophy, Medal, Award, TrendingUp, Sparkles, Crown } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/dashboard/leaderboard")({
  component: LeaderboardPage,
});

type LbEntry = {
  user_id: string;
  name: string;
  dsa_id: string | null;
  dsa_tier: string;
  avatar_url: string | null;
  city: string | null;
  points: number;
  badges: string[];
  earnings: number;
  rank: number;
};

function rankBadge(rank: number) {
  if (rank === 1) return <Crown className="size-5 text-yellow-500" />;
  if (rank === 2) return <Trophy className="size-5 text-gray-400" />;
  if (rank === 3) return <Medal className="size-5 text-orange-500" />;
  return <span className="text-sm font-bold text-muted-foreground">#{rank}</span>;
}

function LeaderboardPage() {
  const { user } = useAuth();
  const [basis, setBasis] = useState<"points" | "earnings">("points");
  const [data, setData] = useState<LbEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    supabase
      .rpc("get_leaderboard", { _basis: basis, _limit: 50 })
      .then(({ data }) => {
        setData((data as unknown as LbEntry[]) ?? []);
        setLoading(false);
      });
  }, [basis]);

  const myEntry = data.find((d) => d.user_id === user?.id);
  const top10 = data.slice(0, 10);
  const rest = data.slice(10);

  return (
    <div className="space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold flex items-center gap-2">
            <Trophy className="size-7 text-primary" /> Leaderboard
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Top performers across LeadMines — climb the ranks, earn rewards.
          </p>
        </div>
        <div className="flex gap-2 self-start sm:self-end">
          <Button
            variant={basis === "points" ? "default" : "outline"}
            size="sm"
            onClick={() => setBasis("points")}
          >
            <Sparkles className="size-4 mr-1.5" /> Points
          </Button>
          <Button
            variant={basis === "earnings" ? "default" : "outline"}
            size="sm"
            onClick={() => setBasis("earnings")}
          >
            <TrendingUp className="size-4 mr-1.5" /> Earnings
          </Button>
        </div>
      </header>

      {myEntry && (
        <Card className="p-4 bg-primary/5 border-primary/30">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-full bg-primary/20 grid place-items-center font-bold text-primary">
              #{myEntry.rank}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold truncate">Your rank</div>
              <div className="text-xs text-muted-foreground">
                {basis === "points"
                  ? `${myEntry.points.toLocaleString()} pts`
                  : `₹${myEntry.earnings.toLocaleString()}`}
                {" · "}{myEntry.dsa_tier} tier
              </div>
            </div>
            <Link to="/dashboard/wallet">
              <Button size="sm" variant="outline">
                <Award className="size-4 mr-1" /> Redeem
              </Button>
            </Link>
          </div>
        </Card>
      )}

      {/* Podium */}
      {top10.length >= 3 && !loading && (
        <div className="grid grid-cols-3 gap-3 sm:gap-4">
          {[top10[1], top10[0], top10[2]].map((e, idx) => {
            const place = idx === 1 ? 1 : idx === 0 ? 2 : 3;
            const heights = ["h-28", "h-36", "h-24"];
            return (
              <div key={e.user_id} className="flex flex-col items-center">
                <Avatar className={cn("size-14 sm:size-16 mb-2 ring-2", place === 1 ? "ring-yellow-500" : place === 2 ? "ring-gray-400" : "ring-orange-500")}>
                  <AvatarImage src={e.avatar_url ?? undefined} />
                  <AvatarFallback>{e.name.charAt(0)}</AvatarFallback>
                </Avatar>
                <div className="text-xs font-semibold text-center truncate w-full px-1">{e.name}</div>
                <div className="text-[10px] text-muted-foreground mb-1.5">
                  {basis === "points" ? `${e.points} pts` : `₹${e.earnings.toLocaleString()}`}
                </div>
                <div className={cn("w-full rounded-t-lg flex items-start justify-center pt-2", heights[idx], place === 1 ? "bg-yellow-500/20" : place === 2 ? "bg-gray-400/20" : "bg-orange-500/20")}>
                  {rankBadge(place)}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* List */}
      <Card>
        <div className="divide-y">
          {loading && (
            <div className="p-8 text-center text-muted-foreground text-sm">Loading…</div>
          )}
          {!loading && data.length === 0 && (
            <div className="p-8 text-center text-muted-foreground text-sm">
              No rankings yet. Complete courses, buy leads, and convert them to earn points!
            </div>
          )}
          {!loading && rest.map((e) => (
            <div
              key={e.user_id}
              className={cn(
                "flex items-center gap-3 p-3 hover:bg-muted/40 transition",
                e.user_id === user?.id && "bg-primary/5"
              )}
            >
              <div className="w-8 text-center">{rankBadge(e.rank)}</div>
              <Avatar className="size-9">
                <AvatarImage src={e.avatar_url ?? undefined} />
                <AvatarFallback>{e.name.charAt(0)}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm truncate">{e.name}</div>
                <div className="text-[11px] text-muted-foreground truncate">
                  {e.city ?? "—"} · <span className="capitalize">{e.dsa_tier}</span>
                  {e.badges.length > 0 && ` · 🏅 ${e.badges.length}`}
                </div>
              </div>
              <div className="text-right">
                <div className="font-bold text-sm">
                  {basis === "points"
                    ? `${e.points.toLocaleString()}`
                    : `₹${Math.round(e.earnings).toLocaleString()}`}
                </div>
                <div className="text-[10px] text-muted-foreground">
                  {basis === "points" ? "pts" : "earned"}
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-4 bg-gradient-to-br from-primary/10 to-accent/10">
        <div className="flex items-start gap-3">
          <div className="size-10 rounded-lg bg-primary/20 grid place-items-center shrink-0">
            <Sparkles className="size-5 text-primary" />
          </div>
          <div className="flex-1">
            <div className="font-semibold text-sm">How to climb</div>
            <ul className="text-xs text-muted-foreground mt-1 space-y-0.5">
              <li>• Complete a course → +100 pts</li>
              <li>• Convert a lead (disbursal) → +200 pts</li>
              <li>• Daily login → +10 pts</li>
              <li>• First lead purchase → +50 pts</li>
            </ul>
          </div>
        </div>
      </Card>
    </div>
  );
}
