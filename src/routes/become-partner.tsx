import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, ArrowRight, ShieldCheck, IndianRupee, GraduationCap, CheckCircle2, Upload, FileText } from "lucide-react";
import { submitPartnerApplication, uploadKycDoc, PRODUCT_OPTIONS } from "@/lib/partners";

export const Route = createFileRoute("/become-partner")({
  head: () => ({
    meta: [
      { title: "Become a Partner — RupeeDial Partner Network" },
      { name: "description", content: "Join the RupeeDial partner network. Apply in a few minutes — get verified, get leads, get paid." },
      { property: "og:title", content: "Become a RupeeDial Partner" },
      { property: "og:description", content: "Verified leads, payouts, and training. Apply now." },
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

const STEP_LABEL = ["You", "Work", "KYC"];

function BecomePartnerPage() {
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<{ id: string } | null>(null);

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
      <div className="min-h-screen bg-[#F4FBF6] text-[#14281c]">
        <PartnerHeader />
        <div className="mx-auto grid min-h-[70vh] max-w-lg place-items-center px-4 py-12">
          <div className="w-full rounded-3xl border border-[#d8ecdd] bg-white p-8 shadow-[0_20px_50px_rgba(16,102,42,0.08)] md:p-10">
            <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-[#E8F7EC]">
              <CheckCircle2 className="size-7 text-[#10662A]" />
            </div>
            <h1 className="mt-5 text-center font-display text-3xl font-bold text-[#390A5D]">Application received</h1>
            <p className="mt-3 text-center text-sm leading-6 text-[#5c4d72]">
              Thanks <strong className="text-[#14281c]">{fullName}</strong>. RupeeDial will verify your KYC and reply within 24 hours.
            </p>
            <div className="mt-6 rounded-2xl border border-[#d8ecdd] bg-[#F4FBF6] p-4 text-left text-sm">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-[#10662A]">Application ID</div>
              <div className="mt-1 break-all font-mono text-[#14281c]">{done.id}</div>
            </div>
            <ol className="mt-6 space-y-3 text-sm">
              {["PAN, bank and documents are reviewed", "Your DSA ID arrives on email and WhatsApp", "Sign in, finish training, and start on leads"].map((line, i) => (
                <li key={line} className="flex items-start gap-3">
                  <span className="mt-0.5 grid size-5 place-items-center rounded-full bg-[#10662A] text-[11px] font-bold text-white">{i + 1}</span>
                  <span>{line}</span>
                </li>
              ))}
            </ol>
            <Link to="/auth" className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#10662A] px-6 py-3 font-semibold text-white">
              Partner sign in <ArrowRight className="size-4" />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F4FBF6] text-[#14281c]">
      <PartnerHeader />

      <div className="mx-auto grid max-w-6xl items-start gap-8 px-4 py-8 md:py-12 lg:grid-cols-[0.9fr_1.2fr] lg:gap-10">
        <aside className="overflow-hidden rounded-3xl bg-gradient-to-br from-[#0D4F20] to-[#10662A] p-7 text-white shadow-[0_24px_50px_rgba(13,79,32,0.25)] lg:sticky lg:top-24">
          <img src="/rupeediallogo.png" alt="RupeeDial" className="h-16 w-auto rounded-xl bg-white object-contain px-2" />
          <p className="mt-6 text-xs font-semibold uppercase tracking-[0.18em] text-[#B7E4C7]">Partner network</p>
          <h1 className="mt-2 font-display text-3xl font-bold leading-tight md:text-4xl">
            Become a RupeeDial financial partner
          </h1>
          <p className="mt-3 text-sm leading-6 text-white/85">
            One application for DSAs, consultants and callers. Verified leads, payouts, and training on the same desk customers already use.
          </p>
          <div className="mt-7 space-y-3">
            {[
              { icon: IndianRupee, title: "Earn on disbursals", desc: "Commission on loans, cards and policies you close" },
              { icon: ShieldCheck, title: "Verified leads only", desc: "Phone checked before a lead reaches your desk" },
              { icon: GraduationCap, title: "Training and certificate", desc: "Learn the product, then carry the badge on your profile" },
            ].map((b) => (
              <div key={b.title} className="flex items-start gap-3 rounded-2xl bg-white/10 p-3.5">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white text-[#10662A]">
                  <b.icon className="size-5" />
                </span>
                <div>
                  <div className="text-sm font-semibold">{b.title}</div>
                  <div className="mt-0.5 text-xs leading-5 text-white/75">{b.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </aside>

        <form onSubmit={onSubmit} className="rounded-3xl border border-[#d8ecdd] bg-white p-6 shadow-[0_16px_40px_rgba(16,102,42,0.06)] md:p-8">
          <div className="mb-6 flex items-center gap-2">
            {[1, 2, 3].map((s) => (
              <div key={s} className="flex flex-1 items-center gap-2">
                <button
                  type="button"
                  onClick={() => s < step && setStep(s)}
                  className={`grid size-8 place-items-center rounded-full text-xs font-bold ${step >= s ? "bg-[#10662A] text-white" : "bg-[#E8F7EC] text-[#5c4d72]"}`}
                >
                  {s}
                </button>
                <span className={`hidden text-xs font-semibold sm:inline ${step >= s ? "text-[#10662A]" : "text-[#5c4d72]"}`}>{STEP_LABEL[s - 1]}</span>
                {s < 3 && <div className={`h-0.5 flex-1 rounded ${step > s ? "bg-[#10662A]" : "bg-[#d8ecdd]"}`} />}
              </div>
            ))}
          </div>

          {step === 1 && (
            <div className="space-y-4">
              <div>
                <h2 className="font-display text-2xl font-bold text-[#390A5D]">Tell us about you</h2>
                <p className="mt-1 text-sm text-[#5c4d72]">Step 1 of 3 · Personal details</p>
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
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Email *">
                  <input type="email" className="input-base" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="rahul@example.com" required />
                </Field>
                <Field label="Mobile (10 digits) *">
                  <input className="input-base" value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))} placeholder="9876543210" required />
                </Field>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="City *"><input className="input-base" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Delhi" required /></Field>
                <Field label="State"><input className="input-base" value={stateField} onChange={(e) => setStateField(e.target.value)} placeholder="Delhi" /></Field>
                <Field label="Pincode"><input className="input-base" value={pincode} onChange={(e) => setPincode(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="110001" /></Field>
              </div>
              <Field label="Company name (if any)">
                <input className="input-base" value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Sharma Finance Services" />
              </Field>
              <button type="button" onClick={() => setStep(2)} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#10662A] py-3 font-semibold text-white hover:bg-[#0D4F20]">
                Continue <ArrowRight className="size-4" />
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div>
                <h2 className="font-display text-2xl font-bold text-[#390A5D]">What do you sell?</h2>
                <p className="mt-1 text-sm text-[#5c4d72]">Step 2 of 3 · Products and experience</p>
              </div>
              <Field label="Products you want to sell *">
                <div className="grid gap-2 sm:grid-cols-2">
                  {PRODUCT_OPTIONS.map((p) => (
                    <label key={p.value} className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium ${products.includes(p.value) ? "border-[#10662A] bg-[#E8F7EC] text-[#0D4F20]" : "border-[#d8ecdd] hover:border-[#10662A]/40"}`}>
                      <input type="checkbox" className="accent-[#10662A]" checked={products.includes(p.value)} onChange={() => toggleProduct(p.value)} />
                      {p.label}
                    </label>
                  ))}
                </div>
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Years of experience">
                  <input type="number" min={0} max={40} className="input-base" value={experience} onChange={(e) => setExperience(parseInt(e.target.value) || 0)} />
                </Field>
                <Field label="Monthly disbursal target (₹)">
                  <input type="number" min={0} className="input-base" value={target} onChange={(e) => setTarget(e.target.value ? parseInt(e.target.value) : "")} placeholder="500000" />
                </Field>
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setStep(1)} className="flex-1 rounded-xl border border-[#d8ecdd] py-3 font-semibold text-[#390A5D] hover:bg-[#F4FBF6]">Back</button>
                <button type="button" onClick={() => setStep(3)} disabled={products.length === 0} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#10662A] py-3 font-semibold text-white hover:bg-[#0D4F20] disabled:opacity-50">
                  Continue <ArrowRight className="size-4" />
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div>
                <h2 className="font-display text-2xl font-bold text-[#390A5D]">KYC and bank</h2>
                <p className="mt-1 text-sm text-[#5c4d72]">Step 3 of 3 · For payouts and verification</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="PAN number *">
                  <input className="input-base uppercase" value={pan} onChange={(e) => setPan(e.target.value.toUpperCase().slice(0, 10))} placeholder="ABCDE1234F" required />
                </Field>
                <Field label="Aadhaar (last 4 digits)">
                  <input className="input-base" value={aadhaarLast4} onChange={(e) => setAadhaarLast4(e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="1234" />
                </Field>
              </div>
              <div className="space-y-3">
                <DocUpload label="PAN card (image/PDF)" accept="image/*,.pdf" url={panDocUrl} uploading={uploading === "pan"} onChange={(f) => handleUpload(f, "pan", setPanDocUrl)} />
                <DocUpload label="Aadhaar (front/back)" accept="image/*,.pdf" url={aadhaarDocUrl} uploading={uploading === "aadhaar"} onChange={(f) => handleUpload(f, "aadhaar", setAadhaarDocUrl)} />
                <DocUpload label="Bank passbook / cheque" accept="image/*,.pdf" url={bankProofUrl} uploading={uploading === "bank"} onChange={(f) => handleUpload(f, "bank", setBankProofUrl)} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Account holder name"><input className="input-base" value={accountHolder} onChange={(e) => setAccountHolder(e.target.value)} placeholder="Rahul Sharma" /></Field>
                <Field label="Bank account no."><input className="input-base" value={bankAccount} onChange={(e) => setBankAccount(e.target.value.replace(/\D/g, ""))} placeholder="123456789012" /></Field>
              </div>
              <Field label="IFSC code">
                <input className="input-base uppercase" value={ifsc} onChange={(e) => setIfsc(e.target.value.toUpperCase().slice(0, 11))} placeholder="HDFC0001234" />
              </Field>
              <label className="flex cursor-pointer items-start gap-2.5 text-xs leading-5 text-[#5c4d72]">
                <input type="checkbox" className="mt-0.5 accent-[#10662A]" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
                <span>I agree to the terms and consent to KYC verification. The details above are accurate.</span>
              </label>
              <div className="flex gap-3">
                <button type="button" onClick={() => setStep(2)} className="flex-1 rounded-xl border border-[#d8ecdd] py-3 font-semibold text-[#390A5D] hover:bg-[#F4FBF6]">Back</button>
                <button type="submit" disabled={submitting || !consent} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#10662A] py-3 font-semibold text-white hover:bg-[#0D4F20] disabled:opacity-50">
                  {submitting ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
                  {submitting ? "Submitting..." : "Submit application"}
                </button>
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}

function PartnerHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-[#d8ecdd] bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link to="/" className="flex items-center">
          <img src="/rupeediallogo.png" alt="RupeeDial" className="h-12 w-auto object-contain" />
        </Link>
        <Link to="/auth" className="text-sm font-semibold text-[#10662A] hover:text-[#0D4F20]">
          Already a partner? Sign in
        </Link>
      </div>
    </header>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-[#5c4d72]">{label}</div>
      {children}
    </label>
  );
}

function DocUpload({ label, accept, url, uploading, onChange }: { label: string; accept: string; url: string | null; uploading: boolean; onChange: (f: File | undefined) => void }) {
  return (
    <label className={`flex cursor-pointer items-center gap-3 rounded-xl border-2 border-dashed px-4 py-3 ${url ? "border-[#10662A]/40 bg-[#F4FBF6]" : "border-[#d8ecdd] hover:border-[#10662A]/40"}`}>
      <div className={`grid size-10 shrink-0 place-items-center rounded-xl ${url ? "bg-[#E8F7EC] text-[#10662A]" : "bg-[#F4FBF6] text-[#5c4d72]"}`}>
        {uploading ? <Loader2 className="size-5 animate-spin" /> : url ? <FileText className="size-5" /> : <Upload className="size-5" />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold text-[#14281c]">{label}</div>
        <div className="truncate text-xs text-[#5c4d72]">{url ? "Uploaded. Click to replace." : "Tap to upload (max 5MB)"}</div>
      </div>
      <input type="file" accept={accept} className="hidden" onChange={(e) => onChange(e.target.files?.[0])} />
    </label>
  );
}
