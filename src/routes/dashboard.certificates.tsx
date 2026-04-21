import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Award, Download, Star, Crown, Trophy, Loader2, GraduationCap, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { generateCertificatePdf } from "@/lib/certificate-pdf";

export const Route = createFileRoute("/dashboard/certificates")({
  head: () => ({ meta: [{ title: "My Certificates — LeadMines Academy" }] }),
  component: CertificatesPage,
});

type Cert = {
  id: string;
  certificate_no: string;
  course_slug: string;
  course_title: string;
  badge: string | null;
  score_percent: number;
  issued_at: string;
};

type Points = {
  total_points: number;
  level: string;
  badges: string[];
};

function CertificatesPage() {
  const { user } = useAuth();
  const [certs, setCerts] = useState<Cert[]>([]);
  const [points, setPoints] = useState<Points | null>(null);
  const [profileName, setProfileName] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    let active = true;
    (async () => {
      const [certsRes, pointsRes, profRes] = await Promise.all([
        supabase
          .from("certificates")
          .select("id, certificate_no, course_slug, course_title, badge, score_percent, issued_at")
          .eq("user_id", user.id)
          .order("issued_at", { ascending: false }),
        supabase
          .from("user_points")
          .select("total_points, level, badges")
          .eq("user_id", user.id)
          .maybeSingle(),
        supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
      ]);

      if (!active) return;
      setCerts((certsRes.data ?? []) as Cert[]);
      setPoints((pointsRes.data as Points | null) ?? { total_points: 0, level: "beginner", badges: [] });
      setProfileName((profRes.data?.full_name as string) ?? user.email ?? "");
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [user]);

  const handleDownload = (c: Cert) => {
    generateCertificatePdf({
      fullName: profileName || "Verified Partner",
      courseTitle: c.course_title,
      badge: c.badge,
      scorePercent: c.score_percent,
      certificateNo: c.certificate_no,
      issuedAt: c.issued_at,
    });
  };

  if (loading) {
    return (
      <div className="grid place-items-center py-20">
        <Loader2 className="size-8 animate-spin text-accent" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="rounded-3xl bg-hero-gradient p-7 lg:p-9 text-white relative overflow-hidden">
        <div className="absolute inset-0 grid-bg opacity-30" />
        <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-xs font-medium">
              <Award className="size-3.5 text-accent" /> {certs.length} certificate{certs.length === 1 ? "" : "s"} earned
            </div>
            <h1 className="mt-3 font-display text-2xl lg:text-3xl font-bold">My certificates & badges</h1>
            <p className="mt-2 text-white/80 text-sm max-w-xl">
              Every certificate boosts your DSA reputation and unlocks higher-quality leads.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Stat icon={Star} label="Points" value={points?.total_points ?? 0} />
            <Stat icon={Crown} label="Level" value={points?.level ?? "beginner"} capitalize />
            <Stat icon={Trophy} label="Badges" value={points?.badges.length ?? 0} />
          </div>
        </div>
      </div>

      {/* Empty state */}
      {certs.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border p-12 text-center">
          <GraduationCap className="size-12 mx-auto text-muted-foreground mb-4" />
          <h2 className="font-display text-xl font-bold">No certificates yet</h2>
          <p className="text-muted-foreground mt-2 max-w-md mx-auto">
            Complete a course quiz with ≥ 70% to earn your first certificate, badge and reputation points.
          </p>
          <Link
            to="/dashboard/learn"
            className="inline-flex items-center gap-2 mt-6 px-5 py-2.5 rounded-full bg-foreground text-background font-semibold hover:scale-[1.02] transition-smooth"
          >
            <Sparkles className="size-4" /> Start a course
          </Link>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-5">
          {certs.map((c) => (
            <div
              key={c.id}
              className="group rounded-3xl border border-border bg-card p-6 shadow-card hover:shadow-elevated transition-smooth"
            >
              <div className="flex items-start gap-4">
                <div className="size-14 rounded-2xl bg-mint-gradient grid place-items-center shrink-0 shadow-mint">
                  <Award className="size-7 text-primary" strokeWidth={2.5} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs uppercase tracking-wider text-accent font-semibold">
                    {c.badge ?? "Certified"}
                  </div>
                  <h3 className="mt-1 font-display font-bold text-lg leading-tight">{c.course_title}</h3>
                  <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                    <span>Score: <strong className="text-foreground">{c.score_percent}%</strong></span>
                    <span>·</span>
                    <span>{new Date(c.issued_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span>
                  </div>
                  <div className="mt-1 text-[10px] font-mono text-muted-foreground/70">{c.certificate_no}</div>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                <button
                  onClick={() => handleDownload(c)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-foreground text-background text-sm font-semibold hover:scale-[1.02] transition-smooth"
                >
                  <Download className="size-3.5" /> Download PDF
                </button>
                <Link
                  to="/learn-earn/$slug"
                  params={{ slug: c.course_slug }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-card border border-border text-sm font-medium hover:border-foreground/30 transition-smooth"
                >
                  Course
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Badges row */}
      {points?.badges && points.badges.length > 0 && (
        <div className="rounded-3xl bg-card border border-border p-6 shadow-card">
          <h2 className="font-display text-lg font-bold flex items-center gap-2">
            <Trophy className="size-5 text-accent" /> Earned badges
          </h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {points.badges.map((b) => (
              <span
                key={b}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-accent/15 border border-accent/30 text-sm font-semibold text-accent-foreground"
              >
                <Award className="size-3.5" /> {b}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({
  icon: Icon, label, value, capitalize,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  capitalize?: boolean;
}) {
  return (
    <div className="rounded-2xl bg-white/10 border border-white/15 backdrop-blur-md p-3 min-w-[5rem]">
      <Icon className="size-4 text-accent" />
      <div className={`font-display text-xl font-bold mt-1.5 ${capitalize ? "capitalize" : ""}`}>{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-white/70">{label}</div>
    </div>
  );
}
