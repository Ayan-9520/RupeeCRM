import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { getCommissionRule, saveCommissionRule } from "@/lib/python-api";

export const Route = createFileRoute("/dashboard/admin/commissions")({
  head: () => ({ meta: [{ title: "Commission Rules — Admin" }] }),
  component: CommissionRulesPage,
});

function CommissionRulesPage() {
  const [percent, setPercent] = useState("1");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getCommissionRule()
      .then((data) => setPercent(String(data.rate_percent)))
      .catch((error) => toast.error(error instanceof Error ? error.message : "Could not load the rate"))
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    const value = Number(percent);
    if (Number.isNaN(value)) {
      toast.error("Enter a percent");
      return;
    }
    setBusy(true);
    try {
      const saved = await saveCommissionRule(value);
      setPercent(String(saved.rate_percent));
      toast.success("Commission percent saved");
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
    <div className="mx-auto max-w-xl space-y-4">
      <div>
        <h1 className="font-display text-2xl font-bold text-[#390A5D]">Commission Rules</h1>
        <p className="mt-1 text-sm text-[#5c4d72]">
          This percent applies to a disbursed case when a partner raises an invoice. Network share is still set on Network Rules.
        </p>
      </div>
      <section className="rounded-2xl border border-[#d8ecdd] bg-white p-4">
        <label className="text-sm font-semibold text-[#390A5D]" htmlFor="rate">
          Payout percent
        </label>
        <div className="mt-2 flex gap-2">
          <input
            id="rate"
            type="number"
            min={0}
            max={100}
            step={0.1}
            value={percent}
            onChange={(event) => setPercent(event.target.value)}
            className="w-32 rounded-xl border border-[#d8ecdd] px-3 py-2 text-sm"
          />
          <button
            type="button"
            disabled={busy}
            onClick={() => void save()}
            className="rounded-xl bg-[#10662A] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            Save
          </button>
        </div>
        <p className="mt-3 text-xs text-[#5c4d72]">Default is 1. A ₹5,00,000 disbursal at 1% is ₹5,000 commission.</p>
      </section>
    </div>
  );
}
