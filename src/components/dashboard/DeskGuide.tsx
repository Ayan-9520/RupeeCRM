import { Link } from "@tanstack/react-router";
import { ArrowRight, Award, Calculator, FileText, GraduationCap, Landmark, Megaphone, MessagesSquare, Network, Phone, Receipt, Store } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { canAccessPath, getRoleLabel } from "@/lib/role-access";

const PARTNER_STEPS: { title: string; detail: string; to: "/dashboard/leadboard" | "/dashboard/emi" | "/dashboard/my-leads" | "/dashboard/cases" | "/dashboard/earnings"; icon: LucideIcon }[] = [
  { title: "Take a lead", detail: "Pick one you can call today.", to: "/dashboard/leadboard", icon: Store },
  { title: "Quote the EMI", detail: "Give the monthly figure before papers.", to: "/dashboard/emi", icon: Calculator },
  { title: "Fill the file", detail: "Save the call, then collect PAN and the statement.", to: "/dashboard/my-leads", icon: FileText },
  { title: "Send it to a lender", detail: "Login, sanction, then disbursal.", to: "/dashboard/cases", icon: Landmark },
  { title: "Raise the invoice", detail: "The payout request sits with the disbursed case.", to: "/dashboard/earnings", icon: Receipt },
];

const CALLER_STEPS: { title: string; detail: string; to: "/dashboard/calls" | "/dashboard/emi" | "/dashboard/my-leads" | "/dashboard/learn"; icon: LucideIcon }[] = [
  { title: "Open the queue", detail: "New and due calls. Log the disposition before you leave.", to: "/dashboard/calls", icon: Phone },
  { title: "Quote the EMI", detail: "One monthly figure. No PAN or account number on the first call.", to: "/dashboard/emi", icon: Calculator },
  { title: "Save the call", detail: "Loan, income, existing EMI and salary mode.", to: "/dashboard/my-leads", icon: FileText },
  { title: "Learn the product", detail: "Read the course before you pitch it.", to: "/dashboard/learn", icon: GraduationCap },
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
    <div className="grid items-start gap-3 lg:grid-cols-2">
      {steps.length > 0 && (
        <section className="rounded-2xl bg-gradient-to-b from-[#F4FBF6] to-[#E8F7EC] p-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#10662A]">{who}</p>
          <h2 className="font-display text-base font-bold text-[#390A5D]">Move a case</h2>
          <div className="mt-2 space-y-1.5">
            {steps.map((step) => {
              const Icon = step.icon;
              return (
                <Link key={step.title} to={step.to} className="group flex items-center gap-2 rounded-xl bg-white px-2.5 py-1.5 shadow-[0_4px_12px_rgba(16,102,42,0.05)] transition hover:bg-[#0D4F20]">
                  <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-[#E8F7EC] text-[#10662A] group-hover:bg-white/15 group-hover:text-white">
                    <Icon className="size-3.5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold leading-4 text-[#390A5D] group-hover:text-white">{step.title}</span>
                    <span className="block truncate text-[11px] text-[#5c4d72] group-hover:text-white/75">{step.detail}</span>
                  </span>
                  <ArrowRight className="size-3.5 shrink-0 text-[#10662A] group-hover:text-white" />
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {programs.length > 0 && (
        <section className="rounded-2xl bg-gradient-to-b from-[#F7F3FB] to-[#F4FBF6] p-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#390A5D]">Also on this desk</p>
          <h2 className="font-display text-base font-bold text-[#390A5D]">Grow the book</h2>
          <div className="mt-2 space-y-1.5">
            {programs.map((item) => {
              const Icon = item.icon;
              return (
                <Link key={item.title} to={item.to} className="group flex items-center gap-2 rounded-xl bg-white px-2.5 py-1.5 shadow-[0_4px_12px_rgba(57,10,93,0.05)] transition hover:bg-[#390A5D]">
                  <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-[#F4F0FA] text-[#390A5D] group-hover:bg-white/15 group-hover:text-white">
                    <Icon className="size-3.5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold leading-4 text-[#390A5D] group-hover:text-white">{item.title}</span>
                    <span className="block truncate text-[11px] text-[#5c4d72] group-hover:text-white/75">{item.detail}</span>
                  </span>
                  <ArrowRight className="size-3.5 shrink-0 text-[#390A5D] group-hover:text-white" />
                </Link>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
