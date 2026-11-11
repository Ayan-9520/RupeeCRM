import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, Trophy } from "lucide-react";
import { listLeaderboard } from "@/lib/python-api";

export const Route = createFileRoute("/dashboard/leaderboard")({
  head: () => ({ meta: [{ title: "Leaderboard — RupeeOne" }] }),
  component: LeaderboardPage,
});

type Row = {
  name: string;
  dsa_id: string;
  role: string;
  sales_title: string;
  purchases: number;
  conversions: number;
  disbursed_value: number;
};

function inr(value: number) {
  return `₹${Math.round(value || 0).toLocaleString("en-IN")}`;
}

function LeaderboardPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    listLeaderboard()
      .then((data) => setRows(data.items ?? []))
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load the leaderboard"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="font-display text-2xl lg:text-3xl font-bold text-[#390A5D] flex items-center gap-2">
          <Trophy className="size-7 text-[#10662A]" /> Partner leaderboard
        </h1>
        <p className="text-[#5c4d72] mt-1 text-sm">
          Ranked by disbursed value, then converted cases, then leads taken. A converted or disbursed case is one point of work, and the rupee figure is the deal value on that case.
        </p>
      </div>

      <div className="rounded-2xl border border-[#d8ecdd] bg-white overflow-hidden">
        {loading ? (
          <div className="p-12 grid place-items-center">
            <Loader2 className="size-5 animate-spin text-[#10662A]" />
          </div>
        ) : error ? (
          <div className="p-12 text-center text-sm text-[#5c4d72]">{error}</div>
        ) : rows.length === 0 ? (
          <div className="p-12 text-center text-sm text-[#5c4d72]">No active partners yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-[#f8fcf9] text-[11px] uppercase tracking-wide text-[#5c4d72]">
              <tr>
                <th className="text-left py-2.5 px-4">#</th>
                <th className="text-left py-2.5 px-4">Name</th>
                <th className="text-left py-2.5 px-4">DSA ID</th>
                <th className="text-right py-2.5 px-4">Converted</th>
                <th className="text-right py-2.5 px-4">Disbursed</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={`${row.dsa_id}-${index}`} className="border-t border-[#d8ecdd]">
                  <td className="py-3 px-4 font-bold text-[#10662A]">{index + 1}</td>
                  <td className="py-3 px-4">
                    <div className="font-medium text-[#390A5D]">{row.name}</div>
                    <div className="text-[11px] text-[#5c4d72]">{row.sales_title || row.role}</div>
                  </td>
                  <td className="py-3 px-4 font-mono text-xs">{row.dsa_id || "—"}</td>
                  <td className="py-3 px-4 text-right">{row.conversions}</td>
                  <td className="py-3 px-4 text-right font-semibold text-[#0D4F20]">{inr(row.disbursed_value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
