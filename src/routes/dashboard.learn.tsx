import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Award, ArrowRight, Star, Clock, BookOpen, CheckCircle2, Crown, Download, Loader2 } from "lucide-react";
import { COURSES, CATEGORY_LABEL, LEVEL_LABEL } from "@/lib/courses";
import { useAuth } from "@/lib/auth-context";
import { listCertificates, type CrmCertificate } from "@/lib/python-api";
import { downloadCertificate } from "@/lib/certificate-pdf";
import { AskRupeeDial } from "@/components/dashboard/AskRupeeDial";

export const Route = createFileRoute("/dashboard/learn")({
  head: () => ({ meta: [{ title: "Learn & Earn — RupeeDial One" }] }),
  component: LearnDashboard,
});

const TOTAL_POINTS = COURSES.reduce((sum, c) => sum + c.reward_points, 0);

function LearnDashboard() {
  const { user } = useAuth();
  const firstName = user?.full_name?.split(" ")[0] || user?.email?.split("@")[0] || "Partner";
  const [certs, setCerts] = useState<CrmCertificate[]>([]);
  const [points, setPoints] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listCertificates()
      .then((data) => {
        setCerts(data.items);
        setPoints(data.total_points);
      })
      .catch((error: Error) => toast.error(error.message || "Could not load progress"))
      .finally(() => setLoading(false));
  }, []);

  const earned = useMemo(() => new Map(certs.map((c) => [c.course_slug, c])), [certs]);
  const nextCourse = COURSES.find((c) => !earned.has(c.slug));
  const progress = TOTAL_POINTS ? Math.round((points / TOTAL_POINTS) * 100) : 0;

  return (
    <div className="space-y-8">
      <div className="relative overflow-hidden rounded-2xl border border-[#d8ecdd] bg-white p-7 lg:p-9 shadow-[0_4px_24px_rgba(16,102,42,0.06)]">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: "radial-gradient(80% 60% at 100% 0%, rgba(232,247,236,0.95), transparent 55%)" }}
        />
        <div className="relative grid lg:grid-cols-3 gap-6 items-center">
          <div className="lg:col-span-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#E8F7EC] border border-[#d8ecdd] text-xs font-semibold text-[#10662A]">
              <Award className="size-3.5" /> RupeeDial Academy
            </div>
            <h1 className="mt-4 font-display text-2xl lg:text-3xl font-extrabold text-[#390A5D]">
              Welcome back, <span className="capitalize">{firstName}</span>.
            </h1>
            <p className="mt-2 text-[#5c4d72] text-sm max-w-xl">
              Read a course, pass its quiz with 70% or more, and get a downloadable certificate plus points.
            </p>
            <div className="mt-4 max-w-md">
              <div className="flex justify-between text-xs text-[#5c4d72] mb-1">
                <span>Academy progress</span>
                <span>
                  {certs.length} of {COURSES.length} courses
                </span>
              </div>
              <div className="h-2 rounded-full bg-[#E8F7EC] overflow-hidden">
                <div className="h-full bg-[#10662A] transition-all" style={{ width: `${progress}%` }} />
              </div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[
              { k: loading ? "…" : points.toLocaleString("en-IN"), v: "Points", icon: Star },
              { k: loading ? "…" : String(certs.length), v: "Certificates", icon: Award },
              { k: String(COURSES.length - certs.length), v: "To go", icon: Crown },
            ].map((s) => (
              <div key={s.v} className="rounded-2xl bg-[#E8F7EC]/80 border border-[#d8ecdd] p-3">
                <s.icon className="size-4 text-[#10662A]" />
                <div className="font-display text-xl font-bold mt-1.5 text-[#390A5D]">{s.k}</div>
                <div className="text-[10px] uppercase tracking-wider text-[#5c4d72] font-semibold">{s.v}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {nextCourse && (
        <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-gradient-to-br from-[#14803a] via-[#10662A] to-[#0B3F1A] p-6 text-white">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-white/70">Up next</div>
            <h2 className="mt-1 font-display text-xl font-bold">{nextCourse.title}</h2>
            <p className="mt-1 text-sm text-white/80">
              {nextCourse.lessons} lessons · {nextCourse.duration_min} min · +{nextCourse.reward_points} pts
            </p>
          </div>
          <div className="flex gap-2">
            <Link
              to="/learn-earn/$slug"
              params={{ slug: nextCourse.slug }}
              className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-sm font-semibold text-[#10662A]"
            >
              Start lessons <ArrowRight className="size-3.5" />
            </Link>
            <Link
              to="/learn-quiz/$slug"
              params={{ slug: nextCourse.slug }}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/40 px-4 py-2 text-sm font-semibold text-white"
            >
              Take quiz
            </Link>
          </div>
        </section>
      )}

      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-lg font-bold text-[#390A5D]">All courses</h2>
          <Link to="/dashboard/certificates" className="text-sm text-[#10662A] font-semibold inline-flex items-center gap-1">
            My certificates <ArrowRight className="size-3.5" />
          </Link>
        </div>
        {loading ? (
          <div className="grid place-items-center py-10">
            <Loader2 className="size-6 animate-spin text-[#10662A]" />
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {COURSES.map((c) => {
              const cert = earned.get(c.slug);
              return (
                <div key={c.slug} className="flex flex-col rounded-2xl border border-[#d8ecdd] bg-white p-5 shadow-[0_4px_16px_rgba(16,102,42,0.04)]">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wide text-[#5c4d72]">
                      {CATEGORY_LABEL[c.category]} · {LEVEL_LABEL[c.level]}
                    </span>
                    {cert && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-[#E8F7EC] px-2 py-0.5 text-[10px] font-bold text-[#10662A]">
                        <CheckCircle2 className="size-3" /> {cert.score_percent}%
                      </span>
                    )}
                  </div>
                  <h3 className="mt-3 font-semibold text-[#390A5D]">{c.title}</h3>
                  <p className="mt-1 text-xs text-[#5c4d72] line-clamp-2">{c.tagline}</p>
                  <div className="mt-3 flex items-center gap-3 text-xs text-[#5c4d72]">
                    <span className="inline-flex items-center gap-1"><Clock className="size-3.5" /> {c.duration_min}m</span>
                    <span className="inline-flex items-center gap-1"><BookOpen className="size-3.5" /> {c.lessons}</span>
                    <span className="font-semibold text-[#10662A]">+{c.reward_points} pts</span>
                  </div>
                  <div className="mt-auto flex gap-2 pt-4 text-xs font-semibold">
                    <Link to="/learn-earn/$slug" params={{ slug: c.slug }} className="rounded-lg border border-[#d8ecdd] px-3 py-1.5 text-[#390A5D]">
                      Lessons
                    </Link>
                    {cert ? (
                      <button
                        onClick={() => downloadCertificate(cert)}
                        className="inline-flex items-center gap-1 rounded-lg bg-[#E8F7EC] px-3 py-1.5 text-[#10662A]"
                      >
                        <Download className="size-3.5" /> Certificate
                      </button>
                    ) : (
                      <Link to="/learn-quiz/$slug" params={{ slug: c.slug }} className="rounded-lg bg-[#10662A] px-3 py-1.5 text-white">
                        Take quiz
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section>
        <h2 className="font-display text-lg font-bold text-[#390A5D] mb-3">Ask a question</h2>
        <AskRupeeDial />
      </section>
    </div>
  );
}
