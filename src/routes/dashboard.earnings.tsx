import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Loader2, TrendingUp, IndianRupee } from "lucide-react";
import { CATEGORY_META, calcCommission, type ProductCategory, type ProductType } from "@/lib/products";

export const Route = createFileRoute("/dashboard/earnings")({
  head: () => ({ meta: [{ title: "Earnings — LeadMines" }] }),
  component: Earnings,
});

type Row = {
  id: string;
  pipeline_stage: string;
  price_paid: number;
  created_at: string;
  leads: { product_category: ProductCategory; product_type_id: string | null; loan_amount: number; applicant_name: string } | null;
};

const CONVERTED_STAGES = new Set(["disbursed", "issued", "delivered", "invested", "approved", "payment"]);

function Earnings() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [types, setTypes] = useState<ProductType[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [purchasesRes, typesRes] = await Promise.all([
        supabase
          .from("lead_purchases")
          .select("id,pipeline_stage,price_paid,created_at,leads!inner(product_category,product_type_id,loan_amount,applicant_name)")
          .eq("dsa_id", user.id),
        supabase.from("product_types").select("*"),
      ]);
      setRows((purchasesRes.data ?? []) as unknown as Row[]);
      setTypes((typesRes.data ?? []) as ProductType[]);
      setLoading(false);
    })();
  }, [user]);

  const typeMap = useMemo(() => Object.fromEntries(types.map((t) => [t.id, t])) as Record<string, ProductType>, [types]);

  const breakdown = useMemo(() => {
    const out: Record<ProductCategory, { converted: number; pending: number; spent: number; commission: number }> = {
      loan: { converted: 0, pending: 0, spent: 0, commission: 0 },
      insurance: { converted: 0, pending: 0, spent: 0, commission: 0 },
      credit_card: { converted: 0, pending: 0, spent: 0, commission: 0 },
      investment: { converted: 0, pending: 0, spent: 0, commission: 0 },
    };
    rows.forEach((r) => {
      if (!r.leads) return;
      const cat = r.leads.product_category;
      const isConverted = CONVERTED_STAGES.has(r.pipeline_stage);
      out[cat].spent += Number(r.price_paid);
      if (isConverted) {
        out[cat].converted += 1;
        const t = r.leads.product_type_id ? typeMap[r.leads.product_type_id] : undefined;
        if (t) out[cat].commission += calcCommission(t, Number(r.leads.loan_amount));
      } else {
        out[cat].pending += 1;
      }
    });
    return out;
  }, [rows, typeMap]);

  const totals = useMemo(() => {
    const v = Object.values(breakdown);
    return {
      commission: v.reduce((s, x) => s + x.commission, 0),
      converted: v.reduce((s, x) => s + x.converted, 0),
      spent: v.reduce((s, x) => s + x.spent, 0),
      pending: v.reduce((s, x) => s + x.pending, 0),
    };
  }, [breakdown]);

  const conversionRate = rows.length > 0 ? (totals.converted / rows.length) * 100 : 0;

  if (loading) {
    return <div className="grid place-items-center py-20"><Loader2 className="size-6 animate-spin text-accent" /></div>;
  }

  return (
    <div className="space-y-6 max-w-7xl">
      <div>
        <h1 className="font-display text-2xl lg:text-3xl font-bold">Earnings & Commissions</h1>
        <p className="text-muted-foreground mt-1">Estimated commission per category based on converted leads.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat icon={IndianRupee} label="Total commission" value={`₹${totals.commission.toLocaleString("en-IN")}`} accent />
        <Stat icon={TrendingUp} label="Converted leads" value={totals.converted.toString()} />
        <Stat icon={IndianRupee} label="Conversion rate" value={`${conversionRate.toFixed(1)}%`} />
        <Stat icon={IndianRupee} label="Total spent" value={`₹${totals.spent.toLocaleString("en-IN")}`} />
      </div>

      <div className="rounded-2xl bg-card border border-border p-5 shadow-card">
        <h2 className="font-display text-lg font-semibold mb-4">Earnings by category</h2>
        <div className="space-y-4">
          {(Object.keys(breakdown) as ProductCategory[]).map((cat) => {
            const v = breakdown[cat];
            const meta = CATEGORY_META[cat];
            const total = totals.commission;
            const pct = total > 0 ? (v.commission / total) * 100 : 0;
            const barColor =
              cat === "loan" ? "bg-blue-500" :
              cat === "insurance" ? "bg-emerald-500" :
              cat === "credit_card" ? "bg-orange-500" : "bg-violet-500";
            return (
              <div key={cat}>
                <div className="flex items-center justify-between text-sm mb-1">
                  <div className="flex items-center gap-2">
                    <span className={`size-2 rounded-full ${barColor}`} />
                    <span className="font-semibold">{meta.label}</span>
                    <span className="text-xs text-muted-foreground">({v.converted} converted · {v.pending} pending)</span>
                  </div>
                  <div className="font-mono text-sm font-bold">₹{v.commission.toLocaleString("en-IN")}</div>
                </div>
                <div className="h-2 rounded-full bg-secondary overflow-hidden">
                  <div className={`h-full ${barColor} transition-all`} style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
        <p className="mt-5 text-[11px] text-muted-foreground">
          * Commission shown is the average of each product's configured min–max range, applied to ticket size or as flat per card.
          Final payouts are confirmed by the lender / insurer at settlement.
        </p>
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value, accent = false }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string; accent?: boolean }) {
  return (
    <div className={`rounded-2xl p-5 border shadow-card ${accent ? "bg-mint-gradient border-transparent" : "bg-card border-border"}`}>
      <Icon className={`size-5 ${accent ? "text-primary" : "text-accent"}`} />
      <div className={`text-xs mt-3 uppercase tracking-wide ${accent ? "text-primary/70" : "text-muted-foreground"}`}>{label}</div>
      <div className={`mt-1 text-2xl font-bold font-display ${accent ? "text-primary" : "text-foreground"}`}>{value}</div>
    </div>
  );
}
