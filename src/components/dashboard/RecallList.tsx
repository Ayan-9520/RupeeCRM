import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { listMyLeads, type CrmPurchase } from "@/lib/python-api";

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
  if (diff < 0) return { tone: "Due", clock };
  if (diff === 0) return { tone: "Today", clock };
  return { tone: "Later", clock };
}

export function RecallList() {
  const [rows, setRows] = useState<CrmPurchase[]>([]);

  useEffect(() => {
    listMyLeads()
      .then((data) => {
        const due = (data.items || []).filter((row) => row.next_followup_at);
        due.sort((a, b) => new Date(a.next_followup_at || 0).getTime() - new Date(b.next_followup_at || 0).getTime());
        setRows(due);
      })
      .catch(() => setRows([]));
  }, []);

  if (rows.length === 0) return null;

  return (
    <section className="rounded-3xl border border-[#d8ecdd] bg-white p-5">
      <h2 className="font-display text-lg font-bold text-[#390A5D]">Recall</h2>
      <p className="mt-1 text-sm text-[#5c4d72]">Calls saved with a date. Due ones stay at the top.</p>
      <ul className="mt-3 divide-y divide-[#eef6f0]">
        {rows.map((row) => {
          const mark = whenLabel(row.next_followup_at || "");
          return (
            <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
              <div>
                <p className="font-semibold text-[#390A5D]">{row.lead?.applicant_name || "Lead"}</p>
                <p className="text-sm text-[#5c4d72]">{labelOf(row)} · {row.lead?.city || ""}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-xs font-bold uppercase ${mark.tone === "Due" ? "text-[#0D4F20]" : "text-[#5c4d72]"}`}>{mark.tone}</span>
                <span className="text-sm font-semibold text-[#14281c]">{mark.clock}</span>
                <Link to="/dashboard/customer/$id" params={{ id: row.id }} className="rounded-lg bg-[#10662A] px-3 py-1.5 text-xs font-semibold text-white">
                  Open
                </Link>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
