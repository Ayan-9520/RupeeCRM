import { createFileRoute, Link, useSearch, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Loader2, ShieldCheck, ArrowRight, CheckCircle2, Banknote,
  User, Phone, MapPin, Mail, Briefcase, IndianRupee, Sparkles, UserPlus,
} from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type LoanType = Database["public"]["Enums"]["loan_type"];
type ProductCategory = Database["public"]["Enums"]["product_category"];

type ProductMeta = {
  slug: string;
  loan_type: LoanType;
  product_category: ProductCategory;
  product_subtype?: string;
  title: string;
  tagline: string;
  amountLabel: string;
  amountMin: number;
  amountMax: number;
  showIncome: boolean;
  accent: string;
};

const PRODUCTS: Record<string, ProductMeta> = {
  "personal-loan": {
    slug: "personal-loan", loan_type: "personal", product_category: "loan",
    title: "Personal Loan", tagline: "Up to ₹50 lakh • Disbursal in 24 hours",
    amountLabel: "Loan amount needed", amountMin: 50000, amountMax: 5000000, showIncome: true,
    accent: "from-blue-500/20 to-indigo-500/10",
  },
  "home-loan": {
    slug: "home-loan", loan_type: "home", product_category: "loan",
    title: "Home Loan", tagline: "Lowest rates from top banks • Up to ₹5 Cr",
    amountLabel: "Property loan amount", amountMin: 500000, amountMax: 50000000, showIncome: true,
    accent: "from-emerald-500/20 to-teal-500/10",
  },
  "business-loan": {
    slug: "business-loan", loan_type: "business", product_category: "loan",
    title: "Business Loan", tagline: "Collateral-free • Up to ₹2 Cr",
    amountLabel: "Business loan amount", amountMin: 100000, amountMax: 20000000, showIncome: true,
    accent: "from-orange-500/20 to-amber-500/10",
  },
  "credit-card": {
    slug: "credit-card", loan_type: "credit_card", product_category: "credit_card",
    title: "Credit Card", tagline: "Premium cards from leading banks • Lifetime free options",
    amountLabel: "Desired credit limit", amountMin: 25000, amountMax: 2000000, showIncome: true,
    accent: "from-rose-500/20 to-pink-500/10",
  },
  "insurance": {
    slug: "insurance", loan_type: "insurance", product_category: "insurance",
    title: "Insurance", tagline: "Health, life & general — best premiums",
    amountLabel: "Sum insured", amountMin: 100000, amountMax: 10000000, showIncome: false,
    accent: "from-cyan-500/20 to-sky-500/10",
  },
  "mutual-fund": {
    slug: "mutual-fund", loan_type: "mutual_fund", product_category: "investment",
    title: "Mutual Funds & Investments", tagline: "SIP, Lumpsum & wealth planning",
    amountLabel: "Investment amount", amountMin: 5000, amountMax: 10000000, showIncome: false,
    accent: "from-violet-500/20 to-fuchsia-500/10",
  },
};

const formSchema = z.object({
  applicant_name: z.string().trim().min(2, "Enter your full name").max(80),
  phone: z.string().trim().regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit Indian mobile"),
  email: z.string().trim().email().max(120).optional().or(z.literal("")),
  city: z.string().trim().min(2, "City is required").max(60),
  loan_amount: z.coerce.number().positive("Amount must be greater than 0"),
  monthly_income: z.coerce.number().nonnegative().optional(),
  employment_type: z.string().optional(),
});

type SearchParams = {
  ref?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
};

export const Route = createFileRoute("/apply/$slug")({
  validateSearch: (s: Record<string, unknown>): SearchParams => ({
    ref: typeof s.ref === "string" ? s.ref : undefined,
    utm_source: typeof s.utm_source === "string" ? s.utm_source : undefined,
    utm_medium: typeof s.utm_medium === "string" ? s.utm_medium : undefined,
    utm_campaign: typeof s.utm_campaign === "string" ? s.utm_campaign : undefined,
  }),
  head: ({ params }) => {
    const p = PRODUCTS[params.slug];
    return {
      meta: [
        { title: `Apply for ${p?.title ?? "Loan"} — RupeeDial` },
        { name: "description", content: p?.tagline ?? "Apply online in 2 minutes." },
      ],
    };
  },
  component: ApplyPage,
});

function ApplyPage() {
  const { slug } = Route.useParams();
  const search = useSearch({ from: "/apply/$slug" });
  const navigate = useNavigate();
  const product = PRODUCTS[slug];
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState<{ leadId: string; masked: string; exclusive: boolean } | null>(null);
  const [refMeta, setRefMeta] = useState<{ name: string | null; company: string | null } | null>(null);
  const [form, setForm] = useState({
    applicant_name: "", phone: "", email: "", city: "",
    loan_amount: "", monthly_income: "", employment_type: "Salaried",
  });

  // Fetch referrer profile (display only)
  useEffect(() => {
    if (!search.ref) return;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("full_name,company_name")
        .eq("dsa_id", search.ref!.toUpperCase())
        .maybeSingle();
      if (data) setRefMeta({ name: data.full_name, company: data.company_name });
    })();
  }, [search.ref]);

  if (!product) {
    return (
      <div className="min-h-screen grid place-items-center bg-background">
        <div className="rounded-2xl bg-card border border-border p-8 text-center max-w-md">
          <h1 className="font-display text-xl font-bold">Product not found</h1>
          <p className="text-muted-foreground mt-2 text-sm">We don't have an application form for "{slug}".</p>
          <Link to="/" className="inline-block mt-4 text-accent font-semibold">← Back to home</Link>
        </div>
      </div>
    );
  }

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = formSchema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setSubmitting(true);
    const { data, error } = await supabase.rpc("submit_public_lead", {
      _applicant_name: parsed.data.applicant_name,
      _phone: parsed.data.phone,
      _city: parsed.data.city,
      _loan_type: product.loan_type,
      _loan_amount: parsed.data.loan_amount,
      _email: parsed.data.email || undefined,
      _monthly_income: parsed.data.monthly_income || undefined,
      _employment_type: parsed.data.employment_type || undefined,
      _product_category: product.product_category,
      _product_subtype: product.product_subtype,
      _ref_code: search.ref,
      _utm_source: search.utm_source,
      _utm_medium: search.utm_medium,
      _utm_campaign: search.utm_campaign,
    });
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    const result = data as { lead_id: string; masked_phone: string; exclusive: boolean };
    setSubmitted({ leadId: result.lead_id, masked: result.masked_phone, exclusive: result.exclusive });
    toast.success("Application received! Our team will call you shortly.");
  };

  if (submitted) {
    return (
      <div className="min-h-screen grid place-items-center bg-background px-4 py-12">
        <div className="max-w-lg w-full rounded-3xl bg-card border border-border p-8 shadow-card text-center">
          <div className="size-16 rounded-2xl bg-emerald-500/15 grid place-items-center mx-auto mb-4">
            <CheckCircle2 className="size-9 text-emerald-600" />
          </div>
          <h1 className="font-display text-2xl font-bold">Application received! 🎉</h1>
          <p className="text-muted-foreground mt-2">
            We'll call <strong>{submitted.masked}</strong> within the next few minutes.
            {submitted.exclusive && refMeta && (
              <> Your application has been routed directly to <strong>{refMeta.company || refMeta.name}</strong>.</>
            )}
          </p>

          <div className="mt-6 rounded-2xl border border-accent/30 bg-accent/5 p-5 text-left">
            <div className="flex items-center gap-2 font-semibold">
              <UserPlus className="size-4 text-accent" /> Track your application
            </div>
            <p className="text-sm text-muted-foreground mt-1.5">
              Create a free account to track status, upload documents, and chat with the team.
            </p>
            <div className="flex gap-2 mt-4">
              <Link
                to="/auth"
                search={{ next: "/dashboard" }}
                className="inline-flex items-center gap-1.5 bg-foreground text-background rounded-xl px-4 py-2 font-semibold text-sm hover:opacity-90"
              >
                Create account <ArrowRight className="size-4" />
              </Link>
              <Link to="/" className="inline-flex items-center px-4 py-2 rounded-xl border border-border font-semibold text-sm">
                Maybe later
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/60 backdrop-blur sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="size-8 rounded-lg bg-mint-gradient grid place-items-center">
              <Sparkles className="size-4 text-primary" strokeWidth={2.5} />
            </div>
            <span className="font-display font-bold">RupeeDial</span>
          </Link>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <ShieldCheck className="size-3.5 text-emerald-500" /> 100% secure & encrypted
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-8 lg:py-12 grid lg:grid-cols-2 gap-8">
        {/* LEFT: hero + referrer card */}
        <div className="space-y-6">
          <div className={`rounded-3xl bg-gradient-to-br ${product.accent} border border-border p-6 lg:p-8`}>
            <div className="text-xs font-bold uppercase tracking-widest text-foreground/60">Apply for</div>
            <h1 className="font-display text-3xl lg:text-4xl font-bold mt-1">{product.title}</h1>
            <p className="text-muted-foreground mt-2">{product.tagline}</p>
            <div className="grid grid-cols-3 gap-3 mt-6">
              {[
                ["2 min", "Form fill"],
                ["24 hrs", "Disbursal"],
                ["50+", "Lender partners"],
              ].map(([n, l]) => (
                <div key={l} className="rounded-xl bg-card/70 border border-border p-3 text-center">
                  <div className="font-display text-lg font-bold">{n}</div>
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{l}</div>
                </div>
              ))}
            </div>
          </div>

          {refMeta && (
            <div className="rounded-2xl border border-accent/30 bg-accent/5 p-4 flex items-start gap-3">
              <div className="size-10 rounded-xl bg-accent/15 grid place-items-center text-accent shrink-0">
                <User className="size-5" />
              </div>
              <div className="text-sm">
                <div className="font-semibold">Referred by {refMeta.company || refMeta.name}</div>
                <div className="text-muted-foreground text-xs mt-0.5">
                  Your application will be handled personally by your referring partner.
                </div>
              </div>
            </div>
          )}

          <ul className="space-y-2.5 text-sm text-muted-foreground">
            {[
              "No paperwork to start — just basic details",
              "Compare offers from 50+ lenders in seconds",
              "Zero processing fee on most products",
              "Dedicated relationship manager",
            ].map((t) => (
              <li key={t} className="flex items-start gap-2">
                <CheckCircle2 className="size-4 text-emerald-500 shrink-0 mt-0.5" /> {t}
              </li>
            ))}
          </ul>
        </div>

        {/* RIGHT: form */}
        <form onSubmit={submit} className="rounded-3xl bg-card border border-border p-6 lg:p-8 shadow-card space-y-4 h-fit">
          <h2 className="font-display text-xl font-bold">Get started in 60 seconds</h2>
          <p className="text-xs text-muted-foreground -mt-3">No credit score impact. Free consultation.</p>

          <Field icon={User} label="Full name *">
            <input className="input-base w-full" maxLength={80} required value={form.applicant_name} onChange={(e) => set("applicant_name", e.target.value)} placeholder="Rohan Kumar" />
          </Field>
          <div className="grid sm:grid-cols-2 gap-3">
            <Field icon={Phone} label="Mobile number *">
              <input className="input-base w-full" type="tel" maxLength={10} required value={form.phone} onChange={(e) => set("phone", e.target.value.replace(/[^0-9]/g, ""))} placeholder="9876543210" />
            </Field>
            <Field icon={MapPin} label="City *">
              <input className="input-base w-full" required maxLength={60} value={form.city} onChange={(e) => set("city", e.target.value)} placeholder="Delhi" />
            </Field>
          </div>
          <Field icon={Mail} label="Email (optional)">
            <input className="input-base w-full" type="email" maxLength={120} value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="you@example.com" />
          </Field>
          <Field icon={IndianRupee} label={`${product.amountLabel} *`}>
            <input className="input-base w-full" type="number" required min={product.amountMin} max={product.amountMax} value={form.loan_amount} onChange={(e) => set("loan_amount", e.target.value)} placeholder={`₹ ${product.amountMin.toLocaleString("en-IN")} – ${product.amountMax.toLocaleString("en-IN")}`} />
          </Field>
          {product.showIncome && (
            <div className="grid sm:grid-cols-2 gap-3">
              <Field icon={Banknote} label="Monthly income">
                <input className="input-base w-full" type="number" min={0} value={form.monthly_income} onChange={(e) => set("monthly_income", e.target.value)} placeholder="₹ 50,000" />
              </Field>
              <Field icon={Briefcase} label="Employment">
                <select className="input-base w-full" value={form.employment_type} onChange={(e) => set("employment_type", e.target.value)}>
                  <option>Salaried</option>
                  <option>Self-employed</option>
                  <option>Business owner</option>
                  <option>Other</option>
                </select>
              </Field>
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-accent text-accent-foreground rounded-xl py-3 font-bold shadow-mint hover:opacity-90 transition disabled:opacity-50 inline-flex items-center justify-center gap-2"
          >
            {submitting ? <><Loader2 className="size-4 animate-spin" /> Submitting…</> : <>Get my offers <ArrowRight className="size-4" /></>}
          </button>

          <p className="text-[11px] text-muted-foreground text-center">
            By submitting, you agree to be contacted by RupeeDial about your application.
          </p>
        </form>
      </div>
    </div>
  );
}

function Field({ icon: Icon, label, children }: { icon: React.ComponentType<{ className?: string }>; label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-foreground/70 inline-flex items-center gap-1.5 mb-1.5">
        <Icon className="size-3.5 text-muted-foreground" /> {label}
      </span>
      {children}
    </label>
  );
}
