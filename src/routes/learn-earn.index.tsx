import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  GraduationCap, Trophy, Sparkles, ArrowRight, CheckCircle2, Award, Zap,
  TrendingUp, ShieldCheck, Crown, Star, Clock, BookOpen, Filter,
} from "lucide-react";
import { Nav } from "@/components/landing/Nav";
import { Footer } from "@/components/landing/Footer";
import { COURSES, CATEGORY_LABEL, LEVEL_LABEL, type CourseCategory, type CourseLevel } from "@/lib/courses";

export const Route = createFileRoute("/learn-earn/")({
  head: () => ({
    meta: [
      { title: "Learn & Earn — Free DSA certification | RupeeDial Academy" },
      { name: "description", content: "Free DSA certification across Personal Loan, Business Loan, Home Loan, Insurance & Credit Cards. Read the lessons, pass the quiz, download your certificate." },
      { property: "og:title", content: "RupeeDial Academy — Learn → Get Certified → Sell Better" },
      { property: "og:description", content: "Free loan and insurance distribution courses with quizzes, badges and downloadable certificates." },
    ],
  }),
  component: LearnEarnLanding,
});

const HOW_STEPS = [
  { icon: BookOpen, title: "Learn", body: "Short modules on eligibility, documents, pitch scripts and objection handling." },
  { icon: Award, title: "Get certified", body: "Pass a 10-question quiz with 70% or more and download your certificate." },
  { icon: TrendingUp, title: "Sell better", body: "Use the scripts and checklists on your next call to move more files to disbursal." },
];

const BENEFITS = [
  { icon: ShieldCheck, title: "Fewer rejections", body: "Know lender rules and document checklists before you log a file." },
  { icon: Zap, title: "Ready scripts", body: "Openers, objection handlers and follow-ups you can use right away." },
  { icon: Crown, title: "Badges & points", body: "Every passed quiz adds a badge and points to your RupeeDial profile." },
  { icon: Trophy, title: "PDF certificate", body: "A numbered certificate you can download and share with customers." },
];

const LEVELS = [
  { name: "Starter", points: "0+" },
  { name: "Bronze", points: "300+" },
  { name: "Silver", points: "800+" },
  { name: "Gold", points: "1,400+" },
  { name: "Platinum", points: "2,110+" },
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
                RupeeDial Academy · Free for partners
              </div>
              <h1 className="mt-6 font-display text-4xl sm:text-5xl lg:text-6xl font-bold text-white tracking-tight animate-fade-up">
                Learn → Get Certified → <span className="text-gradient">Sell Better</span>
              </h1>
              <p className="mt-5 text-lg text-white/80 max-w-2xl animate-fade-up">
                Free training for loan, insurance and card distributors. Read short courses, pass the quiz, and download a certificate with your name on it.
              </p>
              <div className="mt-8 flex flex-wrap gap-3 animate-fade-up">
                <a href="#courses" className="inline-flex items-center gap-2 px-5 py-3 rounded-full bg-mint-gradient text-primary font-semibold shadow-mint hover:scale-[1.02] transition-smooth">
                  Start learning <ArrowRight className="size-4" />
                </a>
                <Link to="/become-partner" className="inline-flex items-center gap-2 px-5 py-3 rounded-full bg-white/10 border border-white/20 backdrop-blur-md text-white font-medium hover:bg-white/20 transition-smooth">
                  Become a partner
                </Link>
              </div>

              <div className="mt-12 grid grid-cols-3 gap-4 max-w-xl">
                {[
                  { k: String(COURSES.length), v: "Live courses" },
                  { k: "70%", v: "Pass mark" },
                  { k: "₹0", v: "Course fee" },
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
                <h2 className="mt-3 font-display text-3xl lg:text-4xl font-bold">Three steps to certified</h2>
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
                <h2 className="mt-3 font-display text-3xl lg:text-4xl font-bold">Better files, faster disbursals.</h2>
                <p className="mt-4 text-muted-foreground">
                  Commission comes from disbursed cases. The academy helps you get there — right customer, right lender, complete documents, first time.
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

        {/* LEVELS */}
        <section className="py-20 lg:py-24 bg-secondary/40">
          <div className="max-w-7xl mx-auto px-5 lg:px-8">
            <div className="text-center max-w-2xl mx-auto">
              <div className="text-xs uppercase tracking-[0.18em] text-accent font-semibold">Levels</div>
              <h2 className="mt-3 font-display text-3xl lg:text-4xl font-bold">Points add up as you certify.</h2>
              <p className="mt-3 text-muted-foreground">Each course quiz you pass adds its points once. Your level shows on your Rewards page inside the CRM.</p>
            </div>
            <div className="mt-10 grid grid-cols-2 sm:grid-cols-5 gap-4">
              {LEVELS.map((l, i) => (
                <div key={l.name} className="rounded-3xl bg-card border border-border p-6 text-center shadow-card">
                  <Trophy className={`size-6 mx-auto ${i === LEVELS.length - 1 ? "text-amber-500" : "text-accent"}`} />
                  <div className="mt-3 font-display text-lg font-bold">{l.name}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{l.points} pts</div>
                </div>
              ))}
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
                  <CheckCircle2 className="size-3.5 text-accent" /> Free for RupeeDial partners
                </div>
                <h2 className="mt-5 font-display text-3xl lg:text-5xl font-bold text-white">
                  Your next disbursal starts with a short lesson.
                </h2>
                <p className="mt-4 text-white/80 max-w-xl mx-auto">
                  Join as a partner, take your first course tonight, and walk into tomorrow's call as a Certified Partner.
                </p>
                <div className="mt-8 flex flex-wrap gap-3 justify-center">
                  <Link to="/become-partner" className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-mint-gradient text-primary font-semibold shadow-mint hover:scale-[1.02] transition-smooth">
                    Become a partner <ArrowRight className="size-4" />
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
