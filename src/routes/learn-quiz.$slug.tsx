import { createFileRoute, Link, useNavigate, redirect } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft, ArrowRight, CheckCircle2, XCircle, Trophy, Award,
  RotateCcw, Loader2, Sparkles, Download,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { getCourse } from "@/lib/courses";
import { generateCertificatePdf } from "@/lib/certificate-pdf";
import { toast } from "sonner";

export const Route = createFileRoute("/learn-quiz/$slug")({
  beforeLoad: async ({ params }) => {
    const course = getCourse(params.slug);
    if (!course) throw redirect({ to: "/learn-earn" });
  },
  head: ({ params }) => {
    const c = getCourse(params.slug);
    return { meta: [{ title: c ? `Quiz: ${c.title} — LeadMines` : "Quiz — LeadMines" }] };
  },
  component: QuizRunner,
});

type Question = {
  id: string;
  question: string;
  options: string[];
  display_order: number;
  // correct_index & explanation are server-truth; revealed only after submit.
};

type SubmitResult = {
  success: boolean;
  passed: boolean;
  score_percent: number;
  correct: number;
  total: number;
  points_awarded: number;
  certificate_id: string | null;
};

function QuizRunner() {
  const { slug } = Route.useParams();
  const course = getCourse(slug)!;
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [current, setCurrent] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [reviewQuestions, setReviewQuestions] = useState<
    Array<Question & { correct_index: number; explanation: string | null }>
  >([]);
  const [profileName, setProfileName] = useState<string>("");

  // Auth guard
  useEffect(() => {
    if (!authLoading && !user) {
      navigate({ to: "/auth", search: { next: `/learn-quiz/${slug}` } as never });
    }
  }, [authLoading, user, navigate, slug]);

  // Load questions
  useEffect(() => {
    if (!user) return;
    let active = true;
    (async () => {
      setLoading(true);
      const { data: quiz } = await supabase
        .from("course_quizzes")
        .select("id")
        .eq("course_slug", slug)
        .eq("enabled", true)
        .maybeSingle();
      if (!quiz) {
        if (active) {
          toast.error("Quiz not available yet for this course");
          setLoading(false);
        }
        return;
      }
      const { data: qs } = await supabase
        .from("quiz_questions")
        .select("id, question, options, display_order")
        .eq("quiz_id", quiz.id)
        .order("display_order", { ascending: true });
      if (active) {
        setQuestions(
          (qs ?? []).map((q) => ({
            id: q.id as string,
            question: q.question as string,
            options: q.options as string[],
            display_order: q.display_order as number,
          })),
        );
        const { data: prof } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", user.id)
          .maybeSingle();
        setProfileName((prof?.full_name as string) ?? user.email ?? "");
        setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [slug, user]);

  const totalQ = questions.length;
  const answeredCount = Object.keys(answers).length;
  const allAnswered = answeredCount === totalQ && totalQ > 0;
  const progressPct = totalQ ? Math.round((answeredCount / totalQ) * 100) : 0;

  const onSelect = (qIdx: number, optionIdx: number) => {
    setAnswers((a) => ({ ...a, [qIdx]: optionIdx }));
  };

  const handleSubmit = async () => {
    if (!allAnswered) {
      toast.error(`Answer all ${totalQ} questions before submitting`);
      return;
    }
    setSubmitting(true);
    const ordered = questions.map((_, i) => answers[i]);
    const { data, error } = await supabase.rpc("submit_quiz", {
      _course_slug: slug,
      _answers: ordered as unknown as never,
    });
    if (error) {
      toast.error(error.message);
      setSubmitting(false);
      return;
    }
    const r = data as unknown as SubmitResult;
    setResult(r);

    // Fetch correct answers for review
    if (questions.length > 0) {
      const { data: full } = await supabase
        .from("quiz_questions")
        .select("id, question, options, display_order, correct_index, explanation")
        .eq("quiz_id", (await supabase.from("course_quizzes").select("id").eq("course_slug", slug).maybeSingle()).data?.id ?? "")
        .order("display_order", { ascending: true });
      setReviewQuestions(
        (full ?? []).map((q) => ({
          id: q.id as string,
          question: q.question as string,
          options: q.options as string[],
          display_order: q.display_order as number,
          correct_index: q.correct_index as number,
          explanation: q.explanation as string | null,
        })),
      );
    }

    if (r.passed) {
      toast.success(`🎉 Passed with ${r.score_percent}%! +${r.points_awarded} points`);
      // Auto-generate PDF
      if (r.certificate_id) {
        const { data: cert } = await supabase
          .from("certificates")
          .select("certificate_no, issued_at, badge")
          .eq("id", r.certificate_id)
          .maybeSingle();
        if (cert) {
          generateCertificatePdf({
            fullName: profileName || "Verified Partner",
            courseTitle: course.title,
            badge: (cert.badge as string | null) ?? course.badge,
            scorePercent: r.score_percent,
            certificateNo: cert.certificate_no as string,
            issuedAt: cert.issued_at as string,
          });
        }
      }
    } else {
      toast.error(`Scored ${r.score_percent}%. You need ${70}% to pass — try again.`);
    }
    setSubmitting(false);
  };

  const handleRetry = () => {
    setAnswers({});
    setCurrent(0);
    setResult(null);
    setReviewQuestions([]);
  };

  const handleDownloadAgain = async () => {
    if (!result?.certificate_id) return;
    const { data: cert } = await supabase
      .from("certificates")
      .select("certificate_no, issued_at, badge, score_percent, course_title")
      .eq("id", result.certificate_id)
      .maybeSingle();
    if (cert) {
      generateCertificatePdf({
        fullName: profileName || "Verified Partner",
        courseTitle: (cert.course_title as string) ?? course.title,
        badge: (cert.badge as string | null) ?? course.badge,
        scorePercent: (cert.score_percent as number) ?? result.score_percent,
        certificateNo: cert.certificate_no as string,
        issuedAt: cert.issued_at as string,
      });
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen grid place-items-center bg-background">
        <Loader2 className="size-8 animate-spin text-accent" />
      </div>
    );
  }

  if (totalQ === 0) {
    return (
      <div className="min-h-screen grid place-items-center bg-background p-8 text-center">
        <div>
          <h1 className="font-display text-2xl font-bold">Quiz coming soon</h1>
          <p className="text-muted-foreground mt-2">Questions for this course are being prepared.</p>
          <Link to="/dashboard/learn" className="inline-flex items-center gap-2 mt-6 px-5 py-2.5 rounded-full bg-foreground text-background font-medium">
            <ArrowLeft className="size-4" /> Back to academy
          </Link>
        </div>
      </div>
    );
  }

  // Result screen
  if (result) {
    return (
      <div className="min-h-screen bg-background text-foreground py-10 px-5">
        <div className="max-w-3xl mx-auto">
          <Link to="/dashboard/learn" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-smooth">
            <ArrowLeft className="size-4" /> Back to academy
          </Link>

          {/* Hero result */}
          <div
            className={`mt-6 rounded-3xl p-8 lg:p-10 text-center shadow-elevated ${
              result.passed
                ? "bg-gradient-to-br from-emerald-500/15 via-emerald-500/5 to-background border border-emerald-500/30"
                : "bg-gradient-to-br from-amber-500/15 via-amber-500/5 to-background border border-amber-500/30"
            }`}
          >
            {result.passed ? (
              <Trophy className="size-14 mx-auto text-accent" strokeWidth={2.5} />
            ) : (
              <RotateCcw className="size-14 mx-auto text-amber-600 dark:text-amber-400" strokeWidth={2.5} />
            )}
            <h1 className="mt-4 font-display text-3xl lg:text-4xl font-bold">
              {result.passed ? "🎉 Certified!" : "Almost there"}
            </h1>
            <p className="mt-2 text-muted-foreground">
              {result.passed
                ? `You scored ${result.score_percent}% on ${course.title}.`
                : `You scored ${result.score_percent}%. You need 70% to earn the badge.`}
            </p>

            <div className="mt-6 grid grid-cols-3 gap-3 max-w-md mx-auto">
              <Stat label="Score" value={`${result.score_percent}%`} />
              <Stat label="Correct" value={`${result.correct}/${result.total}`} />
              <Stat label="Points" value={`+${result.points_awarded}`} />
            </div>

            {result.passed ? (
              <div className="mt-7 flex flex-wrap gap-3 justify-center">
                <button
                  onClick={handleDownloadAgain}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-foreground text-background font-semibold hover:scale-[1.02] transition-smooth"
                >
                  <Download className="size-4" /> Download certificate
                </button>
                <Link
                  to="/dashboard/certificates"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-card border border-border font-medium hover:border-foreground/30 transition-smooth"
                >
                  <Award className="size-4" /> My certificates
                </Link>
              </div>
            ) : (
              <div className="mt-7 flex flex-wrap gap-3 justify-center">
                <button
                  onClick={handleRetry}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-foreground text-background font-semibold hover:scale-[1.02] transition-smooth"
                >
                  <RotateCcw className="size-4" /> Retry quiz
                </button>
                <Link to={`/learn-earn/${slug}`} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-card border border-border font-medium">
                  Review course
                </Link>
              </div>
            )}
          </div>

          {/* Review */}
          <div className="mt-8">
            <h2 className="font-display text-xl font-bold">Review answers</h2>
            <div className="mt-4 space-y-3">
              {reviewQuestions.map((q, i) => {
                const userAns = answers[i];
                const correct = userAns === q.correct_index;
                return (
                  <div key={q.id} className="rounded-2xl bg-card border border-border p-5">
                    <div className="flex items-start gap-3">
                      {correct ? (
                        <CheckCircle2 className="size-5 text-emerald-500 shrink-0 mt-0.5" />
                      ) : (
                        <XCircle className="size-5 text-rose-500 shrink-0 mt-0.5" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                          Question {i + 1}
                        </div>
                        <h3 className="font-medium mt-1">{q.question}</h3>
                        <div className="mt-3 space-y-1.5">
                          {q.options.map((opt, oi) => {
                            const isCorrect = oi === q.correct_index;
                            const isUser = oi === userAns;
                            return (
                              <div
                                key={oi}
                                className={`text-sm px-3 py-2 rounded-lg border ${
                                  isCorrect
                                    ? "bg-emerald-500/10 border-emerald-500/40 text-foreground font-medium"
                                    : isUser
                                    ? "bg-rose-500/10 border-rose-500/40 text-foreground"
                                    : "bg-muted/30 border-transparent text-muted-foreground"
                                }`}
                              >
                                {opt}
                                {isCorrect && <span className="ml-2 text-[10px] font-bold uppercase text-emerald-600">Correct</span>}
                                {isUser && !isCorrect && <span className="ml-2 text-[10px] font-bold uppercase text-rose-600">Your answer</span>}
                              </div>
                            );
                          })}
                        </div>
                        {q.explanation && (
                          <div className="mt-3 text-xs text-muted-foreground bg-muted/30 rounded-lg p-3">
                            <span className="font-semibold text-foreground">Why: </span>
                            {q.explanation}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Quiz screen
  const q = questions[current];
  const selected = answers[current];

  return (
    <div className="min-h-screen bg-background text-foreground py-10 px-5">
      <div className="max-w-3xl mx-auto">
        <Link to={`/learn-earn/${slug}`} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-smooth">
          <ArrowLeft className="size-4" /> {course.title}
        </Link>

        {/* Header */}
        <div className="mt-6 rounded-3xl bg-gradient-to-br from-accent/15 via-accent/5 to-background border border-border p-6 lg:p-8">
          <div className="flex items-center gap-2 text-accent">
            <Sparkles className="size-4" />
            <span className="text-xs font-semibold uppercase tracking-wider">Final quiz</span>
          </div>
          <h1 className="mt-2 font-display text-2xl lg:text-3xl font-bold">{course.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {totalQ} questions · Pass with ≥ 70% · Earn the {course.badge} badge
          </p>

          <div className="mt-5">
            <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
              <span>Progress</span>
              <span>
                {answeredCount} of {totalQ} answered
              </span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div className="h-full bg-mint-gradient transition-all" style={{ width: `${progressPct}%` }} />
            </div>
          </div>
        </div>

        {/* Question card */}
        <div className="mt-6 rounded-3xl bg-card border border-border p-6 lg:p-8 shadow-card">
          <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
            Question {current + 1} of {totalQ}
          </div>
          <h2 className="mt-2 font-display text-xl lg:text-2xl font-bold">{q.question}</h2>

          <div className="mt-6 space-y-2.5">
            {q.options.map((opt, oi) => {
              const isSelected = selected === oi;
              return (
                <button
                  key={oi}
                  onClick={() => onSelect(current, oi)}
                  className={`w-full text-left px-4 py-3.5 rounded-xl border transition-smooth flex items-center gap-3 ${
                    isSelected
                      ? "bg-accent/15 border-accent text-foreground"
                      : "bg-background border-border hover:border-foreground/30"
                  }`}
                >
                  <div
                    className={`size-6 rounded-full border-2 grid place-items-center text-xs font-bold shrink-0 ${
                      isSelected ? "border-accent bg-accent text-accent-foreground" : "border-muted-foreground/30 text-muted-foreground"
                    }`}
                  >
                    {String.fromCharCode(65 + oi)}
                  </div>
                  <span className="text-sm font-medium">{opt}</span>
                </button>
              );
            })}
          </div>

          {/* Nav */}
          <div className="mt-7 flex items-center justify-between gap-3">
            <button
              onClick={() => setCurrent((c) => Math.max(0, c - 1))}
              disabled={current === 0}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-border text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:border-foreground/30 transition-smooth"
            >
              <ArrowLeft className="size-4" /> Previous
            </button>

            {current < totalQ - 1 ? (
              <button
                onClick={() => setCurrent((c) => Math.min(totalQ - 1, c + 1))}
                className="inline-flex items-center gap-1.5 px-5 py-2 rounded-full bg-foreground text-background text-sm font-semibold hover:scale-[1.02] transition-smooth"
              >
                Next <ArrowRight className="size-4" />
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={!allAnswered || submitting}
                className="inline-flex items-center gap-1.5 px-5 py-2 rounded-full bg-mint-gradient text-primary text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.02] transition-smooth shadow-mint"
              >
                {submitting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" /> Submitting…
                  </>
                ) : (
                  <>
                    <Trophy className="size-4" /> Submit quiz
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Question navigator */}
        <div className="mt-6 flex flex-wrap gap-1.5 justify-center">
          {questions.map((_, i) => {
            const answered = answers[i] !== undefined;
            const active = i === current;
            return (
              <button
                key={i}
                onClick={() => setCurrent(i)}
                className={`size-9 rounded-lg text-xs font-bold transition-smooth ${
                  active
                    ? "bg-foreground text-background"
                    : answered
                    ? "bg-accent/20 text-accent-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/70"
                }`}
              >
                {i + 1}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-background border border-border p-4">
      <div className="font-display text-2xl font-bold">{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mt-0.5">{label}</div>
    </div>
  );
}
