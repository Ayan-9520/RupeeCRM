import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  GraduationCap, Trophy, Sparkles, ArrowRight, CheckCircle2, Award, Zap,
  TrendingUp, ShieldCheck, Crown, Star, Clock, BookOpen, Filter,
} from "lucide-react";
import { Nav } from "@/components/landing/Nav";
import { Footer } from "@/components/landing/Footer";
import { COURSES, CATEGORY_LABEL, LEVEL_LABEL, type CourseCategory, type CourseLevel } from "@/lib/courses";

export const Route = createFileRoute("/learn-earn")({
  head: () => ({
    meta: [
      { title: "Learn & Earn — Get certified, unlock premium leads | LeadMines Academy" },
      { name: "description", content: "Free DSA certification across Personal Loan, Home Loan, Insurance & Credit Cards. Pass quizzes, earn badges, unlock premium leads + higher commissions." },
      { property: "og:title", content: "LeadMines Academy — Learn → Get Certified → Earn More" },
      { property: "og:description", content: "Free fintech distribution courses with badges, leaderboards & rewards. Built for India's DSAs." },
    ],
  }),
  component: LearnEarnLanding,
});

const HOW_STEPS = [
  { icon: BookOpen, title: "Learn", body: "Bite-sized modules, scripts and real call recordings — built by top DSAs." },
  { icon: Award, title: "Get certified", body: "Pass a quick quiz and earn a verifiable badge on your public profile." },
  { icon: TrendingUp, title: "Earn more", body: "Unlock premium leads, higher commission slabs and tier upgrades." },
];

const BENEFITS = [
  { icon: Crown, title: "Premium leads", body: "Certified-only access to high-intent leads with verified CIBIL." },
  { icon: Zap, title: "+0.5–1% commission", body: "Stacked payout slabs the moment you certify in a product." },
  { icon: ShieldCheck, title: "Reputation tier", body: "Badges feed your DSA score — fast-track Bronze → Diamond." },
  { icon: Trophy, title: "Monthly leaderboard", body: "Top learners share a ₹1L bonus pool every month." },
];

const TESTIMONIALS = [
  { name: "Ravi K.", city: "Pune", text: "Did the HL course in a weekend, unlocked pre-approved leads on Monday — closed ₹42L by Friday.", badge: "HL Certified · Gold tier" },
  { name: "Anjali S.", city: "Bengaluru", text: "The objection-handling scripts alone doubled my conversion. Best free training I've taken.", badge: "Sales Pro · Platinum" },
  { name: "Mohit R.", city: "Lucknow", text: "Compliance badge got me on the leadboard the same day. No paperwork drama.", badge: "Compliance Verified" },
];

const TOP_LEARNERS = [
  { rank: 1, name: "Priya M.", city: "Mumbai", points: 4250, badges: 7 },
  { rank: 2, name: "Arun V.", city: "Chennai", points: 3920, badges: 6 },
  { rank: 3, name: "Sneha P.", city: "Delhi", points: 3680, badges: 6 },
  { rank: 4, name: "Karan J.", city: "Ahmedabad", points: 3150, badges: 5 },
  { rank: 5, name: "Divya N.", city: "Kolkata", points: 2980, badges: 5 },
];

function LearnEarnLanding() {
  const [cat, setCat] = useState<CourseCategory | "all">("all");
  const [level, setLevel] = useState<CourseLevel | "all">("all");

  const filtered = useMemo(
    () => COURSES.filter((c) => (cat === "all" || c.category === cat) && (level === "all" || c.level === level)),
    [cat, level],
  );

  const cats: { key: CourseCategory | "all"; label: string }[] = [
    { key: "all", label: "All courses" },
    { key: "loan", label: "Loans" },
    { key: "insurance", label: "Insurance" },
    { key: "credit_card", label: "Credit Cards" },
    { key: "sales", label: "Sales" },
    { key: "compliance", label: "Compliance" },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Nav />

      <main className="pt-24">
        {/* HERO */}
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 bg-hero-gradient opacity-95" />
          <div className="absolute inset-0 grid-bg opacity-30" />
          <div className="relative max-w-7xl mx-auto px-5 lg:px-8 py-20 lg:py-28">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 border border-white/20 backdrop-blur-md text-white/90 text-xs font-medium animate-fade-up">
                <Sparkles className="size-3.5 text-accent" />
                LeadMines Academy · Free for verified DSAs
              </div>
              <h1 className="mt-6 font-display text-4xl sm:text-5xl lg:text-6xl font-bold text-white tracking-tight animate-fade-up">
                Learn → Get Certified → <span className="text-gradient">Earn More</span>
              </h1>
              <p className="mt-5 text-lg text-white/80 max-w-2xl animate-fade-up">
                India's first earn-while-you-learn academy for loan, insurance and card distributors. Pass quick courses, unlock premium leads, climb the tier ladder and stack commissions.
              </p>
              <div className="mt-8 flex flex-wrap gap-3 animate-fade-up">
                <a href="#courses" className="inline-flex items-center gap-2 px-5 py-3 rounded-full bg-mint-gradient text-primary font-semibold shadow-mint hover:scale-[1.02] transition-smooth">
                  Start learning <ArrowRight className="size-4" />
                </a>
                <Link to="/auth" className="inline-flex items-center gap-2 px-5 py-3 rounded-full bg-white/10 border border-white/20 backdrop-blur-md text-white font-medium hover:bg-white/20 transition-smooth">
                  Become a partner
                </Link>
              </div>

              <div className="mt-12 grid grid-cols-3 gap-4 max-w-xl">
                {[
                  { k: "8+", v: "Live courses" },
                  { k: "₹1L", v: "Monthly bonus pool" },
                  { k: "5★", v: "Avg DSA rating" },
                ].map((s) => (
                  <div key={s.v} className="rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md p-4">
                    <div className="font-display text-2xl font-bold text-white">{s.k}</div>
                    <div className="text-xs text-white/70 mt-0.5">{s.v}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section className="py-20 lg:py-28">
          <div className="max-w-7xl mx-auto px-5 lg:px-8">
            <div className="text-center max-w-2xl mx-auto">
              <div className="text-xs uppercase tracking-[0.18em] text-accent font-semibold">How it works</div>
              <h2 className="mt-3 font-display text-3xl lg:text-4xl font-bold">Three steps to a higher payout</h2>
            </div>
            <div className="mt-12 grid md:grid-cols-3 gap-6">
              {HOW_STEPS.map((s, i) => (
                <div key={s.title} className="relative rounded-3xl bg-card border border-border p-7 shadow-card hover:shadow-elevated transition-smooth">
                  <div className="size-12 rounded-2xl bg-mint-gradient grid place-items-center shadow-mint">
                    <s.icon className="size-5 text-primary" strokeWidth={2.5} />
                  </div>
                  <div className="mt-5 text-xs font-mono text-muted-foreground">STEP 0{i + 1}</div>
                  <h3 className="font-display text-xl font-bold mt-1">{s.title}</h3>
                  <p className="text-sm text-muted-foreground mt-2">{s.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* COURSE LIBRARY */}
        <section id="courses" className="py-20 lg:py-24 bg-secondary/40">
          <div className="max-w-7xl mx-auto px-5 lg:px-8">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <div className="text-xs uppercase tracking-[0.18em] text-accent font-semibold">Course library</div>
                <h2 className="mt-3 font-display text-3xl lg:text-4xl font-bold">Pick your product. Pass the quiz. Unlock the badge.</h2>
                <p className="mt-3 text-muted-foreground max-w-2xl">Every course ships with pitch scripts, objection handlers and a process flow you can use on your next call.</p>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Filter className="size-3.5" /> {filtered.length} courses
              </div>
            </div>

            {/* Filters */}
            <div className="mt-8 flex flex-wrap gap-2">
              {cats.map((c) => (
                <button
                  key={c.key}
                  onClick={() => setCat(c.key)}
                  className={`px-4 py-2 rounded-full text-sm font-medium border transition-smooth ${
                    cat === c.key
                      ? "bg-foreground text-background border-foreground"
                      : "bg-card border-border text-foreground/70 hover:text-foreground hover:border-foreground/30"
                  }`}
                >
                  {c.label}
                </button>
              ))}
              <div className="w-px h-8 bg-border mx-2 self-center" />
              {(["all", "beginner", "intermediate", "advanced"] as const).map((l) => (
                <button
                  key={l}
                  onClick={() => setLevel(l)}
                  className={`px-4 py-2 rounded-full text-sm font-medium border transition-smooth ${
                    level === l
                      ? "bg-accent text-accent-foreground border-accent"
                      : "bg-card border-border text-foreground/70 hover:text-foreground hover:border-accent/40"
                  }`}
                >
                  {l === "all" ? "All levels" : LEVEL_LABEL[l]}
                </button>
              ))}
            </div>

            {/* Cards */}
            <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filtered.map((c) => (
                <Link
                  key={c.slug}
                  to="/learn-earn/$slug"
                  params={{ slug: c.slug }}
                  className="group relative rounded-3xl bg-card border border-border overflow-hidden shadow-card hover:shadow-elevated hover:-translate-y-0.5 transition-smooth"
                >
                  <div className={`h-32 bg-gradient-to-br ${c.hero_color} relative`}>
                    <div className="absolute top-4 left-4 flex items-center gap-2">
                      <span className="px-2.5 py-1 rounded-full bg-background/80 backdrop-blur-md text-[11px] font-semibold text-foreground">
                        {CATEGORY_LABEL[c.category]}
                      </span>
                      <span className="px-2.5 py-1 rounded-full bg-background/80 backdrop-blur-md text-[11px] font-medium text-muted-foreground">
                        {LEVEL_LABEL[c.level]}
                      </span>
                    </div>
                    <div className="absolute bottom-4 right-4 size-12 rounded-2xl bg-background/90 backdrop-blur-md grid place-items-center shadow-card">
                      <GraduationCap className="size-5 text-accent" strokeWidth={2.5} />
                    </div>
                  </div>
                  <div className="p-6">
                    <h3 className="font-display text-lg font-bold tracking-tight">{c.title}</h3>
                    <p className="text-sm text-muted-foreground mt-1.5 line-clamp-2">{c.tagline}</p>

                    <div className="mt-5 flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1.5"><Clock className="size-3.5" /> {c.duration_min} min</span>
                      <span className="inline-flex items-center gap-1.5"><BookOpen className="size-3.5" /> {c.lessons} lessons</span>
                      <span className="inline-flex items-center gap-1.5 text-accent font-semibold"><Star className="size-3.5" /> +{c.reward_points} pts</span>
                    </div>

                    <div className="mt-4 pt-4 border-t border-dashed border-border">
                      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Unlocks</div>
                      <div className="text-sm font-medium text-foreground mt-0.5">{c.unlock}</div>
                    </div>

                    <div className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-accent group-hover:gap-2.5 transition-smooth">
                      View course <ArrowRight className="size-4" />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* BENEFITS */}
        <section className="py-20 lg:py-28">
          <div className="max-w-7xl mx-auto px-5 lg:px-8">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div>
                <div className="text-xs uppercase tracking-[0.18em] text-accent font-semibold">Why certify</div>
                <h2 className="mt-3 font-display text-3xl lg:text-4xl font-bold">Every badge converts to real money in your wallet.</h2>
                <p className="mt-4 text-muted-foreground">
                  Certification isn't a vanity metric on LeadMines. Each badge unlocks measurable advantages — premium leads, higher commission slabs and faster tier upgrades.
                </p>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                {BENEFITS.map((b) => (
                  <div key={b.title} className="rounded-2xl bg-card border border-border p-5 shadow-card">
                    <div className="size-10 rounded-xl bg-accent/15 grid place-items-center">
                      <b.icon className="size-5 text-accent" strokeWidth={2.5} />
                    </div>
                    <h3 className="font-display font-bold mt-4">{b.title}</h3>
                    <p className="text-sm text-muted-foreground mt-1.5">{b.body}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* TESTIMONIALS + LEADERBOARD */}
        <section className="py-20 lg:py-24 bg-secondary/40">
          <div className="max-w-7xl mx-auto px-5 lg:px-8 grid lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-5">
              <div className="text-xs uppercase tracking-[0.18em] text-accent font-semibold">From the field</div>
              <h2 className="font-display text-3xl lg:text-4xl font-bold">DSAs are already cashing in.</h2>
              <div className="grid sm:grid-cols-2 gap-5 mt-4">
                {TESTIMONIALS.map((t) => (
                  <div key={t.name} className="rounded-3xl bg-card border border-border p-6 shadow-card">
                    <div className="flex gap-0.5 text-accent">
                      {Array.from({ length: 5 }).map((_, i) => <Star key={i} className="size-4 fill-accent" />)}
                    </div>
                    <p className="text-sm text-foreground mt-3 leading-relaxed">"{t.text}"</p>
                    <div className="mt-4 pt-4 border-t border-dashed border-border">
                      <div className="font-semibold text-sm">{t.name} · {t.city}</div>
                      <div className="text-xs text-accent font-medium mt-0.5">{t.badge}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Top learners */}
            <div className="rounded-3xl bg-card border border-border p-6 shadow-card h-fit">
              <div className="flex items-center gap-2">
                <Trophy className="size-5 text-accent" />
                <h3 className="font-display font-bold">Top learners this month</h3>
              </div>
              <div className="mt-5 space-y-2">
                {TOP_LEARNERS.map((l) => (
                  <div key={l.rank} className="flex items-center gap-3 p-3 rounded-2xl hover:bg-muted/50 transition-smooth">
                    <div className={`size-9 rounded-xl grid place-items-center font-bold text-sm ${
                      l.rank === 1 ? "bg-amber-400/20 text-amber-700 dark:text-amber-300" :
                      l.rank === 2 ? "bg-slate-400/20 text-slate-700 dark:text-slate-300" :
                      l.rank === 3 ? "bg-orange-500/20 text-orange-700 dark:text-orange-300" :
                      "bg-muted text-muted-foreground"
                    }`}>
                      {l.rank}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm truncate">{l.name}</div>
                      <div className="text-xs text-muted-foreground">{l.city} · {l.badges} badges</div>
                    </div>
                    <div className="text-sm font-bold text-accent">{l.points.toLocaleString("en-IN")}</div>
                  </div>
                ))}
              </div>
              <div className="mt-5 p-4 rounded-2xl bg-mint-gradient text-primary">
                <div className="text-xs font-semibold uppercase tracking-wider opacity-80">Bonus pool</div>
                <div className="font-display text-2xl font-bold mt-1">₹1,00,000 / month</div>
                <div className="text-xs opacity-80 mt-0.5">Shared by the top 50 learners</div>
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-20 lg:py-28">
          <div className="max-w-5xl mx-auto px-5 lg:px-8">
            <div className="relative rounded-[2rem] overflow-hidden bg-hero-gradient p-10 lg:p-16 text-center">
              <div className="absolute inset-0 grid-bg opacity-30" />
              <div className="relative">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 border border-white/20 backdrop-blur-md text-white/90 text-xs font-medium">
                  <CheckCircle2 className="size-3.5 text-accent" /> Free for verified DSAs
                </div>
                <h2 className="mt-5 font-display text-3xl lg:text-5xl font-bold text-white">
                  Your next ₹10L month starts with a 12-minute lesson.
                </h2>
                <p className="mt-4 text-white/80 max-w-xl mx-auto">
                  Sign up free, take your first course tonight, walk into tomorrow's call as a Certified Partner.
                </p>
                <div className="mt-8 flex flex-wrap gap-3 justify-center">
                  <Link to="/auth" className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-mint-gradient text-primary font-semibold shadow-mint hover:scale-[1.02] transition-smooth">
                    Create free account <ArrowRight className="size-4" />
                  </Link>
                  <a href="#courses" className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-white/10 border border-white/20 backdrop-blur-md text-white font-medium hover:bg-white/20 transition-smooth">
                    Browse courses
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
