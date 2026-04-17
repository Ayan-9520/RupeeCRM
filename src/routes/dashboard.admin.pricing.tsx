import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import { Loader2, Sparkles, Save, Power } from "lucide-react";
import { CATEGORY_META, payoutLabel, type ProductCategory, type ProductType } from "@/lib/products";

export const Route = createFileRoute("/dashboard/admin/pricing")({
  head: () => ({ meta: [{ title: "Product Manager — LeadMines Admin" }] }),
  component: Admin,
});

function Admin() {
  const { role } = useAuth();
  const [items, setItems] = useState<ProductType[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | ProductCategory>("all");
  const [saving, setSaving] = useState<string | null>(null);

  const isAdmin = role === "admin";

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("product_types").select("*").order("category").order("display_order");
    setItems((data ?? []) as ProductType[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const visible = useMemo(() => filter === "all" ? items : items.filter((i) => i.category === filter), [items, filter]);

  const update = (id: string, patch: Partial<ProductType>) => {
    setItems((prev) => prev.map((i) => i.id === id ? { ...i, ...patch } : i));
  };

  const save = async (item: ProductType) => {
    setSaving(item.id);
    const { error } = await supabase.from("product_types").update({
      default_lead_price: Number(item.default_lead_price),
      commission_pct_min: Number(item.commission_pct_min),
      commission_pct_max: Number(item.commission_pct_max),
      commission_flat_min: Number(item.commission_flat_min),
      commission_flat_max: Number(item.commission_flat_max),
      enabled: item.enabled,
      high_demand: item.high_demand,
      high_commission: item.high_commission,
    }).eq("id", item.id);
    setSaving(null);
    if (error) toast.error(error.message);
    else toast.success(`Saved: ${item.name}`);
  };

  if (!isAdmin) {
    return (
      <div className="max-w-3xl">
        <div className="rounded-3xl bg-card border border-dashed border-border p-12 text-center">
          <div className="size-14 mx-auto rounded-2xl bg-destructive/15 grid place-items-center"><Sparkles className="size-6 text-destructive" /></div>
          <h1 className="font-display text-2xl font-bold mt-4">Admins only</h1>
          <p className="text-muted-foreground mt-2">You need the platform admin role to manage products.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl">
      <div>
        <h1 className="font-display text-2xl lg:text-3xl font-bold">Product Manager</h1>
        <p className="text-muted-foreground mt-1">Configure lead pricing, commissions, badges and availability per product.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {(["all", "loan", "insurance", "credit_card", "investment"] as const).map((f) => {
          const meta = f === "all" ? null : CATEGORY_META[f];
          const active = filter === f;
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-full text-sm font-semibold border transition-smooth ${
                active ? "bg-accent text-accent-foreground border-accent" : `bg-card border-border ${meta?.chipText ?? ""}`
              }`}
            >
              {f === "all" ? "All" : meta?.label}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="grid place-items-center py-20"><Loader2 className="size-6 animate-spin text-accent" /></div>
      ) : (
        <div className="rounded-2xl bg-card border border-border shadow-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary/50 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-3">Product</th>
                <th className="text-right px-2 py-3">Lead ₹</th>
                <th className="text-right px-2 py-3">Comm % min/max</th>
                <th className="text-right px-2 py-3">Flat ₹ min/max</th>
                <th className="text-center px-2 py-3">Hot</th>
                <th className="text-center px-2 py-3">High ₹</th>
                <th className="text-center px-2 py-3">Enabled</th>
                <th className="text-right px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((it) => {
                const meta = CATEGORY_META[it.category];
                return (
                  <tr key={it.id} className="border-t border-border hover:bg-secondary/30">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${meta.chipBg} ${meta.chipText}`}>{meta.label}</span>
                        <div>
                          <div className="font-semibold">{it.name}</div>
                          <div className="text-[11px] text-muted-foreground">{payoutLabel(it)}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-2 py-2"><Input value={it.default_lead_price} onChange={(v) => update(it.id, { default_lead_price: v })} /></td>
                    <td className="px-2 py-2">
                      <div className="flex gap-1">
                        <Input value={it.commission_pct_min} onChange={(v) => update(it.id, { commission_pct_min: v })} small />
                        <Input value={it.commission_pct_max} onChange={(v) => update(it.id, { commission_pct_max: v })} small />
                      </div>
                    </td>
                    <td className="px-2 py-2">
                      <div className="flex gap-1">
                        <Input value={it.commission_flat_min} onChange={(v) => update(it.id, { commission_flat_min: v })} small />
                        <Input value={it.commission_flat_max} onChange={(v) => update(it.id, { commission_flat_max: v })} small />
                      </div>
                    </td>
                    <td className="px-2 py-2 text-center">
                      <input type="checkbox" checked={it.high_demand} onChange={(e) => update(it.id, { high_demand: e.target.checked })} />
                    </td>
                    <td className="px-2 py-2 text-center">
                      <input type="checkbox" checked={it.high_commission} onChange={(e) => update(it.id, { high_commission: e.target.checked })} />
                    </td>
                    <td className="px-2 py-2 text-center">
                      <button
                        onClick={() => update(it.id, { enabled: !it.enabled })}
                        className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-semibold ${it.enabled ? "bg-emerald-500/15 text-emerald-600" : "bg-muted text-muted-foreground"}`}
                      >
                        <Power className="size-3" /> {it.enabled ? "On" : "Off"}
                      </button>
                    </td>
                    <td className="px-4 py-2 text-right">
                      <button
                        onClick={() => save(it)}
                        disabled={saving === it.id}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-accent text-accent-foreground text-xs font-semibold hover:opacity-90 disabled:opacity-60"
                      >
                        {saving === it.id ? <Loader2 className="size-3 animate-spin" /> : <Save className="size-3" />}
                        Save
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Input({ value, onChange, small = false }: { value: number; onChange: (v: number) => void; small?: boolean }) {
  return (
    <input
      type="number"
      step="0.1"
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className={`bg-background border border-border rounded px-2 py-1 text-right text-xs ${small ? "w-16" : "w-20"} focus:border-accent focus:outline-none`}
    />
  );
}
