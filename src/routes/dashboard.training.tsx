import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import { GraduationCap, Loader2, Play, Clock, CheckCircle2, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/dashboard/training")({
  head: () => ({ meta: [{ title: "Training — LeadMines" }] }),
  component: Training,
});

type Course = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  category: string;
  thumbnail_url: string | null;
  video_url: string | null;
  duration_minutes: number;
  difficulty: string;
  modules: { title: string; duration: number }[];
};

type Progress = { course_id: string; progress_percent: number; completed_at: string | null };

function Training() {
  const { user } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [progress, setProgress] = useState<Record<string, Progress>>({});
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<Course | null>(null);

  const load = async () => {
    setLoading(true);
    const [coursesRes, progressRes] = await Promise.all([
      supabase.from("training_courses").select("*").eq("enabled", true).order("display_order"),
      user ? supabase.from("training_progress").select("course_id,progress_percent,completed_at").eq("user_id", user.id) : Promise.resolve({ data: [] }),
    ]);
    setCourses((coursesRes.data ?? []) as unknown as Course[]);
    const map: Record<string, Progress> = {};
    (progressRes.data ?? []).forEach((p) => { map[p.course_id] = p as Progress; });
    setProgress(map);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [user]);

  const updateProgress = async (course: Course, percent: number) => {
    if (!user) return;
    const completed = percent >= 100 ? new Date().toISOString() : null;
    const { error } = await supabase.from("training_progress").upsert({
      user_id: user.id,
      course_id: course.id,
      progress_percent: percent,
      completed_at: completed,
      last_watched_at: new Date().toISOString(),
    }, { onConflict: "user_id,course_id" });
    if (error) { toast.error(error.message); return; }
    setProgress((p) => ({ ...p, [course.id]: { course_id: course.id, progress_percent: percent, completed_at: completed } }));
    if (percent >= 100) toast.success("🎉 Course completed!");
  };

  if (loading) return <div className="grid place-items-center py-20"><Loader2 className="size-6 animate-spin text-accent" /></div>;

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="font-display text-2xl lg:text-3xl font-bold">Training Academy</h1>
        <p className="text-muted-foreground mt-1">Short, practical courses — built by top DSAs to grow your business faster.</p>
      </div>

      {courses.length === 0 ? (
        <div className="rounded-3xl bg-card border border-dashed border-border p-12 text-center">
          <div className="size-14 mx-auto rounded-2xl bg-accent/15 grid place-items-center"><GraduationCap className="size-6 text-accent" /></div>
          <h2 className="font-display text-xl font-bold mt-4">No courses yet</h2>
          <p className="text-muted-foreground mt-2">Check back soon for new content.</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {courses.map((c) => {
            const p = progress[c.id]?.progress_percent ?? 0;
            const done = p >= 100;
            return (
              <div key={c.id} className="rounded-2xl bg-card border border-border overflow-hidden shadow-card hover:shadow-mint transition-smooth flex flex-col">
                <div className="relative aspect-video bg-secondary">
                  {c.thumbnail_url && <img src={c.thumbnail_url} alt={c.title} loading="lazy" className="w-full h-full object-cover" />}
                  <button onClick={() => setActive(c)} className="absolute inset-0 grid place-items-center bg-black/30 hover:bg-black/50 transition-smooth">
                    <div className="size-14 rounded-full bg-accent grid place-items-center shadow-lg"><Play className="size-6 text-accent-foreground ml-1" /></div>
                  </button>
                  {done && (
                    <div className="absolute top-2 right-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500 text-white text-[10px] font-bold uppercase">
                      <CheckCircle2 className="size-3" /> Done
                    </div>
                  )}
                </div>
                <div className="p-5 flex flex-col gap-3 flex-1">
                  <div>
                    <div className="flex items-center gap-2 text-[10px] uppercase font-bold text-muted-foreground tracking-wide">
                      <span className="px-1.5 py-0.5 rounded bg-secondary">{c.difficulty}</span>
                      <span className="inline-flex items-center gap-1"><Clock className="size-3" />{c.duration_minutes}m</span>
                    </div>
                    <h3 className="font-display font-bold text-lg mt-2 leading-tight">{c.title}</h3>
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{c.description}</p>
                  </div>
                  <div className="mt-auto">
                    <div className="h-1.5 w-full rounded-full bg-secondary overflow-hidden">
                      <div className="h-full bg-accent transition-all" style={{ width: `${p}%` }} />
                    </div>
                    <div className="flex items-center justify-between mt-2 text-xs">
                      <span className="text-muted-foreground">{p}% complete</span>
                      <button onClick={() => setActive(c)} className="font-bold text-accent hover:underline inline-flex items-center gap-1">
                        {p > 0 ? "Continue" : "Start"} <ArrowRight className="size-3" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {active && (
        <CourseModal course={active} progress={progress[active.id]?.progress_percent ?? 0} onClose={() => setActive(null)} onUpdate={(p) => updateProgress(active, p)} />
      )}
    </div>
  );
}

function CourseModal({ course, progress, onClose, onUpdate }: { course: Course; progress: number; onClose: () => void; onUpdate: (p: number) => void }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm grid place-items-center p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-card rounded-3xl border border-border shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="aspect-video bg-black">
          {course.video_url ? (
            <iframe src={course.video_url} title={course.title} allow="autoplay; encrypted-media" className="w-full h-full" />
          ) : (
            <div className="grid place-items-center h-full text-muted-foreground">No video available</div>
          )}
        </div>
        <div className="p-6 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-display text-2xl font-bold">{course.title}</h2>
              <p className="text-muted-foreground mt-1">{course.description}</p>
            </div>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-2xl leading-none">×</button>
          </div>
          <div>
            <div className="text-xs uppercase font-bold text-muted-foreground tracking-wide mb-2">Modules</div>
            <ul className="space-y-1.5">
              {course.modules.map((m, i) => (
                <li key={i} className="flex items-center justify-between px-3 py-2 rounded-lg bg-secondary/50 text-sm">
                  <span><span className="font-semibold mr-2">{i + 1}.</span>{m.title}</span>
                  <span className="text-xs text-muted-foreground">{m.duration} min</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="pt-3 border-t border-border space-y-2">
            <div className="flex items-center justify-between text-sm"><span>Your progress</span><span className="font-bold">{progress}%</span></div>
            <div className="h-2 w-full rounded-full bg-secondary overflow-hidden"><div className="h-full bg-accent transition-all" style={{ width: `${progress}%` }} /></div>
            <div className="flex gap-2 flex-wrap pt-2">
              {[25, 50, 75, 100].map((p) => (
                <button key={p} onClick={() => onUpdate(p)} className={`text-xs font-bold px-3 py-1.5 rounded-full ${progress >= p ? "bg-emerald-500 text-white" : "bg-secondary hover:bg-accent hover:text-accent-foreground"}`}>
                  Mark {p}%
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
