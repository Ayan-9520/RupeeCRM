import { useEffect, useState } from "react";
import { Loader2, Users } from "lucide-react";
import { getMyDesk, type DeskNode, type DeskPerson } from "@/lib/python-api";
import { departmentLabel } from "@/lib/login-door";

const LEVEL: Record<string, string> = {
  rm: "RM",
  manager: "Manager",
  business_head: "Business head",
  accounts: "Accounts",
};

function joined(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-2 border-b border-[#f0f5f1] py-2 text-sm last:border-0">
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
        <div className="text-xs text-[#5c4d72]">{node.email}</div>
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

export function StaffProfile() {
  const [desk, setDesk] = useState<{ me: DeskPerson; chain: DeskPerson[]; team: DeskNode[] } | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    getMyDesk()
      .then((row) => {
        if (alive) setDesk(row);
      })
      .catch((err: unknown) => {
        if (alive) setError(err instanceof Error ? err.message : "Could not load profile");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="grid place-items-center py-16">
        <Loader2 className="size-5 animate-spin text-[#10662A]" />
      </div>
    );
  }
  if (!desk) {
    return <p className="text-sm text-red-700">{error || "Could not load profile"}</p>;
  }

  const me = desk.me;
  const boss = desk.chain[0];
  const initial = (me.full_name || "?").trim().charAt(0).toUpperCase();

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <section className="rounded-2xl border border-[#d8ecdd] bg-white p-5">
        <div className="flex flex-wrap items-start gap-4">
          <div className="grid size-16 place-items-center rounded-full bg-[#E8F7EC] font-display text-2xl font-bold text-[#10662A]">{initial}</div>
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-2xl font-bold text-[#390A5D]">
              {me.full_name}
              {me.sales_grade ? <span className="ml-2 text-lg font-semibold text-[#5c4d72]">({me.sales_grade})</span> : null}
            </h1>
            <p className="text-sm text-[#14281c]">{me.sales_title || "Employee"}</p>
            <p className="text-xs text-[#5c4d72]">{departmentLabel(me.department) || "Department not set"} · RupeeDial</p>
          </div>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <section className="rounded-2xl border border-[#d8ecdd] bg-white p-5">
          <h2 className="font-semibold text-[#390A5D]">Contact details</h2>
          <div className="mt-2">
            <Fact label="Email" value={me.email} />
            <Fact label="Phone" value={me.phone || "—"} />
            <Fact label="Reports to" value={boss ? `${boss.full_name}${boss.sales_grade ? ` (${boss.sales_grade})` : ""}` : "—"} />
          </div>
        </section>
        <section className="rounded-2xl border border-[#d8ecdd] bg-white p-5">
          <h2 className="font-semibold text-[#390A5D]">Employment</h2>
          <div className="mt-2">
            <Fact label="Department" value={departmentLabel(me.department) || "—"} />
            <Fact label="Designation" value={me.sales_title || "—"} />
            <Fact label="Grade" value={me.sales_grade || "—"} />
            <Fact label="Seat" value={me.finance_level ? LEVEL[me.finance_level] || me.finance_level : "—"} />
            <Fact label="Joined" value={joined(me.joined_at)} />
          </div>
        </section>
      </div>

      {desk.chain.length > 0 ? (
        <section className="rounded-2xl border border-[#d8ecdd] bg-white p-5">
          <h2 className="font-semibold text-[#390A5D]">Reporting line</h2>
          <p className="mt-2 text-sm text-[#14281c]">{desk.chain.map((person) => `${person.full_name}${person.sales_title ? ` · ${person.sales_title}` : ""}`).join(" → ")}</p>
        </section>
      ) : null}

      <section className="rounded-2xl border border-[#d8ecdd] bg-[#F4FBF6] p-5">
        <div className="flex items-center gap-2 font-semibold text-[#390A5D]">
          <Users className="size-4 text-[#10662A]" /> My team
        </div>
        {desk.team.length === 0 ? (
          <p className="mt-3 text-sm text-[#5c4d72]">Nobody reports to you yet.</p>
        ) : (
          <ul className="mt-3">
            {desk.team.map((node) => (
              <TeamBranch key={node.id} node={node} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
