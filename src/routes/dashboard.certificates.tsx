import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Award, Download, GraduationCap, Loader2, Trophy } from "lucide-react";
import { listCertificates, type CrmCertificate } from "@/lib/python-api";
import { downloadCertificate } from "@/lib/certificate-pdf";

export const Route = createFileRoute("/dashboard/certificates")({
  head: () => ({ meta: [{ title: "Certificates — RupeeDial One" }] }),
  component: CertificatesPage,
});

type Available = { slug: string; title: string; badge: string; points: number };

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function CertificatesPage() {
  const [items, setItems] = useState<CrmCertificate[]>([]);
  const [available, setAvailable] = useState<Available[]>([]);
  const [points, setPoints] = useState(0);
  const [loading, setLoading] = useState(true);

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
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 font-display text-2xl font-bold text-[#390A5D]">
            <Award className="size-6 text-[#10662A]" /> Certificates
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-[#5c4d72]">
            Pass a course quiz with 70% or more to earn its certificate and points. Download the PDF any time.
          </p>
        </div>
        <div className="flex gap-3">
          <Stat label="Earned" value={String(items.length)} />
          <Stat label="Points" value={points.toLocaleString("en-IN")} />
        </div>
      </div>

      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#d8ecdd] bg-white p-8 text-center">
          <Trophy className="mx-auto size-8 text-[#10662A]" />
          <p className="mt-3 font-semibold text-[#390A5D]">No certificates yet</p>
          <p className="mt-1 text-sm text-[#5c4d72]">Pick a course below, finish the lessons and take the quiz.</p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {items.map((c) => (
            <article key={c.id} className="flex items-start gap-4 rounded-2xl border border-[#d8ecdd] bg-white p-4">
              <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-[#E8F7EC] text-[#10662A]">
                <Award className="size-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-[#390A5D]">{c.course_title}</p>
                <p className="mt-0.5 text-xs text-[#5c4d72]">
                  {c.badge} · {c.score_percent}% · +{c.points} pts · {formatDate(c.issued_at)}
                </p>
                <p className="mt-1 font-mono text-[11px] text-slate-500">{c.certificate_no}</p>
              </div>
              <button
                onClick={() => downloadCertificate(c)}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-[#d8ecdd] px-3 py-2 text-xs font-semibold text-[#10662A] hover:bg-[#E8F7EC]"
              >
                <Download className="size-3.5" /> PDF
              </button>
            </article>
          ))}
        </div>
      )}

      {available.length > 0 && (
        <section>
          <h2 className="font-semibold text-[#390A5D]">Still to earn</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {available.map((a) => (
              <div key={a.slug} className="rounded-2xl border border-[#d8ecdd] bg-white p-4">
                <div className="flex items-center gap-2 text-[#10662A]">
                  <GraduationCap className="size-4" />
                  <span className="text-[10px] font-bold uppercase tracking-wide">{a.badge}</span>
                </div>
                <p className="mt-2 font-semibold text-[#390A5D]">{a.title}</p>
                <p className="text-xs text-[#5c4d72]">+{a.points} points</p>
                <div className="mt-3 flex gap-2 text-xs font-semibold">
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[#d8ecdd] bg-white px-4 py-2 text-center">
      <p className="font-display text-lg font-bold text-[#10662A]">{value}</p>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-[#5c4d72]">{label}</p>
    </div>
  );
}
