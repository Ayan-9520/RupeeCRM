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
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
}

function CertificateCard({
  name,
  course,
  badge,
  score,
  number,
  date,
}: {
  name: string;
  course: string;
  badge: string | null;
  score: number;
  number: string;
  date: string;
}) {
  return (
    <article className="relative aspect-[297/210] w-full overflow-hidden bg-[#FCFBF8] shadow-[0_16px_40px_rgba(20,20,20,0.08)]">
      <div className="absolute inset-[2.6%] border-[3px] border-[#2ECC71]" />
      <div className="absolute inset-[4.1%] border border-[#B4C8BE]" />
      <div className="absolute left-[2.6%] right-[2.6%] top-[2.6%] h-[2.9%] bg-[#2ECC71]" />

      <p className="absolute left-0 right-0 top-[11%] text-center text-[clamp(8px,1.15vw,13px)] font-bold tracking-wide text-[#2ECC71]">
        RUPEEDIAL ACADEMY · CERTIFIED PARTNER
      </p>
      <h3 className="absolute left-0 right-0 top-[18%] text-center font-sans text-[clamp(16px,3.1vw,36px)] font-bold text-[#141414]">
        Certificate of Completion
      </h3>
      <p className="absolute left-0 right-0 top-[30%] text-center text-[clamp(9px,1.15vw,14px)] text-[#5A5A5A]">This certifies that</p>
      <p className="absolute left-[8%] right-[8%] top-[36%] truncate text-center font-serif text-[clamp(16px,2.9vw,34px)] italic text-[#141414]">{name}</p>
      <div className="absolute left-[23%] right-[23%] top-[44.5%] h-px bg-[#C8C8C8]" />
      <p className="absolute left-0 right-0 top-[48%] text-center text-[clamp(9px,1.2vw,15px)] text-[#464646]">has successfully completed the course</p>
      <p className="absolute left-[6%] right-[6%] top-[54%] truncate text-center text-[clamp(13px,2vw,24px)] font-bold text-[#141414]">{course}</p>
      <p className="absolute left-[6%] right-[6%] top-[62%] text-center text-[clamp(9px,1.15vw,14px)] text-[#5A5A5A]">
        with a score of {score}%{badge ? `   ·   Badge: ${badge}` : ""}
      </p>

      <div className="absolute bottom-[16%] left-[13%] w-[24%] border-t border-[#A0A0A0] pt-1 text-center">
        <p className="text-[clamp(8px,0.95vw,12px)] font-bold text-[#3C3C3C]">Issued on</p>
        <p className="text-[clamp(8px,0.9vw,12px)] text-[#3C3C3C]">{date}</p>
      </div>
      <div className="absolute bottom-[16%] right-[13%] w-[24%] border-t border-[#A0A0A0] pt-1 text-center">
        <p className="text-[clamp(8px,0.95vw,12px)] font-bold text-[#3C3C3C]">Authorised Signatory</p>
        <p className="text-[clamp(8px,0.9vw,12px)] text-[#3C3C3C]">RupeeDial Academy</p>
      </div>
      <p className="absolute bottom-[3.2%] left-0 right-0 text-center text-[clamp(8px,0.85vw,11px)] text-[#787878]">Certificate No. {number}</p>
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
    <div className="mx-auto max-w-5xl space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#10662A]">Academy</p>
          <h1 className="mt-1 flex items-center gap-2 font-display text-3xl font-bold text-[#390A5D]">
            <Award className="size-7 text-[#10662A]" /> Certificates
          </h1>
        </div>
        <p className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-[#390A5D] shadow-[0_8px_20px_rgba(16,102,42,0.06)]">
          {items.length} earned · {points.toLocaleString("en-IN")} points
        </p>
      </div>

      {items.length === 0 ? (
        <CertificateCard
          name={name}
          course="Personal Loan Pro"
          badge="PL Certified"
          score={92}
          number="RD-SAMPLE-0001"
          date={formatDate(new Date().toISOString())}
        />
      ) : (
        <div className="grid gap-8">
          {items.map((c) => (
            <div key={c.id} className="space-y-3">
              <CertificateCard
                name={c.full_name || name}
                course={c.course_title}
                badge={c.badge}
                score={c.score_percent}
                number={c.certificate_no}
                date={formatDate(c.issued_at)}
              />
              <button
                onClick={() => downloadCertificate(c)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#10662A] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0D4F20]"
              >
                <Download className="size-4" /> Download PDF
              </button>
            </div>
          ))}
        </div>
      )}

      {available.length > 0 && (
        <section>
          <h2 className="font-display text-xl font-bold text-[#390A5D]">Courses</h2>
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
