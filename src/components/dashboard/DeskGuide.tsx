import { Link } from "@tanstack/react-router";
import { ArrowRight, Award, GraduationCap, Megaphone, MessagesSquare, Network } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { canAccessPath, getRoleLabel } from "@/lib/role-access";

const PARTNER_STEPS = [
  { n: "1", title: "Take a lead", detail: "Open the marketplace and pick a lead you can work today.", to: "/dashboard/leadboard" as const },
  { n: "2", title: "Quote the EMI", detail: "Tell the customer the monthly figure before you ask for papers.", to: "/dashboard/emi" as const },
  { n: "3", title: "Fill the file", detail: "Save what they said on the call, then ask for PAN and the statement.", to: "/dashboard/my-leads" as const },
  { n: "4", title: "Send it to a lender", detail: "Move the case from login to sanction and disbursal.", to: "/dashboard/cases" as const },
  { n: "5", title: "Raise the invoice", detail: "When the case disburses, the payout request lives in invoices.", to: "/dashboard/earnings" as const },
];

const CALLER_STEPS = [
  { n: "1", title: "Open the queue", detail: "Start with new and due calls. Log the disposition before you leave the lead.", to: "/dashboard/calls" as const },
  { n: "2", title: "Quote the EMI", detail: "Give one monthly figure. Do not ask for PAN or the account number on the first call.", to: "/dashboard/emi" as const },
  { n: "3", title: "Save the call", detail: "Loan, income, existing EMI and salary mode are enough to judge the file.", to: "/dashboard/my-leads" as const },
  { n: "4", title: "Learn the product", detail: "Use the course before you pitch a product you have not closed.", to: "/dashboard/learn" as const },
];

const PROGRAMS = [
  { title: "Network", detail: "Invite a connector. When their case disburses, your share follows the level an admin published.", to: "/dashboard/network" as const, icon: Network },
  { title: "Marketing", detail: "A post, a WhatsApp message, a visiting card or your link, each one carries your name and phone.", to: "/dashboard/marketing" as const, icon: Megaphone },
  { title: "Community", detail: "See what other partners are posting. Add a city update or a product tip from your own desk.", to: "/dashboard/community" as const, icon: MessagesSquare },
  { title: "Certificates", detail: "Finish the lessons and pass the quiz at 70% or more. The PDF is issued in your name.", to: "/dashboard/certificates" as const, icon: Award },
  { title: "Learn & Earn", detail: "Short courses for the products you sell. Points stay on this desk.", to: "/dashboard/learn" as const, icon: GraduationCap },
];

export function DeskGuide({ audience }: { audience: "partner" | "caller" }) {
  const { role, user } = useAuth();
  const finance = user?.finance_level;
  const steps = (audience === "caller" ? CALLER_STEPS : PARTNER_STEPS).filter((step) => canAccessPath(role, step.to, finance));
  const programs = PROGRAMS.filter((item) => canAccessPath(role, item.to, finance));
  const who = role ? getRoleLabel(role) : "your login";

  if (steps.length === 0 && programs.length === 0) return null;

  return (
    <div className="space-y-6">
      {steps.length > 0 && (
        <section>
          <h2 className="font-display text-lg font-bold text-[#390A5D]">How {who} works a file</h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-[#5c4d72]">
            Follow these in order. Each step opens the page where that work is done.
          </p>
          <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {steps.map((step) => (
              <Link key={step.n} to={step.to} className="group flex min-h-[148px] flex-col rounded-2xl border border-[#d8ecdd] bg-white p-4 shadow-[0_8px_20px_rgba(16,102,42,0.04)] transition hover:border-[#0D4F20] hover:bg-[#0D4F20]">
                <span className="text-xs font-bold text-[#10662A] group-hover:text-[#B7E4C7]">{step.n}</span>
                <span className="mt-2 text-base font-semibold text-[#390A5D] group-hover:text-white">{step.title}</span>
                <span className="mt-1 flex-1 text-sm leading-5 text-[#5c4d72] group-hover:text-white/80">{step.detail}</span>
                <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-[#10662A] group-hover:text-white">Open <ArrowRight className="size-3.5" /></span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {programs.length > 0 && (
        <section>
          <h2 className="font-display text-lg font-bold text-[#390A5D]">Use these from the same desk</h2>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {programs.map((item) => {
              const Icon = item.icon;
              return (
                <Link key={item.title} to={item.to} className="flex gap-4 rounded-2xl border border-[#d8ecdd] bg-white p-5 shadow-[0_8px_20px_rgba(16,102,42,0.04)] transition hover:border-[#0D4F20] hover:bg-[#F7FBF8]">
                  <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[#E8F7EC] text-[#10662A]">
                    <Icon className="size-5" />
                  </span>
                  <span className="min-w-0">
                    <span className="flex items-center gap-2 text-base font-semibold text-[#390A5D]">
                      {item.title} <ArrowRight className="size-4 text-[#10662A]" />
                    </span>
                    <span className="mt-1 block text-sm leading-6 text-[#5c4d72]">{item.detail}</span>
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
