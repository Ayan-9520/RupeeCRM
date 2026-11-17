import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight, Award, BookOpen, Clock, FileText, Phone, ShieldCheck } from "lucide-react";
import { AskRupeeDial } from "@/components/dashboard/AskRupeeDial";
import { COURSES, CATEGORY_LABEL, LEVEL_LABEL } from "@/lib/courses";
import { CALL_SCRIPTS } from "@/lib/telesales";
import { RUPEEDIAL_PRODUCT_MENUS } from "@/lib/rupeedial-products";

export const Route = createFileRoute("/dashboard/training")({
  head: () => ({ meta: [{ title: "Academy — RupeeOne" }] }),
  component: Training,
});

type Tab = "courses" | "scripts" | "papers" | "rules";

const TABS: { id: Tab; label: string }[] = [
  { id: "courses", label: "Courses" },
  { id: "scripts", label: "Call book" },
  { id: "papers", label: "Papers" },
  { id: "rules", label: "Desk rules" },
];

const PAPERS = [
  { group: "Every file", items: ["PAN", "Address proof", "Photograph", "Bank statement for the last 6 months"] },
  { group: "Personal loan", items: ["Salary slips or ITR", "Employment proof", "Existing loan list, if the customer mentions one"] },
  { group: "Home loan and LAP", items: ["Sale agreement or property papers", "Ownership proof", "Property tax receipt"] },
  { group: "Auto loan", items: ["Vehicle invoice or quotation", "Employment or business proof"] },
  { group: "Education loan", items: ["Admission letter", "Fee structure", "Co-applicant income proof"] },
  { group: "Credit card", items: ["KYC", "Income proof", "Existing card, yes or no"] },
  { group: "Insurance", items: ["Members to be covered and their ages", "Existing policy, if any"] },
  { group: "Business, MSME and trade", items: ["GST certificate", "ITR", "Business proof", "Invoices, only for invoice financing"] },
];

const RULES = [
  { title: "Confirm, then stop", body: "On the call, confirm the city, the product and the income or business. Do not tell the customer a bank, a rate, or a sanction." },
  { title: "Papers stay with the partner", body: "After Interested, the partner who owns the file collects PAN and income proof. A telecaller does not take documents." },
  { title: "Consent first", body: "Take consent before you call or send a WhatsApp. Do not show a marketplace phone number before that lead is purchased." },
  { title: "No scheme promise", body: "CGTMSE, PMEGP, Stand-Up India and subsidy products are scheme fits. Do not promise collateral-free approval, a subsidy amount, or a category." },
  { title: "Certificate", body: "Read the course, pass the 10-question quiz with 70% or more, then download the certificate from Certificates. Points are added once per course." },
];

function Training() {
  const [tab, setTab] = useState<Tab>("courses");
  const [scriptId, setScriptId] = useState<(typeof CALL_SCRIPTS)[number]["id"]>(CALL_SCRIPTS[0].id);
  const script = CALL_SCRIPTS.find((item) => item.id === scriptId) ?? CALL_SCRIPTS[0];
  const groups = [...new Set(CALL_SCRIPTS.map((item) => item.group))];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#10662A]">Learning</p>
          <h1 className="mt-1 font-display text-3xl font-bold text-[#390A5D]">Academy</h1>
          <p className="mt-1 max-w-2xl text-sm text-[#5c4d72]">
            Eight courses, the words for each product, and the papers the partner collects. This page does not store bank rules or sanction a file.
          </p>
        </div>
        <Link to="/dashboard/certificates" className="inline-flex items-center gap-1 text-sm font-semibold text-[#10662A]">
          Certificates <ArrowRight className="size-3.5" />
        </Link>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {[
          { icon: BookOpen, title: "Learn and pass", detail: "Open a course, then pass its quiz at 70% or more." },
          { icon: Phone, title: "Use the call book", detail: "Same three lines the telecaller uses. Open, confirm, hand the file." },
          { icon: FileText, title: "Collect the papers", detail: "Only after the customer is interested. The list is under Papers." },
        ].map((job) => (
          <article key={job.title} className="rounded-2xl border border-[#d8ecdd] bg-white p-4">
            <job.icon className="size-4 text-[#10662A]" />
            <h2 className="mt-2 font-display font-bold text-[#390A5D]">{job.title}</h2>
            <p className="mt-1 text-sm leading-6 text-[#5c4d72]">{job.detail}</p>
          </article>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={`rounded-full px-4 py-2 text-sm font-semibold ${tab === item.id ? "bg-[#10662A] text-white" : "border border-[#d8ecdd] bg-white text-[#390A5D]"}`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === "courses" && (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {RUPEEDIAL_PRODUCT_MENUS.map((menu) => (
              <article key={menu.title} className="rounded-2xl border border-[#d8ecdd] bg-[#F4FBF6] p-4">
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#10662A]">{menu.title}</p>
                <ul className="mt-2 space-y-1 text-sm text-[#14281c]">
                  {menu.items.map((name) => <li key={name}>{name}</li>)}
                </ul>
              </article>
            ))}
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {COURSES.map((course) => (
              <article key={course.slug} className="flex flex-col rounded-3xl border border-[#d8ecdd] bg-white p-5 shadow-[0_10px_28px_rgba(16,102,42,0.05)]">
                <p className="text-[10px] font-bold uppercase tracking-wide text-[#5c4d72]">
                  {CATEGORY_LABEL[course.category]} · {LEVEL_LABEL[course.level]}
                </p>
                <h2 className="mt-2 font-display text-lg font-bold text-[#390A5D]">{course.title}</h2>
                <p className="mt-1 line-clamp-2 text-sm text-[#5c4d72]">{course.tagline}</p>
                <p className="mt-3 flex items-center gap-1.5 text-xs text-[#5c4d72]">
                  <Clock className="size-3.5" /> {course.duration_min} min · {course.lessons} lessons · +{course.reward_points} pts
                </p>
                <div className="mt-auto flex gap-2 pt-4 text-sm font-semibold">
                  <Link to="/dashboard/learn/$slug" params={{ slug: course.slug }} className="rounded-xl border border-[#d8ecdd] px-3 py-2 text-[#390A5D]">
                    Lessons
                  </Link>
                  <Link to="/learn-quiz/$slug" params={{ slug: course.slug }} className="rounded-xl bg-[#10662A] px-3 py-2 text-white">
                    Take quiz
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </div>
      )}

      {tab === "scripts" && (
        <div className="overflow-hidden rounded-3xl border border-[#d8ecdd] bg-white shadow-[0_16px_40px_rgba(16,102,42,0.05)]">
          <div className="grid lg:grid-cols-[260px_1fr]">
            <aside className="max-h-[32rem] overflow-y-auto border-b border-[#d8ecdd] bg-[#F4FBF6] lg:border-b-0 lg:border-r">
              {groups.map((group) => (
                <div key={group} className="px-3 py-3">
                  <p className="px-2 text-[10px] font-bold uppercase tracking-[0.14em] text-[#10662A]">{group}</p>
                  {CALL_SCRIPTS.filter((item) => item.group === group).map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setScriptId(item.id)}
                      className={`mt-1 w-full rounded-xl px-3 py-2 text-left text-sm font-semibold ${item.id === script.id ? "bg-[#10662A] text-white" : "text-[#390A5D] hover:bg-white"}`}
                    >
                      {item.title}
                    </button>
                  ))}
                </div>
              ))}
            </aside>
            <div className="p-6">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#10662A]">{script.group}</p>
              <h2 className="mt-1 font-display text-2xl font-bold text-[#390A5D]">{script.title}</h2>
              <ol className="mt-4 space-y-3">
                {script.lines.map((line, index) => (
                  <li key={line} className="flex gap-3 rounded-2xl border border-[#d8ecdd] bg-[#F4FBF6] p-3 text-sm leading-6 text-[#14281c]">
                    <span className="grid size-6 shrink-0 place-items-center rounded-full bg-[#10662A] text-xs font-bold text-white">{index + 1}</span>
                    {line}
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      )}

      {tab === "papers" && (
        <div className="grid gap-3 md:grid-cols-2">
          {PAPERS.map((pack) => (
            <article key={pack.group} className="rounded-3xl border border-[#d8ecdd] bg-white p-5">
              <h2 className="font-display text-lg font-bold text-[#390A5D]">{pack.group}</h2>
              <ul className="mt-3 space-y-2">
                {pack.items.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-[#14281c]">
                    <FileText className="mt-0.5 size-4 shrink-0 text-[#10662A]" /> {item}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      )}

      {tab === "rules" && (
        <div className="grid gap-3 md:grid-cols-2">
          {RULES.map((rule) => (
            <article key={rule.title} className="rounded-3xl border border-[#d8ecdd] bg-white p-5">
              <ShieldCheck className="size-5 text-[#10662A]" />
              <h2 className="mt-2 font-display text-lg font-bold text-[#390A5D]">{rule.title}</h2>
              <p className="mt-1 text-sm leading-6 text-[#5c4d72]">{rule.body}</p>
            </article>
          ))}
          <article className="rounded-3xl bg-gradient-to-br from-[#0D4F20] to-[#10662A] p-5 text-white md:col-span-2">
            <Award className="size-5" />
            <h2 className="mt-2 font-display text-xl font-bold">Pass mark is 70%</h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-white/80">A failed quiz does not add points. Pass once, then the badge and the certificate stay on your profile.</p>
            <Link to="/dashboard/learn" className="mt-4 inline-flex rounded-full bg-white px-4 py-2 text-sm font-semibold text-[#0D4F20]">
              Open my courses
            </Link>
          </article>
        </div>
      )}

      <AskRupeeDial />
    </div>
  );
}
