import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Building2, FileText, Loader2, Phone, Receipt, Users } from "lucide-react";
import { getMyDesk, type DeskNode, type DeskPerson } from "@/lib/python-api";
import { departmentLabel } from "@/lib/login-door";

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

function joined(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-2 py-1.5 text-sm">
      <div className="text-[#5c4d72]">{label}</div>
      <div className="font-medium text-[#14281c]">{value || "—"}</div>
    </div>
  );
}

function TeamBranch({ node }: { node: DeskNode }) {
  const title = [node.sales_title, departmentLabel(node.department)].filter(Boolean).join(" · ");
  return (
    <li className="mt-2">
      <div className="rounded-xl border border-[#d8ecdd] bg-white px-3 py-2">
        <div className="font-semibold text-[#390A5D]">
          {node.full_name}
          {node.sales_grade ? <span className="ml-1 text-xs font-medium text-[#5c4d72]">({node.sales_grade})</span> : null}
        </div>
        <div className="text-xs text-[#5c4d72]">{title || "Employee"}</div>
      </div>
      {node.children.length > 0 ? (
        <ul className="ml-4 border-l border-[#d8ecdd] pl-3">
          {node.children.map((child) => (
            <TeamBranch key={child.id} node={child} />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

function ProfileCard({ me, chain }: { me: DeskPerson; chain: DeskPerson[] }) {
  const initial = (me.full_name || "?").trim().charAt(0).toUpperCase();
  const boss = chain[0];
  return (
    <section className="rounded-2xl border border-[#d8ecdd] bg-white p-5">
      <div className="flex flex-wrap items-start gap-4">
        <div className="grid size-16 place-items-center rounded-full bg-[#E8F7EC] font-display text-2xl font-bold text-[#10662A]">
          {initial}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-xl font-bold text-[#390A5D]">
            {me.full_name}
            {me.sales_grade ? <span className="ml-2 text-base font-semibold text-[#5c4d72]">({me.sales_grade})</span> : null}
          </h2>
          <p className="text-sm text-[#14281c]">{me.sales_title || "Employee"}</p>
          <p className="text-xs text-[#5c4d72]">{departmentLabel(me.department) || "Department not set"} · RupeeDial</p>
        </div>
      </div>
      <div className="mt-5 grid gap-6 md:grid-cols-2">
        <div>
          <div className="text-xs font-bold uppercase tracking-wide text-[#5c4d72]">Contact</div>
          <Fact label="Email" value={me.email} />
          <Fact label="Phone" value={me.phone || "—"} />
          <Fact label="Reports to" value={boss ? `${boss.full_name}${boss.sales_grade ? ` (${boss.sales_grade})` : ""}` : "—"} />
        </div>
        <div>
          <div className="text-xs font-bold uppercase tracking-wide text-[#5c4d72]">Employment</div>
          <Fact label="Department" value={departmentLabel(me.department) || "—"} />
          <Fact label="Designation" value={me.sales_title || "—"} />
          <Fact label="Seat" value={me.finance_level ? LEVEL[me.finance_level] || me.finance_level : "—"} />
          <Fact label="Joined" value={joined(me.joined_at)} />
        </div>
      </div>
      {chain.length > 1 ? (
        <p className="mt-3 text-xs text-[#5c4d72]">
          Line: {chain.map((person) => person.full_name).join(" → ")}
        </p>
      ) : null}
    </section>
  );
}

export function EmployeeCockpit({ firstName, financeLevel }: { firstName: string; financeLevel?: string | null }) {
  const level = financeLevel ? LEVEL[financeLevel] || financeLevel : "";
  const [desk, setDesk] = useState<{ me: DeskPerson; chain: DeskPerson[]; team: DeskNode[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const work = [
    { title: "Case files", desc: "Login the file with the bank, then sanction or reject.", to: "/dashboard/cases" as const, icon: Building2 },
    { title: "Submissions", desc: "Files the sales desk has forwarded.", to: "/dashboard/submissions" as const, icon: FileText },
    ...(level
      ? [{ title: "Invoice approvals", desc: "Shown when the invoice reaches your step.", to: "/dashboard/invoice-approvals" as const, icon: Receipt }]
      : []),
    { title: "Learn", desc: "Product notes for the bank conversation.", to: "/dashboard/learn" as const, icon: Phone },
  ];

  useEffect(() => {
    let alive = true;
    getMyDesk()
      .then((row) => {
        if (alive) setDesk(row);
      })
      .catch(() => {
        if (alive) setDesk(null);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <section className="rounded-2xl bg-[#0D4F20] px-5 py-4 text-white">
        <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/70">Employee · RupeeOne</div>
        <h1 className="mt-1 font-display text-2xl font-bold">{firstName ? `${firstName}'s desk` : "Employee desk"}</h1>
        <p className="mt-1 text-sm text-white/75">
          {level ? `${level}. ` : ""}
          {financeLevel && STEP[financeLevel] ? STEP[financeLevel] : "Your profile and the people who report to you are on this desk."}
        </p>
      </section>

      {loading ? (
        <div className="grid place-items-center rounded-2xl border border-[#d8ecdd] bg-white py-10">
          <Loader2 className="size-5 animate-spin text-[#10662A]" />
        </div>
      ) : desk ? (
        <ProfileCard me={desk.me} chain={desk.chain} />
      ) : null}

      <section className="rounded-2xl border border-[#d8ecdd] bg-[#F4FBF6] p-5">
        <div className="flex items-center gap-2 font-display text-lg font-bold text-[#390A5D]">
          <Users className="size-4 text-[#10662A]" /> My team
        </div>
        <p className="mt-1 text-xs text-[#5c4d72]">People who report to you, and their teams under them.</p>
        {loading ? null : !desk || desk.team.length === 0 ? (
          <p className="mt-4 text-sm text-[#5c4d72]">Nobody reports to you yet.</p>
        ) : (
          <ul className="mt-3">
            {desk.team.map((node) => (
              <TeamBranch key={node.id} node={node} />
            ))}
          </ul>
        )}
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
