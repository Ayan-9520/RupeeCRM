import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { isPlatformAdmin } from "@/lib/role-access";
import { toast } from "sonner";
import {
  Loader2, Plus, Search, ShieldAlert, User, Phone, MapPin,
  Banknote, IndianRupee, Tag, X, Upload,
} from "lucide-react";
import { CATEGORIES, CATEGORY_META, type ProductCategory } from "@/lib/products";
import { createCrmLead, listCrmLeads, type CrmLead } from "@/lib/python-api";

export const Route = createFileRoute("/dashboard/admin/leads")({
  head: () => ({ meta: [{ title: "Admin · Leads — RupeeDial One" }] }),
  component: AdminLeadsPage,
});

function AdminLeadsPage() {
  const { role } = useAuth();
  const [leads, setLeads] = useState<CrmLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState<ProductCategory | "all">("all");
  const [openForm, setOpenForm] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const data = await listCrmLeads({ limit: 200 });
      setLeads(data.items ?? []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load leads");
      setLeads([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return leads.filter((l) => {
      if (filterCat !== "all" && l.product_category !== filterCat) return false;
      if (q && !`${l.applicant_name} ${l.full_phone} ${l.city}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [leads, filterCat, search]);

  if (role && !isPlatformAdmin(role)) {
    return (
      <div className="max-w-md mx-auto mt-20 rounded-2xl border border-border bg-card p-8 text-center">
        <ShieldAlert className="size-10 text-amber-500 mx-auto mb-3" />
        <h2 className="font-display text-xl font-bold mb-1">Admin only</h2>
        <p className="text-sm text-muted-foreground">Lead creation is restricted to admins.</p>
        <Link to="/dashboard" className="inline-block mt-4 text-sm font-semibold text-accent">
          ← Back
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-2xl lg:text-3xl font-bold">Leads (Admin)</h1>
          <p className="text-muted-foreground mt-1">CRM marketplace leads — create one-by-one or via website forms.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => toast.info("Import via website forms or add one-by-one")}
            className="inline-flex items-center gap-2 border border-border bg-card rounded-xl px-4 py-2.5 font-semibold text-sm hover:bg-secondary transition"
          >
            <Upload className="size-4" /> Bulk import
          </button>
          <button
            type="button"
            onClick={() => setOpenForm(true)}
            className="inline-flex items-center gap-2 bg-accent text-accent-foreground rounded-xl px-4 py-2.5 font-semibold shadow-mint hover:opacity-90 transition"
          >
            <Plus className="size-4" /> New lead
          </button>
        </div>
      </div>

      <div className="rounded-2xl bg-card border border-border p-4 shadow-card">
        <div className="grid sm:grid-cols-3 gap-3">
          <div className="relative sm:col-span-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, phone, city…"
              className="input-base pl-9 w-full"
            />
          </div>
          <select
            value={filterCat}
            onChange={(e) => setFilterCat(e.target.value as ProductCategory | "all")}
            className="input-base"
          >
            <option value="all">All categories</option>
            {CATEGORIES.map((c) => (
              <option key={c.key} value={c.key}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="rounded-2xl bg-card border border-border shadow-card overflow-hidden">
        {loading ? (
          <div className="grid place-items-center py-20">
            <Loader2 className="size-6 animate-spin text-accent" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground text-sm">
            No leads yet — click &quot;New lead&quot; to add one.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary/40 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-3">Applicant</th>
                  <th className="text-left px-4 py-3">Source</th>
                  <th className="text-left px-4 py-3">Product</th>
                  <th className="text-left px-4 py-3">City</th>
                  <th className="text-left px-4 py-3">Score</th>
                  <th className="text-left px-4 py-3">Price</th>
                  <th className="text-left px-4 py-3">Status</th>
                  <th className="text-left px-4 py-3">Created</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((l) => {
                  const cat = (l.product_category || "loan") as ProductCategory;
                  const meta = CATEGORY_META[cat] ?? CATEGORY_META.loan;
                  return (
                    <tr key={l.id} className="border-t border-border hover:bg-secondary/30">
                      <td className="px-4 py-3">
                        <div className="font-semibold">{l.applicant_name}</div>
                        <div className="text-xs text-muted-foreground">{l.full_phone || l.masked_phone}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-secondary text-foreground/70">
                          {l.source ?? "Manual"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${meta.chipBg} ${meta.chipText}`}>
                          {meta.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">{l.city}</td>
                      <td className="px-4 py-3">
                        <ScoreBadge score={l.score} />
                      </td>
                      <td className="px-4 py-3 font-semibold">₹{Number(l.price).toLocaleString("en-IN")}</td>
                      <td className="px-4 py-3">
                        <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">
                          {l.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {new Date(l.created_at).toLocaleDateString("en-IN")}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {openForm && (
        <NewLeadDrawer
          onClose={() => setOpenForm(false)}
          onCreated={() => {
            setOpenForm(false);
            void load();
          }}
        />
      )}
    </div>
  );
}

function ScoreBadge({ score }: { score: string }) {
  const key = (score || "warm").toLowerCase();
  const map: Record<string, string> = {
    hot: "bg-red-500/15 text-red-700 dark:text-red-300",
    warm: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
    cold: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  };
  return (
    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${map[key] ?? map.warm}`}>
      {score || "warm"}
    </span>
  );
}

type FormState = {
  applicant_name: string;
  full_phone: string;
  city: string;
  loan_amount: string;
  product_category: ProductCategory;
  score: "cold" | "warm" | "hot";
  price: string;
};

const EMPTY: FormState = {
  applicant_name: "",
  full_phone: "",
  city: "",
  loan_amount: "",
  product_category: "loan",
  score: "warm",
  price: "99",
};

function NewLeadDrawer({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState<FormState>(EMPTY);
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!form.applicant_name.trim()) {
      toast.error("Name is required");
      return;
    }
    if (!/^\+?\d{10,15}$/.test(form.full_phone.replace(/\s/g, ""))) {
      toast.error("Valid phone is required");
      return;
    }
    setSaving(true);
    try {
      await createCrmLead({
        applicant_name: form.applicant_name.trim(),
        full_phone: form.full_phone.replace(/\s/g, ""),
        city: form.city.trim() || "—",
        loan_amount: Number(form.loan_amount || 0),
        product_category: form.product_category,
        score: form.score,
        price: Number(form.price || 99),
        source: "Manual",
        is_marketplace: true,
        sale_available: true,
      });
      toast.success("Lead created");
      onCreated();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Create failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm grid place-items-end sm:place-items-center p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-card border border-border rounded-t-2xl sm:rounded-2xl w-full max-w-lg max-h-[92vh] overflow-hidden flex flex-col shadow-2xl"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="font-display text-lg font-bold">New lead</h2>
          <button type="button" onClick={onClose} className="size-8 rounded-lg hover:bg-secondary grid place-items-center">
            <X className="size-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          <Field icon={User} label="Customer name" required>
            <input
              className="input-base w-full"
              value={form.applicant_name}
              onChange={(e) => set("applicant_name", e.target.value)}
              placeholder="Rahul Sharma"
            />
          </Field>
          <Field icon={Phone} label="Phone" required>
            <input
              className="input-base w-full"
              value={form.full_phone}
              onChange={(e) => set("full_phone", e.target.value)}
              placeholder="+919876543210"
            />
          </Field>
          <Field icon={MapPin} label="City">
            <input
              className="input-base w-full"
              value={form.city}
              onChange={(e) => set("city", e.target.value)}
              placeholder="Mumbai"
            />
          </Field>
          <Field icon={Banknote} label="Loan amount (₹)">
            <input
              className="input-base w-full"
              type="number"
              value={form.loan_amount}
              onChange={(e) => set("loan_amount", e.target.value)}
              placeholder="500000"
            />
          </Field>
          <Field icon={Tag} label="Product category">
            <select
              className="input-base w-full"
              value={form.product_category}
              onChange={(e) => set("product_category", e.target.value as ProductCategory)}
            >
              {CATEGORIES.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.label}
                </option>
              ))}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field icon={Tag} label="Score">
              <select
                className="input-base w-full"
                value={form.score}
                onChange={(e) => set("score", e.target.value as FormState["score"])}
              >
                <option value="hot">Hot</option>
                <option value="warm">Warm</option>
                <option value="cold">Cold</option>
              </select>
            </Field>
            <Field icon={IndianRupee} label="Price (₹)">
              <input
                className="input-base w-full"
                type="number"
                value={form.price}
                onChange={(e) => set("price", e.target.value)}
              />
            </Field>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-border flex items-center justify-between gap-3">
          <button type="button" onClick={onClose} className="text-sm font-semibold px-4 py-2 rounded-lg hover:bg-secondary transition">
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={saving}
            className="inline-flex items-center gap-2 bg-accent text-accent-foreground rounded-lg px-5 py-2 font-semibold hover:opacity-90 disabled:opacity-50"
          >
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
            Create lead
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({
  icon: Icon,
  label,
  required,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground mb-1 flex items-center gap-1.5">
        <Icon className="size-3" /> {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
    </div>
  );
}
