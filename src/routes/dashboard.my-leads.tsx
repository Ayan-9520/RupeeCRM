import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import {
  Loader2, Phone, MapPin, Banknote, Search, Filter, X, MessageSquare, Copy,
  CheckCircle2, TrendingUp, ShoppingBag, Wallet, Clock, ChevronRight, StickyNote,
  CalendarClock, LayoutGrid, List, Trophy, IndianRupee, FileText, Sparkles, RefreshCw,
} from "lucide-react";
import { RefundRequestDialog } from "@/components/leads/RefundRequestDialog";
import { CATEGORY_META, calcCommission, type Pipeline, type ProductCategory, type ProductType } from "@/lib/products";
import type { Database, Json } from "@/integrations/supabase/types";
import {
  DndContext, PointerSensor, useSensor, useSensors, useDraggable, useDroppable,
  DragOverlay, type DragEndEvent, type DragStartEvent,
} from "@dnd-kit/core";

export const Route = createFileRoute("/dashboard/my-leads")({
  head: () => ({ meta: [{ title: "My Leads — LeadMines" }] }),
  component: MyLeads,
});

type Note = { at: string; text: string; by?: string };

type Purchase = {
  id: string;
  pipeline_stage: string;
  price_paid: number;
  created_at: string;
  updated_at: string;
  notes: Note[];
  next_followup_at: string | null;
  converted: boolean;
  deal_value: number;
  leads: {
    id: string;
    applicant_name: string;
    full_phone: string;
    email: string | null;
    city: string;
    loan_amount: number;
    monthly_income: number | null;
    score: "cold" | "warm" | "hot";
    product_category: ProductCategory;
    product_subtype: string | null;
    product_type_id: string | null;
    product_details: Record<string, unknown>;
    source: string | null;
    ref_dsa_id: string | null;
    is_marketplace: boolean;
  } | null;
};

type DateFilter = "all" | "7d" | "30d" | "90d";
type View = "cards" | "kanban";

function MyLeads() {
  const { user } = useAuth();
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [productTypes, setProductTypes] = useState<ProductType[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"all" | ProductCategory>("all");
  const [stage, setStage] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [search, setSearch] = useState("");
  const [view, setView] = useState<View>("cards");
  const [openId, setOpenId] = useState<string | null>(null);

  // Load pipelines + product types
  useEffect(() => {
    (async () => {
      const [pipeRes, typeRes] = await Promise.all([
        supabase.from("product_pipelines").select("*"),
        supabase.from("product_types").select("*"),
      ]);
      setPipelines(((pipeRes.data ?? []) as Array<{ id: string; category: ProductCategory; name: string; stages: Json; created_at: string; updated_at: string }>).map((p) => ({
        ...p,
        stages: Array.isArray(p.stages) ? (p.stages as unknown as Pipeline["stages"]) : [],
      })));
      setProductTypes((typeRes.data ?? []) as ProductType[]);
    })();
  }, []);

  const loadPurchases = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("lead_purchases")
      .select("id,pipeline_stage,price_paid,created_at,updated_at,notes,next_followup_at,converted,deal_value,leads(id,applicant_name,full_phone,email,city,loan_amount,monthly_income,score,product_category,product_subtype,product_type_id,product_details,source,ref_dsa_id,is_marketplace)")
      .eq("dsa_id", user.id)
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setPurchases(((data ?? []) as unknown as Array<Omit<Purchase, "notes"> & { notes: Json }>).map((p) => ({
      ...p,
      notes: Array.isArray(p.notes) ? (p.notes as unknown as Note[]) : [],
    })));
    setLoading(false);
  };

  useEffect(() => { loadPurchases(); /* eslint-disable-next-line */ }, [user]);

  const pipelineByCat = useMemo(
    () => Object.fromEntries(pipelines.map((p) => [p.category, p])) as Partial<Record<ProductCategory, Pipeline>>,
    [pipelines],
  );

  const typeMap = useMemo(
    () => Object.fromEntries(productTypes.map((p) => [p.id, p])) as Record<string, ProductType>,
    [productTypes],
  );

  // Filtering
  const filtered = useMemo(() => {
    const cutoff = (() => {
      if (dateFilter === "all") return null;
      const days = dateFilter === "7d" ? 7 : dateFilter === "30d" ? 30 : 90;
      return Date.now() - days * 86400_000;
    })();
    const q = search.trim().toLowerCase();
    return purchases.filter((p) => {
      if (!p.leads) return false;
      if (activeTab !== "all" && p.leads.product_category !== activeTab) return false;
      if (stage !== "all" && p.pipeline_stage !== stage) return false;
      if (cutoff && new Date(p.created_at).getTime() < cutoff) return false;
      if (q) {
        const hay = `${p.leads.applicant_name} ${p.leads.full_phone} ${p.leads.city}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [purchases, activeTab, stage, dateFilter, search]);

  // Stats
  const stats = useMemo(() => {
    const total = purchases.length;
    const converted = purchases.filter((p) => p.converted).length;
    const spent = purchases.reduce((s, p) => s + Number(p.price_paid), 0);
    const earnings = purchases.reduce((s, p) => {
      if (!p.converted || !p.leads) return s;
      const pt = p.leads.product_type_id ? typeMap[p.leads.product_type_id] : null;
      if (!pt) return s;
      const value = Number(p.deal_value) > 0 ? Number(p.deal_value) : Number(p.leads.loan_amount);
      return s + calcCommission(pt, value);
    }, 0);
    const rate = total > 0 ? Math.round((converted / total) * 100) : 0;
    return { total, converted, spent, earnings, rate };
  }, [purchases, typeMap]);

  // Available stages for current tab
  const availableStages = useMemo(() => {
    if (activeTab === "all") {
      const set = new Set<string>();
      const labels: Record<string, string> = {};
      pipelines.forEach((p) => p.stages.forEach((s) => { set.add(s.key); labels[s.key] = s.label; }));
      return Array.from(set).map((k) => ({ key: k, label: labels[k] ?? k }));
    }
    return pipelineByCat[activeTab as ProductCategory]?.stages.map((s) => ({ key: s.key, label: s.label })) ?? [];
  }, [activeTab, pipelines, pipelineByCat]);

  useEffect(() => { setStage("all"); }, [activeTab]);

  // Actions on a purchase
  const updatePurchase = async (id: string, patch: Partial<Pick<Purchase, "pipeline_stage" | "next_followup_at" | "converted" | "deal_value">> & { notes?: Note[] }) => {
    const safePatch: Database["public"]["Tables"]["lead_purchases"]["Update"] = { ...patch };
    if (patch.notes) safePatch.notes = patch.notes as unknown as Json;
    const { error } = await supabase.from("lead_purchases").update(safePatch).eq("id", id);
    if (error) { toast.error(error.message); return false; }
    setPurchases((prev) => prev.map((p) => p.id === id ? { ...p, ...patch, notes: patch.notes ?? p.notes } : p));
    return true;
  };

  const showKanban = view === "kanban" && activeTab !== "all" && pipelineByCat[activeTab as ProductCategory];
  const openPurchase = openId ? purchases.find((p) => p.id === openId) ?? null : null;

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-2xl lg:text-3xl font-bold">My Leads</h1>
          <p className="text-muted-foreground mt-1">Multi-product CRM. Track every purchased lead from purchase to disbursal.</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Stat icon={ShoppingBag} label="Purchased" value={stats.total.toString()} tone="default" />
        <Stat icon={CheckCircle2} label="Converted" value={stats.converted.toString()} tone="success" />
        <Stat icon={TrendingUp} label="Conv. rate" value={`${stats.rate}%`} tone="accent" />
        <Stat icon={Wallet} label="Spent" value={`₹${stats.spent.toLocaleString("en-IN")}`} tone="default" />
        <Stat icon={Trophy} label="Est. earnings" value={`₹${stats.earnings.toLocaleString("en-IN")}`} tone="accent" />
      </div>

      {/* Tabs by category */}
      <div className="flex flex-wrap gap-2">
        {(["all", "loan", "insurance", "credit_card", "investment"] as const).map((tab) => {
          const meta = tab === "all" ? null : CATEGORY_META[tab];
          const active = activeTab === tab;
          const count = tab === "all" ? purchases.length : purchases.filter((p) => p.leads?.product_category === tab).length;
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
              <span className="ml-1.5 text-[10px] opacity-70">({count})</span>
            </button>
          );
        })}
      </div>

      {/* Filters bar */}
      <div className="rounded-2xl bg-card border border-border p-4 shadow-card">
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="relative lg:col-span-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, phone, city…"
              className="input-base pl-9 w-full"
            />
          </div>
          <select value={stage} onChange={(e) => setStage(e.target.value)} className="input-base">
            <option value="all">All stages</option>
            {availableStages.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
          <select value={dateFilter} onChange={(e) => setDateFilter(e.target.value as DateFilter)} className="input-base">
            <option value="all">Any time</option>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
          </select>
          <div className="flex gap-1 rounded-xl border border-border p-1 bg-secondary">
            <button
              onClick={() => setView("cards")}
              className={`flex-1 inline-flex items-center justify-center gap-1.5 text-xs font-semibold py-1.5 rounded-lg transition ${view === "cards" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"}`}
            >
              <LayoutGrid className="size-3.5" /> Cards
            </button>
            <button
              onClick={() => setView("kanban")}
              disabled={activeTab === "all"}
              className={`flex-1 inline-flex items-center justify-center gap-1.5 text-xs font-semibold py-1.5 rounded-lg transition disabled:opacity-40 ${view === "kanban" && activeTab !== "all" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"}`}
              title={activeTab === "all" ? "Pick a category for Kanban" : "Kanban view"}
            >
              <List className="size-3.5" /> Kanban
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
          <Filter className="size-3.5" />
          <span>{filtered.length} of {purchases.length} leads shown</span>
          {(search || stage !== "all" || dateFilter !== "all") && (
            <button onClick={() => { setSearch(""); setStage("all"); setDateFilter("all"); }} className="ml-auto inline-flex items-center gap-1 hover:text-accent">
              <X className="size-3" /> Clear filters
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="grid place-items-center py-20"><Loader2 className="size-6 animate-spin text-accent" /></div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center text-muted-foreground">
          {purchases.length === 0
            ? "No leads yet — visit the Leadboard to purchase your first."
            : "No leads match these filters."}
        </div>
      ) : showKanban ? (
        <KanbanView
          purchases={filtered}
          pipeline={pipelineByCat[activeTab as ProductCategory]!}
          onMove={(id, key) => updatePurchase(id, { pipeline_stage: key })}
          onOpen={setOpenId}
        />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((p) => (
            <PurchaseCard
              key={p.id}
              p={p}
              pipeline={p.leads ? pipelineByCat[p.leads.product_category] : undefined}
              onOpen={() => setOpenId(p.id)}
            />
          ))}
        </div>
      )}

      {openPurchase && (
        <LeadDetailDrawer
          purchase={openPurchase}
          pipeline={openPurchase.leads ? pipelineByCat[openPurchase.leads.product_category] : undefined}
          productType={openPurchase.leads?.product_type_id ? typeMap[openPurchase.leads.product_type_id] : undefined}
          onClose={() => setOpenId(null)}
          onUpdate={updatePurchase}
        />
      )}
    </div>
  );
}

/* ----------------------------- Components ----------------------------- */

function Stat({
  icon: Icon, label, value, tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  tone: "default" | "success" | "accent";
}) {
  const toneClass =
    tone === "success" ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
    : tone === "accent" ? "bg-accent/10 text-accent border-accent/30"
    : "bg-secondary text-foreground border-border";
  return (
    <div className="rounded-2xl bg-card border border-border p-4 shadow-card flex items-center gap-3">
      <div className={`size-10 rounded-xl border grid place-items-center ${toneClass}`}>
        <Icon className="size-5" />
      </div>
      <div className="min-w-0">
        <div className="text-xs text-muted-foreground truncate">{label}</div>
        <div className="font-display text-lg font-bold leading-tight truncate">{value}</div>
      </div>
    </div>
  );
}

function StageBadge({ pipeline, stageKey }: { pipeline?: Pipeline; stageKey: string }) {
  const stage = pipeline?.stages.find((s) => s.key === stageKey);
  const label = stage?.label ?? stageKey.replace(/_/g, " ");
  const idx = pipeline?.stages.findIndex((s) => s.key === stageKey) ?? -1;
  const len = pipeline?.stages.length ?? 0;
  // Color by progress
  const tone = (() => {
    if (/reject|lost|cancel/i.test(stageKey)) return "bg-red-500/15 text-red-600 dark:text-red-400";
    if (idx === len - 1 && len > 0) return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300";
    if (idx >= len - 2 && len > 0) return "bg-blue-500/15 text-blue-700 dark:text-blue-300";
    if (idx >= 1) return "bg-amber-500/15 text-amber-700 dark:text-amber-300";
    return "bg-secondary text-foreground/70";
  })();
  return (
    <span className={`text-[10px] uppercase tracking-wide font-bold px-2 py-0.5 rounded-full ${tone}`}>{label}</span>
  );
}

function PurchaseCard({ p, pipeline, onOpen }: { p: Purchase; pipeline?: Pipeline; onOpen: () => void }) {
  const meta = p.leads ? CATEGORY_META[p.leads.product_category] : null;
  return (
    <button
      onClick={onOpen}
      className="text-left rounded-2xl bg-card border border-border p-5 shadow-card hover:border-accent/50 hover:shadow-lg transition-smooth flex flex-col"
    >
      <div className="flex items-center gap-1.5 flex-wrap mb-2">
        {meta && (
          <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${meta.chipBg} ${meta.chipText}`}>{meta.label}</span>
        )}
        {p.leads?.ref_dsa_id && Number(p.price_paid) === 0 && (
          <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 inline-flex items-center gap-0.5" title="Customer applied through your referral link — free lead">
            <Sparkles className="size-2.5" /> Partner Sourced
          </span>
        )}
        {p.converted && (
          <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 inline-flex items-center gap-0.5">
            <CheckCircle2 className="size-2.5" /> Won
          </span>
        )}
        <span className="ml-auto"><StageBadge pipeline={pipeline} stageKey={p.pipeline_stage} /></span>
      </div>
      <h3 className="font-semibold truncate">{p.leads?.applicant_name ?? "—"}</h3>
      <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
        <Phone className="size-3" /> {p.leads?.full_phone}
      </div>
      <div className="mt-4 space-y-1.5 text-sm text-foreground/80">
        <div className="flex items-center gap-2"><MapPin className="size-3.5 text-muted-foreground" /> {p.leads?.city}</div>
        <div className="flex items-center gap-2"><Banknote className="size-3.5 text-muted-foreground" /> ₹{p.leads?.loan_amount.toLocaleString("en-IN")}</div>
        {p.next_followup_at && (() => {
          const due = new Date(p.next_followup_at);
          const overdue = due.getTime() < Date.now();
          return (
            <div className={`flex items-center gap-2 ${overdue ? "text-red-600 dark:text-red-400 font-semibold" : "text-amber-600 dark:text-amber-400"}`}>
              <CalendarClock className="size-3.5" />
              {overdue ? "Overdue: " : "Follow-up "}{due.toLocaleDateString("en-IN")}
            </div>
          );
        })()}
      </div>
      <div className="mt-4 pt-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1"><StickyNote className="size-3" /> {p.notes.filter((n) => !(n as { kind?: string }).kind).length} notes</span>
        <span className="inline-flex items-center gap-1">Open <ChevronRight className="size-3" /></span>
      </div>
    </button>
  );
}

function KanbanView({
  purchases, pipeline, onMove, onOpen,
}: {
  purchases: Purchase[];
  pipeline: Pipeline;
  onMove: (id: string, key: string) => Promise<boolean>;
  onOpen: (id: string) => void;
}) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const totalInPipeline = purchases.length;
  const lastStageKey = pipeline.stages[pipeline.stages.length - 1]?.key;
  const wonCount = purchases.filter((p) => p.converted || p.pipeline_stage === lastStageKey || /disbursed|policy_issued/i.test(p.pipeline_stage)).length;
  const rejectedCount = purchases.filter((p) => /reject|lost|cancel/i.test(p.pipeline_stage)).length;
  const pendingCount = totalInPipeline - wonCount - rejectedCount;

  const handleDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id));
  const handleDragEnd = async (e: DragEndEvent) => {
    setActiveId(null);
    if (!e.over) return;
    const id = String(e.active.id);
    const targetStage = String(e.over.id);
    const purchase = purchases.find((p) => p.id === id);
    if (!purchase || purchase.pipeline_stage === targetStage) return;
    const ok = await onMove(id, targetStage);
    if (ok) toast.success(`Moved to ${pipeline.stages.find((s) => s.key === targetStage)?.label ?? targetStage}`);
  };

  const activePurchase = activeId ? purchases.find((p) => p.id === activeId) : null;

  return (
    <div className="space-y-3">
      {/* Pipeline-scoped performance strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <PipelineStat label="In pipeline" value={totalInPipeline} tone="default" />
        <PipelineStat label="Won" value={wonCount} tone="success" />
        <PipelineStat label="Pending" value={pendingCount} tone="amber" />
        <PipelineStat label="Rejected" value={rejectedCount} tone="danger" />
      </div>

      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="overflow-x-auto pb-4">
          <div className="flex gap-3 min-w-max">
            {pipeline.stages.map((stage) => {
              const items = purchases.filter((p) => p.pipeline_stage === stage.key);
              return (
                <KanbanColumn key={stage.key} stageKey={stage.key} label={stage.label} count={items.length}>
                  {items.length === 0 ? (
                    <div className="text-xs text-muted-foreground/70 text-center py-6 border border-dashed border-border rounded-lg">
                      Drop here
                    </div>
                  ) : items.map((p) => (
                    <KanbanCard key={p.id} purchase={p} pipeline={pipeline} onOpen={onOpen} />
                  ))}
                </KanbanColumn>
              );
            })}
          </div>
        </div>
        <DragOverlay dropAnimation={null}>
          {activePurchase ? <KanbanCardInner purchase={activePurchase} pipeline={pipeline} dragging /> : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

function PipelineStat({ label, value, tone }: { label: string; value: number; tone: "default" | "success" | "amber" | "danger" }) {
  const cls =
    tone === "success" ? "text-emerald-600 dark:text-emerald-400"
    : tone === "amber" ? "text-amber-600 dark:text-amber-400"
    : tone === "danger" ? "text-red-600 dark:text-red-400"
    : "text-foreground";
  return (
    <div className="rounded-xl bg-card border border-border px-3 py-2 shadow-card">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`font-display text-lg font-bold leading-tight ${cls}`}>{value}</div>
    </div>
  );
}

function KanbanColumn({
  stageKey, label, count, children,
}: {
  stageKey: string; label: string; count: number; children: React.ReactNode;
}) {
  const { isOver, setNodeRef } = useDroppable({ id: stageKey });
  const headerTone =
    /reject|lost|cancel/i.test(stageKey) ? "text-red-600 dark:text-red-400"
    : /disbursed|policy_issued|approved/i.test(stageKey) ? "text-emerald-700 dark:text-emerald-300"
    : "text-foreground";
  return (
    <div
      ref={setNodeRef}
      className={`w-72 shrink-0 rounded-xl border p-3 transition ${
        isOver ? "bg-accent/10 border-accent" : "bg-secondary/40 border-border"
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <div className={`font-semibold text-sm ${headerTone}`}>{label}</div>
        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-card text-muted-foreground border border-border">{count}</span>
      </div>
      <div className="space-y-2 min-h-[60px]">{children}</div>
    </div>
  );
}

function KanbanCard({ purchase, pipeline, onOpen }: { purchase: Purchase; pipeline: Pipeline; onOpen: (id: string) => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: purchase.id });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={(e) => {
        if (!isDragging) {
          e.stopPropagation();
          onOpen(purchase.id);
        }
      }}
      className={`cursor-grab active:cursor-grabbing ${isDragging ? "opacity-30" : ""}`}
    >
      <KanbanCardInner purchase={purchase} pipeline={pipeline} />
    </div>
  );
}

function KanbanCardInner({ purchase, pipeline, dragging }: { purchase: Purchase; pipeline?: Pipeline; dragging?: boolean }) {
  const lead = purchase.leads;
  if (!lead) return null;
  const meta = CATEGORY_META[lead.product_category];
  const scoreCls =
    lead.score === "hot" ? "bg-red-500/15 text-red-600 dark:text-red-400"
    : lead.score === "warm" ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
    : "bg-blue-500/15 text-blue-700 dark:text-blue-300";
  const lastActivity = purchase.updated_at ?? purchase.created_at;
  return (
    <div className={`rounded-lg bg-card border border-border p-3 shadow-card text-sm ${dragging ? "ring-2 ring-accent shadow-elevated rotate-1" : ""}`}>
      <div className="flex items-center gap-1 flex-wrap mb-1.5">
        <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full ${meta.chipBg} ${meta.chipText}`}>{meta.label}</span>
        <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full ${scoreCls}`}>{lead.score}</span>
        {purchase.converted && (
          <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">Won</span>
        )}
      </div>
      <div className="font-semibold truncate">{lead.applicant_name}</div>
      {lead.product_subtype && (
        <div className="text-[11px] text-muted-foreground truncate">{lead.product_subtype}</div>
      )}
      <div className="flex items-center gap-1 text-[11px] text-muted-foreground mt-1">
        <Banknote className="size-2.5" /> ₹{lead.loan_amount.toLocaleString("en-IN")}
      </div>
      <div className="flex items-center gap-1 text-[11px] text-muted-foreground mt-0.5">
        <MapPin className="size-2.5" /> {lead.city}
      </div>
      <div className="flex items-center justify-between mt-2 pt-2 border-t border-border text-[10px] text-muted-foreground">
        <span className="inline-flex items-center gap-1"><Clock className="size-2.5" /> {timeAgo(lastActivity)}</span>
        {pipeline && purchase.next_followup_at && (
          <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
            <CalendarClock className="size-2.5" /> {new Date(purchase.next_followup_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
          </span>
        )}
      </div>
    </div>
  );
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

/* ------------------------------ Drawer ------------------------------ */

function LeadDetailDrawer({
  purchase, pipeline, productType, onClose, onUpdate,
}: {
  purchase: Purchase;
  pipeline?: Pipeline;
  productType?: ProductType;
  onClose: () => void;
  onUpdate: (id: string, patch: Partial<Pick<Purchase, "pipeline_stage" | "next_followup_at" | "converted" | "deal_value">> & { notes?: Note[] }) => Promise<boolean>;
}) {
  const lead = purchase.leads;
  const [noteText, setNoteText] = useState("");
  const [followup, setFollowup] = useState(purchase.next_followup_at?.slice(0, 10) ?? "");
  const [dealValue, setDealValue] = useState<string>(String(purchase.deal_value || lead?.loan_amount || 0));
  const [busy, setBusy] = useState(false);

  if (!lead) return null;

  const meta = CATEGORY_META[lead.product_category];
  const phoneDigits = lead.full_phone.replace(/[^\d]/g, "");
  const waLink = `https://wa.me/${phoneDigits}`;
  const callLink = `tel:${lead.full_phone}`;

  const addNote = async () => {
    const txt = noteText.trim();
    if (!txt) return;
    setBusy(true);
    const updated: Note[] = [...purchase.notes, { at: new Date().toISOString(), text: txt }];
    const ok = await onUpdate(purchase.id, { notes: updated });
    setBusy(false);
    if (ok) {
      setNoteText("");
      toast.success("Note added");
    }
  };

  const moveStage = async (key: string) => {
    setBusy(true);
    const ok = await onUpdate(purchase.id, { pipeline_stage: key });
    setBusy(false);
    if (ok) toast.success("Stage updated");
  };

  const saveFollowup = async () => {
    setBusy(true);
    const ok = await onUpdate(purchase.id, { next_followup_at: followup ? new Date(followup).toISOString() : null });
    setBusy(false);
    if (ok) toast.success(followup ? "Follow-up set" : "Follow-up cleared");
  };

  const markConverted = async (won: boolean) => {
    setBusy(true);
    const ok = await onUpdate(purchase.id, { converted: won, deal_value: Number(dealValue) || 0 });
    setBusy(false);
    if (ok) toast.success(won ? "Marked as converted 🎉" : "Reverted");
  };

  const copyPhone = async () => {
    await navigator.clipboard.writeText(lead.full_phone);
    toast.success("Phone copied");
  };

  const commission = productType
    ? calcCommission(productType, Number(dealValue) || lead.loan_amount)
    : 0;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex justify-end" onClick={onClose}>
      <div
        className="w-full max-w-xl h-full bg-card border-l border-border shadow-elevated overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 bg-card border-b border-border p-5 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${meta.chipBg} ${meta.chipText}`}>{meta.label}</span>
              {productType && (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-secondary text-foreground/70 border border-border">{productType.name}</span>
              )}
              <StageBadge pipeline={pipeline} stageKey={purchase.pipeline_stage} />
              {purchase.converted && (
                <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 inline-flex items-center gap-0.5">
                  <CheckCircle2 className="size-2.5" /> Won
                </span>
              )}
            </div>
            <h2 className="font-display text-xl font-bold truncate">{lead.applicant_name}</h2>
            <div className="text-xs text-muted-foreground mt-0.5">
              Bought ₹{purchase.price_paid} · {new Date(purchase.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
            </div>
          </div>
          <button onClick={onClose} className="size-9 rounded-full grid place-items-center hover:bg-secondary shrink-0">
            <X className="size-4" />
          </button>
        </div>

        {/* Quick actions */}
        <div className="p-5 grid grid-cols-3 gap-2">
          <a href={callLink} className="flex flex-col items-center gap-1 py-3 rounded-xl bg-accent text-accent-foreground font-semibold text-xs hover:opacity-90">
            <Phone className="size-4" /> Call now
          </a>
          <a href={waLink} target="_blank" rel="noopener" className="flex flex-col items-center gap-1 py-3 rounded-xl bg-emerald-500 text-white font-semibold text-xs hover:opacity-90">
            <MessageSquare className="size-4" /> WhatsApp
          </a>
          <button onClick={copyPhone} className="flex flex-col items-center gap-1 py-3 rounded-xl border border-border hover:bg-secondary font-semibold text-xs">
            <Copy className="size-4" /> Copy phone
          </button>
        </div>

        {/* Process / Apply CTA */}
        <div className="px-5 pb-2">
          <Link
            to="/dashboard/my-leads/$id/apply"
            params={{ id: purchase.id }}
            className="w-full inline-flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-accent to-accent/80 text-accent-foreground font-bold text-sm shadow-card hover:shadow-elevated transition-smooth"
          >
            <FileText className="size-4" />
            {purchase.notes.some((n) => (n as { kind?: string }).kind === "application_draft")
              ? "Resume application"
              : "Start processing application"}
            <ChevronRight className="size-4" />
          </Link>
        </div>

        {/* Customer info */}
        <Section title="Customer">
          <Field label="Phone" value={lead.full_phone} />
          {lead.email && <Field label="Email" value={lead.email} />}
          <Field label="City" value={lead.city} />
          <Field label="Ticket size" value={`₹${lead.loan_amount.toLocaleString("en-IN")}`} />
          {lead.monthly_income && <Field label="Monthly income" value={`₹${lead.monthly_income.toLocaleString("en-IN")}`} />}
          <Field label="Lead score" value={lead.score.toUpperCase()} />
          {lead.product_details && Object.keys(lead.product_details).length > 0 && (
            <div className="col-span-2 mt-2 pt-2 border-t border-border">
              <div className="text-[10px] uppercase font-bold text-muted-foreground mb-2">Product details</div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                {Object.entries(lead.product_details).map(([k, v]) => (
                  <Field key={k} label={k.replace(/_/g, " ")} value={String(v)} />
                ))}
              </div>
            </div>
          )}
        </Section>

        {/* Pipeline progress */}
        {pipeline && (
          <Section title="Pipeline">
            <div className="col-span-2 space-y-2">
              <div className="flex items-center gap-1.5 flex-wrap">
                {pipeline.stages.map((s, i) => {
                  const currIdx = pipeline.stages.findIndex((x) => x.key === purchase.pipeline_stage);
                  const isCurrent = s.key === purchase.pipeline_stage;
                  const isDone = i < currIdx;
                  return (
                    <button
                      key={s.key}
                      disabled={busy}
                      onClick={() => moveStage(s.key)}
                      className={`text-[11px] font-bold px-2.5 py-1 rounded-full border transition ${
                        isCurrent
                          ? "bg-accent text-accent-foreground border-accent"
                          : isDone
                            ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                            : "bg-card text-muted-foreground border-border hover:border-accent/50"
                      }`}
                    >
                      {isDone && "✓ "}{s.label}
                    </button>
                  );
                })}
              </div>
              <p className="text-[11px] text-muted-foreground">Click any stage to move this lead.</p>
            </div>
          </Section>
        )}

        {/* Conversion + earnings */}
        <Section title="Conversion">
          <div className="col-span-2 space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs">
                <span className="text-muted-foreground">Final deal value (₹)</span>
                <input
                  type="number"
                  value={dealValue}
                  onChange={(e) => setDealValue(e.target.value)}
                  className="input-base mt-1 w-full"
                />
              </label>
              <div className="text-xs">
                <span className="text-muted-foreground">Est. commission</span>
                <div className="input-base mt-1 inline-flex items-center font-display font-bold text-emerald-600 dark:text-emerald-400">
                  <IndianRupee className="size-3.5" />{commission.toLocaleString("en-IN")}
                </div>
              </div>
            </div>
            {!purchase.converted ? (
              <button
                onClick={() => markConverted(true)}
                disabled={busy}
                className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-500 text-white font-semibold text-sm hover:opacity-90 disabled:opacity-60"
              >
                <Trophy className="size-4" /> Mark as converted
              </button>
            ) : (
              <button
                onClick={() => markConverted(false)}
                disabled={busy}
                className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl border border-border font-medium text-sm hover:bg-secondary disabled:opacity-60"
              >
                Undo conversion
              </button>
            )}
          </div>
        </Section>

        {/* Follow-up */}
        <Section title="Follow-up">
          <div className="col-span-2 flex items-end gap-2">
            <label className="text-xs flex-1">
              <span className="text-muted-foreground">Next follow-up date</span>
              <input
                type="date"
                value={followup}
                onChange={(e) => setFollowup(e.target.value)}
                className="input-base mt-1 w-full"
              />
            </label>
            <button onClick={saveFollowup} disabled={busy} className="px-4 py-2 rounded-xl bg-accent text-accent-foreground font-semibold text-sm hover:opacity-90 disabled:opacity-60">
              Save
            </button>
          </div>
        </Section>

        {/* Notes / activity */}
        {(() => {
          const visibleNotes = purchase.notes.filter((n) => !(n as { kind?: string }).kind);
          return (
            <Section title={`Notes & activity (${visibleNotes.length})`}>
              <div className="col-span-2 space-y-3">
                <div className="flex gap-2">
                  <textarea
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    placeholder="Add a note (call summary, client requirement, blocker…)"
                    rows={2}
                    className="input-base flex-1 !h-auto py-2"
                  />
                  <button onClick={addNote} disabled={busy || !noteText.trim()} className="px-4 self-stretch rounded-xl bg-accent text-accent-foreground font-semibold text-sm hover:opacity-90 disabled:opacity-50">
                    Add
                  </button>
                </div>
                {visibleNotes.length === 0 ? (
                  <div className="text-center text-xs text-muted-foreground py-6 border border-dashed border-border rounded-xl">
                    No notes yet — add the first one above.
                  </div>
                ) : (
                  <ul className="space-y-2">
                    {[...visibleNotes].reverse().map((n, i) => (
                      <li key={i} className="rounded-xl border border-border bg-secondary/40 p-3">
                        <div className="text-xs text-muted-foreground inline-flex items-center gap-1">
                          <Clock className="size-3" /> {new Date(n.at).toLocaleString("en-IN")}
                        </div>
                        <div className="text-sm mt-1 whitespace-pre-wrap">{n.text}</div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </Section>
          );
        })()}

        <div className="h-6" />
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="px-5 py-4 border-t border-border">
      <h3 className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground mb-3">{title}</h3>
      <div className="grid grid-cols-2 gap-x-4 gap-y-2">{children}</div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-sm font-medium truncate">{value}</div>
    </div>
  );
}
