import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, BarChart3, Users, Target, Briefcase } from "lucide-react";
import { listCrmLeads, listCrmPartners, listMyLeads } from "@/lib/python-api";

export const Route = createFileRoute("/dashboard/los-executive")({
  head: () => ({ meta: [{ title: "Executive Analytics — RupeeDial One" }] }),
  component: LosExecutivePage,
});

function LosExecutivePage() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    leads: 0,
    available: 0,
    purchases: 0,
    conversionRate: 0,
    partnersPending: 0,
    partnersApproved: 0,
    avgDeal: 0,
  });

  useEffect(() => {
    (async () => {
      try {
        const [leads, mine, partners] = await Promise.all([
          listCrmLeads({ limit: 200 }).catch(() => ({ items: [], total: 0 })),
          listMyLeads().catch(() => ({ items: [], total: 0, stages: [] as string[] })),
          listCrmPartners().catch(() => ({ items: [], total: 0 })),
        ]);
        const items = leads.items ?? [];
        const purchases = mine.items ?? [];
        const converted = purchases.filter((p) => p.converted);
        const dealSum = converted.reduce((s, p) => s + Number(p.deal_value || 0), 0);
        const pItems = partners.items ?? [];
        setStats({
          leads: leads.total ?? items.length,
          available: items.filter((l) => l.sale_available !== false && l.is_marketplace).length,
          purchases: purchases.length,
          conversionRate: purchases.length ? Math.round((converted.length / purchases.length) * 100) : 0,
          partnersPending: pItems.filter((p) => p.status === "pending" || p.status === "under_review").length,
          partnersApproved: pItems.filter((p) => p.status === "approved").length,
          avgDeal: converted.length ? Math.round(dealSum / converted.length) : 0,
        });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div className="grid place-items-center py-20">
        <Loader2 className="size-6 animate-spin text-[#10662A]" />
      </div>
    );
  }

  const cards = [
    { label: "Total CRM leads", value: stats.leads, icon: Briefcase },
    { label: "On marketplace", value: stats.available, icon: Target },
    { label: "Purchases", value: stats.purchases, icon: BarChart3 },
    { label: "Conversion rate", value: `${stats.conversionRate}%`, icon: Target },
    { label: "Partners pending", value: stats.partnersPending, icon: Users },
    { label: "Partners approved", value: stats.partnersApproved, icon: Users },
    { label: "Avg deal value", value: `₹${stats.avgDeal.toLocaleString("en-IN")}`, icon: BarChart3 },
  ];

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl lg:text-3xl font-bold text-[#390A5D]">Executive view</h1>
          <p className="text-[#5c4d72] mt-1 text-sm">Cross-CRM snapshot for leadership — leads, pipeline, partners.</p>
        </div>
        <Link to="/dashboard/los-analytics" className="text-sm font-semibold text-[#10662A] hover:underline">
          Detailed analytics →
        </Link>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-2xl border border-[#d8ecdd] bg-white p-5">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[#5c4d72]">
              <c.icon className="size-3.5 text-[#10662A]" /> {c.label}
            </div>
            <div className="font-display text-2xl font-bold text-[#390A5D] mt-2">{c.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
