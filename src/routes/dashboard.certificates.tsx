import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Award, Download, Loader2, X } from "lucide-react";
import { listCertificates, type CrmCertificate } from "@/lib/python-api";
import { downloadCertificate } from "@/lib/certificate-pdf";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/dashboard/certificates")({
  head: () => ({ meta: [{ title: "Certificates — RupeeOne" }] }),
  component: CertificatesPage,
});

type Available = { slug: string; title: string; badge: string; points: number };

type Sheet = {
  key: string;
  name: string;
  course: string;
  badge: string | null;
  score: number;
  number: string;
  date: string;
  real: CrmCertificate | null;
};

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
}: Omit<Sheet, "key" | "real">) {
  return (
    <article className="relative aspect-[297/210] w-full overflow-hidden bg-[#FCFBF8] shadow-[0_16px_40px_rgba(20,20,20,0.08)]">
      <div className="absolute inset-[2.6%] border-[3px] border-[#2ECC71]" />
      <div className="absolute inset-[4.1%] border border-[#B4C8BE]" />
      <div className="absolute left-[2.6%] right-[2.6%] top-[2.6%] h-[2.9%] bg-[#2ECC71]" />
      <p className="absolute left-0 right-0 top-[11%] text-center text-[clamp(7px,1.6cqw,13px)] font-bold tracking-wide text-[#2ECC71]">
        RUPEEDIAL ACADEMY · CERTIFIED PARTNER
      </p>
      <h3 className="absolute left-0 right-0 top-[18%] text-center font-sans text-[clamp(13px,4.2cqw,36px)] font-bold text-[#141414]">
        Certificate of Completion
      </h3>
      <p className="absolute left-0 right-0 top-[30%] text-center text-[clamp(8px,1.7cqw,14px)] text-[#5A5A5A]">This certifies that</p>
      <p className="absolute left-[8%] right-[8%] top-[36%] truncate text-center font-serif text-[clamp(14px,4cqw,34px)] italic text-[#141414]">{name}</p>
      <div className="absolute left-[23%] right-[23%] top-[44.5%] h-px bg-[#C8C8C8]" />
      <p className="absolute left-0 right-0 top-[48%] text-center text-[clamp(8px,1.8cqw,15px)] text-[#464646]">has successfully completed the course</p>
      <p className="absolute left-[6%] right-[6%] top-[54%] truncate text-center text-[clamp(11px,2.8cqw,24px)] font-bold text-[#141414]">{course}</p>
      <p className="absolute left-[6%] right-[6%] top-[62%] truncate text-center text-[clamp(8px,1.6cqw,14px)] text-[#5A5A5A]">
        with a score of {score}%{badge ? ` · ${badge}` : ""}
      </p>
      <div className="absolute bottom-[16%] left-[13%] w-[24%] border-t border-[#A0A0A0] pt-1 text-center">
        <p className="text-[clamp(7px,1.3cqw,12px)] font-bold text-[#3C3C3C]">Issued on</p>
        <p className="truncate text-[clamp(7px,1.2cqw,12px)] text-[#3C3C3C]">{date}</p>
      </div>
      <div className="absolute bottom-[16%] right-[13%] w-[24%] border-t border-[#A0A0A0] pt-1 text-center">
        <p className="text-[clamp(7px,1.3cqw,12px)] font-bold text-[#3C3C3C]">Authorised Signatory</p>
        <p className="truncate text-[clamp(7px,1.2cqw,12px)] text-[#3C3C3C]">RupeeDial Academy</p>
      </div>
      <p className="absolute bottom-[3.2%] left-0 right-0 truncate px-4 text-center text-[clamp(7px,1.2cqw,11px)] text-[#787878]">Certificate No. {number}</p>
    </article>
  );
}

function CertificatesPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<CrmCertificate[]>([]);
  const [available, setAvailable] = useState<Available[]>([]);
  const [points, setPoints] = useState(0);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<Sheet | null>(null);
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

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (loading) {
    return (
      <div className="grid place-items-center py-16">
        <Loader2 className="size-6 animate-spin text-[#10662A]" />
      </div>
    );
  }

  const sheets: Sheet[] = items.length
    ? items.map((c) => ({
        key: c.id,
        name: c.full_name || name,
        course: c.course_title,
        badge: c.badge,
        score: c.score_percent,
        number: c.certificate_no,
        date: formatDate(c.issued_at),
        real: c,
      }))
    : [
        {
          key: "sample",
          name,
          course: available[0]?.title || "Personal Loan Pro",
          badge: available[0]?.badge || "PL Certified",
          score: 92,
          number: "RD-SAMPLE-0001",
          date: formatDate(new Date().toISOString()),
          real: null,
        },
      ];

  return (
    <div className="mx-auto max-w-6xl space-y-8">
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

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {sheets.map((sheet) => (
          <button
            key={sheet.key}
            type="button"
            onClick={() => setOpen(sheet)}
            className="group rounded-2xl bg-white p-3 text-left shadow-[0_10px_28px_rgba(16,102,42,0.06)] ring-1 ring-[#d8ecdd] transition hover:-translate-y-0.5 hover:ring-[#10662A] [container-type:inline-size]"
          >
            <div className="pointer-events-none overflow-hidden rounded-xl">
              <CertificateCard {...sheet} />
            </div>
            <span className="mt-3 flex items-center justify-between text-sm font-semibold text-[#390A5D]">
              {sheet.real ? sheet.course : "Preview"}
              <span className="text-xs font-semibold text-[#10662A]">{sheet.real ? "Open" : "Tap to enlarge"}</span>
            </span>
          </button>
        ))}
      </div>

      {available.length > 0 && (
        <section>
          <div className="flex items-end justify-between gap-3">
            <h2 className="font-display text-xl font-bold text-[#390A5D]">Courses</h2>
            <p className="text-sm text-[#5c4d72]">{available.length} open</p>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {available.map((course) => (
              <article key={course.slug} className="flex min-h-[168px] flex-col rounded-2xl border border-[#e4d7ef] bg-white p-4 shadow-[0_10px_24px_rgba(57,10,93,0.04)]">
                <p className="text-[11px] font-bold uppercase tracking-wide text-[#10662A]">{course.badge}</p>
                <h3 className="mt-2 font-display text-lg font-bold leading-snug text-[#390A5D]">{course.title}</h3>
                <p className="mt-1 text-sm text-[#5c4d72]">+{course.points} points · quiz 70%</p>
                <div className="mt-auto flex gap-2 pt-4 text-sm font-semibold">
                  <Link to="/learn-earn/$slug" params={{ slug: course.slug }} className="rounded-lg border border-[#d8ecdd] px-3 py-1.5 text-[#390A5D] hover:border-[#10662A]">
                    Lessons
                  </Link>
                  <Link to="/learn-quiz/$slug" params={{ slug: course.slug }} className="rounded-lg bg-[#10662A] px-3 py-1.5 text-white hover:bg-[#0D4F20]">
                    Take quiz
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-[#0D4F20]/70 p-4" onClick={() => setOpen(null)}>
          <div className="w-full max-w-4xl [container-type:inline-size]" onClick={(event) => event.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between text-white">
              <p className="text-sm font-semibold">{open.real ? open.number : "Preview · pass a quiz at 70% for the real PDF"}</p>
              <button type="button" onClick={() => setOpen(null)} className="grid size-9 place-items-center rounded-full bg-white/15 hover:bg-white/25" aria-label="Close">
                <X className="size-4" />
              </button>
            </div>
            <CertificateCard {...open} />
            {open.real && (
              <button
                type="button"
                onClick={() => downloadCertificate(open.real as CrmCertificate)}
                className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-[#0D4F20]"
              >
                <Download className="size-4" /> Download PDF
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
