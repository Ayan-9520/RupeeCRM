import { createFileRoute, Link } from "@tanstack/react-router";
import { GraduationCap, Clock, ArrowRight } from "lucide-react";
import { COURSES, CATEGORY_LABEL, LEVEL_LABEL } from "@/lib/courses";
import { CrmPageHub } from "@/components/dashboard/CrmPageHub";

export const Route = createFileRoute("/dashboard/training")({
  head: () => ({ meta: [{ title: "Training — RupeeDial One" }] }),
  component: Training,
});

function Training() {
  if (COURSES.length === 0) {
    return (
      <CrmPageHub
        title="Training Academy"
        description="No courses in the static catalog yet."
        links={[{ label: "Learn", to: "/dashboard/learn", desc: "Open the Learn & Earn academy" }]}
      />
    );
  }

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl lg:text-3xl font-bold text-[#390A5D]">Training Academy</h1>
          <p className="text-[#5c4d72] mt-1">Static course catalog — progress sync ships later.</p>
        </div>
        <Link to="/dashboard/learn" className="text-sm font-semibold text-[#10662A] hover:underline inline-flex items-center gap-1">
          Open Learn <ArrowRight className="size-3.5" />
        </Link>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {COURSES.map((c) => (
          <div key={c.slug} className="rounded-2xl border border-[#d8ecdd] bg-white p-5 shadow-[0_4px_16px_rgba(16,102,42,0.04)]">
            <div className="flex items-center gap-2 mb-3">
              <div className="size-9 rounded-xl bg-[#E8F7EC] grid place-items-center text-[#10662A]">
                <GraduationCap className="size-4" />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wide text-[#5c4d72]">
                {CATEGORY_LABEL[c.category]} · {LEVEL_LABEL[c.level]}
              </span>
            </div>
            <h2 className="font-semibold text-[#390A5D]">{c.title}</h2>
            <p className="text-xs text-[#5c4d72] mt-1 line-clamp-2">{c.tagline}</p>
            <div className="mt-3 flex items-center gap-1.5 text-xs text-[#5c4d72]">
              <Clock className="size-3.5" /> {c.duration_min} min · {c.lessons} lessons
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
