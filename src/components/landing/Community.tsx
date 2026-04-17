import { Trophy, Heart, MessageCircle, Share2, PlayCircle } from "lucide-react";

const leaders = [
  { rank: 1, name: "Rohan Mehta", city: "Mumbai", disbursed: "₹4.2 Cr", deals: 38 },
  { rank: 2, name: "Priya Sharma", city: "Bengaluru", disbursed: "₹3.8 Cr", deals: 31 },
  { rank: 3, name: "Arjun Patel", city: "Ahmedabad", disbursed: "₹3.1 Cr", deals: 29 },
];

export function Community() {
  return (
    <section id="community" className="py-24 lg:py-32 bg-background">
      <div className="max-w-7xl mx-auto px-5 lg:px-8 grid lg:grid-cols-2 gap-12 items-center">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-[oklch(0.5_0.16_165)] font-semibold">Community + Training</div>
          <h2 className="mt-3 text-3xl lg:text-5xl font-bold tracking-tight">
            Learn, post, and <span className="text-gradient">climb the leaderboard</span>.
          </h2>
          <p className="mt-5 text-muted-foreground text-lg">
            Share reels, ask peers, attend webinars and earn certification badges.
            The top-performing DSAs in India are already here.
          </p>

          <div className="mt-8 space-y-3">
            {[
              "Weekly live webinars from senior bankers",
              "Product one-pagers for every loan & card",
              "Reels feed with likes, comments & shares",
              "Certification badges shown on partner profile",
            ].map((p) => (
              <div key={p} className="flex items-center gap-3 text-sm">
                <div className="size-1.5 rounded-full bg-mint-gradient" />
                {p}
              </div>
            ))}
          </div>
        </div>

        <div className="relative">
          <div className="relative rounded-3xl bg-card-gradient border border-border shadow-elevated p-6">
            <div className="flex items-center gap-2.5">
              <Trophy className="size-5 text-[oklch(0.78_0.13_80)]" />
              <div className="font-display font-semibold">Top Partners · This month</div>
            </div>

            <div className="mt-5 space-y-3">
              {leaders.map((l) => (
                <div key={l.rank} className="flex items-center gap-4 p-3.5 rounded-2xl bg-secondary/60 border border-border">
                  <div className={`size-9 rounded-xl grid place-items-center font-display font-bold text-sm ${
                    l.rank === 1 ? "bg-mint-gradient text-primary shadow-mint" : "bg-background border border-border text-foreground"
                  }`}>
                    {l.rank}
                  </div>
                  <div className="flex-1">
                    <div className="font-medium text-sm">{l.name}</div>
                    <div className="text-xs text-muted-foreground">{l.city} · {l.deals} deals</div>
                  </div>
                  <div className="text-sm font-display font-bold text-[oklch(0.35_0.11_240)]">{l.disbursed}</div>
                </div>
              ))}
            </div>

            <div className="mt-5 p-4 rounded-2xl bg-secondary/60 border border-border">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-full bg-mint-gradient grid place-items-center text-primary font-bold text-sm">RM</div>
                <div className="flex-1">
                  <div className="font-medium text-sm">Rohan Mehta</div>
                  <div className="text-xs text-muted-foreground">2h ago · Pro tip</div>
                </div>
                <PlayCircle className="size-5 text-muted-foreground" />
              </div>
              <p className="mt-3 text-sm text-foreground/80">
                "Always pre-qualify on income docs before submitting to HDFC — cuts rejections by 40%."
              </p>
              <div className="mt-3 flex items-center gap-5 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5"><Heart className="size-3.5" /> 248</span>
                <span className="flex items-center gap-1.5"><MessageCircle className="size-3.5" /> 32</span>
                <span className="flex items-center gap-1.5"><Share2 className="size-3.5" /> 18</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
