import { Link } from "@tanstack/react-router";
import {
  ArrowLeft, ArrowRight, BookOpen, Clock, Award, CheckCircle2, PlayCircle, FileText, MessageSquare, Trophy,
} from "lucide-react";
import { COURSES, CATEGORY_LABEL, LEVEL_LABEL, type Course } from "@/lib/courses";

const TYPE_ICON = {
  video: PlayCircle,
  reading: FileText,
  script: MessageSquare,
  quiz: Trophy,
  certificate: Award,
} as const;

export function CourseReader({ course }: { course: Course }) {
  const related = COURSES.filter((item) => item.category === course.category && item.slug !== course.slug).slice(0, 3);

  return (
    <div className="space-y-8">
      <Link to="/dashboard/learn" className="inline-flex items-center gap-2 text-sm font-semibold text-[#10662A]">
        <ArrowLeft className="size-4" /> All courses
      </Link>

      <section className="grid gap-6 lg:grid-cols-[1.4fr_0.8fr]">
        <div className="rounded-3xl border border-[#d8ecdd] bg-white p-6 shadow-[0_12px_32px_rgba(16,102,42,0.05)] md:p-8">
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full bg-[#E8F7EC] px-2.5 py-1 text-[11px] font-semibold text-[#10662A]">{CATEGORY_LABEL[course.category]}</span>
            <span className="rounded-full bg-[#F4FBF6] px-2.5 py-1 text-[11px] font-semibold text-[#5c4d72]">{LEVEL_LABEL[course.level]}</span>
            <span className="rounded-full bg-[#F4F0FA] px-2.5 py-1 text-[11px] font-semibold text-[#390A5D]">+{course.reward_points} pts</span>
          </div>
          <h1 className="mt-4 font-display text-3xl font-bold text-[#390A5D]">{course.title}</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[#5c4d72]">{course.tagline}</p>
          <div className="mt-5 flex flex-wrap gap-4 text-sm text-[#5c4d72]">
            <span className="inline-flex items-center gap-1.5"><Clock className="size-4 text-[#10662A]" /> {course.duration_min} min</span>
            <span className="inline-flex items-center gap-1.5"><BookOpen className="size-4 text-[#10662A]" /> {course.lessons} lessons</span>
            <span className="inline-flex items-center gap-1.5"><Award className="size-4 text-[#10662A]" /> {course.badge}</span>
          </div>
          <Link to="/learn-quiz/$slug" params={{ slug: course.slug }} className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#10662A] px-5 py-2.5 text-sm font-semibold text-white">
            <Trophy className="size-4" /> Take the quiz
          </Link>
        </div>
        <aside className="rounded-3xl border border-[#d8ecdd] bg-[#F4FBF6] p-6">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#10662A]">On completion</p>
          <h2 className="mt-2 font-display text-xl font-bold text-[#390A5D]">{course.unlock}</h2>
          <ul className="mt-4 space-y-2 text-sm text-[#14281c]">
            {["Verifiable badge on your profile", `+${course.reward_points} reputation points`, "Certificate you can download"].map((line) => (
              <li key={line} className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-[#10662A]" /> {line}
              </li>
            ))}
          </ul>
        </aside>
      </section>

      <section>
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#10662A]">What you will be able to do</p>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          {course.outcomes.map((outcome) => (
            <article key={outcome} className="rounded-2xl border border-[#d8ecdd] bg-white p-4">
              <CheckCircle2 className="size-5 text-[#10662A]" />
              <p className="mt-2 text-sm leading-6 text-[#14281c]">{outcome}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-3xl border border-[#d8ecdd] bg-white p-6">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#10662A]">Lessons</p>
        <h2 className="mt-1 font-display text-2xl font-bold text-[#390A5D]">{course.modules.length} modules · {course.duration_min} min</h2>
        <ol className="mt-5 space-y-3">
          {course.modules.map((module, index) => {
            const Icon = TYPE_ICON[module.type];
            return (
              <li key={module.key} className="flex gap-3 rounded-2xl bg-[#F4FBF6] p-4">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white text-[#10662A]">
                  <Icon className="size-5" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-[#390A5D]">{index + 1}. {module.title}</p>
                  <p className="mt-1 text-sm leading-6 text-[#5c4d72]">{module.summary}</p>
                  <p className="mt-1 text-xs text-[#5c4d72]">{module.duration_min} min · {module.type}</p>
                </div>
              </li>
            );
          })}
        </ol>
      </section>

      {related.length > 0 && (
        <section>
          <h2 className="font-display text-xl font-bold text-[#390A5D]">More in {CATEGORY_LABEL[course.category]}</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((item) => (
              <Link key={item.slug} to="/dashboard/learn/$slug" params={{ slug: item.slug }} className="rounded-2xl border border-[#d8ecdd] bg-white p-4">
                <p className="text-[11px] font-bold uppercase tracking-wide text-[#10662A]">{LEVEL_LABEL[item.level]}</p>
                <h3 className="mt-1 font-semibold text-[#390A5D]">{item.title}</h3>
                <p className="mt-1 line-clamp-2 text-sm text-[#5c4d72]">{item.tagline}</p>
                <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-[#10662A]">Open lessons <ArrowRight className="size-4" /></span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
