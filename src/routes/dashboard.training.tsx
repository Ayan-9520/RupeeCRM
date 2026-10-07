import { createFileRoute, Link } from "@tanstack/react-router";
import { GraduationCap, Clock, ArrowRight } from "lucide-react";
import { COURSES, CATEGORY_LABEL, LEVEL_LABEL } from "@/lib/courses";
import { CrmPageHub } from "@/components/dashboard/CrmPageHub";
import { AskRupeeDial } from "@/components/dashboard/AskRupeeDial";
import { CALL_SCRIPTS } from "@/lib/telesales";

export const Route = createFileRoute("/dashboard/training")({
  head: () => ({ meta: [{ title: "Academy — RupeeDial One" }] }),
  component: Training,
});

const ACADEMY = [
  { id: "products", title: "Products", body: "Personal, business, home, auto and cards. Open a course below for the product you sell." },
  { id: "policies", title: "Lender policies", body: "Live bank rules are not stored here. Confirm income, obligations and documents, then lender match runs later in OneFlo." },
  { id: "documents", title: "Documents", body: "Start with PAN, address proof, income proof and bank statements. Property loans also need ownership papers. Do not mark a file ready until the customer has shared it." },
  { id: "eligibility", title: "Eligibility", body: "The website check compares indicative offers. It does not sanction. A case becomes eligible in your pipeline only after income and requirement are confirmed." },
  { id: "sales", title: "Sales training", body: "Use the call scripts, log a disposition, and move a real case only when the customer agrees to the next document step." },
  { id: "compliance", title: "Compliance", body: "Take consent before you call or message. Do not promise a bank, a rate, or a disbursal. Do not show a marketplace phone before purchase." },
  { id: "certification", title: "Certification", body: "Finish a course, pass its 10-question quiz with 70% or more, and download the certificate from the Certificates page." },
] as const;

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
          <h1 className="font-display text-2xl lg:text-3xl font-bold text-[#390A5D]">Academy</h1>
          <p className="text-[#5c4d72] mt-1">Products, documents, scripts and a case assistant. Lender policy stays with OneFlo.</p>
        </div>
        <Link to="/dashboard/learn" className="text-sm font-semibold text-[#10662A] hover:underline inline-flex items-center gap-1">
          Open Learn <ArrowRight className="size-3.5" />
        </Link>
      </div>

      <div className="flex flex-wrap gap-2">
        {ACADEMY.map((item) => (
          <a key={item.id} href={`#${item.id}`} className="rounded-full border border-[#d8ecdd] bg-white px-3 py-1.5 text-sm font-semibold text-[#390A5D]">
            {item.title}
          </a>
        ))}
        <a href="#scripts" className="rounded-full border border-[#d8ecdd] bg-white px-3 py-1.5 text-sm font-semibold text-[#390A5D]">Scripts</a>
        <a href="#assistant" className="rounded-full border border-[#d8ecdd] bg-white px-3 py-1.5 text-sm font-semibold text-[#390A5D]">AI learning</a>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {ACADEMY.map((item) => (
          <article key={item.id} id={item.id} className="rounded-2xl border border-[#d8ecdd] bg-white p-4">
            <h2 className="font-semibold text-[#390A5D]">{item.title}</h2>
            <p className="mt-1 text-sm text-[#5c4d72]">{item.body}</p>
          </article>
        ))}
      </div>

      <section id="scripts" className="grid gap-3 md:grid-cols-2">
        {CALL_SCRIPTS.map((script) => (
          <article key={script.id} className="rounded-2xl border border-[#d8ecdd] bg-white p-4">
            <h2 className="font-semibold text-[#390A5D]">{script.title}</h2>
            <ol className="mt-2 list-decimal space-y-1 pl-4 text-sm text-[#5c4d72]">
              {script.lines.map((line) => <li key={line}>{line}</li>)}
            </ol>
          </article>
        ))}
      </section>

      <AskRupeeDial />

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
            <div className="mt-4 flex gap-2 text-xs font-semibold">
              <Link to="/learn-earn/$slug" params={{ slug: c.slug }} className="rounded-lg border border-[#d8ecdd] px-3 py-1.5 text-[#390A5D]">
                Lessons
              </Link>
              <Link to="/learn-quiz/$slug" params={{ slug: c.slug }} className="rounded-lg bg-[#10662A] px-3 py-1.5 text-white">
                Take quiz
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
