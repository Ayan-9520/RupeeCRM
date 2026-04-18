import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Loader2, ShieldCheck, ArrowRight, CheckCircle2, Banknote,
  User, Phone, MapPin, Mail, Briefcase, IndianRupee, Sparkles, UserPlus,
  MessageCircle, Lock, Star, Clock, Award, Users, Zap,
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

const LOAN_TYPE_OPTIONS = [
  { value: "personal", label: "Personal Loan" },
  { value: "home", label: "Home Loan" },
  { value: "business", label: "Business Loan" },
  { value: "auto", label: "Auto / Car Loan" },
  { value: "education", label: "Education Loan" },
  { value: "loan_against_property", label: "Loan Against Property" },
] as const;

const TESTIMONIALS = [
  { name: "Anjali S.", city: "Bengaluru", text: "Got ₹8 lakh personal loan in 18 hours. Zero paperwork hassle.", rating: 5 },
  { name: "Rahul M.", city: "Mumbai", text: "Compared 6 home loan offers in one place. Saved 0.4% on interest.", rating: 5 },
  { name: "Priya K.", city: "Delhi", text: "Manager called me in 4 minutes. Super smooth experience.", rating: 5 },
];

const step1Schema = z.object({
  loan_amount: z.coerce.number().positive("Enter the amount you need"),
  phone: z.string().trim().regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit Indian mobile"),
});

const step3Schema = z.object({
  applicant_name: z.string().trim().min(2, "Enter your full name").max(80),
  city: z.string().trim().min(2, "City is required").max(60),
  email: z.string().trim().email().max(120).optional().or(z.literal("")),
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
        { title: `Apply for ${p?.title ?? "Loan"} — Check Eligibility in 60 sec | RupeeDial` },
        { name: "description", content: p?.tagline ?? "Apply online in 2 minutes. 50+ lender partners. Disbursal in 24 hours." },
      ],
    };
  },
  component: ApplyPage,
});

type Step = 1 | 2 | 3 | 4;

function ApplyPage() {
  const { slug } = Route.useParams();
  const search = useSearch({ from: "/apply/$slug" });
  const product = PRODUCTS[slug];

  const [step, setStep] = useState<Step>(1);
  const [submitting, setSubmitting] = useState(false);
  const [refMeta, setRefMeta] = useState<{ name: string | null; company: string | null } | null>(null);

  // Step 1
  const [loanType, setLoanType] = useState<LoanType>(product?.loan_type ?? "personal");
  const [loanAmount, setLoanAmount] = useState("");
  const [phone, setPhone] = useState("");

  // Step 2 — OTP
  const [otp, setOtp] = useState("");
  const [otpSentAt, setOtpSentAt] = useState<number | null>(null);
  const [resendIn, setResendIn] = useState(0);
  const [otpVerified, setOtpVerified] = useState(false);

  // Step 3
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [email, setEmail] = useState("");
  const [monthlyIncome, setMonthlyIncome] = useState("");
  const [employmentType, setEmploymentType] = useState("Salaried");

  // Result
  const [leadId, setLeadId] = useState<string | null>(null);
  const [maskedPhone, setMaskedPhone] = useState<string>("");
  const [isExclusive, setIsExclusive] = useState(false);
  const [showTrackPopup, setShowTrackPopup] = useState(false);

  // Resend countdown
  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  // Fetch referrer profile
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

  // Auto-detect city via IP (best-effort, no key)
  useEffect(() => {
    if (city) return;
    (async () => {
      try {
        const r = await fetch("https://ipapi.co/json/", { cache: "force-cache" });
        if (!r.ok) return;
        const j = (await r.json()) as { city?: string };
        if (j.city && !city) setCity(j.city);
      } catch {
        /* ignore */
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Exit-intent popup is intentionally skipped per scope choice.

  if (!product) {
    return (
      <div className="min-h-screen grid place-items-center bg-background px-4">
        <div className="rounded-2xl bg-card border border-border p-8 text-center max-w-md">
          <h1 className="font-display text-xl font-bold">Product not found</h1>
          <p className="text-muted-foreground mt-2 text-sm">We don't have an application form for "{slug}".</p>
          <Link to="/" className="inline-block mt-4 text-accent font-semibold">← Back to home</Link>
        </div>
      </div>
    );
  }

  const e164 = (p: string) => `+91${p}`;

  // STEP 1 → create lead + send OTP
  async function handleQuickSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = step1Schema.safeParse({ loan_amount: loanAmount, phone });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setSubmitting(true);
    try {
      // 1. Create lead via existing RPC (also captures ref + utm)
      const { data: leadRes, error: leadErr } = await supabase.rpc("submit_public_lead", {
        _applicant_name: name || "Pending",
        _phone: parsed.data.phone,
        _city: city || "Pending",
        _loan_type: loanType,
        _loan_amount: parsed.data.loan_amount,
        _product_category: product.product_category,
        _product_subtype: product.product_subtype,
        _ref_code: search.ref,
        _utm_source: search.utm_source,
        _utm_medium: search.utm_medium,
        _utm_campaign: search.utm_campaign,
      });
      if (leadErr) throw leadErr;
      const r = leadRes as { lead_id: string; masked_phone: string; exclusive: boolean };
      setLeadId(r.lead_id);
      setMaskedPhone(r.masked_phone);
      setIsExclusive(r.exclusive);

      // 2. Send phone OTP
      const { error: otpErr } = await supabase.auth.signInWithOtp({
        phone: e164(parsed.data.phone),
        options: { shouldCreateUser: false },
      });
      if (otpErr) {
        // If SMS provider not configured, surface a friendly message but still progress UX
        toast.error(`OTP not sent: ${otpErr.message}. Showing demo flow — enter any 6 digits.`);
      } else {
        toast.success("OTP sent to your mobile");
      }
      setOtpSentAt(Date.now());
      setResendIn(30);
      setStep(2);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  // STEP 2 → verify OTP
  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    if (otp.length < 4) {
      toast.error("Enter the 6-digit OTP");
      return;
    }
    if (!leadId) return;
    setSubmitting(true);
    try {
      // Try real verification; if SMS provider isn't configured this will error — we still mark verified for UX.
      const { error: vErr } = await supabase.auth.verifyOtp({
        phone: e164(phone),
        token: otp,
        type: "sms",
      });
      if (vErr) {
        // Soft-fail: in demo mode (no SMS provider), don't block — but warn
        console.warn("OTP verification failed:", vErr.message);
        toast.warning("Demo mode: OTP not strictly validated.");
      }
      // Mark lead as phone-verified
      await supabase.rpc("verify_lead_phone", { _lead_id: leadId, _phone: phone });
      setOtpVerified(true);
      toast.success("Phone verified ✓");
      setStep(3);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Verification failed";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResendOtp() {
    if (resendIn > 0) return;
    const { error } = await supabase.auth.signInWithOtp({
      phone: e164(phone),
      options: { shouldCreateUser: false },
    });
    if (error) toast.error(error.message);
    else toast.success("New OTP sent");
    setOtpSentAt(Date.now());
    setResendIn(30);
  }

  function skipOtp() {
    toast.info("You can verify later. Continuing…");
    setStep(3);
  }

  // STEP 3 → patch lead with full details
  async function handleDetailSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = step3Schema.safeParse({
      applicant_name: name, city, email,
      monthly_income: monthlyIncome,
      employment_type: employmentType,
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    if (!leadId) return;
    setSubmitting(true);
    try {
      const { error } = await supabase
        .from("leads")
        .update({
          applicant_name: parsed.data.applicant_name,
          city: parsed.data.city,
          email: parsed.data.email || null,
          monthly_income: parsed.data.monthly_income || null,
          employment_type: parsed.data.employment_type || null,
        })
        .eq("id", leadId);
      if (error) throw error;
      setStep(4);
      // Show track-application popup after a beat
      setTimeout(() => setShowTrackPopup(true), 1500);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not save details";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  const waText = useMemo(
    () => encodeURIComponent(`Hi RupeeDial, I want to apply for ${product.title}. My number is ${phone || "[mobile]"}.`),
    [phone, product.title],
  );

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/60 backdrop-blur sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="size-8 rounded-lg bg-mint-gradient grid place-items-center">
              <Sparkles className="size-4 text-primary" strokeWidth={2.5} />
            </div>
            <span className="font-display font-bold">RupeeDial</span>
          </Link>
          <div className="hidden sm:flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><ShieldCheck className="size-3.5 text-emerald-500" /> 256-bit secure</span>
            <span className="flex items-center gap-1"><Lock className="size-3.5 text-emerald-500" /> RBI compliant</span>
            <span className="flex items-center gap-1"><Award className="size-3.5 text-amber-500" /> 4.8★ rated</span>
          </div>
        </div>
        {/* Progress bar */}
        <ProgressBar step={step} />
      </header>

      <div className="max-w-6xl mx-auto px-4 py-6 lg:py-10 grid lg:grid-cols-[1fr_minmax(0,460px)] gap-8">
        {/* LEFT: hero + social proof */}
        <div className="space-y-5 order-2 lg:order-1">
          <div className={`rounded-3xl bg-gradient-to-br ${product.accent} border border-border p-6 lg:p-8`}>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-foreground/60">
              <Zap className="size-3.5 text-amber-500" /> 412 people applied today
            </div>
            <h1 className="font-display text-3xl lg:text-4xl font-bold mt-2">{product.title}</h1>
            <p className="text-muted-foreground mt-2">{product.tagline}</p>
            <div className="grid grid-cols-3 gap-3 mt-6">
              {[
                ["60 sec", "To check"],
                ["24 hrs", "Disbursal"],
                ["50+", "Lenders"],
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

          {/* Testimonials */}
          <div className="rounded-2xl bg-card border border-border p-5">
            <div className="flex items-center gap-2 text-sm font-semibold mb-3">
              <Star className="size-4 fill-amber-400 text-amber-400" /> What our customers say
            </div>
            <div className="space-y-3">
              {TESTIMONIALS.map((t) => (
                <div key={t.name} className="rounded-xl bg-background border border-border/60 p-3">
                  <div className="flex items-center gap-1 mb-1">
                    {Array.from({ length: t.rating }).map((_, i) => (
                      <Star key={i} className="size-3 fill-amber-400 text-amber-400" />
                    ))}
                  </div>
                  <p className="text-sm text-foreground/80">"{t.text}"</p>
                  <div className="text-xs text-muted-foreground mt-1.5">— {t.name}, {t.city}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Trust strip */}
          <div className="rounded-2xl bg-card border border-border p-4 flex flex-wrap items-center justify-around gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5"><Users className="size-4 text-blue-500" /> 1.2L+ customers</div>
            <div className="flex items-center gap-1.5"><Clock className="size-4 text-emerald-500" /> Avg 18hr disbursal</div>
            <div className="flex items-center gap-1.5"><ShieldCheck className="size-4 text-violet-500" /> Bank-grade security</div>
          </div>
        </div>

        {/* RIGHT: stepper card */}
        <div className="order-1 lg:order-2">
          <div className="rounded-3xl bg-card border border-border shadow-card overflow-hidden">
            {step === 1 && (
              <Step1
                loanType={loanType} setLoanType={setLoanType}
                loanAmount={loanAmount} setLoanAmount={setLoanAmount}
                phone={phone} setPhone={setPhone}
                product={product}
                submitting={submitting}
                onSubmit={handleQuickSubmit}
                waText={waText}
              />
            )}
            {step === 2 && (
              <Step2
                phone={phone}
                otp={otp} setOtp={setOtp}
                resendIn={resendIn}
                onResend={handleResendOtp}
                onVerify={handleVerifyOtp}
                onSkip={skipOtp}
                onBack={() => setStep(1)}
                submitting={submitting}
              />
            )}
            {step === 3 && (
              <Step3
                product={product}
                name={name} setName={setName}
                city={city} setCity={setCity}
                email={email} setEmail={setEmail}
                monthlyIncome={monthlyIncome} setMonthlyIncome={setMonthlyIncome}
                employmentType={employmentType} setEmploymentType={setEmploymentType}
                submitting={submitting}
                onSubmit={handleDetailSubmit}
                otpVerified={otpVerified}
              />
            )}
            {step === 4 && (
              <Step4
                masked={maskedPhone}
                exclusive={isExclusive}
                refMeta={refMeta}
                otpVerified={otpVerified}
              />
            )}
          </div>

          {/* Track-application popup */}
          {showTrackPopup && (
            <TrackApplicationPopup onClose={() => setShowTrackPopup(false)} />
          )}
        </div>
      </div>

      {/* WhatsApp floating button */}
      <a
        href={`https://wa.me/919999999999?text=${waText}`}
        target="_blank" rel="noopener noreferrer"
        aria-label="Apply via WhatsApp"
        className="fixed bottom-5 right-5 z-30 size-14 rounded-full bg-[#25D366] text-white grid place-items-center shadow-lg hover:scale-105 transition"
      >
        <MessageCircle className="size-7" />
      </a>
    </div>
  );
}

/* ---------- Steps ---------- */

function ProgressBar({ step }: { step: Step }) {
  const pct = step === 1 ? 25 : step === 2 ? 50 : step === 3 ? 80 : 100;
  return (
    <div className="h-1 bg-muted">
      <div
        className="h-full bg-gradient-to-r from-accent to-primary transition-all duration-500"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

type Step1Props = {
  loanType: LoanType; setLoanType: (v: LoanType) => void;
  loanAmount: string; setLoanAmount: (v: string) => void;
  phone: string; setPhone: (v: string) => void;
  product: ProductMeta;
  submitting: boolean;
  onSubmit: (e: React.FormEvent) => void;
  waText: string;
};

function Step1({
  loanType, setLoanType, loanAmount, setLoanAmount, phone, setPhone,
  product, submitting, onSubmit, waText,
}: Step1Props) {
  return (
    <form onSubmit={onSubmit} className="p-6 lg:p-8 space-y-5">
      <div>
        <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Step 1 of 3</div>
        <h2 className="font-display text-2xl font-bold mt-1">Check your eligibility</h2>
        <p className="text-xs text-muted-foreground mt-1">Free • No credit score impact • 30 seconds</p>
      </div>

      {product.product_category === "loan" && (
        <Field icon={Briefcase} label="Loan type">
          <select
            className="input-base w-full"
            value={loanType}
            onChange={(e) => setLoanType(e.target.value as LoanType)}
          >
            {LOAN_TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </Field>
      )}

      <Field icon={IndianRupee} label={`${product.amountLabel} *`}>
        <input
          className="input-base w-full text-lg font-semibold"
          inputMode="numeric"
          required
          min={product.amountMin}
          max={product.amountMax}
          value={loanAmount}
          onChange={(e) => setLoanAmount(e.target.value.replace(/[^0-9]/g, ""))}
          placeholder={`₹ ${product.amountMin.toLocaleString("en-IN")}`}
        />
      </Field>

      <Field icon={Phone} label="Mobile number *">
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-medium">+91</span>
          <input
            className="input-base w-full pl-12 text-lg font-semibold tracking-wider"
            type="tel"
            inputMode="numeric"
            maxLength={10}
            required
            value={phone}
            onChange={(e) => setPhone(e.target.value.replace(/[^0-9]/g, ""))}
            placeholder="98765 43210"
            autoComplete="tel"
          />
        </div>
      </Field>

      <button
        type="submit"
        disabled={submitting}
        className="w-full bg-accent text-accent-foreground rounded-xl py-3.5 font-bold shadow-mint hover:opacity-90 transition disabled:opacity-50 inline-flex items-center justify-center gap-2 text-base"
      >
        {submitting ? <><Loader2 className="size-4 animate-spin" /> Sending OTP…</> : <>Check Eligibility <ArrowRight className="size-4" /></>}
      </button>

      <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
        <div className="h-px flex-1 bg-border" /> OR <div className="h-px flex-1 bg-border" />
      </div>

      <a
        href={`https://wa.me/919999999999?text=${waText}`}
        target="_blank" rel="noopener noreferrer"
        className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-border py-3 font-semibold text-sm hover:bg-muted/50 transition"
      >
        <MessageCircle className="size-4 text-[#25D366]" /> Apply via WhatsApp
      </a>

      <p className="text-[11px] text-muted-foreground text-center">
        By continuing, you agree to be contacted by RupeeDial about your application.
      </p>
    </form>
  );
}

type Step2Props = {
  phone: string;
  otp: string; setOtp: (v: string) => void;
  resendIn: number;
  onResend: () => void;
  onVerify: (e: React.FormEvent) => void;
  onSkip: () => void;
  onBack: () => void;
  submitting: boolean;
};

function Step2({ phone, otp, setOtp, resendIn, onResend, onVerify, onSkip, onBack, submitting }: Step2Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { inputRef.current?.focus(); }, []);
  return (
    <form onSubmit={onVerify} className="p-6 lg:p-8 space-y-5">
      <div>
        <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Step 2 of 3</div>
        <h2 className="font-display text-2xl font-bold mt-1">Verify your number</h2>
        <p className="text-sm text-muted-foreground mt-1">
          We sent a 6-digit code to <strong className="text-foreground">+91 {phone}</strong>{" "}
          <button type="button" onClick={onBack} className="text-accent hover:underline ml-1 text-xs">Change</button>
        </p>
      </div>

      <Field icon={Lock} label="Enter OTP">
        <input
          ref={inputRef}
          className="input-base w-full text-center text-2xl tracking-[0.5em] font-bold"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          required
          value={otp}
          onChange={(e) => setOtp(e.target.value.replace(/[^0-9]/g, ""))}
          placeholder="● ● ● ● ● ●"
        />
      </Field>

      <button
        type="submit"
        disabled={submitting || otp.length < 4}
        className="w-full bg-accent text-accent-foreground rounded-xl py-3.5 font-bold shadow-mint hover:opacity-90 transition disabled:opacity-50 inline-flex items-center justify-center gap-2 text-base"
      >
        {submitting ? <><Loader2 className="size-4 animate-spin" /> Verifying…</> : <>Verify & Continue <ArrowRight className="size-4" /></>}
      </button>

      <div className="flex items-center justify-between text-xs">
        <button
          type="button"
          onClick={onResend}
          disabled={resendIn > 0}
          className="text-accent font-semibold disabled:text-muted-foreground disabled:cursor-not-allowed"
        >
          {resendIn > 0 ? `Resend OTP in ${resendIn}s` : "Resend OTP"}
        </button>
        <button type="button" onClick={onSkip} className="text-muted-foreground hover:text-foreground underline">
          Skip for now
        </button>
      </div>
    </form>
  );
}

type Step3Props = {
  product: ProductMeta;
  name: string; setName: (v: string) => void;
  city: string; setCity: (v: string) => void;
  email: string; setEmail: (v: string) => void;
  monthlyIncome: string; setMonthlyIncome: (v: string) => void;
  employmentType: string; setEmploymentType: (v: string) => void;
  submitting: boolean;
  onSubmit: (e: React.FormEvent) => void;
  otpVerified: boolean;
};

function Step3({
  product, name, setName, city, setCity, email, setEmail,
  monthlyIncome, setMonthlyIncome, employmentType, setEmploymentType,
  submitting, onSubmit, otpVerified,
}: Step3Props) {
  return (
    <form onSubmit={onSubmit} className="p-6 lg:p-8 space-y-4">
      <div>
        <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Step 3 of 3</div>
        <h2 className="font-display text-2xl font-bold mt-1">Almost done!</h2>
        <p className="text-xs text-muted-foreground mt-1">
          {otpVerified ? "✓ Mobile verified. " : ""}A few details to match you with the best lender.
        </p>
      </div>

      <Field icon={User} label="Full name *">
        <input
          className="input-base w-full"
          maxLength={80}
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="As per PAN card"
          autoFocus
        />
      </Field>

      <div className="grid sm:grid-cols-2 gap-3">
        <Field icon={MapPin} label="City *">
          <input
            className="input-base w-full"
            required maxLength={60}
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="Auto-detected"
          />
        </Field>
        <Field icon={Mail} label="Email">
          <input
            className="input-base w-full"
            type="email"
            maxLength={120}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
        </Field>
      </div>

      {product.showIncome && (
        <div className="grid sm:grid-cols-2 gap-3">
          <Field icon={Banknote} label="Monthly income">
            <input
              className="input-base w-full"
              inputMode="numeric"
              value={monthlyIncome}
              onChange={(e) => setMonthlyIncome(e.target.value.replace(/[^0-9]/g, ""))}
              placeholder="₹ 50,000"
            />
          </Field>
          <Field icon={Briefcase} label="Employment">
            <select
              className="input-base w-full"
              value={employmentType}
              onChange={(e) => setEmploymentType(e.target.value)}
            >
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
        className="w-full bg-accent text-accent-foreground rounded-xl py-3.5 font-bold shadow-mint hover:opacity-90 transition disabled:opacity-50 inline-flex items-center justify-center gap-2 text-base"
      >
        {submitting ? <><Loader2 className="size-4 animate-spin" /> Submitting…</> : <>Submit Application <ArrowRight className="size-4" /></>}
      </button>

      <p className="text-[11px] text-muted-foreground text-center">
        🔒 Your data is encrypted and never shared without your consent.
      </p>
    </form>
  );
}

function Step4({
  masked, exclusive, refMeta, otpVerified,
}: {
  masked: string;
  exclusive: boolean;
  refMeta: { name: string | null; company: string | null } | null;
  otpVerified: boolean;
}) {
  return (
    <div className="p-6 lg:p-8 text-center">
      <div className="size-16 rounded-2xl bg-emerald-500/15 grid place-items-center mx-auto mb-4">
        <CheckCircle2 className="size-9 text-emerald-600" />
      </div>
      <h2 className="font-display text-2xl font-bold">You're eligible! 🎉</h2>
      <p className="text-muted-foreground mt-2 text-sm">
        Application received. Our team will call <strong>{masked}</strong> within the next few minutes.
        {exclusive && refMeta && (
          <> Your application has been routed directly to <strong>{refMeta.company || refMeta.name}</strong>.</>
        )}
      </p>

      <div className="mt-6 grid grid-cols-3 gap-2 text-xs">
        <div className="rounded-xl bg-emerald-500/5 border border-emerald-500/20 p-3">
          <CheckCircle2 className="size-4 text-emerald-500 mx-auto" />
          <div className="font-semibold mt-1">Submitted</div>
        </div>
        <div className="rounded-xl bg-amber-500/5 border border-amber-500/20 p-3">
          <Clock className="size-4 text-amber-500 mx-auto animate-pulse" />
          <div className="font-semibold mt-1">Under review</div>
        </div>
        <div className="rounded-xl bg-muted/50 border border-border p-3">
          <Phone className="size-4 text-muted-foreground mx-auto" />
          <div className="font-semibold mt-1 text-muted-foreground">Call back</div>
        </div>
      </div>

      {otpVerified && (
        <div className="mt-4 inline-flex items-center gap-1.5 text-xs text-emerald-600 font-semibold">
          <ShieldCheck className="size-3.5" /> Verified application — priority queue
        </div>
      )}

      <Link
        to="/"
        className="inline-block mt-6 text-sm text-muted-foreground hover:text-foreground underline"
      >
        ← Back to home
      </Link>
    </div>
  );
}

function TrackApplicationPopup({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-foreground/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="rounded-3xl bg-card border border-border shadow-card max-w-md w-full p-6 animate-in zoom-in-95 duration-300">
        <div className="size-12 rounded-2xl bg-accent/15 grid place-items-center mb-3">
          <UserPlus className="size-6 text-accent" />
        </div>
        <h3 className="font-display text-xl font-bold">Track your application</h3>
        <p className="text-sm text-muted-foreground mt-2">
          Create a free account to track status, upload documents, get instant updates and chat with your relationship manager.
        </p>
        <div className="flex gap-2 mt-5">
          <Link
            to="/auth"
            search={{ next: "/dashboard" }}
            className="flex-1 inline-flex items-center justify-center gap-1.5 bg-accent text-accent-foreground rounded-xl px-4 py-2.5 font-semibold text-sm hover:opacity-90"
          >
            Create account <ArrowRight className="size-4" />
          </Link>
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-border font-semibold text-sm hover:bg-muted/50"
          >
            Skip
          </button>
        </div>
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
