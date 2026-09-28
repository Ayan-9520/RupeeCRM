import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, Users, Store, KanbanSquare, Handshake, TrendingUp } from "lucide-react";
import { listCrmLeads, listCrmPartners, listMyLeads, getCrmUser } from "@/lib/python-api";
import { isPlatformAdmin } from "@/lib/role-access";
import type { AppRole } from "@/lib/auth-context";

export const Route = createFileRoute("/dashboard/los-analytics")({
  head: () => ({ meta: [{ title: "LOS Analytics — RupeeDial One" }] }),
  component: LosAnalyticsPage,
});

type Kpis = {
  marketplaceLeads: number;
  myPurchases: number;
  converted: number;
  partners: number;
  pipelineValue: number;
  spent: number;
};

function LosAnalyticsPage() {
  const admin = isPlatformAdmin((getCrmUser()?.role as AppRole) || null);
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState<Kpis>({
    marketplaceLeads: 0,
    myPurchases: 0,
    converted: 0,
    partners: 0,
    pipelineValue: 0,
    spent: 0,
  });

  useEffect(() => {
    (async () => {
      try {
        const [leads, mine, partners] = await Promise.all([
          listCrmLeads({ limit: 200 }).catch(() => ({ items: [], total: 0 })),
          listMyLeads().catch(() => ({ items: [], total: 0, stages: [] as string[] })),
          admin
            ? listCrmPartners().catch(() => ({ items: [], total: 0 }))
            : Promise.resolve({ items: [], total: 0 }),
        ]);
        const purchases = mine.items ?? [];
        setKpis({
          marketplaceLeads: leads.total ?? leads.items?.length ?? 0,
          myPurchases: mine.total ?? purchases.length,
          converted: purchases.filter((p) => p.converted).length,
          partners: partners.total ?? partners.items?.length ?? 0,
          pipelineValue: purchases.reduce((s, p) => s + Number(p.deal_value || p.lead?.loan_amount || 0), 0),
          spent: purchases.reduce((s, p) => s + Number(p.price_paid || 0), 0),
        });
      } finally {
        setLoading(false);
      }
    })();
  }, [admin]);

  if (loading) {
    return (
      <div className="grid place-items-center py-20">
        <Loader2 className="size-6 animate-spin text-[#10662A]" />
      </div>
    );
  }

  const cards = [
    { label: "Marketplace leads", value: kpis.marketplaceLeads, icon: Store, to: "/dashboard/leadboard" },
    { label: "My purchases", value: kpis.myPurchases, icon: KanbanSquare, to: "/dashboard/my-leads" },
    { label: "Converted", value: kpis.converted, icon: TrendingUp, to: "/dashboard/earnings" },
    admin
      ? { label: "Partner apps", value: kpis.partners, icon: Handshake, to: "/dashboard/admin/partners" }
      : { label: "Team / seats", value: "—", icon: Handshake, to: "/dashboard/billing" },
    { label: "Pipeline value", value: `₹${kpis.pipelineValue.toLocaleString("en-IN")}`, icon: Users, to: "/dashboard/cases" },
    { label: "Lead spend", value: `₹${kpis.spent.toLocaleString("en-IN")}`, icon: Store, to: "/dashboard/wallet" },
  ];

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="font-display text-2xl lg:text-3xl font-bold text-[#390A5D]">LOS Analytics</h1>
        <p className="text-[#5c4d72] mt-1 text-sm">Live KPIs from CRM leads, purchases, and partner applications.</p>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map((c) => (
          <Link
            key={c.label}
            to={c.to}
            className="rounded-2xl border border-[#d8ecdd] bg-white p-5 shadow-[0_4px_20px_rgba(16,102,42,0.05)] hover:border-[#10662A]/40 transition-all"
          >
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[#5c4d72]">
              <c.icon className="size-3.5 text-[#10662A]" /> {c.label}
            </div>
            <div className="font-display text-2xl font-bold text-[#390A5D] mt-2">{c.value}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
