import { createFileRoute, Link } from "@tanstack/react-router";
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
  const [gst, setGst] = useState("18");
  const [tds, setTds] = useState("2");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getCommissionRule()
      .then((data) => {
        setPercent(String(data.rate_percent));
        if (data.gst_percent != null) setGst(String(data.gst_percent));
        if (data.tds_percent != null) setTds(String(data.tds_percent));
      })
      .catch((error) => toast.error(error instanceof Error ? error.message : "Could not load the rate"))
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    const value = Number(percent);
    const gstValue = Number(gst);
    const tdsValue = Number(tds);
    if ([value, gstValue, tdsValue].some((n) => Number.isNaN(n))) {
      toast.error("Enter valid percents");
      return;
    }
    setBusy(true);
    try {
      const saved = await saveCommissionRule(value, { gst_percent: gstValue, tds_percent: tdsValue });
      setPercent(String(saved.rate_percent));
      if (saved.gst_percent != null) setGst(String(saved.gst_percent));
      if (saved.tds_percent != null) setTds(String(saved.tds_percent));
      toast.success("Commission and tax saved");
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

  const field = (id: string, label: string, value: string, set: (v: string) => void, max: number) => (
    <div>
      <label className="text-sm font-semibold text-[#390A5D]" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        type="number"
        min={0}
        max={max}
        step={0.1}
        value={value}
        onChange={(event) => set(event.target.value)}
        className="mt-1 w-full rounded-xl border border-[#d8ecdd] px-3 py-2 text-sm"
      />
    </div>
  );

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <div>
        <h1 className="font-display text-2xl font-bold text-[#390A5D]">Commission Rules</h1>
        <p className="mt-1 text-sm text-[#5c4d72]">
          This percent applies to a disbursed case when a partner raises an invoice. Network share is still set on Network Rules.
        </p>
      </div>
      <section className="space-y-4 rounded-2xl border border-[#d8ecdd] bg-white p-4">
        <div className="grid gap-3 sm:grid-cols-3">
          {field("rate", "Payout %", percent, setPercent, 100)}
          {field("gst", "GST %", gst, setGst, 50)}
          {field("tds", "TDS %", tds, setTds, 50)}
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={() => void save()}
          className="rounded-xl bg-[#10662A] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          Save
        </button>
        <ul className="space-y-1 text-xs text-[#5c4d72]">
          <li>A ₹5,00,000 disbursal at 1% is ₹5,000 commission.</li>
          <li>GST is added only when the partner has a GSTIN in Settings. TDS is deducted from the commission (before GST).</li>
          <li>New rates apply to invoices raised after saving. Confirm the GST and TDS rates with your CA.</li>
          <li>
            Lender sheets and case subvention are on{" "}
            <Link to="/dashboard/admin/payout-grids" className="font-semibold text-[#10662A]">
              Payout Grids
            </Link>
            . This page does not change those rates.
          </li>
        </ul>
      </section>
    </div>
  );
}
