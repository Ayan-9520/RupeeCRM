import { useEffect, useState } from "react";
import { Banknote, ShieldCheck, CreditCard, LineChart, ArrowUpRight, ChevronDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { CATEGORIES, type ProductCategory, type ProductType, payoutLabel } from "@/lib/products";

const CATEGORY_ICONS = { Banknote, ShieldCheck, CreditCard, LineChart } as const;

const VISIBLE_TAGS = 6;

type CardData = {
  category: ProductCategory;
  label: string;
  tagline: string;
  iconKey: keyof typeof CATEGORY_ICONS;
  color: string;
  items: ProductType[];
};

export function Products() {
  const [cards, setCards] = useState<CardData[]>([]);
  const [expanded, setExpanded] = useState<ProductCategory | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("product_types")
        .select("*")
        .eq("enabled", true)
        .order("display_order", { ascending: true });
      const items = (data ?? []) as ProductType[];
      setCards(
        CATEGORIES.map((c) => ({
          category: c.key,
          label: c.label,
          tagline: c.tagline,
          iconKey: c.icon as keyof typeof CATEGORY_ICONS,
          color: c.color,
          items: items.filter((i) => i.category === c.key),
        })),
      );
    })();
  }, []);

  return (
    <section id="products" className="py-24 lg:py-32 bg-background border-t border-border relative overflow-hidden">
      <div className="absolute inset-0 -z-10 wa-pattern opacity-30" />
      <div className="max-w-7xl mx-auto px-5 lg:px-8">
        <div className="max-w-2xl">
          <div className="text-xs uppercase tracking-[0.2em] text-[var(--wa-green)] font-bold">Products</div>
          <h2 className="mt-3 text-3xl lg:text-5xl font-bold tracking-tight">
            One platform. <span className="text-gradient">Every financial product.</span>
          </h2>
          <p className="mt-4 text-muted-foreground text-lg">
            38+ sub-products across loans, insurance, credit cards & investments. Distribute, track, and earn from a single CRM.
          </p>
        </div>

        <div className="mt-14 grid sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4 gap-4">
          {cards.map((c) => (
            <ProductCard
              key={c.category}
              card={c}
              expanded={expanded === c.category}
              onToggle={() => setExpanded(expanded === c.category ? null : c.category)}
            />
          ))}
        </div>

        <div className="mt-10 flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <span className="size-1.5 rounded-full bg-[var(--wa-green)] animate-pulse" />
          New product types ship every quarter — admin can add categories anytime.
        </div>
      </div>
    </section>
  );
}

function ProductCard({ card, expanded, onToggle }: { card: CardData; expanded: boolean; onToggle: () => void }) {
  const Icon = CATEGORY_ICONS[card.iconKey];
  const items = card.items;
  const visible = expanded ? items : items.slice(0, VISIBLE_TAGS);
  const hidden = items.length - VISIBLE_TAGS;
  const accentClass =
    card.color === "blue" ? "from-blue-500/20 to-blue-500/5 text-blue-600 dark:text-blue-400" :
    card.color === "green" ? "from-emerald-500/20 to-emerald-500/5 text-emerald-600 dark:text-emerald-400" :
    card.color === "orange" ? "from-orange-500/20 to-orange-500/5 text-orange-600 dark:text-orange-400" :
    "from-violet-500/20 to-violet-500/5 text-violet-600 dark:text-violet-400";

  return (
    <div className="group relative rounded-2xl bg-card border border-border p-6 hover:shadow-elevated hover:border-[var(--wa-green)]/30 transition-smooth flex flex-col">
      <div className={`size-12 rounded-xl bg-gradient-to-br ${accentClass} grid place-items-center group-hover:scale-110 transition-smooth`}>
        <Icon className="size-6" strokeWidth={2.2} />
      </div>
      <h3 className="mt-5 font-display font-semibold text-xl">{card.label}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{card.tagline}</p>
      <div className="mt-2 text-[10px] font-mono text-muted-foreground">{items.length} sub-products</div>

      <ul className="mt-4 flex flex-wrap gap-1.5">
        {visible.map((it) => (
          <li
            key={it.id}
            title={it.description ?? it.name}
            className="group/tag relative text-[11px] font-medium px-2 py-0.5 rounded-md bg-secondary text-foreground/75 border border-border hover:bg-accent/15 hover:border-accent/40 transition-smooth cursor-help"
          >
            {it.name}
            {it.high_demand && <span className="ml-1 text-[8px] text-orange-500">●</span>}
          </li>
        ))}
        {!expanded && hidden > 0 && (
          <li>
            <button
              onClick={onToggle}
              className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-accent/15 text-accent border border-accent/30 hover:bg-accent/25 transition-smooth"
            >
              +{hidden} more
            </button>
          </li>
        )}
      </ul>

      {expanded && items.some((i) => i.description) && (
        <div className="mt-3 text-[11px] text-muted-foreground space-y-1 max-h-32 overflow-y-auto pr-1">
          {items.slice(0, 4).map((i) => i.description && (
            <div key={i.id}><span className="font-semibold text-foreground/80">{i.name}:</span> {i.description}</div>
          ))}
        </div>
      )}

      <div className="mt-5 pt-4 border-t border-dashed border-border flex items-center justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">Payout range</div>
          <div className="font-mono text-sm font-semibold mt-0.5">
            {items.length > 0 ? payoutLabel(items[0]) : "—"}
          </div>
        </div>
        <button
          onClick={onToggle}
          className="inline-flex items-center gap-1 text-xs font-semibold text-foreground hover:text-accent transition-smooth"
        >
          {expanded ? "Less" : "View all"}
          {expanded ? <ChevronDown className="size-3 rotate-180 transition-transform" /> : <ArrowUpRight className="size-3" />}
        </button>
      </div>
    </div>
  );
}
