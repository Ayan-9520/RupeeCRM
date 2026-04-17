import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Loader2, Phone, MapPin, Banknote } from "lucide-react";
import { CATEGORY_META, type Pipeline, type ProductCategory } from "@/lib/products";
import type { Json } from "@/integrations/supabase/types";

export const Route = createFileRoute("/dashboard/my-leads")({
  head: () => ({ meta: [{ title: "My Leads — LeadMines" }] }),
  component: MyLeads,
});

type Purchase = {
  id: string;
  pipeline_stage: string;
  price_paid: number;
  created_at: string;
  leads: {
    applicant_name: string;
    full_phone: string;
    city: string;
    loan_amount: number;
    product_category: ProductCategory;
    product_type_id: string | null;
  } | null;
};

function MyLeads() {
  const { user } = useAuth();
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"all" | ProductCategory>("all");

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("product_pipelines").select("*");
      setPipelines(((data ?? []) as Array<{ id: string; category: ProductCategory; name: string; stages: Json; created_at: string; updated_at: string }>).map((p) => ({
        ...p,
        stages: Array.isArray(p.stages) ? (p.stages as unknown as Pipeline["stages"]) : [],
      })));
    })();
  }, []);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("lead_purchases")
        .select("id,pipeline_stage,price_paid,created_at,leads(applicant_name,full_phone,city,loan_amount,product_category,product_type_id)")
        .eq("dsa_id", user.id)
        .order("created_at", { ascending: false });
      setPurchases((data ?? []) as unknown as Purchase[]);
      setLoading(false);
    })();
  }, [user]);

  const pipelineByCat = useMemo(
    () => Object.fromEntries(pipelines.map((p) => [p.category, p])) as Partial<Record<ProductCategory, Pipeline>>,
    [pipelines],
  );

  const visible = activeTab === "all" ? purchases : purchases.filter((p) => p.leads?.product_category === activeTab);

  // Group visible leads by pipeline (when single category) for kanban-like view
  const showKanban = activeTab !== "all" && pipelineByCat[activeTab];

  return (
    <div className="space-y-6 max-w-7xl">
      <div>
        <h1 className="font-display text-2xl lg:text-3xl font-bold">My Leads</h1>
        <p className="text-muted-foreground mt-1">Multi-product CRM. Each category has its own pipeline.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {(["all", "loan", "insurance", "credit_card", "investment"] as const).map((tab) => {
          const meta = tab === "all" ? null : CATEGORY_META[tab];
          const active = activeTab === tab;
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1.5 rounded-full text-sm font-semibold border transition-smooth ${
                active
                  ? "bg-accent text-accent-foreground border-accent"
                  : `bg-card border-border hover:border-accent/50 ${meta?.chipText ?? "text-foreground"}`
              }`}
            >
              {tab === "all" ? "All" : meta?.label}
              <span className="ml-1.5 text-[10px] opacity-70">
                ({tab === "all" ? purchases.length : purchases.filter((p) => p.leads?.product_category === tab).length})
              </span>
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="grid place-items-center py-20"><Loader2 className="size-6 animate-spin text-accent" /></div>
      ) : visible.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center text-muted-foreground">
          No leads in this pipeline yet. Visit the Leadboard to purchase.
        </div>
      ) : showKanban && pipelineByCat[activeTab as ProductCategory] ? (
        <KanbanView purchases={visible} pipeline={pipelineByCat[activeTab as ProductCategory]!} />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {visible.map((p) => (
            <PurchaseCard key={p.id} p={p} pipeline={p.leads ? pipelineByCat[p.leads.product_category] : undefined} />
          ))}
        </div>
      )}
    </div>
  );
}

function KanbanView({ purchases, pipeline }: { purchases: Purchase[]; pipeline: Pipeline }) {
  return (
    <div className="overflow-x-auto pb-4">
      <div className="flex gap-3 min-w-max">
        {pipeline.stages.map((stage) => {
          const items = purchases.filter((p) => p.pipeline_stage === stage.key);
          return (
            <div key={stage.key} className="w-72 shrink-0 rounded-xl bg-secondary/40 border border-border p-3">
              <div className="flex items-center justify-between mb-3">
                <div className="font-semibold text-sm">{stage.label}</div>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-card text-muted-foreground border border-border">{items.length}</span>
              </div>
              <div className="space-y-2">
                {items.length === 0 ? (
                  <div className="text-xs text-muted-foreground/70 text-center py-6 border border-dashed border-border rounded-lg">Empty</div>
                ) : items.map((p) => (
                  <div key={p.id} className="rounded-lg bg-card border border-border p-3 shadow-card text-sm">
                    <div className="font-semibold truncate">{p.leads?.applicant_name}</div>
                    <div className="flex items-center gap-1 text-[11px] text-muted-foreground mt-0.5">
                      <Phone className="size-2.5" /> {p.leads?.full_phone}
                    </div>
                    <div className="flex items-center gap-1 text-[11px] text-muted-foreground mt-0.5">
                      <MapPin className="size-2.5" /> {p.leads?.city}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PurchaseCard({ p, pipeline }: { p: Purchase; pipeline?: Pipeline }) {
  const meta = p.leads ? CATEGORY_META[p.leads.product_category] : null;
  const stageLabel = pipeline?.stages.find((s) => s.key === p.pipeline_stage)?.label ?? p.pipeline_stage.replace(/_/g, " ");
  return (
    <div className="rounded-2xl bg-card border border-border p-5 shadow-card">
      <div className="flex items-center gap-1.5 mb-2">
        {meta && (
          <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${meta.chipBg} ${meta.chipText}`}>{meta.label}</span>
        )}
        <span className="text-[10px] uppercase tracking-wide font-bold px-2 py-0.5 rounded-full bg-accent/15 text-accent ml-auto">
          {stageLabel}
        </span>
      </div>
      <h3 className="font-semibold">{p.leads?.applicant_name ?? "—"}</h3>
      <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
        <Phone className="size-3" /> {p.leads?.full_phone}
      </div>
      <div className="mt-4 space-y-1.5 text-sm text-foreground/80">
        <div className="flex items-center gap-2"><MapPin className="size-3.5 text-muted-foreground" /> {p.leads?.city}</div>
        <div className="flex items-center gap-2"><Banknote className="size-3.5 text-muted-foreground" /> ₹{p.leads?.loan_amount.toLocaleString("en-IN")}</div>
      </div>
      <div className="mt-4 pt-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
        <span>Bought ₹{p.price_paid}</span>
        <span>{new Date(p.created_at).toLocaleDateString("en-IN")}</span>
      </div>
    </div>
  );
}
