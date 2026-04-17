import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import {
  ArrowLeft, ArrowRight, BookOpen, Clock, Star, Award, CheckCircle2,
  PlayCircle, FileText, MessageSquare, Trophy, Lock, Sparkles,
} from "lucide-react";
import { Nav } from "@/components/landing/Nav";
import { Footer } from "@/components/landing/Footer";
import { getCourse, COURSES, CATEGORY_LABEL, LEVEL_LABEL } from "@/lib/courses";

export const Route = createFileRoute("/learn-earn/$slug")({
  loader: ({ params }) => {
    const course = getCourse(params.slug);
    if (!course) throw notFound();
    return { course };
  },
  head: ({ loaderData }) => {
    const c = loaderData?.course;
    if (!c) return { meta: [{ title: "Course not found — LeadMines Academy" }] };
    return {
      meta: [
        { title: `${c.title} — LeadMines Academy` },
        { name: "description", content: c.tagline },
        { property: "og:title", content: `${c.title} — Free DSA certification` },
        { property: "og:description", content: c.tagline },
      ],
    };
  },
  notFoundComponent: () => (
    <div className="min-h-screen grid place-items-center bg-background text-foreground p-8">
      <div className="text-center">
        <h1 className="font-display text-2xl font-bold">Course not found</h1>
        <p className="text-muted-foreground mt-2">This course doesn't exist yet.</p>
        <Link to="/learn-earn" className="inline-flex items-center gap-2 mt-6 px-5 py-2.5 rounded-full bg-foreground text-background font-medium">
          <ArrowLeft className="size-4" /> Back to courses
        </Link>
      </div>
    </div>
  ),
  component: CourseDetail,
});

const TYPE_ICON = {
  video: PlayCircle,
  reading: FileText,
  script: MessageSquare,
  quiz: Trophy,
  certificate: Award,
} as const;

function CourseDetail() {
  const { course } = Route.useLoaderData();
  const related = COURSES.filter((c) => c.category === course.category && c.slug !== course.slug).slice(0, 3);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Nav />

      <main className="pt-24">
        {/* HERO */}
        <section className={`relative overflow-hidden bg-gradient-to-br ${course.hero_color}`}>
          <div className="max-w-7xl mx-auto px-5 lg:px-8 py-16 lg:py-20">
            <Link to="/learn-earn" className="inline-flex items-center gap-2 text-sm text-foreground/70 hover:text-foreground transition-smooth">
              <ArrowLeft className="size-4" /> All courses
            </Link>

            <div className="mt-6 grid lg:grid-cols-3 gap-10">
              <div className="lg:col-span-2">
                <div className="flex flex-wrap gap-2">
                  <span className="px-2.5 py-1 rounded-full bg-background/80 backdrop-blur text-[11px] font-semibold">
                    {CATEGORY_LABEL[course.category]}
                  </span>
                  <span className="px-2.5 py-1 rounded-full bg-background/80 backdrop-blur text-[11px] font-medium text-muted-foreground">
                    {LEVEL_LABEL[course.level]}
                  </span>
                  <span className="px-2.5 py-1 rounded-full bg-accent/20 text-accent-foreground text-[11px] font-semibold inline-flex items-center gap-1">
                    <Star className="size-3" /> +{course.reward_points} pts
                  </span>
                </div>
                <h1 className="mt-5 font-display text-3xl lg:text-5xl font-bold tracking-tight">{course.title}</h1>
                <p className="mt-4 text-lg text-foreground/75 max-w-2xl">{course.tagline}</p>

                <div className="mt-6 flex flex-wrap items-center gap-5 text-sm text-foreground/70">
                  <span className="inline-flex items-center gap-1.5"><Clock className="size-4" /> {course.duration_min} min total</span>
                  <span className="inline-flex items-center gap-1.5"><BookOpen className="size-4" /> {course.lessons} lessons</span>
                  <span className="inline-flex items-center gap-1.5"><Award className="size-4" /> {course.badge}</span>
                </div>

                <div className="mt-8 flex flex-wrap gap-3">
                  <Link to="/auth" className="inline-flex items-center gap-2 px-5 py-3 rounded-full bg-foreground text-background font-semibold shadow-card hover:scale-[1.02] transition-smooth">
                    Sign in to start <ArrowRight className="size-4" />
                  </Link>
                  <Link to="/auth" className="inline-flex items-center gap-2 px-5 py-3 rounded-full bg-card border border-border font-medium hover:border-foreground/30 transition-smooth">
                    Create free account
                  </Link>
                </div>
              </div>

              {/* Unlock card */}
              <aside className="rounded-3xl bg-card border border-border p-6 shadow-elevated h-fit">
                <div className="flex items-center gap-2 text-accent">
                  <Sparkles className="size-4" />
                  <div className="text-xs font-semibold uppercase tracking-wider">On completion</div>
                </div>
                <div className="mt-3 font-display text-xl font-bold">{course.unlock}</div>
                <div className="mt-5 space-y-3">
                  <div className="flex items-center gap-2.5 text-sm">
                    <CheckCircle2 className="size-4 text-accent shrink-0" />
                    <span>Verifiable badge on your profile</span>
                  </div>
                  <div className="flex items-center gap-2.5 text-sm">
                    <CheckCircle2 className="size-4 text-accent shrink-0" />
                    <span>+{course.reward_points} reputation points</span>
                  </div>
                  <div className="flex items-center gap-2.5 text-sm">
                    <CheckCircle2 className="size-4 text-accent shrink-0" />
                    <span>Auto-shareable on WhatsApp & LinkedIn</span>
                  </div>
                </div>
              </aside>
            </div>
          </div>
        </section>

        {/* OUTCOMES */}
        <section className="py-16">
          <div className="max-w-7xl mx-auto px-5 lg:px-8">
            <div className="text-xs uppercase tracking-[0.18em] text-accent font-semibold">What you'll be able to do</div>
            <h2 className="mt-3 font-display text-2xl lg:text-3xl font-bold">By the end of this course</h2>
            <div className="mt-8 grid md:grid-cols-3 gap-5">
              {course.outcomes.map((o) => (
                <div key={o} className="rounded-2xl bg-card border border-border p-5 shadow-card">
                  <CheckCircle2 className="size-5 text-accent" />
                  <p className="text-sm text-foreground mt-3 leading-relaxed">{o}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CURRICULUM */}
        <section className="py-16 bg-secondary/40">
          <div className="max-w-4xl mx-auto px-5 lg:px-8">
            <div className="text-xs uppercase tracking-[0.18em] text-accent font-semibold">Curriculum</div>
            <h2 className="mt-3 font-display text-2xl lg:text-3xl font-bold">{course.modules.length} modules · {course.duration_min} min</h2>

            <div className="mt-8 space-y-3">
              {course.modules.map((m, i) => {
                const Icon = TYPE_ICON[m.type];
                const isLocked = i > 0;
                return (
                  <div key={m.key} className="rounded-2xl bg-card border border-border p-5 shadow-card flex items-start gap-4">
                    <div className="size-11 rounded-xl bg-accent/15 grid place-items-center shrink-0">
                      <Icon className="size-5 text-accent" strokeWidth={2.5} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-display font-bold">{m.title}</h3>
                        <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-semibold">
                          {m.type}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1.5">{m.summary}</p>
                      <div className="text-xs text-muted-foreground mt-2 inline-flex items-center gap-1.5">
                        <Clock className="size-3" /> {m.duration_min} min
                      </div>
                    </div>
                    {isLocked && (
                      <div className="text-muted-foreground" title="Sign in to unlock">
                        <Lock className="size-4" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="mt-10 rounded-3xl bg-mint-gradient text-primary p-8 text-center shadow-mint">
              <Award className="size-8 mx-auto" strokeWidth={2.5} />
              <h3 className="font-display text-xl font-bold mt-3">Pass the quiz with ≥ 70% to earn</h3>
              <div className="font-display text-3xl font-bold mt-1">{course.badge}</div>
              <Link to="/auth" className="inline-flex items-center gap-2 mt-5 px-5 py-2.5 rounded-full bg-primary text-primary-foreground font-semibold hover:scale-[1.02] transition-smooth">
                Start the course <ArrowRight className="size-4" />
              </Link>
            </div>
          </div>
        </section>

        {/* RELATED */}
        {related.length > 0 && (
          <section className="py-16">
            <div className="max-w-7xl mx-auto px-5 lg:px-8">
              <h2 className="font-display text-2xl font-bold">More in {CATEGORY_LABEL[course.category]}</h2>
              <div className="mt-6 grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {related.map((c) => (
                  <Link
                    key={c.slug}
                    to="/learn-earn/$slug"
                    params={{ slug: c.slug }}
                    className="group rounded-2xl bg-card border border-border p-5 shadow-card hover:shadow-elevated hover:-translate-y-0.5 transition-smooth"
                  >
                    <div className="text-[11px] uppercase tracking-wider text-accent font-semibold">{LEVEL_LABEL[c.level]}</div>
                    <h3 className="font-display font-bold mt-1">{c.title}</h3>
                    <p className="text-sm text-muted-foreground mt-1.5 line-clamp-2">{c.tagline}</p>
                    <div className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-accent group-hover:gap-2.5 transition-smooth">
                      View course <ArrowRight className="size-4" />
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}
      </main>

      <Footer />
    </div>
  );
}
