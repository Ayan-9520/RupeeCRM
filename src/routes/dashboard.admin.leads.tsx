import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import {
  Loader2, Plus, Search, ShieldAlert, User, Phone, Mail, MapPin,
  Banknote, Briefcase, IndianRupee, Sparkles, AlertTriangle, CalendarClock,
  Tag, Megaphone, FileText, ChevronRight, X, Upload,
} from "lucide-react";
import { CATEGORIES, CATEGORY_META, type ProductCategory, type ProductType } from "@/lib/products";
import type { Json } from "@/integrations/supabase/types";
import { BulkUploadLeadsDialog } from "@/components/admin/BulkUploadLeadsDialog";

export const Route = createFileRoute("/dashboard/admin/leads")({
  head: () => ({ meta: [{ title: "Admin · Leads — LeadMines" }] }),
  component: AdminLeadsPage,
});

type LeadRow = {
  id: string;
  applicant_name: string;
  full_phone: string;
  city: string;
  product_category: ProductCategory;
  product_type_id: string | null;
  score: "cold" | "warm" | "hot";
  status: "available" | "sold" | "archived";
  price: number;
  created_at: string;
  follow_up_date: string | null;
  source: string | null;
  ref_dsa_id: string | null;
  is_marketplace: boolean;
  utm_source: string | null;
  referrer?: { dsa_id: string | null; full_name: string | null } | null;
};

function AdminLeadsPage() {
  const { role } = useAuth();
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [productTypes, setProductTypes] = useState<ProductType[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState<ProductCategory | "all">("all");
  const [openForm, setOpenForm] = useState(false);
  const [openBulk, setOpenBulk] = useState(false);

  const load = async () => {
    setLoading(true);
    const [lRes, pRes] = await Promise.all([
      supabase
        .from("leads")
        .select("id,applicant_name,full_phone,city,product_category,product_type_id,score,status,price,created_at,follow_up_date,source,ref_dsa_id,is_marketplace,utm_source,referrer:profiles!leads_ref_dsa_id_fkey(dsa_id,full_name)")
        .order("created_at", { ascending: false })
        .limit(200),
      supabase.from("product_types").select("*").eq("enabled", true).order("display_order"),
    ]);
    if (lRes.error) toast.error(lRes.error.message);
    setLeads((lRes.data ?? []) as LeadRow[]);
    setProductTypes((pRes.data ?? []) as ProductType[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return leads.filter((l) => {
      if (filterCat !== "all" && l.product_category !== filterCat) return false;
      if (q && !`${l.applicant_name} ${l.full_phone} ${l.city}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [leads, filterCat, search]);

  if (role && role !== "admin") {
    return (
      <div className="max-w-md mx-auto mt-20 rounded-2xl border border-border bg-card p-8 text-center">
        <ShieldAlert className="size-10 text-amber-500 mx-auto mb-3" />
        <h2 className="font-display text-xl font-bold mb-1">Admin only</h2>
        <p className="text-sm text-muted-foreground">Lead creation is restricted to admins.</p>
        <Link to="/dashboard" className="inline-block mt-4 text-sm font-semibold text-accent">← Back</Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-2xl lg:text-3xl font-bold">Leads (Admin)</h1>
          <p className="text-muted-foreground mt-1">Add structured leads with auto-scoring, smart follow-ups, and duplicate protection.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setOpenBulk(true)}
            className="inline-flex items-center gap-2 border border-border bg-card rounded-xl px-4 py-2.5 font-semibold text-sm hover:bg-secondary transition"
          >
            <Upload className="size-4" /> Bulk import
          </button>
          <button
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
          <select value={filterCat} onChange={(e) => setFilterCat(e.target.value as ProductCategory | "all")} className="input-base">
            <option value="all">All categories</option>
            {CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
          </select>
        </div>
      </div>

      <div className="rounded-2xl bg-card border border-border shadow-card overflow-hidden">
        {loading ? (
          <div className="grid place-items-center py-20"><Loader2 className="size-6 animate-spin text-accent" /></div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground text-sm">No leads yet — click "New lead" to add one.</div>
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
                  <th className="text-left px-4 py-3">Follow-up</th>
                  <th className="text-left px-4 py-3">Created</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((l) => {
                  const meta = CATEGORY_META[l.product_category];
                  const overdue = l.follow_up_date && new Date(l.follow_up_date) < new Date();
                  return (
                    <tr key={l.id} className="border-t border-border hover:bg-secondary/30">
                      <td className="px-4 py-3">
                        <div className="font-semibold">{l.applicant_name}</div>
                        <div className="text-xs text-muted-foreground">{l.full_phone}</div>
                      </td>
                      <td className="px-4 py-3">
                        {l.ref_dsa_id ? (
                          <div className="flex flex-col gap-0.5">
                            <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 w-fit">Referral</span>
                            <span className="text-[10px] text-muted-foreground font-mono">{l.referrer?.dsa_id ?? "—"}</span>
                          </div>
                        ) : (
                          <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-secondary text-foreground/70">{l.source ?? "Manual"}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${meta.chipBg} ${meta.chipText}`}>{meta.label}</span>
                      </td>
                      <td className="px-4 py-3">{l.city}</td>
                      <td className="px-4 py-3">
                        <ScoreBadge score={l.score} />
                      </td>
                      <td className="px-4 py-3 font-semibold">₹{Number(l.price).toLocaleString("en-IN")}</td>
                      <td className="px-4 py-3">
                        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                          l.status === "available" ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                          : l.status === "sold" ? "bg-blue-500/15 text-blue-700 dark:text-blue-300"
                          : "bg-secondary text-muted-foreground"
                        }`}>{l.status}</span>
                      </td>
                      <td className="px-4 py-3">
                        {l.follow_up_date ? (
                          <span className={`inline-flex items-center gap-1 text-xs ${overdue ? "text-red-600 dark:text-red-400 font-semibold" : "text-muted-foreground"}`}>
                            {overdue && <AlertTriangle className="size-3" />}
                            {new Date(l.follow_up_date).toLocaleDateString("en-IN")}
                          </span>
                        ) : "—"}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(l.created_at).toLocaleDateString("en-IN")}</td>
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
          productTypes={productTypes}
          onClose={() => setOpenForm(false)}
          onCreated={() => { setOpenForm(false); load(); }}
        />
      )}
      <BulkUploadLeadsDialog
        open={openBulk}
        onClose={() => setOpenBulk(false)}
        onImported={load}
        productTypes={productTypes}
      />
    </div>
  );
}

function ScoreBadge({ score }: { score: "cold" | "warm" | "hot" }) {
  const map = {
    hot: "bg-red-500/15 text-red-700 dark:text-red-300",
    warm: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
    cold: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  };
  return <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${map[score]}`}>{score}</span>;
}

/* ======================== New Lead Drawer ======================== */

type FormState = {
  applicant_name: string;
  full_phone: string;
  alternate_phone: string;
  email: string;
  city: string;
  state: string;
  product_category: ProductCategory;
  product_type_id: string;
  loan_amount: string;
  sum_insured: string;
  card_type: string;
  monthly_income: string;
  employment_type: string;
  company_name: string;
  cibil_score: string;
  age: string;
  gender: string;
  family_members: string;
  source: string;
  campaign_name: string;
  follow_up_date: string;
  next_call_date: string;
  score: "auto" | "cold" | "warm" | "hot";
  price: string;
  sale_available: boolean;
  remarks: string;
  internal_notes: string;
};

const EMPTY: FormState = {
  applicant_name: "", full_phone: "", alternate_phone: "", email: "", city: "", state: "",
  product_category: "loan", product_type_id: "", loan_amount: "", sum_insured: "", card_type: "",
  monthly_income: "", employment_type: "", company_name: "", cibil_score: "",
  age: "", gender: "", family_members: "",
  source: "Manual", campaign_name: "", follow_up_date: "", next_call_date: "",
  score: "auto", price: "", sale_available: true, remarks: "", internal_notes: "",
};

function NewLeadDrawer({
  productTypes, onClose, onCreated,
}: {
  productTypes: ProductType[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [dupWarn, setDupWarn] = useState<string | null>(null);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }));

  const filteredTypes = productTypes.filter((p) => p.category === form.product_category);

  useEffect(() => {
    if (form.product_type_id && !filteredTypes.find((t) => t.id === form.product_type_id)) {
      set("product_type_id", "");
    }
  }, [form.product_category]);

  useEffect(() => {
    const pt = filteredTypes.find((t) => t.id === form.product_type_id);
    if (pt && !form.price) set("price", String(pt.default_lead_price));
  }, [form.product_type_id]);

  const checkDuplicate = async () => {
    if (!form.full_phone || form.full_phone.length < 10) { setDupWarn(null); return; }
    const since = new Date(Date.now() - 30 * 86400_000).toISOString();
    const { data } = await supabase
      .from("leads")
      .select("id,applicant_name,created_at")
      .eq("full_phone", form.full_phone)
      .gte("created_at", since)
      .limit(1);
    if (data && data.length > 0) {
      setDupWarn(`Duplicate: this phone was added on ${new Date(data[0].created_at).toLocaleDateString("en-IN")}`);
    } else setDupWarn(null);
  };

  const validateStep = (s: number): string | null => {
    if (s === 1) {
      if (!form.applicant_name.trim()) return "Customer name is required";
      if (!/^\+?\d{10,15}$/.test(form.full_phone.replace(/\s/g, ""))) return "Valid phone number is required";
      if (!form.city.trim()) return "City is required";
      if (!form.state.trim()) return "State is required";
      if (form.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email)) return "Invalid email";
    }
    if (s === 2) {
      if (!form.product_type_id) return "Pick a product type";
      if (form.product_category === "loan" && !form.loan_amount) return "Loan amount is required";
      if (form.product_category === "insurance" && !form.sum_insured) return "Sum insured is required";
      if (form.product_category === "credit_card" && !form.card_type) return "Card type is required";
      if (form.product_category === "investment" && !form.loan_amount) return "Investment amount is required";
    }
    return null;
  };

  const next = () => {
    const err = validateStep(step);
    if (err) { toast.error(err); return; }
    setStep((s) => Math.min(4, s + 1));
  };

  const submit = async () => {
    for (let s = 1; s <= 3; s++) {
      const e = validateStep(s);
      if (e) { setStep(s); toast.error(e); return; }
    }
    setSaving(true);
    const phone = form.full_phone.replace(/\s/g, "");
    const masked = phone.length > 4 ? phone.slice(0, 2) + "XXXX" + phone.slice(-2) : phone;
    const pt = filteredTypes.find((t) => t.id === form.product_type_id);

    const loan_type = form.product_category === "loan" ? "personal"
      : form.product_category === "insurance" ? "insurance"
      : form.product_category === "credit_card" ? "credit_card"
      : "mutual_fund";

    const amount = form.product_category === "insurance"
      ? Number(form.sum_insured || 0)
      : Number(form.loan_amount || 0);

    const product_details: Record<string, unknown> = {};
    if (form.card_type) product_details.card_type = form.card_type;
    if (form.family_members) product_details.family_members = Number(form.family_members);
    if (form.gender) product_details.gender = form.gender;

    const insertRow = {
      applicant_name: form.applicant_name.trim(),
      full_phone: phone,
      masked_phone: masked,
      alternate_phone: form.alternate_phone || null,
      email: form.email || null,
      city: form.city.trim(),
      state: form.state.trim(),
      product_category: form.product_category,
      product_type_id: form.product_type_id,
      product_subtype: pt?.name ?? null,
      product_details: product_details as Json,
      loan_type: loan_type as "personal" | "home" | "business" | "credit_card" | "insurance" | "mutual_fund",
      loan_amount: amount,
      sum_insured: form.sum_insured ? Number(form.sum_insured) : null,
      monthly_income: form.monthly_income ? Number(form.monthly_income) : null,
      employment_type: form.employment_type || null,
      company_name: form.company_name || null,
      cibil_score: form.cibil_score ? Number(form.cibil_score) : null,
      age: form.age ? Number(form.age) : null,
      gender: form.gender || null,
      family_members: form.family_members ? Number(form.family_members) : null,
      card_type: form.card_type || null,
      source: form.source,
      campaign_name: form.campaign_name || null,
      score: form.score === "auto" ? "warm" : form.score,
      price: form.price ? Number(form.price) : (pt?.default_lead_price ?? 99),
      sale_available: form.sale_available,
      status: form.sale_available ? "available" : "archived",
      follow_up_date: form.follow_up_date ? new Date(form.follow_up_date).toISOString() : null,
      next_call_date: form.next_call_date ? new Date(form.next_call_date).toISOString() : null,
      remarks: form.remarks || null,
      internal_notes: form.internal_notes || null,
    } as const;

    const { error } = await supabase.from("leads").insert([insertRow]);
    setSaving(false);

    if (error) {
      if (error.message.includes("DUPLICATE_LEAD")) {
        toast.error("Duplicate lead", { description: "This phone number was added in the last 30 days." });
      } else {
        toast.error(error.message);
      }
      return;
    }
    toast.success("Lead created", { description: "Auto-scored and follow-up scheduled." });
    onCreated();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm grid place-items-end sm:place-items-center p-0 sm:p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-card border border-border rounded-t-2xl sm:rounded-2xl w-full max-w-3xl max-h-[92vh] overflow-hidden flex flex-col shadow-2xl"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div>
            <h2 className="font-display text-lg font-bold">New lead</h2>
            <p className="text-xs text-muted-foreground">Step {step} of 4</p>
          </div>
          <button onClick={onClose} className="size-8 rounded-lg hover:bg-secondary grid place-items-center"><X className="size-4" /></button>
        </div>

        <div className="flex gap-1 px-6 py-3 border-b border-border bg-secondary/30">
          {["Basic", "Product", "Details", "Tracking"].map((label, i) => (
            <button
              key={label}
              onClick={() => setStep(i + 1)}
              className={`flex-1 text-[11px] font-bold uppercase tracking-wide py-1.5 rounded-md transition ${
                step === i + 1 ? "bg-accent text-accent-foreground" : step > i + 1 ? "text-emerald-600" : "text-muted-foreground"
              }`}
            >
              {i + 1}. {label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {step === 1 && (
            <div className="grid sm:grid-cols-2 gap-3">
              <Field icon={User} label="Customer name" required>
                <input className="input-base w-full" value={form.applicant_name} onChange={(e) => set("applicant_name", e.target.value)} placeholder="Rahul Sharma" />
              </Field>
              <Field icon={Phone} label="Phone number" required>
                <input className="input-base w-full" value={form.full_phone} onChange={(e) => set("full_phone", e.target.value)} onBlur={checkDuplicate} placeholder="+919876543210" />
                {dupWarn && <p className="text-[11px] text-red-600 mt-1 inline-flex items-center gap-1"><AlertTriangle className="size-3" />{dupWarn}</p>}
              </Field>
              <Field icon={Phone} label="Alternate phone">
                <input className="input-base w-full" value={form.alternate_phone} onChange={(e) => set("alternate_phone", e.target.value)} />
              </Field>
              <Field icon={Mail} label="Email">
                <input className="input-base w-full" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
              </Field>
              <Field icon={MapPin} label="City" required>
                <input className="input-base w-full" value={form.city} onChange={(e) => set("city", e.target.value)} placeholder="Mumbai" />
              </Field>
              <Field icon={MapPin} label="State" required>
                <input className="input-base w-full" value={form.state} onChange={(e) => set("state", e.target.value)} placeholder="Maharashtra" />
              </Field>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2 block">Product category *</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {CATEGORIES.map((c) => {
                    const active = form.product_category === c.key;
                    return (
                      <button
                        key={c.key}
                        onClick={() => set("product_category", c.key)}
                        className={`p-3 rounded-xl border text-left transition ${active ? "border-accent bg-accent/10" : "border-border hover:border-accent/50"}`}
                      >
                        <div className="text-xs font-bold">{c.label}</div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">{c.tagline}</div>
                      </button>
                    );
                  })}
                </div>
              </div>
              <Field icon={Tag} label="Product type" required>
                <select className="input-base w-full" value={form.product_type_id} onChange={(e) => set("product_type_id", e.target.value)}>
                  <option value="">Select product type…</option>
                  {filteredTypes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </Field>
              {form.product_category === "loan" && (
                <div className="grid sm:grid-cols-2 gap-3">
                  <Field icon={Banknote} label="Loan amount (₹)" required>
                    <input className="input-base w-full" type="number" value={form.loan_amount} onChange={(e) => set("loan_amount", e.target.value)} placeholder="500000" />
                  </Field>
                </div>
              )}
              {form.product_category === "insurance" && (
                <div className="grid sm:grid-cols-2 gap-3">
                  <Field icon={Banknote} label="Sum insured (₹)" required>
                    <input className="input-base w-full" type="number" value={form.sum_insured} onChange={(e) => set("sum_insured", e.target.value)} placeholder="500000" />
                  </Field>
                </div>
              )}
              {form.product_category === "credit_card" && (
                <Field icon={Tag} label="Card type" required>
                  <select className="input-base w-full" value={form.card_type} onChange={(e) => set("card_type", e.target.value)}>
                    <option value="">Select…</option>
                    <option>Travel</option><option>Cashback</option><option>Fuel</option>
                    <option>Premium</option><option>Business</option>
                  </select>
                </Field>
              )}
              {form.product_category === "investment" && (
                <Field icon={Banknote} label="Investment amount (₹)" required>
                  <input className="input-base w-full" type="number" value={form.loan_amount} onChange={(e) => set("loan_amount", e.target.value)} placeholder="100000" />
                </Field>
              )}
            </div>
          )}

          {step === 3 && (
            <div className="grid sm:grid-cols-2 gap-3">
              {(form.product_category === "loan" || form.product_category === "credit_card") && (
                <>
                  <Field icon={IndianRupee} label="Monthly income (₹)">
                    <input className="input-base w-full" type="number" value={form.monthly_income} onChange={(e) => set("monthly_income", e.target.value)} placeholder="50000" />
                  </Field>
                  <Field icon={Briefcase} label="Employment type">
                    <select className="input-base w-full" value={form.employment_type} onChange={(e) => set("employment_type", e.target.value)}>
                      <option value="">Select…</option>
                      <option>Salaried</option><option>Self-employed</option><option>Business owner</option><option>Freelancer</option>
                    </select>
                  </Field>
                  <Field icon={Briefcase} label="Company / Business name">
                    <input className="input-base w-full" value={form.company_name} onChange={(e) => set("company_name", e.target.value)} />
                  </Field>
                  <Field icon={Sparkles} label="CIBIL score (optional)">
                    <input className="input-base w-full" type="number" min={300} max={900} value={form.cibil_score} onChange={(e) => set("cibil_score", e.target.value)} placeholder="750" />
                  </Field>
                </>
              )}
              {form.product_category === "insurance" && (
                <>
                  <Field icon={User} label="Age">
                    <input className="input-base w-full" type="number" value={form.age} onChange={(e) => set("age", e.target.value)} placeholder="32" />
                  </Field>
                  <Field icon={User} label="Gender">
                    <select className="input-base w-full" value={form.gender} onChange={(e) => set("gender", e.target.value)}>
                      <option value="">Select…</option><option>Male</option><option>Female</option><option>Other</option>
                    </select>
                  </Field>
                  <Field icon={User} label="Family members covered">
                    <input className="input-base w-full" type="number" value={form.family_members} onChange={(e) => set("family_members", e.target.value)} placeholder="4" />
                  </Field>
                </>
              )}
              <div className="sm:col-span-2 rounded-xl bg-accent/10 border border-accent/30 p-3 text-xs text-foreground/80 flex gap-2">
                <Sparkles className="size-4 text-accent shrink-0 mt-0.5" />
                <div>
                  <strong>Auto-score:</strong> Based on your inputs, we'll mark this lead Hot/Warm/Cold automatically.
                  Income ≥₹1L = Hot, ₹50k–₹1L = Warm, &lt;₹50k = Cold (loans/cards). Sum insured ≥₹10L = Hot (insurance).
                </div>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-3">
              <div className="grid sm:grid-cols-2 gap-3">
                <Field icon={Megaphone} label="Lead source">
                  <select className="input-base w-full" value={form.source} onChange={(e) => set("source", e.target.value)}>
                    <option>Manual</option><option>Facebook Ads</option><option>Google Ads</option>
                    <option>Affiliate</option><option>Organic</option><option>Referral</option>
                  </select>
                </Field>
                <Field icon={Megaphone} label="Campaign name">
                  <input className="input-base w-full" value={form.campaign_name} onChange={(e) => set("campaign_name", e.target.value)} placeholder="Summer-PL-2025" />
                </Field>
                <Field icon={CalendarClock} label="Follow-up date (optional)">
                  <input className="input-base w-full" type="datetime-local" value={form.follow_up_date} onChange={(e) => set("follow_up_date", e.target.value)} />
                  <p className="text-[10px] text-muted-foreground mt-1">If blank: Hot=+1d · Warm=+3d · Cold=+7d</p>
                </Field>
                <Field icon={CalendarClock} label="Next call date (optional)">
                  <input className="input-base w-full" type="datetime-local" value={form.next_call_date} onChange={(e) => set("next_call_date", e.target.value)} />
                </Field>
                <Field icon={Sparkles} label="Lead score">
                  <select className="input-base w-full" value={form.score} onChange={(e) => set("score", e.target.value as FormState["score"])}>
                    <option value="auto">Auto (recommended)</option>
                    <option value="hot">Hot 🔥</option><option value="warm">Warm</option><option value="cold">Cold</option>
                  </select>
                </Field>
                <Field icon={IndianRupee} label="Lead price (₹)">
                  <input className="input-base w-full" type="number" value={form.price} onChange={(e) => set("price", e.target.value)} placeholder="99" />
                </Field>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.sale_available} onChange={(e) => set("sale_available", e.target.checked)} className="size-4" />
                <span>Make available for sale on Leadboard</span>
              </label>
              <Field icon={FileText} label="Remarks (visible to buyer)">
                <textarea className="input-base w-full min-h-[60px]" value={form.remarks} onChange={(e) => set("remarks", e.target.value)} />
              </Field>
              <Field icon={FileText} label="Internal notes (admin only)">
                <textarea className="input-base w-full min-h-[60px]" value={form.internal_notes} onChange={(e) => set("internal_notes", e.target.value)} />
              </Field>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-border flex items-center justify-between gap-3">
          <button
            onClick={() => step > 1 ? setStep(step - 1) : onClose()}
            className="text-sm font-semibold px-4 py-2 rounded-lg hover:bg-secondary transition"
          >
            {step > 1 ? "← Back" : "Cancel"}
          </button>
          {step < 4 ? (
            <button onClick={next} className="inline-flex items-center gap-2 bg-accent text-accent-foreground rounded-lg px-5 py-2 font-semibold hover:opacity-90">
              Next <ChevronRight className="size-4" />
            </button>
          ) : (
            <button
              onClick={submit}
              disabled={saving}
              className="inline-flex items-center gap-2 bg-accent text-accent-foreground rounded-lg px-5 py-2 font-semibold hover:opacity-90 disabled:opacity-50"
            >
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
              Create lead
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({
  icon: Icon, label, required, children,
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

void useNavigate;
