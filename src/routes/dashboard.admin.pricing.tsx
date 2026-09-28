import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CATEGORIES, type ProductCategory } from "@/lib/products";

export const Route = createFileRoute("/dashboard/admin/pricing")({
  head: () => ({ meta: [{ title: "Admin Pricing — RupeeDial One" }] }),
  component: AdminPricingPage,
});

const STORAGE_KEY = "rd_crm_category_prices";

const DEFAULTS: Record<ProductCategory, number> = {
  loan: 99,
  insurance: 149,
  credit_card: 79,
  investment: 129,
};

function loadPrices(): Record<ProductCategory, number> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    /* ignore */
  }
  return { ...DEFAULTS };
}

function AdminPricingPage() {
  const [prices, setPrices] = useState<Record<ProductCategory, number>>(DEFAULTS);

  useEffect(() => {
    setPrices(loadPrices());
  }, []);

  const save = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prices));
    toast.success("Saved category prices locally");
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="font-display text-2xl lg:text-3xl font-bold text-[#390A5D]">Pricing</h1>
        <p className="text-[#5c4d72] mt-1 text-sm">
          Default lead prices by category (stored in localStorage). Used as guide when creating CRM leads.
        </p>
      </div>

      <div className="rounded-2xl border border-[#d8ecdd] bg-white divide-y divide-[#d8ecdd]">
        {CATEGORIES.map((c) => (
          <div key={c.key} className="flex items-center justify-between gap-4 px-5 py-4">
            <div>
              <div className="font-semibold text-[#390A5D]">{c.label}</div>
              <div className="text-xs text-[#5c4d72]">{c.tagline}</div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-[#5c4d72]">₹</span>
              <input
                type="number"
                className="input-base w-28"
                value={prices[c.key]}
                onChange={(e) => setPrices((p) => ({ ...p, [c.key]: Number(e.target.value) || 0 }))}
              />
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={save}
        className="rounded-xl bg-[#10662A] text-white px-5 py-2.5 text-sm font-semibold hover:opacity-90"
      >
        Save prices
      </button>
    </div>
  );
}
