import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Award, Download, Loader2 } from "lucide-react";
import { listCertificates, type CrmCertificate } from "@/lib/python-api";
import { downloadCertificate } from "@/lib/certificate-pdf";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/dashboard/certificates")({
  head: () => ({ meta: [{ title: "Certificates — RupeeOne" }] }),
  component: CertificatesPage,
});

type Available = { slug: string; title: string; badge: string; points: number };

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function CertificateCard({
  name,
  course,
  badge,
  score,
  number,
  date,
  sample,
}: {
  name: string;
  course: string;
  badge: string;
  score: string;
  number: string;
  date: string;
  sample?: boolean;
}) {
  return (
    <article className="relative overflow-hidden rounded-2xl border border-[#cfe3d4] bg-[#F7FBF8] p-5 shadow-[0_12px_30px_rgba(16,102,42,0.06)] sm:p-6">
      <div className="absolute inset-x-0 top-0 h-2 bg-[#10662A]" />
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#10662A]">RupeeDial Academy</p>
      <h3 className="mt-3 font-display text-2xl font-bold text-[#14281c] sm:text-3xl">Certificate of completion</h3>
      <p className="mt-4 text-sm text-[#5c4d72]">This certifies that</p>
      <p className="mt-1 font-display text-2xl font-bold text-[#390A5D]">{name}</p>
      <p className="mt-3 text-sm text-[#5c4d72]">has completed</p>
      <p className="mt-1 text-lg font-semibold text-[#14281c]">{course}</p>
      <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold">
        <span className="rounded-full bg-[#E8F7EC] px-3 py-1 text-[#0D4F20]">{badge}</span>
        <span className="rounded-full bg-white px-3 py-1 text-[#390A5D] ring-1 ring-[#d8ecdd]">{score}</span>
        <span className="rounded-full bg-white px-3 py-1 text-[#390A5D] ring-1 ring-[#d8ecdd]">{date}</span>
      </div>
      <p className="mt-4 font-mono text-[11px] text-[#5c4d72]">{number}</p>
      {sample && <p className="mt-2 text-xs font-semibold text-[#10662A]">Sample. Yours looks like this after a quiz of 70% or more.</p>}
    </article>
  );
}

function CertificatesPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<CrmCertificate[]>([]);
  const [available, setAvailable] = useState<Available[]>([]);
  const [points, setPoints] = useState(0);
  const [loading, setLoading] = useState(true);
  const name = user?.full_name || "Your name";

  useEffect(() => {
    listCertificates()
      .then((data) => {
        setItems(data.items);
        setAvailable(data.available);
        setPoints(data.total_points);
      })
      .catch((error: Error) => toast.error(error.message || "Could not load certificates"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="grid place-items-center py-16">
        <Loader2 className="size-6 animate-spin text-[#10662A]" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#10662A]">Learning</p>
          <h1 className="mt-1 flex items-center gap-2 font-display text-2xl font-bold text-[#390A5D]">
            <Award className="size-6 text-[#10662A]" /> Certificates
          </h1>
          <p className="mt-1 max-w-xl text-sm leading-6 text-[#5c4d72]">
            {items.length} earned · {points.toLocaleString("en-IN")} points. Pass a quiz with 70% or more and this page adds your real certificate.
          </p>
        </div>
      </div>

      {items.length === 0 ? (
        <CertificateCard
          sample
          name={name}
          course="Personal Loan Pro"
          badge="PL Certified"
          score="Sample score 92%"
          number="RD-SAMPLE-0001"
          date="Shown as a preview"
        />
      ) : (
        <div className="grid gap-4">
          {items.map((c) => (
            <div key={c.id} className="space-y-3">
              <CertificateCard
                name={c.full_name || name}
                course={c.course_title}
                badge={c.badge || "Certified"}
                score={`${c.score_percent}% · +${c.points} pts`}
                number={c.certificate_no}
                date={formatDate(c.issued_at)}
              />
              <button
                onClick={() => downloadCertificate(c)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#10662A] px-4 py-2 text-sm font-semibold text-white"
              >
                <Download className="size-4" /> Download PDF
              </button>
            </div>
          ))}
        </div>
      )}

      {available.length > 0 && (
        <section>
          <h2 className="font-display text-lg font-bold text-[#390A5D]">Earn yours</h2>
          <p className="mt-1 text-sm text-[#5c4d72]">Open the lessons, then take the quiz. 70% prints a certificate in your name.</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {available.map((a) => (
              <div key={a.slug} className="rounded-2xl border border-[#d8ecdd] bg-white p-4">
                <p className="text-[11px] font-bold uppercase tracking-wide text-[#10662A]">{a.badge}</p>
                <p className="mt-1 font-semibold text-[#390A5D]">{a.title}</p>
                <p className="text-sm text-[#5c4d72]">+{a.points} points</p>
                <div className="mt-3 flex gap-2 text-sm font-semibold">
                  <Link to="/learn-earn/$slug" params={{ slug: a.slug }} className="rounded-lg border border-[#d8ecdd] px-3 py-1.5 text-[#390A5D]">
                    Lessons
                  </Link>
                  <Link to="/learn-quiz/$slug" params={{ slug: a.slug }} className="rounded-lg bg-[#10662A] px-3 py-1.5 text-white">
                    Take quiz
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
