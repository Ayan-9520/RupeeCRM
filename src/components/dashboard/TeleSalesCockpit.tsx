import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Phone } from "lucide-react";
import { listMyLeads, type CrmPurchase } from "@/lib/python-api";
import { TELE_SECTIONS, telesalesStats } from "@/lib/telesales";

export function TeleSalesCockpit({ firstName }: { firstName: string }) {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(() => telesalesStats([]));

  useEffect(() => {
    let cancelled = false;
    listMyLeads()
      .then((data) => {
        if (!cancelled) setStats(telesalesStats(data.items ?? []));
      })
      .catch(() => {
        if (!cancelled) setStats(telesalesStats([] as CrmPurchase[]));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const cards = [
    { label: "Call queue", value: stats.queue, hint: "New or contacted" },
    { label: "Follow-ups due", value: stats.followups, hint: "Today or overdue" },
    { label: "Calls today", value: stats.callsToday, hint: "Dispositions logged" },
    { label: "Interested", value: stats.interested, hint: "Marked today" },
    { label: "Callbacks", value: stats.callbacks, hint: "Scheduled today" },
    { label: "Connect rate", value: `${stats.connectRate}%`, hint: "Connected / calls today" },
  ];

  return (
    <div className="max-w-7xl space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#10662A]">TeleSales</p>
          <h1 className="mt-1 font-display text-2xl font-extrabold text-[#390A5D] lg:text-3xl">
            {firstName ? `${firstName}'s calling desk` : "Calling desk"}
          </h1>
          <p className="mt-1 max-w-xl text-sm text-[#5c4d72]">
            Queue, follow-ups, scripts, disposition and conversion. Lender matching stays outside this desk.
          </p>
        </div>
        <Link
          to="/dashboard/calls"
          className="inline-flex items-center gap-2 rounded-xl bg-[#10662A] px-4 py-2.5 text-sm font-semibold text-white"
        >
          <Phone className="size-4" /> Open call queue
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        {cards.map((card) => (
          <div key={card.label} className="rounded-2xl border border-[#d8ecdd] bg-white px-4 py-3.5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[#5c4d72]">{card.label}</p>
            <p className="mt-1 font-display text-xl font-extrabold text-[#390A5D]">{loading ? "…" : card.value}</p>
            <p className="mt-0.5 text-[11px] text-slate-500">{card.hint}</p>
          </div>
        ))}
      </div>

      <div>
        <h2 className="font-display text-lg font-bold text-[#390A5D]">TeleSales</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {TELE_SECTIONS.map((item) => (
            <a
              key={item.id}
              href={`/dashboard/calls#${item.id}`}
              className="rounded-full border border-[#d8ecdd] bg-white px-3 py-1.5 text-sm font-semibold text-[#390A5D] hover:border-[#10662A] hover:bg-[#f5fcf7]"
            >
              {item.label}
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
