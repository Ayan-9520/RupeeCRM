import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { getNetworkSettings, saveNetworkSettings, type NetworkLevel } from "@/lib/python-api";

export const Route = createFileRoute("/dashboard/admin/network")({
  head: () => ({ meta: [{ title: "Network Rules — Admin" }] }),
  component: NetworkRulesPage,
});

function NetworkRulesPage() {
  const [levels, setLevels] = useState<NetworkLevel[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getNetworkSettings()
      .then((data) => setLevels(data.levels.length ? data.levels : [{ label: "Direct connector", share_percent: 0 }]))
      .catch((error) => toast.error(error instanceof Error ? error.message : "Could not load rules"))
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setBusy(true);
    try {
      const saved = await saveNetworkSettings(levels.filter((level) => level.label.trim()));
      setLevels(saved.levels);
      toast.success("Network rules saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Save failed");
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="grid place-items-center py-16">
        <Loader2 className="size-6 animate-spin text-[#10662A]" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-5">
      <div>
        <h1 className="font-display text-2xl font-bold text-[#390A5D]">Network rules</h1>
        <p className="mt-1 text-sm text-[#5c4d72]">
          Each level is a percent of that connector&apos;s disbursed commission. Change it here. The partner screen reads these numbers.
        </p>
      </div>
      <div className="space-y-3">
        {levels.map((level, index) => (
          <div key={index} className="grid grid-cols-[1fr_120px_auto] gap-2">
            <input
              value={level.label}
              onChange={(event) =>
                setLevels((prev) => prev.map((item, i) => (i === index ? { ...item, label: event.target.value } : item)))
              }
              className="rounded-xl border border-[#d8ecdd] px-3 py-2 text-sm"
              placeholder="Level name"
            />
            <input
              type="number"
              min={0}
              max={100}
              value={level.share_percent}
              onChange={(event) =>
                setLevels((prev) =>
                  prev.map((item, i) => (i === index ? { ...item, share_percent: Number(event.target.value) } : item)),
                )
              }
              className="rounded-xl border border-[#d8ecdd] px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={() => setLevels((prev) => prev.filter((_, i) => i !== index))}
              className="rounded-xl border border-[#d8ecdd] px-3 text-xs font-semibold"
            >
              Remove
            </button>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setLevels((prev) => [...prev, { label: `Level ${prev.length + 1}`, share_percent: 0 }])}
          className="rounded-xl border border-[#d8ecdd] px-4 py-2 text-sm font-semibold"
        >
          Add level
        </button>
        <button type="button" disabled={busy} onClick={() => void save()} className="rounded-xl bg-[#10662A] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
          {busy ? "Saving…" : "Save rules"}
        </button>
      </div>
    </div>
  );
}
