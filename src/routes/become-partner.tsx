import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, ArrowRight, ShieldCheck, IndianRupee, GraduationCap, Sparkles, CheckCircle2, Upload, FileText } from "lucide-react";
import { submitPartnerApplication, uploadKycDoc, PRODUCT_OPTIONS } from "@/lib/partners";

export const Route = createFileRoute("/become-partner")({
  head: () => ({
    meta: [
      { title: "Become a Partner — LeadMines DSA Network" },
      { name: "description", content: "Join 10,000+ DSAs earning lakhs every month. Apply in 3 minutes — get verified, get leads, get paid." },
      { property: "og:title", content: "Become a LeadMines DSA Partner" },
      { property: "og:description", content: "Verified leads, daily payouts, marketing tools and AI training. Apply now." },
    ],
  }),
  component: BecomePartnerPage,
});

const schema = z.object({
  full_name: z.string().trim().min(2, "Enter your full name"),
  email: z.string().trim().email("Valid email required"),
  phone: z.string().trim().regex(/^[6-9]\d{9}$/, "Enter 10-digit Indian mobile"),
  city: z.string().trim().min(2, "City required"),
  state: z.string().trim().optional(),
  pincode: z.string().trim().regex(/^\d{6}$/, "6-digit pincode").optional().or(z.literal("")),
  pan: z.string().trim().regex(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, "Format: ABCDE1234F"),
  experience_years: z.number().min(0).max(40),
  products: z.array(z.string()).min(1, "Pick at least one product"),
  consent: z.literal(true, { errorMap: () => ({ message: "You must accept the terms" }) }),
});

function BecomePartnerPage() {
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<{ id: string } | null>(null);

  // form state
  const [dsaType, setDsaType] = useState("dsa");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [stateField, setStateField] = useState("");
  const [pincode, setPincode] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [experience, setExperience] = useState(0);
  const [products, setProducts] = useState<string[]>([]);
  const [target, setTarget] = useState<number | "">("");
  const [pan, setPan] = useState("");
  const [aadhaarLast4, setAadhaarLast4] = useState("");
  const [bankAccount, setBankAccount] = useState("");
  const [ifsc, setIfsc] = useState("");
  const [accountHolder, setAccountHolder] = useState("");
  const [consent, setConsent] = useState(false);

  // doc uploads
  const [panDocUrl, setPanDocUrl] = useState<string | null>(null);
  const [aadhaarDocUrl, setAadhaarDocUrl] = useState<string | null>(null);
  const [bankProofUrl, setBankProofUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);

  const toggleProduct = (v: string) =>
    setProducts((p) => (p.includes(v) ? p.filter((x) => x !== v) : [...p, v]));

  const handleUpload = async (file: File | undefined, label: string, setter: (u: string) => void) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("File too large (max 5MB)");
      return;
    }
    setUploading(label);
    try {
      const url = await uploadKycDoc(file, label);
      setter(url);
      toast.success(`${label} uploaded`);
    } catch (e: any) {
      toast.error(e.message || "Upload failed");
    } finally {
      setUploading(null);
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse({
      full_name: fullName,
      email,
      phone,
      city,
      state: stateField,
      pincode,
      pan: pan.toUpperCase(),
      experience_years: experience,
      products,
      consent,
    });
    if (!parsed.success) {
      toast.error(parsed.error.errors[0].message);
      return;
    }
    setSubmitting(true);
    try {
      const params = new URLSearchParams(window.location.search);
      const res = await submitPartnerApplication({
        full_name: fullName,
        email,
        phone,
        city,
        state: stateField || undefined,
        pincode: pincode || undefined,
        company_name: companyName || undefined,
        experience_years: experience,
        products,
        monthly_target: target ? Number(target) : undefined,
        pan: pan.toUpperCase(),
        aadhaar_last4: aadhaarLast4 || undefined,
        bank_account: bankAccount || undefined,
        ifsc: ifsc.toUpperCase() || undefined,
        account_holder: accountHolder || undefined,
        pan_doc_url: panDocUrl || undefined,
        aadhaar_doc_url: aadhaarDocUrl || undefined,
        bank_proof_url: bankProofUrl || undefined,
        utm_source: params.get("utm_source") || undefined,
        utm_medium: params.get("utm_medium") || undefined,
        utm_campaign: params.get("utm_campaign") || undefined,
        dsa_type: dsaType,
      });
      setDone({ id: res.application_id });
    } catch (e: any) {
      toast.error(e.message || "Submission failed. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-mint-100/20 grid place-items-center px-4 py-12">
        <div className="max-w-lg w-full bg-card border border-border rounded-3xl p-8 md:p-10 shadow-elegant text-center">
          <div className="size-16 mx-auto rounded-2xl bg-emerald-500/15 grid place-items-center">
            <CheckCircle2 className="size-8 text-emerald-600" />
          </div>
          <h1 className="font-display text-3xl font-bold mt-5">Application received! 🎉</h1>
          <p className="text-muted-foreground mt-3">
            Thanks <strong className="text-foreground">{fullName}</strong>. Our team will verify your KYC and get back within <strong>24 hours</strong>.
          </p>
          <div className="mt-6 rounded-2xl bg-muted/40 border border-border p-4 text-left text-sm">
            <div className="text-muted-foreground text-xs uppercase tracking-wide font-semibold">Application ID</div>
            <div className="font-mono text-foreground mt-1 break-all">{done.id}</div>
          </div>
          <div className="mt-6 space-y-3 text-sm text-left">
            <div className="flex items-start gap-3"><div className="size-5 rounded-full bg-accent/20 grid place-items-center text-accent text-xs font-bold mt-0.5">1</div><span>Our team reviews your PAN, bank & documents</span></div>
            <div className="flex items-start gap-3"><div className="size-5 rounded-full bg-accent/20 grid place-items-center text-accent text-xs font-bold mt-0.5">2</div><span>You receive your <strong>DSA ID</strong> on email & WhatsApp</span></div>
            <div className="flex items-start gap-3"><div className="size-5 rounded-full bg-accent/20 grid place-items-center text-accent text-xs font-bold mt-0.5">3</div><span>Login, complete training, and start buying leads</span></div>
          </div>
          <Link to="/" className="mt-8 inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-foreground text-background font-bold hover:opacity-90 transition-smooth">
            Back to home <ArrowRight className="size-4" />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-mint-100/20">
      <header className="border-b border-border bg-card/60 backdrop-blur sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="size-8 rounded-lg bg-mint-gradient grid place-items-center shadow-mint">
              <Sparkles className="size-4 text-primary" strokeWidth={2.5} />
            </div>
            <div className="leading-tight">
              <div className="font-display font-bold text-sm">RupeeDial</div>
              <div className="text-[9px] uppercase tracking-[0.16em] text-muted-foreground -mt-0.5">by MoneyMines</div>
            </div>
          </Link>
          <Link to="/auth" className="text-sm font-semibold text-muted-foreground hover:text-foreground transition-smooth">
            Already a partner? Sign in →
          </Link>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-10 md:py-14 grid lg:grid-cols-[1.2fr_2fr] gap-10">
        {/* Left: pitch */}
        <aside className="lg:sticky lg:top-24 lg:self-start space-y-6">
          <div>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-accent/15 border border-accent/30 text-xs font-bold text-accent uppercase tracking-wide">
              <ShieldCheck className="size-3.5" /> Verified DSA Network
            </span>
            <h1 className="font-display text-3xl md:text-4xl font-bold mt-3 leading-tight">Become a <span className="text-accent">RupeeDial</span> Financial Partner</h1>
            <p className="text-muted-foreground mt-3">Join 10,000+ DSAs earning lakhs every month. Verified leads, daily payouts, AI tools.</p>
          </div>

          <div className="grid gap-3">
            {[
              { icon: IndianRupee, title: "Earn ₹50k–₹5L/month", desc: "Upto 2.5% commission on disbursals" },
              { icon: ShieldCheck, title: "Verified leads only", desc: "Phone verified + CIBIL checked" },
              { icon: GraduationCap, title: "Free training & certs", desc: "Become certified in 7 days" },
            ].map((b) => (
              <div key={b.title} className="flex items-start gap-3 p-4 rounded-2xl border border-border bg-card">
                <div className="size-10 rounded-xl bg-accent/15 grid place-items-center shrink-0"><b.icon className="size-5 text-accent" /></div>
                <div>
                  <div className="font-semibold text-sm">{b.title}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{b.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </aside>

        {/* Right: form */}
        <form onSubmit={onSubmit} className="bg-card border border-border rounded-3xl p-6 md:p-8 shadow-elegant space-y-6">
          {/* Stepper */}
          <div className="flex items-center gap-2">
            {[1, 2, 3].map((s) => (
              <div key={s} className="flex-1 flex items-center gap-2">
                <div className={`size-7 rounded-full grid place-items-center text-xs font-bold transition-smooth ${step >= s ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground"}`}>{s}</div>
                <div className={`flex-1 h-0.5 rounded ${step > s ? "bg-accent" : "bg-border"} ${s === 3 ? "hidden" : ""}`} />
              </div>
            ))}
          </div>

          {/* STEP 1: Personal */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <h2 className="font-display text-xl font-bold">Tell us about you</h2>
                <p className="text-xs text-muted-foreground mt-1">Step 1 of 3 · Personal details</p>
              </div>
              <Field label="Partner type *">
                <select className="input-base" value={dsaType} onChange={(e) => setDsaType(e.target.value)}>
                  <option value="dsa">DSA</option>
                  <option value="sub_dsa">Sub-DSA</option>
                  <option value="loan_consultant">Loan Consultant</option>
                  <option value="ca">CA</option>
                  <option value="gst_consultant">GST Consultant</option>
                  <option value="insurance_advisor">Insurance Advisor</option>
                  <option value="property_consultant">Property Consultant</option>
                  <option value="telecaller">Telecaller</option>
                  <option value="telecalling_agency">Telecalling Agency</option>
                  <option value="freelancer">Freelancer</option>
                  <option value="referral">Referral Partner</option>
                </select>
              </Field>
              <Field label="Full name *">
                <input className="input-base" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Rahul Sharma" required />
              </Field>
              <div className="grid sm:grid-cols-2 gap-4">
                <Field label="Email *">
                  <input type="email" className="input-base" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="rahul@example.com" required />
                </Field>
                <Field label="Mobile (10 digits) *">
                  <input className="input-base" value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))} placeholder="9876543210" required />
                </Field>
              </div>
              <div className="grid sm:grid-cols-3 gap-4">
                <Field label="City *"><input className="input-base" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Delhi" required /></Field>
                <Field label="State"><input className="input-base" value={stateField} onChange={(e) => setStateField(e.target.value)} placeholder="Delhi" /></Field>
                <Field label="Pincode"><input className="input-base" value={pincode} onChange={(e) => setPincode(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="110001" /></Field>
              </div>
              <Field label="Company name (if any)">
                <input className="input-base" value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Sharma Finance Services" />
              </Field>
              <button type="button" onClick={() => setStep(2)} className="w-full py-3 rounded-xl bg-foreground text-background font-bold hover:opacity-90 transition-smooth flex items-center justify-center gap-2">
                Continue <ArrowRight className="size-4" />
              </button>
            </div>
          )}

          {/* STEP 2: Business */}
          {step === 2 && (
            <div className="space-y-4">
              <div>
                <h2 className="font-display text-xl font-bold">What do you sell?</h2>
                <p className="text-xs text-muted-foreground mt-1">Step 2 of 3 · Products & experience</p>
              </div>
              <Field label="Products you want to sell *">
                <div className="grid sm:grid-cols-2 gap-2">
                  {PRODUCT_OPTIONS.map((p) => (
                    <label key={p.value} className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border cursor-pointer transition-smooth ${products.includes(p.value) ? "border-accent bg-accent/10" : "border-border hover:border-accent/40"}`}>
                      <input type="checkbox" className="accent-accent" checked={products.includes(p.value)} onChange={() => toggleProduct(p.value)} />
                      <span className="text-sm font-medium">{p.label}</span>
                    </label>
                  ))}
                </div>
              </Field>
              <div className="grid sm:grid-cols-2 gap-4">
                <Field label="Years of experience">
                  <input type="number" min={0} max={40} className="input-base" value={experience} onChange={(e) => setExperience(parseInt(e.target.value) || 0)} />
                </Field>
                <Field label="Monthly disbursal target (₹)">
                  <input type="number" min={0} className="input-base" value={target} onChange={(e) => setTarget(e.target.value ? parseInt(e.target.value) : "")} placeholder="500000" />
                </Field>
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setStep(1)} className="flex-1 py-3 rounded-xl border border-border font-semibold hover:bg-muted transition-smooth">Back</button>
                <button type="button" onClick={() => setStep(3)} disabled={products.length === 0} className="flex-1 py-3 rounded-xl bg-foreground text-background font-bold hover:opacity-90 transition-smooth flex items-center justify-center gap-2 disabled:opacity-50">
                  Continue <ArrowRight className="size-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: KYC */}
          {step === 3 && (
            <div className="space-y-4">
              <div>
                <h2 className="font-display text-xl font-bold">KYC & Bank Details</h2>
                <p className="text-xs text-muted-foreground mt-1">Step 3 of 3 · For payouts & verification</p>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <Field label="PAN number *">
                  <input className="input-base uppercase" value={pan} onChange={(e) => setPan(e.target.value.toUpperCase().slice(0, 10))} placeholder="ABCDE1234F" required />
                </Field>
                <Field label="Aadhaar (last 4 digits)">
                  <input className="input-base" value={aadhaarLast4} onChange={(e) => setAadhaarLast4(e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="1234" />
                </Field>
              </div>

              {/* Document uploads */}
              <div className="space-y-3">
                <DocUpload label="PAN card (image/PDF)" accept="image/*,.pdf" url={panDocUrl} uploading={uploading === "pan"} onChange={(f) => handleUpload(f, "pan", setPanDocUrl)} />
                <DocUpload label="Aadhaar (front/back)" accept="image/*,.pdf" url={aadhaarDocUrl} uploading={uploading === "aadhaar"} onChange={(f) => handleUpload(f, "aadhaar", setAadhaarDocUrl)} />
                <DocUpload label="Bank passbook / cheque" accept="image/*,.pdf" url={bankProofUrl} uploading={uploading === "bank"} onChange={(f) => handleUpload(f, "bank", setBankProofUrl)} />
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <Field label="Account holder name"><input className="input-base" value={accountHolder} onChange={(e) => setAccountHolder(e.target.value)} placeholder="Rahul Sharma" /></Field>
                <Field label="Bank account no."><input className="input-base" value={bankAccount} onChange={(e) => setBankAccount(e.target.value.replace(/\D/g, ""))} placeholder="123456789012" /></Field>
              </div>
              <Field label="IFSC code">
                <input className="input-base uppercase" value={ifsc} onChange={(e) => setIfsc(e.target.value.toUpperCase().slice(0, 11))} placeholder="HDFC0001234" />
              </Field>

              <label className="flex items-start gap-2.5 text-xs text-muted-foreground cursor-pointer">
                <input type="checkbox" className="mt-0.5 accent-accent" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
                <span>I agree to the <Link to="/" className="text-accent underline">Terms</Link> and consent to KYC verification. I confirm all details are accurate.</span>
              </label>

              <div className="flex gap-3">
                <button type="button" onClick={() => setStep(2)} className="flex-1 py-3 rounded-xl border border-border font-semibold hover:bg-muted transition-smooth">Back</button>
                <button type="submit" disabled={submitting || !consent} className="flex-1 py-3 rounded-xl bg-mint-gradient text-foreground font-bold shadow-mint hover:opacity-90 transition-smooth flex items-center justify-center gap-2 disabled:opacity-50">
                  {submitting ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
                  {submitting ? "Submitting..." : "Submit Application"}
                </button>
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">{label}</div>
      {children}
    </label>
  );
}

function DocUpload({ label, accept, url, uploading, onChange }: { label: string; accept: string; url: string | null; uploading: boolean; onChange: (f: File | undefined) => void }) {
  return (
    <label className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 border-dashed cursor-pointer transition-smooth ${url ? "border-emerald-500/40 bg-emerald-500/5" : "border-border hover:border-accent/40"}`}>
      <div className={`size-10 rounded-xl grid place-items-center shrink-0 ${url ? "bg-emerald-500/15 text-emerald-600" : "bg-muted text-muted-foreground"}`}>
        {uploading ? <Loader2 className="size-5 animate-spin" /> : url ? <FileText className="size-5" /> : <Upload className="size-5" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-sm">{label}</div>
        <div className="text-xs text-muted-foreground truncate">{url ? "Uploaded ✓ click to replace" : "Tap to upload (max 5MB)"}</div>
      </div>
      <input type="file" accept={accept} className="hidden" onChange={(e) => onChange(e.target.files?.[0])} />
    </label>
  );
}
