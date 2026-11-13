import { Link } from "@tanstack/react-router";
import { ArrowRight, Building2, FileText, Phone, Receipt } from "lucide-react";

const LEVEL: Record<string, string> = {
  rm: "RM",
  manager: "Manager",
  business_head: "Business head",
  accounts: "Accounts",
};

const STEP: Record<string, string> = {
  rm: "You check the partner invoice when you are named as RM 1 or RM 2.",
  manager: "You approve after both RMs. It then goes to the Business Head.",
  business_head: "You approve after the Manager. It then goes to Accounts.",
  accounts: "You pay the invoice after the Business Head, with the bank reference.",
};

export function EmployeeCockpit({ firstName, financeLevel, department }: { firstName: string; financeLevel?: string | null; department?: string | null }) {
  const level = financeLevel ? LEVEL[financeLevel] || financeLevel : "";
  const invoiceSeat = financeLevel === "rm" || financeLevel === "manager" || financeLevel === "business_head" || financeLevel === "accounts";
  const bankDesk = department === "OPS" && !invoiceSeat;
  const work = invoiceSeat
    ? [
        { title: "Invoice approvals", desc: "Shown when the invoice reaches your step.", to: "/dashboard/invoice-approvals" as const, icon: Receipt },
        ...(financeLevel === "accounts" || financeLevel === "business_head"
          ? [{ title: "Payouts", desc: "Paid and pending partner invoices.", to: "/dashboard/admin/payouts" as const, icon: FileText }]
          : []),
      ]
    : bankDesk
      ? [
          { title: "Submissions", desc: "Partner files that have reached the bank.", to: "/dashboard/submissions" as const, icon: FileText },
          { title: "Case files", desc: "Record login, sanction, disbursed, or reject.", to: "/dashboard/cases" as const, icon: Building2 },
        ]
      : [
          { title: "Case files", desc: "Login the file with the bank, then sanction or reject.", to: "/dashboard/cases" as const, icon: Building2 },
          { title: "Submissions", desc: "Files the sales desk has forwarded.", to: "/dashboard/submissions" as const, icon: FileText },
          { title: "Learn", desc: "Product notes for the bank conversation.", to: "/dashboard/learn" as const, icon: Phone },
        ];

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <section className="rounded-2xl bg-[#0D4F20] px-5 py-4 text-white">
        <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/70">Employee · RupeeOne</div>
        <h1 className="mt-1 font-display text-2xl font-bold">{firstName ? `${firstName}'s desk` : "Employee desk"}</h1>
        <p className="mt-1 text-sm text-white/75">
          {level ? `${level}. ` : ""}
          {financeLevel && STEP[financeLevel]
            ? STEP[financeLevel]
            : bankDesk
              ? "The partner takes the papers to the bank. You record login, sanction, disbursed, or reject."
              : "Take the file from sales and talk to the bank."}{" "}
          Open the profile icon for your full record.
        </p>
      </section>
      <div className="grid gap-3 sm:grid-cols-2">
        {work.map((item) => (
          <Link key={item.to} to={item.to} className="rounded-2xl border border-[#d8ecdd] bg-white p-4 hover:bg-[#F4FBF6]">
            <item.icon className="size-4 text-[#10662A]" />
            <div className="mt-3 flex items-center justify-between gap-2">
              <div className="font-semibold text-[#390A5D]">{item.title}</div>
              <ArrowRight className="size-3.5 text-[#10662A]" />
            </div>
            <p className="mt-1 text-xs text-[#5c4d72]">{item.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
