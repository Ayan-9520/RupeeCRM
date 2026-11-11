import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Award, BookOpen, CircleCheck, Download, Loader2, X } from "lucide-react";
import { listCertificates, type CrmCertificate } from "@/lib/python-api";
import { downloadCertificate } from "@/lib/certificate-pdf";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/dashboard/certificates")({
  head: () => ({ meta: [{ title: "Certificates — RupeeOne" }] }),
  component: CertificatesPage,
});

type Available = { slug: string; title: string; badge: string; points: number };

const STEPS = [
  { icon: BookOpen, title: "Read the lessons", detail: "Six short modules on that product." },
  { icon: CircleCheck, title: "Pass the quiz", detail: "70% or more. One attempt is enough." },
  { icon: Award, title: "The PDF is yours", detail: "Your name, score and a certificate number." },
];

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
  const [slide, setSlide] = useState(0);
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

  const slideCount = STEPS.length + available.length;
  useEffect(() => {
    if (slideCount < 2) return;
    const timer = window.setInterval(() => setSlide((current) => (current + 1) % slideCount), 3200);
    return () => window.clearInterval(timer);
  }, [slideCount]);

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

  const safeSlide = slideCount === 0 ? 0 : slide % slideCount;
  const featured = safeSlide >= STEPS.length ? available[safeSlide - STEPS.length] : null;
  const shown = sheets[0];
  const preview: Sheet = featured && shown && !shown.real
    ? { ...shown, course: featured.title, badge: featured.badge }
    : shown;

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

      <div className="grid items-stretch gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="flex min-h-[280px] flex-col justify-between rounded-3xl bg-white p-6 shadow-[0_12px_30px_rgba(16,102,42,0.06)] ring-1 ring-[#d8ecdd]">
          {safeSlide < STEPS.length ? (
            <div key={STEPS[safeSlide].title}>
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#10662A]">Step {safeSlide + 1} of {STEPS.length}</p>
              <span className="mt-4 grid size-14 place-items-center rounded-full bg-[#0D4F20] text-white">
                {(() => {
                  const Icon = STEPS[safeSlide].icon;
                  return <Icon className="size-6" />;
                })()}
              </span>
              <h2 className="mt-4 font-display text-2xl font-bold text-[#390A5D]">{STEPS[safeSlide].title}</h2>
              <p className="mt-2 text-sm leading-6 text-[#5c4d72]">{STEPS[safeSlide].detail}</p>
            </div>
          ) : featured ? (
            <div key={featured.slug}>
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#10662A]">Badge</p>
              <h2 className="mt-4 font-display text-2xl font-bold text-[#390A5D]">{featured.title}</h2>
              <p className="mt-1 text-sm font-semibold text-[#10662A]">{featured.badge}</p>
              <p className="mt-2 text-sm leading-6 text-[#5c4d72]">+{featured.points} points after a quiz of 70% or more.</p>
              <div className="mt-4 flex gap-2 text-sm font-semibold">
                <Link to="/learn-earn/$slug" params={{ slug: featured.slug }} className="rounded-lg border border-[#d8ecdd] px-3 py-1.5 text-[#390A5D]">Lessons</Link>
                <Link to="/learn-quiz/$slug" params={{ slug: featured.slug }} className="rounded-lg bg-[#10662A] px-3 py-1.5 text-white">Take quiz</Link>
              </div>
            </div>
          ) : null}
          <div className="mt-6 flex flex-wrap gap-1.5">
            {Array.from({ length: slideCount }, (_, index) => (
              <button key={index} type="button" aria-label={`Show item ${index + 1}`} onClick={() => setSlide(index)} className={`h-1.5 rounded-full ${index === safeSlide ? "w-6 bg-[#0D4F20]" : "w-1.5 bg-[#d8ecdd]"}`} />
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={() => setOpen(preview)}
          className="rounded-3xl bg-white p-4 text-left shadow-[0_12px_30px_rgba(16,102,42,0.06)] ring-1 ring-[#d8ecdd] [container-type:inline-size]"
        >
          <div className="pointer-events-none overflow-hidden rounded-xl">
            <CertificateCard {...preview} />
          </div>
          <span className="mt-3 flex items-center justify-between text-sm font-semibold text-[#390A5D]">
            {preview.real ? preview.course : "Preview"}
            <span className="text-xs font-semibold text-[#10662A]">Tap to enlarge</span>
          </span>
        </button>
      </div>

      {available.length > 0 && (
        <section>
          <div className="flex items-end justify-between gap-3">
            <h2 className="font-display text-xl font-bold text-[#390A5D]">Badges you can earn</h2>
            <p className="text-sm text-[#5c4d72]">{available.length} open</p>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {available.map((course) => {
              const words = course.badge.split(/\s+/).filter((word) => !/certified|verified|pro|advisor|closer|expert|mastery|specialist|fundamentals/i.test(word));
              const source = words.length ? words : course.badge.split(/\s+/);
              const mark = source.length === 1 && source[0].length <= 4
                ? source[0].toUpperCase()
                : source.map((word) => word[0]).join("").slice(0, 3).toUpperCase();
              return (
                <article key={course.slug} className="flex flex-col rounded-3xl bg-gradient-to-b from-[#F7F3FB] to-white p-4 shadow-[0_12px_28px_rgba(57,10,93,0.06)] ring-1 ring-[#e4d7ef]">
                  <div className="flex items-center gap-3">
                    <span className="relative grid size-16 shrink-0 place-items-center">
                      <span className="absolute inset-0 rounded-full bg-[#0D4F20]" />
                      <span className="absolute inset-[5px] rounded-full border border-[#B7E4C7]" />
                      <span className="absolute inset-[9px] rounded-full border border-white/40" />
                      <span className="relative px-1 text-center text-[10px] font-bold uppercase leading-tight text-white">{mark}</span>
                    </span>
                    <span>
                      <span className="block text-[11px] font-bold uppercase tracking-wide text-[#10662A]">{course.badge}</span>
                      <span className="mt-1 block font-display text-base font-bold leading-snug text-[#390A5D]">{course.title}</span>
                    </span>
                  </div>
                  <p className="mt-3 text-sm text-[#5c4d72]">+{course.points} points after a quiz of 70% or more.</p>
                  <div className="mt-4 flex gap-2 text-sm font-semibold">
                    <Link to="/learn-earn/$slug" params={{ slug: course.slug }} className="rounded-lg border border-[#d8ecdd] bg-white px-3 py-1.5 text-[#390A5D] hover:border-[#10662A]">
                      Lessons
                    </Link>
                    <Link to="/learn-quiz/$slug" params={{ slug: course.slug }} className="rounded-lg bg-[#10662A] px-3 py-1.5 text-white hover:bg-[#0D4F20]">
                      Take quiz
                    </Link>
                  </div>
                </article>
              );
            })}
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
