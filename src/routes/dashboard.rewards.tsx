import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Award, Gift, Loader2, Lock, Star } from "lucide-react";
import { listCertificates, type CrmCertificate } from "@/lib/python-api";

export const Route = createFileRoute("/dashboard/rewards")({
  head: () => ({ meta: [{ title: "Rewards — RupeeDial One" }] }),
  component: RewardsPage,
});

const LEVELS = [
  { name: "Starter", min: 0 },
  { name: "Bronze", min: 300 },
  { name: "Silver", min: 800 },
  { name: "Gold", min: 1400 },
  { name: "Platinum", min: 2110 },
] as const;

type Available = { slug: string; title: string; badge: string; points: number };

function RewardsPage() {
  const [items, setItems] = useState<CrmCertificate[]>([]);
  const [available, setAvailable] = useState<Available[]>([]);
  const [points, setPoints] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listCertificates()
      .then((data) => {
        setItems(data.items);
        setAvailable(data.available);
        setPoints(data.total_points);
      })
      .catch((error: Error) => toast.error(error.message || "Could not load rewards"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="grid place-items-center py-16">
        <Loader2 className="size-6 animate-spin text-[#10662A]" />
      </div>
    );
  }

  const levelIndex = LEVELS.reduce((acc, l, i) => (points >= l.min ? i : acc), 0);
  const level = LEVELS[levelIndex];
  const next = LEVELS[levelIndex + 1];
  const progress = next ? Math.round(((points - level.min) / (next.min - level.min)) * 100) : 100;

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="flex items-center gap-2 font-display text-2xl font-bold text-[#390A5D]">
          <Gift className="size-6 text-[#10662A]" /> Rewards
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-[#5c4d72]">
          Earn points by passing course quizzes. Your level and badges show your training progress. Cash earnings stay on the Invoices page.
        </p>
      </div>

      <div className="rounded-3xl bg-gradient-to-br from-[#14803a] via-[#10662A] to-[#0B3F1A] p-6 text-white">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/70">Your level</p>
            <p className="mt-1 font-display text-3xl font-bold">{level.name}</p>
          </div>
          <div className="text-right">
            <p className="font-display text-3xl font-bold">{points.toLocaleString("en-IN")}</p>
            <p className="text-xs text-white/70">points</p>
          </div>
        </div>
        <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/20">
          <div className="h-full rounded-full bg-white" style={{ width: `${Math.min(100, progress)}%` }} />
        </div>
        <p className="mt-2 text-xs text-white/80">
          {next ? `${(next.min - points).toLocaleString("en-IN")} points to ${next.name}` : "Top level reached — every course completed."}
        </p>
      </div>

      <section>
        <h2 className="font-semibold text-[#390A5D]">Badges</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((c) => (
            <div key={c.id} className="rounded-2xl border border-[#d8ecdd] bg-white p-4 text-center">
              <div className="mx-auto grid size-12 place-items-center rounded-full bg-[#E8F7EC] text-[#10662A]">
                <Award className="size-6" />
              </div>
              <p className="mt-2 font-semibold text-[#390A5D]">{c.badge}</p>
              <p className="text-xs text-[#5c4d72]">+{c.points} pts</p>
            </div>
          ))}
          {available.map((a) => (
            <Link
              key={a.slug}
              to="/learn-quiz/$slug"
              params={{ slug: a.slug }}
              className="rounded-2xl border border-dashed border-[#d8ecdd] bg-white/60 p-4 text-center hover:border-[#10662A]/40"
            >
              <div className="mx-auto grid size-12 place-items-center rounded-full bg-slate-100 text-slate-400">
                <Lock className="size-5" />
              </div>
              <p className="mt-2 font-semibold text-slate-500">{a.badge}</p>
              <p className="text-xs text-slate-500">+{a.points} pts · take quiz</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-[#d8ecdd] bg-white p-5">
        <h2 className="flex items-center gap-2 font-semibold text-[#390A5D]">
          <Star className="size-4 text-[#10662A]" /> Levels
        </h2>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
          {LEVELS.map((l, i) => (
            <div
              key={l.name}
              className={`rounded-xl border px-3 py-2 text-center text-xs ${
                i <= levelIndex ? "border-[#10662A]/30 bg-[#E8F7EC] text-[#10662A]" : "border-[#d8ecdd] text-slate-500"
              }`}
            >
              <p className="font-bold">{l.name}</p>
              <p>{l.min.toLocaleString("en-IN")}+ pts</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
