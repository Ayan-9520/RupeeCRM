import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Trophy, Award, ArrowRight, Star, Clock, BookOpen,
  Flame, Target, Crown, TrendingUp, Sparkles,
} from "lucide-react";
import { COURSES, CATEGORY_LABEL, LEVEL_LABEL } from "@/lib/courses";
import { useAuth } from "@/lib/auth-context";
import { AITrainerChat } from "@/components/learn/AITrainerChat";

export const Route = createFileRoute("/dashboard/learn")({
  head: () => ({ meta: [{ title: "Learn & Earn — RupeeDial One" }] }),
  component: LearnDashboard,
});

const DAILY_TASKS = [
  { label: "Daily login", points: 10, done: true },
  { label: "Complete 1 lesson", points: 20, done: false },
  { label: "Call 5 leads", points: 30, done: false },
  { label: "Convert 1 lead", points: 100, done: false },
];

function LearnDashboard() {
  const { user } = useAuth();
  const firstName = user?.email?.split("@")[0] ?? "Partner";

  // skeleton stats — wired to courses table in Phase 3
  const earnedPoints = 280;
  const level = "Pro";
  const nextLevelAt = 500;
  const streak = 4;
  const certificates = 1;

  const continueLearning = COURSES[0];
  const recommended = COURSES.slice(1, 4);

  return (
    <div className="space-y-8">
      {/* HERO */}
      <div className="relative overflow-hidden rounded-2xl border border-[#d8ecdd] bg-white p-7 lg:p-9 shadow-[0_4px_24px_rgba(16,102,42,0.06)]">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(80% 60% at 100% 0%, rgba(232,247,236,0.95), transparent 55%)",
          }}
        />
        <div className="relative grid lg:grid-cols-3 gap-6 items-center">
          <div className="lg:col-span-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#E8F7EC] border border-[#d8ecdd] text-xs font-semibold text-[#10662A]">
              <Flame className="size-3.5 text-[#10662A]" /> {streak}-day learning streak
            </div>
            <h1 className="mt-4 font-display text-2xl lg:text-3xl font-extrabold text-[#390A5D]">
              Welcome back, <span className="capitalize">{firstName}</span>.
            </h1>
            <p className="mt-2 text-[#5c4d72] text-sm max-w-xl">
              You're {nextLevelAt - earnedPoints} pts away from <span className="font-bold text-[#10662A]">Expert</span>. Finish one lesson today to keep your streak alive.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[
              { k: earnedPoints, v: "Points", icon: Star },
              { k: level, v: "Level", icon: Crown },
              { k: certificates, v: "Badges", icon: Award },
            ].map((s) => (
              <div key={s.v} className="rounded-2xl bg-[#E8F7EC]/80 border border-[#d8ecdd] p-3 cursor-default hover:border-[#10662A]/35 transition-all">
                <s.icon className="size-4 text-[#10662A]" />
                <div className="font-display text-xl font-bold mt-1.5 text-[#390A5D]">{s.k}</div>
                <div className="text-[10px] uppercase tracking-wider text-[#5c4d72] font-semibold">{s.v}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* AI TRAINER — full width, hero placement */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="size-5 text-accent" />
            <h2 className="font-display text-lg font-bold">Trainer AI</h2>
            <span className="px-2 py-0.5 rounded-full bg-accent/15 text-accent-foreground text-[10px] font-bold uppercase tracking-wider">Live</span>
          </div>
          <span className="text-xs text-muted-foreground hidden sm:inline">
            Powered by Lovable AI · cites course modules
          </span>
        </div>
        <AITrainerChat />
      </section>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* LEFT — content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Continue learning */}
          <section className="rounded-3xl bg-card border border-border p-6 shadow-card">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs uppercase tracking-[0.18em] text-accent font-semibold">Continue learning</div>
                <h2 className="mt-1 font-display text-xl font-bold">{continueLearning.title}</h2>
              </div>
              <Link
                to="/learn-earn/$slug"
                params={{ slug: continueLearning.slug }}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-foreground text-background text-sm font-semibold hover:scale-[1.02] transition-smooth"
              >
                Resume <ArrowRight className="size-3.5" />
              </Link>
            </div>
            <div className="mt-4 h-2 rounded-full bg-muted overflow-hidden">
              <div className="h-full bg-mint-gradient" style={{ width: "35%" }} />
            </div>
            <div className="mt-2 flex justify-between text-xs text-muted-foreground">
              <span>2 of {continueLearning.lessons} modules · 35% complete</span>
              <span>+{continueLearning.reward_points} pts on completion</span>
            </div>
          </section>

          {/* Recommended */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-lg font-bold">Recommended for you</h2>
              <Link to="/learn-earn" className="text-sm text-accent font-semibold inline-flex items-center gap-1">
                Browse all <ArrowRight className="size-3.5" />
              </Link>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              {recommended.map((c) => (
                <Link
                  key={c.slug}
                  to="/learn-earn/$slug"
                  params={{ slug: c.slug }}
                  className="group rounded-2xl bg-card border border-border p-5 shadow-card hover:shadow-elevated hover:-translate-y-0.5 transition-smooth"
                >
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-full bg-accent/15 text-accent-foreground text-[10px] font-bold uppercase tracking-wider">
                      {CATEGORY_LABEL[c.category]}
                    </span>
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                      {LEVEL_LABEL[c.level]}
                    </span>
                  </div>
                  <h3 className="font-display font-bold mt-3">{c.title}</h3>
                  <p className="text-sm text-muted-foreground mt-1.5 line-clamp-2">{c.tagline}</p>
                  <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5"><Clock className="size-3.5" /> {c.duration_min}m</span>
                    <span className="inline-flex items-center gap-1.5"><BookOpen className="size-3.5" /> {c.lessons}</span>
                    <span className="text-accent font-semibold">+{c.reward_points} pts</span>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        </div>

        {/* RIGHT — gamification */}
        <aside className="space-y-6">
          {/* Daily tasks */}
          <div className="rounded-3xl bg-card border border-border p-6 shadow-card">
            <div className="flex items-center gap-2">
              <Target className="size-5 text-accent" />
              <h3 className="font-display font-bold">Today's tasks</h3>
            </div>
            <div className="mt-4 space-y-2.5">
              {DAILY_TASKS.map((t) => (
                <div key={t.label} className="flex items-center gap-3 p-3 rounded-xl border border-dashed border-border">
                  <div className={`size-5 rounded-md grid place-items-center ${t.done ? "bg-accent text-accent-foreground" : "bg-muted"}`}>
                    {t.done && <span className="text-xs font-bold">✓</span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className={`text-sm font-medium ${t.done ? "line-through text-muted-foreground" : "text-foreground"}`}>{t.label}</div>
                  </div>
                  <span className="text-xs font-bold text-accent">+{t.points}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Leaderboard */}
          <div className="rounded-3xl bg-card border border-border p-6 shadow-card">
            <div className="flex items-center gap-2">
              <Trophy className="size-5 text-accent" />
              <h3 className="font-display font-bold">This month</h3>
            </div>
            <div className="mt-4 space-y-2">
              {[
                { rank: 1, name: "Priya M.", pts: 4250 },
                { rank: 2, name: "Arun V.", pts: 3920 },
                { rank: 3, name: "Sneha P.", pts: 3680 },
                { rank: 47, name: "You", pts: earnedPoints, you: true },
              ].map((l) => (
                <div key={l.rank} className={`flex items-center gap-3 p-2.5 rounded-xl ${l.you ? "bg-accent/10 border border-accent/30" : ""}`}>
                  <div className={`size-7 rounded-lg grid place-items-center text-xs font-bold ${
                    l.rank === 1 ? "bg-amber-400/20 text-amber-700 dark:text-amber-300" :
                    l.rank === 2 ? "bg-slate-400/20 text-slate-700 dark:text-slate-300" :
                    l.rank === 3 ? "bg-orange-500/20 text-orange-700 dark:text-orange-300" :
                    "bg-muted text-muted-foreground"
                  }`}>
                    {l.rank}
                  </div>
                  <div className={`flex-1 text-sm ${l.you ? "font-bold" : "font-medium"}`}>{l.name}</div>
                  <div className="text-xs font-bold text-accent">{l.pts.toLocaleString("en-IN")}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Unlocks teaser */}
          <div className="rounded-3xl bg-mint-gradient text-primary p-6 shadow-mint">
            <TrendingUp className="size-6" strokeWidth={2.5} />
            <div className="mt-3 text-xs font-semibold uppercase tracking-wider opacity-80">Next unlock</div>
            <div className="font-display text-lg font-bold mt-1">Premium PL Leads</div>
            <p className="text-sm mt-1.5 opacity-85">Pass the Personal Loan Pro quiz to access verified high-CIBIL leads.</p>
            <Link
              to="/learn-earn/$slug"
              params={{ slug: "personal-loan-pro" }}
              className="inline-flex items-center gap-1.5 mt-4 px-3 py-1.5 rounded-full bg-primary text-primary-foreground text-xs font-semibold hover:scale-[1.02] transition-smooth"
            >
              Start course <ArrowRight className="size-3.5" />
            </Link>
          </div>
        </aside>
      </div>

    </div>
  );
}
