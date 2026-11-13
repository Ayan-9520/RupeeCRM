import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { listMyLeads, type CrmPurchase } from "@/lib/python-api";
import { useAuth } from "@/lib/auth-context";
import { canAccessPath } from "@/lib/role-access";

function labelOf(row: CrmPurchase) {
  const notes = [...(row.notes || [])].reverse();
  const hit = notes.find((note) => note.kind === "disposition");
  return hit?.text?.replace("Disposition: ", "") || row.pipeline_stage;
}

function whenLabel(iso: string) {
  const date = new Date(iso);
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const day = new Date(date);
  day.setHours(0, 0, 0, 0);
  const diff = Math.round((day.getTime() - start.getTime()) / 86400000);
  const clock = date.toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  if (diff < 0) return { tone: "Due" as const, clock };
  if (diff === 0) return { tone: "Today" as const, clock };
  return { tone: "Later" as const, clock };
}

export function RecallList() {
  const { role, user } = useAuth();
  const [rows, setRows] = useState<CrmPurchase[] | null>(null);
  const [filter, setFilter] = useState<"All" | "Due" | "Today" | "Later">("All");
  const canUpload = canAccessPath(role, "/dashboard/upload-leads", user?.finance_level);

  useEffect(() => {
    listMyLeads()
      .then((data) => {
        const due = (data.items || []).filter(
          (row) => row.next_followup_at && row.pipeline_stage !== "disbursed" && row.pipeline_stage !== "rejected" && !row.converted,
        );
        due.sort((a, b) => new Date(a.next_followup_at || 0).getTime() - new Date(b.next_followup_at || 0).getTime());
        setRows(due);
      })
      .catch(() => setRows([]));
  }, []);

  const marked = (rows || []).map((row) => ({ row, mark: whenLabel(row.next_followup_at || "") }));
  const visible = marked.filter((item) => filter === "All" || item.mark.tone === filter);

  return (
    <section className="rounded-3xl border border-[#d8ecdd] bg-white p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-bold text-[#390A5D]">Follow-ups and callbacks</h2>
          <p className="mt-1 text-sm text-[#5c4d72]">Every saved date is here. Due stays first. A status without a date does not appear.</p>
        </div>
        {canUpload ? (
          <Link to="/dashboard/upload-leads" className="rounded-lg bg-[#10662A] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#0D4F20]">
            Add from Excel
          </Link>
        ) : null}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {(["All", "Due", "Today", "Later"] as const).map((tone) => (
          <button
            key={tone}
            type="button"
            onClick={() => setFilter(tone)}
            className={`rounded-full px-3 py-1 text-xs font-semibold ${filter === tone ? "bg-[#0D4F20] text-white" : "bg-[#E8F7EC] text-[#0D4F20]"}`}
          >
            {tone} {tone === "All" ? marked.length : marked.filter((item) => item.mark.tone === tone).length}
          </button>
        ))}
      </div>
      {rows === null ? (
        <p className="mt-4 text-sm text-[#5c4d72]">Loading follow-ups…</p>
      ) : visible.length === 0 ? (
        <p className="mt-4 text-sm text-[#5c4d72]">Nothing in this list. On the lead, pick 2 days, 1 week, 1 month or 2 months, then Save status.</p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-[#d8ecdd] text-[11px] font-bold uppercase tracking-wide text-[#5c4d72]">
                <th className="py-2 pr-3 font-bold">Customer</th>
                <th className="py-2 pr-3 font-bold">Product</th>
                <th className="py-2 pr-3 font-bold">Status</th>
                <th className="py-2 pr-3 font-bold">When</th>
                <th className="py-2 pr-3 font-bold">Timing</th>
                <th className="py-2 font-bold" />
              </tr>
            </thead>
            <tbody>
              {visible.map(({ row, mark }) => (
                <tr key={row.id} className="border-b border-[#eef6f0]">
                  <td className="py-2.5 pr-3">
                    <p className="font-semibold text-[#390A5D]">{row.lead?.applicant_name || "Lead"}</p>
                    <p className="text-xs text-[#5c4d72]">{row.lead?.city || ""}</p>
                  </td>
                  <td className="py-2.5 pr-3 text-[#14281c]">{row.lead?.product_subtype || row.lead?.loan_type || "—"}</td>
                  <td className="py-2.5 pr-3 text-[#14281c]">{labelOf(row)}</td>
                  <td className="py-2.5 pr-3 font-semibold text-[#14281c]">{mark.clock}</td>
                  <td className={`py-2.5 pr-3 text-xs font-bold uppercase ${mark.tone === "Due" ? "text-[#0D4F20]" : "text-[#5c4d72]"}`}>{mark.tone}</td>
                  <td className="py-2.5 text-right">
                    <Link to="/dashboard/customer/$id" params={{ id: row.id }} className="rounded-lg bg-[#10662A] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#0D4F20]">
                      Open
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
