import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft, Loader2, Save, Send, Sparkles, CheckCircle2, AlertCircle, User, Briefcase, Banknote, FileText,
} from "lucide-react";
import { listMyLeads, patchMyLead, type CrmPurchase } from "@/lib/python-api";

export const Route = createFileRoute("/dashboard/my-leads/$id/apply")({
  head: () => ({ meta: [{ title: "Apply — RupeeDial One" }] }),
  component: ApplyPage,
  errorComponent: ({ error }) => (
    <div className="max-w-2xl mx-auto p-8 rounded-2xl border border-destructive/40 bg-destructive/5">
      <div className="flex items-center gap-2 text-destructive font-semibold mb-2">
        <AlertCircle className="size-5" /> Could not load application
      </div>
      <p className="text-sm text-muted-foreground">{error.message}</p>
      <Link to="/dashboard/my-leads" className="mt-4 inline-flex items-center gap-1 text-accent text-sm font-semibold">
        <ArrowLeft className="size-4" /> Back to My Leads
      </Link>
    </div>
  ),
  notFoundComponent: () => (
    <div className="max-w-2xl mx-auto p-8 rounded-2xl border border-border bg-card text-center">
      <div className="font-display text-xl font-bold mb-1">Lead not found</div>
      <p className="text-sm text-muted-foreground mb-4">This lead may have been removed or you don&apos;t have access.</p>
      <Link to="/dashboard/my-leads" className="inline-flex items-center gap-1 text-accent text-sm font-semibold">
        <ArrowLeft className="size-4" /> Back to My Leads
      </Link>
    </div>
  ),
});

type FormState = {
  full_name: string;
  mobile: string;
  email: string;
  city: string;
  age: string;
  gender: string;
  loan_amount: string;
  monthly_income: string;
  employment_type: string;
  cibil_score: string;
  company_name: string;
  existing_emi: string;
  pan: string;
  purpose: string;
};

const EMPTY: FormState = {
  full_name: "", mobile: "", email: "", city: "", age: "", gender: "",
  loan_amount: "", monthly_income: "", employment_type: "", cibil_score: "",
  company_name: "", existing_emi: "", pan: "", purpose: "",
};

function formFromPurchase(p: CrmPurchase): FormState {
  const lead = p.lead;
  const pd = (lead?.product_details ?? {}) as Record<string, unknown>;
  const draft = (pd.application as FormState | undefined) ?? null;
  const seed: FormState = {
    full_name: lead?.applicant_name ?? "",
    mobile: lead?.full_phone ?? "",
    email: lead?.email ?? "",
    city: lead?.city ?? "",
    age: pd.age != null ? String(pd.age) : "",
    gender: typeof pd.gender === "string" ? pd.gender : "",
    loan_amount: lead?.loan_amount ? String(lead.loan_amount) : "",
    monthly_income: lead?.monthly_income != null ? String(lead.monthly_income) : "",
    employment_type: lead?.employment_type ?? "",
    cibil_score: pd.cibil_score != null ? String(pd.cibil_score) : "",
    company_name: lead?.company_name ?? "",
    existing_emi: pd.existing_emi != null ? String(pd.existing_emi) : "",
    pan: typeof pd.pan === "string" ? pd.pan : "",
    purpose: typeof pd.purpose === "string" ? pd.purpose : "",
  };
  return draft ? { ...seed, ...draft } : seed;
}

function ApplyPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [purchase, setPurchase] = useState<CrmPurchase | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [prefilledKeys, setPrefilledKeys] = useState<Set<keyof FormState>>(new Set());
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const data = await listMyLeads();
        const found = (data.items ?? []).find((p) => p.id === id) ?? null;
        if (!found) {
          setPurchase(null);
          setLoading(false);
          return;
        }
        const seed = formFromPurchase(found);
        const filled = new Set<keyof FormState>();
        (Object.keys(seed) as (keyof FormState)[]).forEach((k) => {
          if (seed[k]) filled.add(k);
        });
        setPrefilledKeys(filled);
        setPurchase(found);
        setForm(seed);
        const pd = (found.lead?.product_details ?? {}) as Record<string, unknown>;
        if (typeof pd.application_saved_at === "string") setLastSavedAt(pd.application_saved_at);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to load lead");
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const set = <K extends keyof FormState>(k: K, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const requiredOk = useMemo(() => {
    return ["full_name", "mobile", "city", "loan_amount", "monthly_income", "employment_type"].every(
      (k) => !!form[k as keyof FormState].trim(),
    );
  }, [form]);

  const persist = async (opts?: { submit?: boolean }) => {
    if (!purchase) return;
    const now = new Date().toISOString();
    const product_details: Record<string, unknown> = {
      ...(purchase.lead?.product_details ?? {}),
      application: form,
      application_saved_at: now,
      age: form.age ? Number(form.age) : undefined,
      gender: form.gender || undefined,
      cibil_score: form.cibil_score ? Number(form.cibil_score) : undefined,
      existing_emi: form.existing_emi ? Number(form.existing_emi) : undefined,
      pan: form.pan || undefined,
      purpose: form.purpose || undefined,
    };
    const body: Parameters<typeof patchMyLead>[1] = {
      lead: {
        product_details,
        applicant_name: form.full_name,
        email: form.email || null,
        city: form.city,
        loan_amount: Number(form.loan_amount || 0),
        monthly_income: form.monthly_income ? Number(form.monthly_income) : null,
        employment_type: form.employment_type || null,
        company_name: form.company_name || null,
      },
    };
    if (opts?.submit) {
      body.pipeline_stage = "bank_submitted";
      body.notes_text = `Application submitted. Loan ₹${form.loan_amount}, income ₹${form.monthly_income}, employment: ${form.employment_type}.`;
    }
    const updated = await patchMyLead(purchase.id, body);
    setPurchase(updated);
    setLastSavedAt(now);
  };

  const saveDraft = async () => {
    if (!purchase) return;
    setSaving(true);
    try {
      await persist();
      toast.success("Draft saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save draft");
    } finally {
      setSaving(false);
    }
  };

  const submit = async () => {
    if (!purchase) return;
    if (!requiredOk) {
      toast.error("Fill all required fields first");
      return;
    }
    setSubmitting(true);
    try {
      await persist({ submit: true });
      toast.success("Application submitted");
      router.invalidate();
      navigate({ to: "/dashboard/my-leads" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Submit failed");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="grid place-items-center py-20">
        <Loader2 className="size-6 animate-spin text-accent" />
      </div>
    );
  }

  if (!purchase || !purchase.lead) {
    return (
      <div className="max-w-2xl mx-auto p-8 rounded-2xl border border-border bg-card text-center">
        <div className="font-display text-xl font-bold mb-1">Lead not found</div>
        <p className="text-sm text-muted-foreground mb-4">You may not own this lead.</p>
        <Link to="/dashboard/my-leads" className="inline-flex items-center gap-1 text-accent text-sm font-semibold">
          <ArrowLeft className="size-4" /> Back to My Leads
        </Link>
      </div>
    );
  }

  const isSubmitted = ["bank_submitted", "submitted", "sanctioned", "approved", "disbursed"].includes(
    purchase.pipeline_stage,
  );

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <Link to="/dashboard/my-leads" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-accent mb-2">
            <ArrowLeft className="size-3.5" /> Back to My Leads
          </Link>
          <h1 className="font-display text-2xl lg:text-3xl font-bold">Application form</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            For <span className="font-semibold text-foreground">{purchase.lead.applicant_name}</span>
            {" · "}
            <span className="capitalize">{purchase.lead.product_category.replace("_", " ")}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          {lastSavedAt && (
            <span className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
              <CheckCircle2 className="size-3 text-emerald-500" /> Saved{" "}
              {new Date(lastSavedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
          {isSubmitted && (
            <span className="text-[10px] uppercase font-bold tracking-wide px-2 py-1 rounded-full bg-emerald-500/15 text-emerald-700">
              Submitted
            </span>
          )}
        </div>
      </div>

      {prefilledKeys.size > 0 && (
        <div className="rounded-2xl border border-accent/30 bg-accent/5 p-4 flex items-start gap-3">
          <Sparkles className="size-5 text-accent shrink-0 mt-0.5" />
          <div className="text-sm">
            <div className="font-semibold">{prefilledKeys.size} fields pre-filled from lead data</div>
            <div className="text-muted-foreground text-xs mt-0.5">
              Highlighted fields were copied from the lead. Edit anything before submitting.
            </div>
          </div>
        </div>
      )}

      <div className="rounded-2xl bg-card border border-border shadow-card divide-y divide-border">
        <FormSection icon={User} title="Personal details">
          <Input label="Full name" required prefilled={prefilledKeys.has("full_name")} value={form.full_name} onChange={(v) => set("full_name", v)} />
          <Input label="Mobile number" required prefilled={prefilledKeys.has("mobile")} value={form.mobile} onChange={(v) => set("mobile", v)} />
          <Input label="Email" type="email" prefilled={prefilledKeys.has("email")} value={form.email} onChange={(v) => set("email", v)} />
          <Input label="City" required prefilled={prefilledKeys.has("city")} value={form.city} onChange={(v) => set("city", v)} />
          <Input label="Age" type="number" prefilled={prefilledKeys.has("age")} value={form.age} onChange={(v) => set("age", v)} />
          <Select label="Gender" prefilled={prefilledKeys.has("gender")} value={form.gender} onChange={(v) => set("gender", v)} options={["", "male", "female", "other"]} />
        </FormSection>

        <FormSection icon={Briefcase} title="Employment">
          <Select
            label="Employment type"
            required
            prefilled={prefilledKeys.has("employment_type")}
            value={form.employment_type}
            onChange={(v) => set("employment_type", v)}
            options={["", "salaried", "self_employed", "business", "freelance", "retired"]}
          />
          <Input label="Company / Business name" prefilled={prefilledKeys.has("company_name")} value={form.company_name} onChange={(v) => set("company_name", v)} />
          <Input label="Net monthly income (₹)" type="number" required prefilled={prefilledKeys.has("monthly_income")} value={form.monthly_income} onChange={(v) => set("monthly_income", v)} />
          <Input label="Existing EMI (₹)" type="number" value={form.existing_emi} onChange={(v) => set("existing_emi", v)} />
        </FormSection>

        <FormSection icon={Banknote} title="Loan requirement">
          <Input label="Loan amount (₹)" type="number" required prefilled={prefilledKeys.has("loan_amount")} value={form.loan_amount} onChange={(v) => set("loan_amount", v)} />
          <Input label="CIBIL score" type="number" prefilled={prefilledKeys.has("cibil_score")} value={form.cibil_score} onChange={(v) => set("cibil_score", v)} />
          <Input label="PAN" value={form.pan} onChange={(v) => set("pan", v.toUpperCase())} />
          <Input label="Purpose" value={form.purpose} onChange={(v) => set("purpose", v)} />
        </FormSection>

        <FormSection icon={FileText} title="Additional notes">
          <div className="sm:col-span-2">
            <label className="text-xs text-muted-foreground">Anything the lender should know</label>
            <textarea
              rows={3}
              value={form.purpose}
              onChange={(e) => set("purpose", e.target.value)}
              className="input-base mt-1 w-full !h-auto py-2"
              placeholder="e.g., Customer needs disbursal in 7 days"
            />
          </div>
        </FormSection>
      </div>

      <div className="sticky bottom-4 z-20 rounded-2xl bg-card border border-border shadow-elevated p-4 flex flex-wrap items-center gap-3">
        <div className="text-xs text-muted-foreground flex-1 min-w-0">
          {requiredOk ? (
            <span className="inline-flex items-center gap-1 text-emerald-600 font-semibold">
              <CheckCircle2 className="size-3.5" /> Ready to submit
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-amber-600 font-semibold">
              <AlertCircle className="size-3.5" /> Fill all required fields to submit
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={saveDraft}
          disabled={saving || submitting}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-border font-semibold text-sm hover:bg-secondary disabled:opacity-60"
        >
          {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          Save draft
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={submitting || saving || !requiredOk}
          className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-accent text-accent-foreground font-semibold text-sm hover:opacity-90 disabled:opacity-50"
        >
          {submitting ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          Submit application
        </button>
      </div>
    </div>
  );
}

function FormSection({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="p-5">
      <h3 className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground mb-3 inline-flex items-center gap-1.5">
        <Icon className="size-3.5" /> {title}
      </h3>
      <div className="grid sm:grid-cols-2 gap-3">{children}</div>
    </div>
  );
}

function Input({
  label,
  value,
  onChange,
  type = "text",
  required,
  prefilled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  prefilled?: boolean;
}) {
  return (
    <label className="text-xs">
      <span className="text-muted-foreground inline-flex items-center gap-1">
        {label}
        {required && <span className="text-destructive">*</span>}
        {prefilled && <Sparkles className="size-3 text-accent" />}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        className={`input-base mt-1 w-full ${prefilled && value ? "border-accent/40 bg-accent/[0.03]" : ""}`}
      />
    </label>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
  required,
  prefilled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  required?: boolean;
  prefilled?: boolean;
}) {
  return (
    <label className="text-xs">
      <span className="text-muted-foreground inline-flex items-center gap-1">
        {label}
        {required && <span className="text-destructive">*</span>}
        {prefilled && <Sparkles className="size-3 text-accent" />}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        className={`input-base mt-1 w-full ${prefilled && value ? "border-accent/40 bg-accent/[0.03]" : ""}`}
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o ? o.replace(/_/g, " ") : "Select…"}
          </option>
        ))}
      </select>
    </label>
  );
}
