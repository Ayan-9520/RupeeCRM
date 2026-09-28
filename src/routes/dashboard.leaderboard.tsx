import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, Trophy } from "lucide-react";
import { listCrmUsers } from "@/lib/python-api";

export const Route = createFileRoute("/dashboard/leaderboard")({
  head: () => ({ meta: [{ title: "Leaderboard — RupeeDial One" }] }),
  component: LeaderboardPage,
});

function LeaderboardPage() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<{ name: string; dsa: string; role: string }[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const data = await listCrmUsers();
        const dsas = (data.items ?? [])
          .filter((u) => u.dsa_id || u.role === "dsa" || u.role === "partner")
          .sort((a, b) => (a.full_name || "").localeCompare(b.full_name || ""));
        setRows(
          dsas.map((u) => ({
            name: u.full_name || u.email,
            dsa: u.dsa_id || "—",
            role: u.role,
          })),
        );
      } catch {
        setRows([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="font-display text-2xl lg:text-3xl font-bold text-[#390A5D] flex items-center gap-2">
          <Trophy className="size-7 text-[#10662A]" /> DSA Leaderboard
        </h1>
        <p className="text-[#5c4d72] mt-1 text-sm">
          Simple ranking of CRM users with DSA IDs. Sales points arrive in a later release.
        </p>
      </div>

      <div className="rounded-2xl border border-[#d8ecdd] bg-white overflow-hidden">
        {loading ? (
          <div className="p-12 grid place-items-center">
            <Loader2 className="size-5 animate-spin text-[#10662A]" />
          </div>
        ) : rows.length === 0 ? (
          <div className="p-12 text-center text-sm text-[#5c4d72]">No DSA users yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-[#f8fcf9] text-[11px] uppercase tracking-wide text-[#5c4d72]">
              <tr>
                <th className="text-left py-2.5 px-4">#</th>
                <th className="text-left py-2.5 px-4">Name</th>
                <th className="text-left py-2.5 px-4">DSA ID</th>
                <th className="text-left py-2.5 px-4">Role</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={`${r.dsa}-${i}`} className="border-t border-[#d8ecdd]">
                  <td className="py-3 px-4 font-bold text-[#10662A]">{i + 1}</td>
                  <td className="py-3 px-4 font-medium text-[#390A5D]">{r.name}</td>
                  <td className="py-3 px-4 font-mono text-xs">{r.dsa}</td>
                  <td className="py-3 px-4 capitalize text-[#5c4d72]">{r.role}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
