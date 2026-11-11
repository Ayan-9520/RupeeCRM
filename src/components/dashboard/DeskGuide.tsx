import { Link } from "@tanstack/react-router";
import { ArrowRight, Award, GraduationCap, Megaphone, MessagesSquare, Network } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { canAccessPath, getRoleLabel } from "@/lib/role-access";

const PARTNER_STEPS = [
  { n: "1", title: "Take a lead", detail: "Pick one you can call today.", to: "/dashboard/leadboard" as const },
  { n: "2", title: "Quote the EMI", detail: "Give the monthly figure before papers.", to: "/dashboard/emi" as const },
  { n: "3", title: "Fill the file", detail: "Save the call, then collect PAN and the statement.", to: "/dashboard/my-leads" as const },
  { n: "4", title: "Send it to a lender", detail: "Login, sanction, then disbursal.", to: "/dashboard/cases" as const },
  { n: "5", title: "Raise the invoice", detail: "The payout request sits with the disbursed case.", to: "/dashboard/earnings" as const },
];

const CALLER_STEPS = [
  { n: "1", title: "Open the queue", detail: "New and due calls. Log the disposition before you leave.", to: "/dashboard/calls" as const },
  { n: "2", title: "Quote the EMI", detail: "One monthly figure. No PAN or account number on the first call.", to: "/dashboard/emi" as const },
  { n: "3", title: "Save the call", detail: "Loan, income, existing EMI and salary mode.", to: "/dashboard/my-leads" as const },
  { n: "4", title: "Learn the product", detail: "Read the course before you pitch it.", to: "/dashboard/learn" as const },
];

const PROGRAMS = [
  { title: "Network", detail: "Invite a connector. Share follows the admin level.", to: "/dashboard/network" as const, icon: Network },
  { title: "Marketing", detail: "Post, WhatsApp, card or your link, with your name.", to: "/dashboard/marketing" as const, icon: Megaphone },
  { title: "Community", detail: "City updates and product tips from other partners.", to: "/dashboard/community" as const, icon: MessagesSquare },
  { title: "Certificates", detail: "Pass a quiz at 70%. The PDF uses your name.", to: "/dashboard/certificates" as const, icon: Award },
  { title: "Learn & Earn", detail: "Product courses. Points stay on this desk.", to: "/dashboard/learn" as const, icon: GraduationCap },
];

export function DeskGuide({ audience }: { audience: "partner" | "caller" }) {
  const { role, user } = useAuth();
  const finance = user?.finance_level;
  const steps = (audience === "caller" ? CALLER_STEPS : PARTNER_STEPS).filter((step) => canAccessPath(role, step.to, finance));
  const programs = PROGRAMS.filter((item) => canAccessPath(role, item.to, finance));
  const who = role ? getRoleLabel(role) : "Your desk";

  if (steps.length === 0 && programs.length === 0) return null;

  return (
    <div className="grid items-stretch gap-4 lg:grid-cols-[1.15fr_0.85fr]">
      {steps.length > 0 && (
        <section className="rounded-3xl border border-[#e4d7ef] bg-white p-5 shadow-[0_16px_40px_rgba(57,10,93,0.05)]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#10662A]">{who}</p>
          <h2 className="mt-1 font-display text-xl font-bold text-[#390A5D]">Move a case</h2>
          <ol className="mt-4">
            {steps.map((step, index) => (
              <li key={step.n}>
                <Link to={step.to} className="group flex items-center gap-3 rounded-2xl px-2 py-2.5 transition hover:bg-[#F4FBF6]">
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[#0D4F20] text-sm font-bold text-white">{step.n}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold text-[#390A5D]">{step.title}</span>
                    <span className="block text-sm leading-5 text-[#5c4d72]">{step.detail}</span>
                  </span>
                  <ArrowRight className="size-4 shrink-0 text-[#10662A] opacity-0 transition group-hover:opacity-100" />
                </Link>
                {index < steps.length - 1 && <div className="ml-6 h-3 border-l border-[#d8ecdd]" />}
              </li>
            ))}
          </ol>
        </section>
      )}

      {programs.length > 0 && (
        <section className="rounded-3xl bg-gradient-to-b from-[#F7F3FB] to-[#F4FBF6] p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#390A5D]">Also on this desk</p>
          <h2 className="mt-1 font-display text-xl font-bold text-[#390A5D]">Grow the book</h2>
          <div className="mt-4 space-y-2">
            {programs.map((item) => {
              const Icon = item.icon;
              return (
                <Link key={item.title} to={item.to} className="group flex items-center gap-3 rounded-2xl bg-white px-3 py-3 shadow-[0_6px_16px_rgba(57,10,93,0.04)] transition hover:bg-[#0D4F20]">
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#E8F7EC] text-[#10662A] group-hover:bg-white/15 group-hover:text-white">
                    <Icon className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold text-[#390A5D] group-hover:text-white">{item.title}</span>
                    <span className="block truncate text-sm text-[#5c4d72] group-hover:text-white/75">{item.detail}</span>
                  </span>
                  <ArrowRight className="size-4 shrink-0 text-[#10662A] group-hover:text-white" />
                </Link>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
