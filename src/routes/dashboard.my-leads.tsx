import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import {
  Loader2,
  Phone,
  MapPin,
  Banknote,
  Search,
  Filter,
  X,
  MessageSquare,
  Copy,
  CheckCircle2,
  TrendingUp,
  ShoppingBag,
  Wallet,
  Clock,
  ChevronRight,
  StickyNote,
  CalendarClock,
  LayoutGrid,
  List,
  Trophy,
  IndianRupee,
  FileText,
  Sparkles,
  Mail,
  Send,
  Upload,
  User as UserIcon,
  Briefcase,
  CreditCard,
  Activity,
  FolderOpen,
  Target,
  Download,
  Trash2,
  AlertCircle,
} from "lucide-react";
import { CATEGORY_META, calcCommission, type Pipeline, type ProductCategory, type ProductType } from "@/lib/products";
import type { Database, Json } from "@/integrations/supabase/types";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  DragOverlay,
  type DragEndEvent,
  type DragStartEvent,
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
  lead_id?: string;
  leads: {
    id: string;
    applicant_name: string;
    full_phone: string;
    alternate_phone: string | null;
    email: string | null;
    city: string;
    state: string | null;
    loan_amount: number;
    monthly_income: number | null;
    employment_type: string | null;
    company_name: string | null;
    cibil_score: number | null;
    age: number | null;
    gender: string | null;
    score: "cold" | "warm" | "hot";
    product_category: ProductCategory;
    product_subtype: string | null;
    product_type_id: string | null;
    product_details: Record<string, unknown>;
    source: string | null;
    notes: string | null;
    ref_dsa_id: string | null;
    is_marketplace: boolean;
    created_at: string;
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
      setPipelines(
        (
          (pipeRes.data ?? []) as Array<{
            id: string;
            category: ProductCategory;
            name: string;
            stages: Json;
            created_at: string;
            updated_at: string;
          }>
        ).map((p) => ({
          ...p,
          stages: Array.isArray(p.stages) ? (p.stages as unknown as Pipeline["stages"]) : [],
        })),
      );
      setProductTypes((typeRes.data ?? []) as ProductType[]);
    })();
  }, []);

  const loadPurchases = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("lead_purchases")
      .select(
        "id,lead_id,pipeline_stage,price_paid,created_at,updated_at,notes,next_followup_at,converted,deal_value,leads(id,applicant_name,full_phone,alternate_phone,email,city,state,loan_amount,monthly_income,employment_type,company_name,cibil_score,age,gender,score,product_category,product_subtype,product_type_id,product_details,source,notes,ref_dsa_id,is_marketplace,created_at)",
      )
      .eq("dsa_id", user.id)
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setPurchases(
      ((data ?? []) as unknown as Array<Omit<Purchase, "notes"> & { notes: Json }>).map((p) => ({
        ...p,
        notes: Array.isArray(p.notes) ? (p.notes as unknown as Note[]) : [],
      })),
    );
    setLoading(false);
  };

  useEffect(() => {
    loadPurchases(); /* eslint-disable-next-line */
  }, [user]);

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
      pipelines.forEach((p) =>
        p.stages.forEach((s) => {
          set.add(s.key);
          labels[s.key] = s.label;
        }),
      );
      return Array.from(set).map((k) => ({ key: k, label: labels[k] ?? k }));
    }
    return pipelineByCat[activeTab as ProductCategory]?.stages.map((s) => ({ key: s.key, label: s.label })) ?? [];
  }, [activeTab, pipelines, pipelineByCat]);

  useEffect(() => {
    setStage("all");
  }, [activeTab]);

  // Actions on a purchase
  const updatePurchase = async (
    id: string,
    patch: Partial<Pick<Purchase, "pipeline_stage" | "next_followup_at" | "converted" | "deal_value">> & {
      notes?: Note[];
    },
  ) => {
    const safePatch: Database["public"]["Tables"]["lead_purchases"]["Update"] = { ...patch };
    if (patch.notes) safePatch.notes = patch.notes as unknown as Json;
    const { error } = await supabase.from("lead_purchases").update(safePatch).eq("id", id);
    if (error) {
      toast.error(error.message);
      return false;
    }
    setPurchases((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch, notes: patch.notes ?? p.notes } : p)));
    return true;
  };

  const showKanban = view === "kanban" && activeTab !== "all" && pipelineByCat[activeTab as ProductCategory];
  const openPurchase = openId ? (purchases.find((p) => p.id === openId) ?? null) : null;

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-2xl lg:text-3xl font-bold">My Leads</h1>
          <p className="text-muted-foreground mt-1">
            Multi-product CRM. Track every purchased lead from purchase to disbursal.
          </p>
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
          const count =
            tab === "all" ? purchases.length : purchases.filter((p) => p.leads?.product_category === tab).length;
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
            {availableStages.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
          <select
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value as DateFilter)}
            className="input-base"
          >
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
          <span>
            {filtered.length} of {purchases.length} leads shown
          </span>
          {(search || stage !== "all" || dateFilter !== "all") && (
            <button
              onClick={() => {
                setSearch("");
                setStage("all");
                setDateFilter("all");
              }}
              className="ml-auto inline-flex items-center gap-1 hover:text-accent"
            >
              <X className="size-3" /> Clear filters
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="grid place-items-center py-20">
          <Loader2 className="size-6 animate-spin text-accent" />
        </div>
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
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  tone: "default" | "success" | "accent";
}) {
  const toneClass =
    tone === "success"
      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
      : tone === "accent"
        ? "bg-accent/10 text-accent border-accent/30"
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
          <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${meta.chipBg} ${meta.chipText}`}>
            {meta.label}
          </span>
        )}
        {p.leads?.ref_dsa_id && Number(p.price_paid) === 0 && (
          <span
            className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 inline-flex items-center gap-0.5"
            title="Customer applied through your referral link — free lead"
          >
            <Sparkles className="size-2.5" /> Partner Sourced
          </span>
        )}
        {p.converted && (
          <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 inline-flex items-center gap-0.5">
            <CheckCircle2 className="size-2.5" /> Won
          </span>
        )}
        <span className="ml-auto">
          <StageBadge pipeline={pipeline} stageKey={p.pipeline_stage} />
        </span>
      </div>
      <h3 className="font-semibold truncate">{p.leads?.applicant_name ?? "—"}</h3>
      <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
        <Phone className="size-3" /> {p.leads?.full_phone}
      </div>
      <div className="mt-4 space-y-1.5 text-sm text-foreground/80">
        <div className="flex items-center gap-2">
          <MapPin className="size-3.5 text-muted-foreground" /> {p.leads?.city}
        </div>
        <div className="flex items-center gap-2">
          <Banknote className="size-3.5 text-muted-foreground" /> ₹{p.leads?.loan_amount.toLocaleString("en-IN")}
        </div>
        {p.next_followup_at &&
          (() => {
            const due = new Date(p.next_followup_at);
            const overdue = due.getTime() < Date.now();
            return (
              <div
                className={`flex items-center gap-2 ${overdue ? "text-red-600 dark:text-red-400 font-semibold" : "text-amber-600 dark:text-amber-400"}`}
              >
                <CalendarClock className="size-3.5" />
                {overdue ? "Overdue: " : "Follow-up "}
                {due.toLocaleDateString("en-IN")}
              </div>
            );
          })()}
      </div>
      <div className="mt-4 pt-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <StickyNote className="size-3" /> {p.notes.filter((n) => !(n as { kind?: string }).kind).length} notes
        </span>
        <span className="inline-flex items-center gap-1">
          Open <ChevronRight className="size-3" />
        </span>
      </div>
    </button>
  );
}

function KanbanView({
  purchases,
  pipeline,
  onMove,
  onOpen,
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
  const wonCount = purchases.filter(
    (p) => p.converted || p.pipeline_stage === lastStageKey || /disbursed|policy_issued/i.test(p.pipeline_stage),
  ).length;
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
                  ) : (
                    items.map((p) => <KanbanCard key={p.id} purchase={p} pipeline={pipeline} onOpen={onOpen} />)
                  )}
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

function PipelineStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "default" | "success" | "amber" | "danger";
}) {
  const cls =
    tone === "success"
      ? "text-emerald-600 dark:text-emerald-400"
      : tone === "amber"
        ? "text-amber-600 dark:text-amber-400"
        : tone === "danger"
          ? "text-red-600 dark:text-red-400"
          : "text-foreground";
  return (
    <div className="rounded-xl bg-card border border-border px-3 py-2 shadow-card">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`font-display text-lg font-bold leading-tight ${cls}`}>{value}</div>
    </div>
  );
}

function KanbanColumn({
  stageKey,
  label,
  count,
  children,
}: {
  stageKey: string;
  label: string;
  count: number;
  children: React.ReactNode;
}) {
  const { isOver, setNodeRef } = useDroppable({ id: stageKey });
  const headerTone = /reject|lost|cancel/i.test(stageKey)
    ? "text-red-600 dark:text-red-400"
    : /disbursed|policy_issued|approved/i.test(stageKey)
      ? "text-emerald-700 dark:text-emerald-300"
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
        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-card text-muted-foreground border border-border">
          {count}
        </span>
      </div>
      <div className="space-y-2 min-h-[60px]">{children}</div>
    </div>
  );
}

function KanbanCard({
  purchase,
  pipeline,
  onOpen,
}: {
  purchase: Purchase;
  pipeline: Pipeline;
  onOpen: (id: string) => void;
}) {
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

function KanbanCardInner({
  purchase,
  pipeline,
  dragging,
}: {
  purchase: Purchase;
  pipeline?: Pipeline;
  dragging?: boolean;
}) {
  const lead = purchase.leads;
  if (!lead) return null;
  const meta = CATEGORY_META[lead.product_category];
  const scoreCls =
    lead.score === "hot"
      ? "bg-red-500/15 text-red-600 dark:text-red-400"
      : lead.score === "warm"
        ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
        : "bg-blue-500/15 text-blue-700 dark:text-blue-300";
  const lastActivity = purchase.updated_at ?? purchase.created_at;
  return (
    <div
      className={`rounded-lg bg-card border border-border p-3 shadow-card text-sm ${dragging ? "ring-2 ring-accent shadow-elevated rotate-1" : ""}`}
    >
      <div className="flex items-center gap-1 flex-wrap mb-1.5">
        <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full ${meta.chipBg} ${meta.chipText}`}>
          {meta.label}
        </span>
        <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full ${scoreCls}`}>{lead.score}</span>
        {purchase.converted && (
          <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
            Won
          </span>
        )}
      </div>
      <div className="font-semibold truncate">{lead.applicant_name}</div>
      {lead.product_subtype && <div className="text-[11px] text-muted-foreground truncate">{lead.product_subtype}</div>}
      <div className="flex items-center gap-1 text-[11px] text-muted-foreground mt-1">
        <Banknote className="size-2.5" /> ₹{lead.loan_amount.toLocaleString("en-IN")}
      </div>
      <div className="flex items-center gap-1 text-[11px] text-muted-foreground mt-0.5">
        <MapPin className="size-2.5" /> {lead.city}
      </div>
      <div className="flex items-center justify-between mt-2 pt-2 border-t border-border text-[10px] text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <Clock className="size-2.5" /> {timeAgo(lastActivity)}
        </span>
        {pipeline && purchase.next_followup_at && (
          <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
            <CalendarClock className="size-2.5" />{" "}
            {new Date(purchase.next_followup_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
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

type CaseDoc = {
  id: string;
  doc_type: string;
  file_name: string;
  file_url: string;
  file_size: number | null;
  mime_type: string | null;
  uploaded_by: string;
  created_at: string;
};

type StatusLog = {
  id: string;
  from_stage: string | null;
  to_stage: string;
  notes: string | null;
  created_at: string;
  changed_by: string | null;
};

const DOC_TYPES: { value: string; label: string }[] = [
  { value: "pan", label: "PAN Card" },
  { value: "aadhaar", label: "Aadhaar" },
  { value: "bank_statement", label: "Bank Statement" },
  { value: "salary_slip", label: "Salary Slip" },
  { value: "itr", label: "ITR" },
  { value: "selfie", label: "Selfie" },
  { value: "address_proof", label: "Address Proof" },
  { value: "other", label: "Other" },
];

function LeadDetailDrawer({
  purchase,
  pipeline,
  productType,
  onClose,
  onUpdate,
}: {
  purchase: Purchase;
  pipeline?: Pipeline;
  productType?: ProductType;
  onClose: () => void;
  onUpdate: (
    id: string,
    patch: Partial<Pick<Purchase, "pipeline_stage" | "next_followup_at" | "converted" | "deal_value">> & {
      notes?: Note[];
    },
  ) => Promise<boolean>;
}) {
  const { user } = useAuth();
  const lead = purchase.leads;
  const [tab, setTab] = useState<"overview" | "pipeline" | "documents" | "notes" | "commission">("overview");
  const [commissions, setCommissions] = useState<{ id: string; amount: number; percentage: number; base_amount: number; status: string; created_at: string; credited_at: string | null }[]>([]);
  const [disbursals, setDisbursals] = useState<{ id: string; lender_name: string | null; loan_account_no: string | null; disbursed_amount: number; commission_amount: number; status: string; disbursed_at: string | null; created_at: string }[]>([]);
  const [noteText, setNoteText] = useState("");
  const [followup, setFollowup] = useState(purchase.next_followup_at?.slice(0, 10) ?? "");
  const [dealValue, setDealValue] = useState<string>(String(purchase.deal_value || lead?.loan_amount || 0));
  const [busy, setBusy] = useState(false);
  const [docs, setDocs] = useState<CaseDoc[]>([]);
  const [logs, setLogs] = useState<StatusLog[]>([]);
  const [docType, setDocType] = useState("pan");
  const [uploading, setUploading] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const t = setTimeout(() => setMounted(true), 10);
    return () => clearTimeout(t);
  }, []);

  const loadAux = async () => {
    const [d, l, c, ds] = await Promise.all([
      supabase
        .from("case_documents")
        .select("id,doc_type,file_name,file_url,file_size,mime_type,uploaded_by,created_at")
        .eq("lead_purchase_id", purchase.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("case_status_logs")
        .select("id,from_stage,to_stage,notes,created_at,changed_by")
        .eq("lead_purchase_id", purchase.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("commissions")
        .select("id,amount,percentage,base_amount,status,created_at,credited_at")
        .eq("lead_purchase_id", purchase.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("disbursals")
        .select("id,lender_name,loan_account_no,disbursed_amount,commission_amount,status,disbursed_at,created_at")
        .eq("lead_purchase_id", purchase.id)
        .order("created_at", { ascending: false }),
    ]);
    setDocs((d.data as CaseDoc[]) ?? []);
    setLogs((l.data as StatusLog[]) ?? []);
    setCommissions((c.data as typeof commissions) ?? []);
    setDisbursals((ds.data as typeof disbursals) ?? []);
  };

  useEffect(() => {
    loadAux(); /* eslint-disable-next-line */
  }, [purchase.id]);

  if (!lead) return null;

  const meta = CATEGORY_META[lead.product_category];
  const phoneDigits = lead.full_phone.replace(/[^\d]/g, "");
  const waLink = `https://wa.me/${phoneDigits}`;
  const callLink = `tel:${lead.full_phone}`;
  const smsLink = `sms:${lead.full_phone}`;
  const emailLink = lead.email ? `mailto:${lead.email}` : null;

  const visibleNotes = purchase.notes.filter((n) => !(n as { kind?: string }).kind);

  const addNote = async () => {
    const txt = noteText.trim();
    if (!txt) return;
    setBusy(true);
    const updated: Note[] = [...purchase.notes, { at: new Date().toISOString(), text: txt, by: user?.email ?? undefined }];
    const ok = await onUpdate(purchase.id, { notes: updated });
    setBusy(false);
    if (ok) {
      setNoteText("");
      toast.success("Note added");
    }
  };

  const moveStage = async (key: string) => {
    if (key === purchase.pipeline_stage) return;
    setBusy(true);
    const ok = await onUpdate(purchase.id, { pipeline_stage: key });
    if (ok && purchase.lead_id && user) {
      // Best-effort log to status history (RLS may reject for non-admin/lender; ignore failure)
      await supabase.from("case_status_logs").insert({
        lead_purchase_id: purchase.id,
        lead_id: purchase.lead_id,
        from_stage: purchase.pipeline_stage,
        to_stage: key,
        changed_by: user.id,
      } as never);
      loadAux();
    }
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

  const copyText = async (text: string, label: string) => {
    await navigator.clipboard.writeText(text);
    toast.success(`${label} copied`);
  };

  const downloadPdf = async () => {
    try {
      const { jsPDF } = await import("jspdf");
      const doc = new jsPDF();
      const W = doc.internal.pageSize.getWidth();
      let y = 14;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.text("Lead Summary", 14, y);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.text(new Date().toLocaleString("en-IN"), W - 14, y, { align: "right" });
      y += 8;
      doc.setDrawColor(200);
      doc.line(14, y, W - 14, y);
      y += 6;

      const section = (title: string) => {
        if (y > 270) { doc.addPage(); y = 14; }
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.text(title, 14, y);
        y += 5;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
      };
      const row = (k: string, v: string | number | null | undefined) => {
        if (v === null || v === undefined || v === "") return;
        if (y > 280) { doc.addPage(); y = 14; }
        doc.setTextColor(120);
        doc.text(`${k}:`, 16, y);
        doc.setTextColor(20);
        const lines = doc.splitTextToSize(String(v), W - 70);
        doc.text(lines, 70, y);
        y += 5 * lines.length;
      };

      section("Applicant");
      row("Name", lead.applicant_name);
      row("Phone", lead.full_phone);
      row("Alternate", lead.alternate_phone);
      row("Email", lead.email);
      row("Age / Gender", [lead.age, lead.gender].filter(Boolean).join(" / "));
      row("City / State", [lead.city, lead.state].filter(Boolean).join(", "));
      y += 2;

      section("Employment & Credit");
      row("Employment", lead.employment_type);
      row("Company", lead.company_name);
      row("Monthly income", lead.monthly_income ? `Rs. ${lead.monthly_income.toLocaleString("en-IN")}` : null);
      row("CIBIL", lead.cibil_score);
      y += 2;

      section("Product Requirement");
      row("Category", meta.label);
      row("Subtype", lead.product_subtype);
      row("Ticket size", `Rs. ${lead.loan_amount.toLocaleString("en-IN")}`);
      row("Source", lead.source);
      Object.entries(lead.product_details ?? {}).forEach(([k, v]) => row(k.replace(/_/g, " "), String(v)));
      y += 2;

      section("Processing");
      row("Stage", purchase.pipeline_stage);
      row("Purchased", new Date(purchase.created_at).toLocaleString("en-IN"));
      row("Price paid", `Rs. ${purchase.price_paid}`);
      row("Deal value", purchase.deal_value ? `Rs. ${purchase.deal_value.toLocaleString("en-IN")}` : null);
      row("Converted", purchase.converted ? "Yes" : "No");
      row("Next follow-up", purchase.next_followup_at ? new Date(purchase.next_followup_at).toLocaleDateString("en-IN") : null);
      y += 2;

      if (docs.length) {
        section("Documents");
        docs.forEach((d) => row(DOC_TYPES.find((x) => x.value === d.doc_type)?.label ?? d.doc_type, d.file_name));
        y += 2;
      }

      const visible = purchase.notes.filter((n) => !(n as { kind?: string }).kind);
      if (visible.length) {
        section("Notes");
        visible.slice(-15).forEach((n) => row(new Date(n.at).toLocaleDateString("en-IN"), n.text));
      }

      doc.save(`Lead-${lead.applicant_name.replace(/\s+/g, "_")}-${purchase.id.slice(0, 6)}.pdf`);
      toast.success("PDF downloaded");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "PDF failed");
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user || !purchase.lead_id) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error("File too large (max 10MB)");
      return;
    }
    setUploading(true);
    try {
      const path = `${user.id}/${purchase.id}/${Date.now()}-${file.name}`;
      const { error: upErr } = await supabase.storage.from("case-documents").upload(path, file);
      if (upErr) throw upErr;
      const { data: signed } = await supabase.storage
        .from("case-documents")
        .createSignedUrl(path, 60 * 60 * 24 * 365);
      const { error: insErr } = await supabase.from("case_documents").insert({
        lead_purchase_id: purchase.id,
        lead_id: purchase.lead_id,
        uploaded_by: user.id,
        doc_type: docType,
        file_name: file.name,
        file_url: signed?.signedUrl || path,
        file_size: file.size,
        mime_type: file.type,
      });
      if (insErr) throw insErr;
      toast.success("Document uploaded");
      e.target.value = "";
      loadAux();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Upload failed";
      toast.error(msg);
    } finally {
      setUploading(false);
    }
  };

  const commission = productType ? calcCommission(productType, Number(dealValue) || lead.loan_amount) : 0;
  const followUpDate = purchase.next_followup_at ? new Date(purchase.next_followup_at) : null;
  const overdue = followUpDate ? followUpDate.getTime() < Date.now() : false;

  // Merge timeline: status logs + notes (with optional kind)
  type TimelineItem = { at: string; type: string; text: string; by?: string };
  const timeline: TimelineItem[] = [
    {
      at: purchase.created_at,
      type: "purchased",
      text: `Lead purchased for ₹${purchase.price_paid}`,
    },
    ...logs.map((l) => ({
      at: l.created_at,
      type: "stage",
      text: `Stage: ${l.from_stage ? `${l.from_stage} → ` : ""}${l.to_stage}`,
    })),
    ...purchase.notes.map((n) => {
      const k = (n as { kind?: string }).kind;
      return {
        at: n.at,
        type: k ?? "note",
        text: n.text,
        by: n.by,
      };
    }),
  ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  return (
    <div
      className={`fixed inset-0 z-50 bg-black/70 backdrop-blur-sm grid place-items-center p-0 sm:p-4 transition-opacity duration-200 ${
        mounted ? "opacity-100" : "opacity-0"
      }`}
      onClick={onClose}
    >
      <div
        className={`bg-card border border-border shadow-elevated w-full sm:max-w-[1400px] h-full sm:h-[94vh] sm:rounded-2xl overflow-hidden flex flex-col transition-all duration-200 ${
          mounted ? "scale-100 opacity-100" : "scale-95 opacity-0"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* HEADER */}
        <div className="border-b border-border bg-gradient-to-br from-card via-card to-secondary/30 p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 mb-2 flex-wrap">
                <span
                  className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${meta.chipBg} ${meta.chipText}`}
                >
                  {meta.label}
                </span>
                {productType && (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-secondary text-foreground/70 border border-border">
                    {productType.name}
                  </span>
                )}
                <StageBadge pipeline={pipeline} stageKey={purchase.pipeline_stage} />
                <span
                  className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                    lead.score === "hot"
                      ? "bg-red-500/15 text-red-600 dark:text-red-400"
                      : lead.score === "warm"
                        ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                        : "bg-blue-500/15 text-blue-700 dark:text-blue-300"
                  }`}
                >
                  {lead.score} priority
                </span>
                {lead.source && (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-secondary text-foreground/70 border border-border">
                    {lead.source}
                  </span>
                )}
                {purchase.converted && (
                  <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 inline-flex items-center gap-0.5">
                    <CheckCircle2 className="size-2.5" /> Won
                  </span>
                )}
                {overdue && (
                  <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-red-500/15 text-red-600 dark:text-red-400 inline-flex items-center gap-0.5">
                    <AlertCircle className="size-2.5" /> Overdue follow-up
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3">
                <div className="size-12 sm:size-14 rounded-2xl bg-gradient-to-br from-accent/30 to-accent/10 border border-accent/30 grid place-items-center font-display text-lg font-bold text-accent shrink-0">
                  {lead.applicant_name.slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <h2 className="font-display text-xl sm:text-2xl font-bold truncate">{lead.applicant_name}</h2>
                  <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-3 flex-wrap">
                    <span className="inline-flex items-center gap-1">
                      <Wallet className="size-3" /> ₹{purchase.price_paid} paid
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Clock className="size-3" /> {timeAgo(purchase.created_at)}
                    </span>
                    {followUpDate && (
                      <span className={`inline-flex items-center gap-1 ${overdue ? "text-red-600 dark:text-red-400" : "text-amber-600 dark:text-amber-400"}`}>
                        <CalendarClock className="size-3" />
                        {followUpDate.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              className="size-9 rounded-full grid place-items-center hover:bg-secondary shrink-0"
              aria-label="Close"
            >
              <X className="size-4" />
            </button>
          </div>

          {/* QUICK ACTIONS */}
          <div className="mt-4 grid grid-cols-3 sm:grid-cols-7 gap-2">
            <ActionBtn href={callLink} icon={Phone} label="Call" tone="accent" />
            <ActionBtn href={waLink} target="_blank" icon={MessageSquare} label="WhatsApp" tone="emerald" />
            <ActionBtn href={smsLink} icon={Send} label="SMS" tone="default" />
            <ActionBtn
              href={emailLink ?? undefined}
              icon={Mail}
              label="Email"
              tone="default"
              disabled={!emailLink}
            />
            <ActionBtn onClick={() => copyText(lead.full_phone, "Phone")} icon={Copy} label="Copy #" tone="default" />
            <ActionBtn onClick={downloadPdf} icon={Download} label="PDF" tone="default" />
            <Link
              to="/dashboard/my-leads/$id/apply"
              params={{ id: purchase.id }}
              className="flex flex-col items-center gap-1 py-2.5 rounded-xl bg-gradient-to-br from-accent to-accent/70 text-accent-foreground font-semibold text-[11px] hover:opacity-90 transition"
            >
              <FileText className="size-4" />
              Apply
            </Link>
          </div>
        </div>

        {/* TABS */}
        <div className="border-b border-border bg-card px-2 sm:px-4 flex gap-1 overflow-x-auto">
          {[
            { id: "overview", label: "Overview", icon: UserIcon },
            { id: "pipeline", label: "Pipeline & Activity", icon: Activity },
            { id: "documents", label: `Documents (${docs.length})`, icon: FolderOpen },
            { id: "notes", label: `Notes (${visibleNotes.length})`, icon: StickyNote },
            { id: "commission", label: "Commission", icon: IndianRupee },
          ].map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id as typeof tab)}
                className={`relative px-3 sm:px-4 py-3 text-xs sm:text-sm font-semibold inline-flex items-center gap-1.5 whitespace-nowrap transition ${
                  active ? "text-accent" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="size-3.5" /> {t.label}
                {active && <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-accent rounded-full" />}
              </button>
            );
          })}
        </div>

        {/* CONTENT */}
        <div className="flex-1 overflow-y-auto">
          {tab === "overview" && (
            <div className="p-5 sm:p-6 space-y-5">
              <PanelGroup
                title="Contact Information"
                icon={UserIcon}
                items={[
                  { label: "Full name", value: lead.applicant_name },
                  { label: "Phone", value: lead.full_phone, copy: true },
                  { label: "Alternate phone", value: lead.alternate_phone, copy: true },
                  { label: "Email", value: lead.email, copy: true },
                  { label: "City", value: lead.city },
                  { label: "State", value: lead.state },
                  { label: "Age", value: lead.age?.toString() },
                  { label: "Gender", value: lead.gender },
                ]}
                onCopy={copyText}
              />
              <PanelGroup
                title="Employment & Credit"
                icon={Briefcase}
                items={[
                  { label: "Employment", value: lead.employment_type },
                  { label: "Company", value: lead.company_name },
                  { label: "Monthly income", value: lead.monthly_income ? `₹${lead.monthly_income.toLocaleString("en-IN")}` : null },
                  { label: "CIBIL score", value: lead.cibil_score?.toString() },
                ]}
                onCopy={copyText}
              />
              <PanelGroup
                title="Product Requirement"
                icon={CreditCard}
                items={[
                  { label: "Category", value: meta.label },
                  { label: "Subtype", value: lead.product_subtype },
                  { label: "Ticket size", value: `₹${lead.loan_amount.toLocaleString("en-IN")}` },
                  { label: "Source", value: lead.source },
                  ...Object.entries(lead.product_details ?? {}).map(([k, v]) => ({
                    label: k.replace(/_/g, " "),
                    value: String(v),
                  })),
                ]}
                onCopy={copyText}
              />
              {lead.notes && (
                <div className="rounded-2xl border border-border bg-secondary/30 p-4">
                  <div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground mb-1.5">
                    Customer note
                  </div>
                  <div className="text-sm whitespace-pre-wrap">{lead.notes}</div>
                </div>
              )}

              <div className="grid sm:grid-cols-3 gap-3 text-xs">
                <MetaCard label="Lead created" value={new Date(lead.created_at).toLocaleString("en-IN")} />
                <MetaCard label="Purchased on" value={new Date(purchase.created_at).toLocaleString("en-IN")} />
                <MetaCard label="Last updated" value={new Date(purchase.updated_at).toLocaleString("en-IN")} />
              </div>
            </div>
          )}

          {tab === "pipeline" && (
            <div className="p-5 sm:p-6 space-y-6">
              {/* Pipeline visual */}
              {pipeline && (
                <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="font-display font-bold text-base">Pipeline</h3>
                      <p className="text-xs text-muted-foreground">Click any stage to update.</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {pipeline.stages.map((s, i) => {
                      const currIdx = pipeline.stages.findIndex((x) => x.key === purchase.pipeline_stage);
                      const isCurrent = s.key === purchase.pipeline_stage;
                      const isDone = i < currIdx;
                      return (
                        <button
                          key={s.key}
                          disabled={busy}
                          onClick={() => moveStage(s.key)}
                          className={`text-[11px] font-bold px-2.5 py-1.5 rounded-full border transition ${
                            isCurrent
                              ? "bg-accent text-accent-foreground border-accent shadow-sm"
                              : isDone
                                ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                                : "bg-card text-muted-foreground border-border hover:border-accent/50"
                          }`}
                        >
                          {isDone && "✓ "}
                          {s.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Conversion */}
              <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
                <div className="flex items-center gap-2 mb-3">
                  <Target className="size-4 text-accent" />
                  <h3 className="font-display font-bold text-base">Conversion</h3>
                </div>
                <div className="grid sm:grid-cols-2 gap-3">
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
                      <IndianRupee className="size-3.5" />
                      {commission.toLocaleString("en-IN")}
                    </div>
                  </div>
                </div>
                {!purchase.converted ? (
                  <button
                    onClick={() => markConverted(true)}
                    disabled={busy}
                    className="mt-3 w-full inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-500 text-white font-semibold text-sm hover:opacity-90 disabled:opacity-60"
                  >
                    <Trophy className="size-4" /> Mark as converted
                  </button>
                ) : (
                  <button
                    onClick={() => markConverted(false)}
                    disabled={busy}
                    className="mt-3 w-full inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl border border-border font-medium text-sm hover:bg-secondary disabled:opacity-60"
                  >
                    Undo conversion
                  </button>
                )}
              </div>

              {/* Follow-up */}
              <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
                <div className="flex items-center gap-2 mb-3">
                  <CalendarClock className="size-4 text-accent" />
                  <h3 className="font-display font-bold text-base">Follow-up</h3>
                </div>
                <div className="flex items-end gap-2">
                  <label className="text-xs flex-1">
                    <span className="text-muted-foreground">Next follow-up date</span>
                    <input
                      type="date"
                      value={followup}
                      onChange={(e) => setFollowup(e.target.value)}
                      className="input-base mt-1 w-full"
                    />
                  </label>
                  <button
                    onClick={saveFollowup}
                    disabled={busy}
                    className="px-4 py-2 rounded-xl bg-accent text-accent-foreground font-semibold text-sm hover:opacity-90 disabled:opacity-60"
                  >
                    Save
                  </button>
                </div>
              </div>

              {/* Activity timeline */}
              <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
                <div className="flex items-center gap-2 mb-4">
                  <Activity className="size-4 text-accent" />
                  <h3 className="font-display font-bold text-base">Activity timeline</h3>
                </div>
                {timeline.length === 0 ? (
                  <div className="text-xs text-muted-foreground text-center py-6">No activity yet.</div>
                ) : (
                  <ol className="relative border-l border-border ml-2 space-y-4">
                    {timeline.map((it, i) => (
                      <li key={i} className="ml-4">
                        <span
                          className={`absolute -left-[5px] size-2.5 rounded-full ring-2 ring-card ${
                            it.type === "stage"
                              ? "bg-blue-500"
                              : it.type === "purchased"
                                ? "bg-emerald-500"
                                : "bg-accent"
                          }`}
                        />
                        <div className="text-[10px] uppercase tracking-wide text-muted-foreground inline-flex items-center gap-1">
                          <Clock className="size-2.5" /> {new Date(it.at).toLocaleString("en-IN")} · {it.type}
                          {it.by && <span> · {it.by}</span>}
                        </div>
                        <div className="text-sm mt-0.5 whitespace-pre-wrap">{it.text}</div>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            </div>
          )}

          {tab === "documents" && (
            <div className="p-5 sm:p-6 space-y-4">
              <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
                <div className="flex items-center gap-2 mb-3">
                  <Upload className="size-4 text-accent" />
                  <h3 className="font-display font-bold text-base">Upload document</h3>
                </div>
                <div className="grid sm:grid-cols-[1fr_auto] gap-2">
                  <select value={docType} onChange={(e) => setDocType(e.target.value)} className="input-base">
                    {DOC_TYPES.map((d) => (
                      <option key={d.value} value={d.value}>
                        {d.label}
                      </option>
                    ))}
                  </select>
                  <label
                    className={`inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-accent text-accent-foreground font-semibold text-sm cursor-pointer hover:opacity-90 ${uploading ? "opacity-60 pointer-events-none" : ""}`}
                  >
                    {uploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
                    {uploading ? "Uploading…" : "Choose file"}
                    <input
                      type="file"
                      className="hidden"
                      onChange={handleUpload}
                      accept="image/*,application/pdf"
                      disabled={uploading}
                    />
                  </label>
                </div>
                <p className="text-[11px] text-muted-foreground mt-2">PDF or image up to 10MB.</p>
              </div>

              {docs.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
                  No documents uploaded yet.
                </div>
              ) : (
                <ul className="space-y-2">
                  {docs.map((d) => {
                    const typeMeta = DOC_TYPES.find((x) => x.value === d.doc_type);
                    return (
                      <li
                        key={d.id}
                        className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 shadow-card"
                      >
                        <div className="size-10 rounded-lg bg-accent/10 text-accent grid place-items-center shrink-0">
                          <FileText className="size-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-semibold truncate">{d.file_name}</div>
                          <div className="text-[11px] text-muted-foreground">
                            {typeMeta?.label ?? d.doc_type} · {(Number(d.file_size ?? 0) / 1024).toFixed(0)} KB ·{" "}
                            {timeAgo(d.created_at)}
                          </div>
                        </div>
                        <a
                          href={d.file_url}
                          target="_blank"
                          rel="noopener"
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg border border-border hover:bg-secondary"
                        >
                          <Download className="size-3.5" /> Open
                        </a>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}

          {tab === "notes" && (
            <div className="p-5 sm:p-6 space-y-4">
              <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
                <div className="flex items-center gap-2 mb-3">
                  <StickyNote className="size-4 text-accent" />
                  <h3 className="font-display font-bold text-base">Add internal note</h3>
                </div>
                <textarea
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  placeholder="Call summary, client requirement, blocker, next step…"
                  rows={4}
                  className="input-base w-full !h-auto py-2"
                />
                <div className="flex justify-end mt-2">
                  <button
                    onClick={addNote}
                    disabled={busy || !noteText.trim()}
                    className="px-4 py-2 rounded-xl bg-accent text-accent-foreground font-semibold text-sm hover:opacity-90 disabled:opacity-50"
                  >
                    Add note
                  </button>
                </div>
              </div>
              {visibleNotes.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
                  No notes yet — add the first one above.
                </div>
              ) : (
                <ul className="space-y-2">
                  {[...visibleNotes].reverse().map((n, i) => (
                    <li key={i} className="rounded-xl border border-border bg-card p-4 shadow-card">
                      <div className="text-[11px] text-muted-foreground inline-flex items-center gap-2">
                        <Clock className="size-3" /> {new Date(n.at).toLocaleString("en-IN")}
                        {n.by && <span>· {n.by}</span>}
                      </div>
                      <div className="text-sm mt-1.5 whitespace-pre-wrap">{n.text}</div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {tab === "commission" && (
            <div className="p-5 sm:p-6 space-y-4">
              <div className="grid sm:grid-cols-3 gap-3">
                <MetaCard label="Loan / ticket size" value={`₹${lead.loan_amount.toLocaleString("en-IN")}`} />
                <MetaCard label="Final deal value" value={purchase.deal_value ? `₹${purchase.deal_value.toLocaleString("en-IN")}` : "—"} />
                <MetaCard label="Est. commission" value={`₹${commission.toLocaleString("en-IN")}`} />
              </div>

              <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
                <div className="flex items-center gap-2 mb-3">
                  <Banknote className="size-4 text-accent" />
                  <h3 className="font-display font-bold text-base">Disbursals</h3>
                </div>
                {disbursals.length === 0 ? (
                  <div className="text-xs text-muted-foreground py-3">No disbursal recorded yet.</div>
                ) : (
                  <ul className="space-y-2">
                    {disbursals.map((d) => (
                      <li key={d.id} className="rounded-xl border border-border p-3 text-sm">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <div className="font-semibold">{d.lender_name ?? "Lender"}</div>
                          <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-secondary border border-border">{d.status}</span>
                        </div>
                        <div className="grid sm:grid-cols-4 gap-2 text-xs mt-2 text-muted-foreground">
                          <div><span className="block text-[10px] uppercase">Loan A/C</span><span className="text-foreground">{d.loan_account_no ?? "—"}</span></div>
                          <div><span className="block text-[10px] uppercase">Disbursed</span><span className="text-foreground">₹{Number(d.disbursed_amount).toLocaleString("en-IN")}</span></div>
                          <div><span className="block text-[10px] uppercase">Commission</span><span className="text-foreground">₹{Number(d.commission_amount).toLocaleString("en-IN")}</span></div>
                          <div><span className="block text-[10px] uppercase">Date</span><span className="text-foreground">{d.disbursed_at ? new Date(d.disbursed_at).toLocaleDateString("en-IN") : "—"}</span></div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
                <div className="flex items-center gap-2 mb-3">
                  <IndianRupee className="size-4 text-accent" />
                  <h3 className="font-display font-bold text-base">Commission ledger</h3>
                </div>
                {commissions.length === 0 ? (
                  <div className="text-xs text-muted-foreground py-3">No commission entries yet.</div>
                ) : (
                  <ul className="space-y-2">
                    {commissions.map((c) => (
                      <li key={c.id} className="flex items-center justify-between rounded-xl border border-border p-3 text-sm">
                        <div>
                          <div className="font-semibold">₹{Number(c.amount).toLocaleString("en-IN")} <span className="text-xs text-muted-foreground">({c.percentage}% of ₹{Number(c.base_amount).toLocaleString("en-IN")})</span></div>
                          <div className="text-[11px] text-muted-foreground">{new Date(c.created_at).toLocaleString("en-IN")}{c.credited_at ? ` · credited ${new Date(c.credited_at).toLocaleDateString("en-IN")}` : ""}</div>
                        </div>
                        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${c.status === "credited" ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" : "bg-amber-500/15 text-amber-700 dark:text-amber-300"}`}>{c.status}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}

function ActionBtn({
  icon: Icon,
  label,
  tone,
  href,
  target,
  onClick,
  disabled,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  tone: "accent" | "emerald" | "default";
  href?: string;
  target?: string;
  onClick?: () => void;
  disabled?: boolean;
}) {
  const cls =
    tone === "accent"
      ? "bg-accent text-accent-foreground hover:opacity-90"
      : tone === "emerald"
        ? "bg-emerald-500 text-white hover:opacity-90"
        : "border border-border hover:bg-secondary text-foreground";
  const base = `flex flex-col items-center gap-1 py-2.5 rounded-xl font-semibold text-[11px] transition ${cls} ${
    disabled ? "opacity-40 pointer-events-none" : ""
  }`;
  if (href) {
    return (
      <a href={href} target={target} rel={target ? "noopener" : undefined} className={base}>
        <Icon className="size-4" />
        {label}
      </a>
    );
  }
  return (
    <button onClick={onClick} className={base} disabled={disabled}>
      <Icon className="size-4" />
      {label}
    </button>
  );
}

function PanelGroup({
  title,
  icon: Icon,
  items,
  onCopy,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  items: { label: string; value: string | number | null | undefined; copy?: boolean }[];
  onCopy: (text: string, label: string) => void;
}) {
  const visible = items.filter((i) => i.value !== null && i.value !== undefined && i.value !== "");
  if (visible.length === 0) return null;
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
      <div className="flex items-center gap-2 mb-3">
        <Icon className="size-4 text-accent" />
        <h3 className="font-display font-bold text-base">{title}</h3>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
        {visible.map((it) => (
          <div key={it.label} className="min-w-0">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{it.label}</div>
            <div className="flex items-center gap-1.5">
              <div className="text-sm font-medium truncate">{String(it.value)}</div>
              {it.copy && (
                <button
                  onClick={() => onCopy(String(it.value), it.label)}
                  className="text-muted-foreground hover:text-accent shrink-0"
                  title={`Copy ${it.label}`}
                >
                  <Copy className="size-3" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MetaCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-secondary/40 p-3">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-xs font-semibold mt-0.5">{value}</div>
    </div>
  );
}
