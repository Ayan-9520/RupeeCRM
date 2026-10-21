import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { ADMIN_ROLES } from "@/lib/role-access";
import { CATEGORIES, type ProductCategory } from "@/lib/products";
import { request } from "@/lib/python-api";

export const Route = createFileRoute("/dashboard/admin/pricing")({
  head: () => ({ meta: [{ title: "Admin Pricing — RupeeDial One" }] }),
  component: AdminPricingPage,
});

function AdminPricingPage() {
  const { role } = useAuth();
  const [prices, setPrices] = useState<Partial<Record<ProductCategory, number>>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const allowed = role != null && ADMIN_ROLES.includes(role);

  useEffect(() => {
    if (!allowed) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const data = await request<{ category_prices: Record<string, number> }>("/api/public/plans");
        if (!cancelled) setPrices(data.category_prices ?? {});
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load lead prices");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [allowed]);

  if (!allowed) {
    return <p className="text-sm text-destructive">Lead prices are available to administrators.</p>;
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="font-display text-2xl lg:text-3xl font-bold text-[#390A5D]">Pricing</h1>
        <p className="text-[#5c4d72] mt-1 text-sm">
          These are the category prices used when a marketplace lead is created. They are set in the application and are not edited from this screen.
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-[#5c4d72]">Loading prices…</p>
      ) : error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : (
        <div className="rounded-2xl border border-[#d8ecdd] bg-white divide-y divide-[#d8ecdd]">
          {CATEGORIES.map((c) => (
            <div key={c.key} className="flex items-center justify-between gap-4 px-5 py-4">
              <div>
                <div className="font-semibold text-[#390A5D]">{c.label}</div>
                <div className="text-xs text-[#5c4d72]">{c.tagline}</div>
              </div>
              <div className="text-sm font-semibold text-[#390A5D]">
                {prices[c.key] == null ? "—" : `₹${prices[c.key]}`}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
