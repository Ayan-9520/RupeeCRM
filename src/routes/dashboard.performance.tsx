import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { getPerformance, type PerformanceReport } from "@/lib/python-api";

export const Route = createFileRoute("/dashboard/performance")({
  head: () => ({ meta: [{ title: "Performance — RupeeOne" }] }),
  component: PerformancePage,
});

const PERIODS = [
  { id: "month", label: "This month" },
  { id: "quarter", label: "This quarter" },
  { id: "year", label: "This year" },
] as const;

function inr(value: number) {
  return `₹${Math.round(Number(value) || 0).toLocaleString("en-IN")}`;
}

function PerformancePage() {
  const [period, setPeriod] = useState<(typeof PERIODS)[number]["id"]>("month");
  const [report, setReport] = useState<PerformanceReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let live = true;
    setLoading(true);
    getPerformance(period)
      .then((data) => {
        if (live) setReport(data);
      })
      .catch((error: unknown) => {
        toast.error(error instanceof Error ? error.message : "Could not load performance");
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [period]);

  const showMoney = report?.view === "company" || report?.view === "unit" || report?.view === "coordinator";

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-2xl lg:text-3xl font-bold">Performance</h1>
          <p className="text-muted-foreground mt-1 text-sm max-w-2xl">{report?.intro}</p>
          {report?.reports_to ? <p className="text-sm mt-1">Reports to {report.reports_to}.</p> : null}
        </div>
        <div className="flex gap-2">
          {PERIODS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setPeriod(item.id)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold border ${
                period === item.id ? "bg-[#10662A] text-white border-[#10662A]" : "border-border text-muted-foreground"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {loading || !report ? (
        <div className="grid place-items-center py-20">
          <Loader2 className="size-6 animate-spin text-[#10662A]" />
        </div>
      ) : (
        <>
          <p className="text-sm font-semibold text-[#390A5D]">{report.label}</p>
          {showMoney ? (
            <p className="text-sm text-muted-foreground">
              Company revenue is the lender payout left after the partner agreement. Plan sales are the catalogue price of plans started in this period. A disbursed file with no case yet shows the loan amount and a zero payout.
            </p>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {report.cards.map((card) => (
              <div key={card.label} className="rounded-2xl border border-border bg-card p-4 shadow-card">
                <p className="text-xs text-muted-foreground">{card.label}</p>
                <p className="mt-1 text-2xl font-bold">{card.money ? inr(card.value) : card.value}</p>
              </div>
            ))}
          </div>

          {report.view === "unit" && report.team.length > 0 ? (
            <section className="rounded-2xl border border-border bg-card shadow-card overflow-hidden">
              <h2 className="px-4 py-3 font-semibold">Team</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2 font-medium">Name</th>
                      <th className="px-4 py-2 font-medium">Seat</th>
                      <th className="px-4 py-2 font-medium">Calls</th>
                      <th className="px-4 py-2 font-medium">Interested</th>
                      <th className="px-4 py-2 font-medium">Handed over</th>
                      <th className="px-4 py-2 font-medium">Bank results</th>
                      <th className="px-4 py-2 font-medium">Partners</th>
                      <th className="px-4 py-2 font-medium">Company revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.team.map((person) => (
                      <tr key={person.id} className="border-t border-border">
                        <td className="px-4 py-2">{person.name}</td>
                        <td className="px-4 py-2">{person.seat}</td>
                        <td className="px-4 py-2">{person.calls || 0}</td>
                        <td className="px-4 py-2">{person.interested || 0}</td>
                        <td className="px-4 py-2">{person.handed || 0}</td>
                        <td className="px-4 py-2">{person.bank || 0}</td>
                        <td className="px-4 py-2">{person.partners || 0}</td>
                        <td className="px-4 py-2">{person.seat === "DSA coordinator" ? inr(person.company_revenue || 0) : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}

          {showMoney ? (
            <section className="rounded-2xl border border-border bg-card shadow-card overflow-hidden">
              <h2 className="px-4 py-3 font-semibold">Partners</h2>
              {report.partners.length === 0 ? (
                <p className="px-4 pb-4 text-sm text-muted-foreground">
                  No partners are mapped yet. On a partner, set RM1 to the DSA coordinator who looks after them. That coordinator reports to the unit head.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-left text-muted-foreground">
                      <tr>
                        <th className="px-4 py-2 font-medium">Name</th>
                        <th className="px-4 py-2 font-medium">Agreement</th>
                        <th className="px-4 py-2 font-medium">Disbursed</th>
                        <th className="px-4 py-2 font-medium">Lender payout</th>
                        <th className="px-4 py-2 font-medium">Partner share</th>
                        <th className="px-4 py-2 font-medium">Company revenue</th>
                        <th className="px-4 py-2 font-medium">Plan</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.partners.map((person) => (
                        <tr key={person.id} className="border-t border-border">
                          <td className="px-4 py-2">{person.name}</td>
                          <td className="px-4 py-2">{person.agreement_percent ? `${person.agreement_percent}%` : "—"}</td>
                          <td className="px-4 py-2">{inr(person.disbursed_amount || 0)}</td>
                          <td className="px-4 py-2">{inr(person.lender_payout || 0)}</td>
                          <td className="px-4 py-2">{inr(person.partner_share || 0)}</td>
                          <td className="px-4 py-2">{inr(person.company_revenue || 0)}</td>
                          <td className="px-4 py-2">{inr(person.plan_sales || 0)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
