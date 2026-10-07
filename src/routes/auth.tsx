import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import {
  Loader2,
  Eye,
  EyeOff,
  ShieldCheck,
  ArrowRight,
  Sparkles,
  Lock,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import type { AppRole } from "@/lib/auth-context";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — RupeeDial One" },
      {
        name: "description",
        content: "Sign in to RupeeDial One CRM. Buy leads, run My Leads pipeline, and disburse cases.",
      },
    ],
  }),
  validateSearch: (search: Record<string, unknown>): { next?: string } => {
    const next = typeof search.next === "string" ? search.next : undefined;
    return next && next.startsWith("/") && !next.startsWith("//") ? { next } : {};
  },
  component: AuthPage,
});

const ROLES: { value: AppRole; label: string; hint: string }[] = [
  { value: "dsa", label: "DSA Partner", hint: "Buy leads & run your pipeline." },
  { value: "caller", label: "Telecaller", hint: "Call queue & lead qualification." },
  { value: "coordinator", label: "Sales Coordinator", hint: "Documents & lender routing." },
  { value: "lender", label: "Lender (Bank/NBFC)", hint: "Review cases & disbursal." },
  { value: "affiliate", label: "Affiliate / Influencer", hint: "Referral links & commission." },
  { value: "customer", label: "Customer", hint: "Track your application." },
];

const signinSchema = z.object({
  email: z.string().trim().email("Invalid email").max(255),
  password: z.string().min(1, "Password required").max(72),
});

function AuthPage() {
  const navigate = useNavigate();
  const { user, loading, signIn } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [submitting, setSubmitting] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<AppRole>("dsa");
  const [showPassword, setShowPassword] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const { next } = Route.useSearch();
  const destination = next ?? "/dashboard";

  useEffect(() => {
    if (!loading && user) navigate({ to: destination as "/dashboard" });
  }, [user, loading, navigate, destination]);

  if (loading || (!loading && user)) {
    return (
      <div className="auth-page grid place-items-center bg-[#f5fcf7] p-4">
        <div className="rounded-2xl border border-[#d8ecdd] bg-white flex flex-col items-center gap-2 text-[#5c4d72] px-8 py-8 shadow-[0_8px_30px_rgba(16,102,42,0.06)]">
          <Loader2 className="size-7 animate-spin text-[#10662A]" />
          <p className="text-sm font-medium">Restoring session…</p>
        </div>
      </div>
    );
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (mode === "signup") {
        toast.error("Signup closed. After partner approval, admin shares CRM email + password.");
        setMode("signin");
        return;
      }
      const parsed = signinSchema.safeParse({ email, password });
      if (!parsed.success) {
        toast.error(parsed.error.issues[0].message);
        return;
      }
      await signIn(parsed.data.email.trim().toLowerCase(), parsed.data.password);
      toast.success("Welcome to RupeeDial One");
      setTimeout(() => navigate({ to: destination as "/dashboard" }), 300);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Invalid login credentials");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-page min-h-svh bg-[#f5fcf7] p-3 sm:p-4 lg:p-6 flex flex-col">
      <div className="flex-1 min-h-0 max-w-[1100px] w-full mx-auto grid grid-cols-1 lg:grid-cols-[0.92fr_1.08fr] rounded-2xl overflow-hidden border border-[#d8ecdd] bg-white shadow-[0_16px_50px_rgba(16,102,42,0.08)]">
        {/* Left — RupeeDial brand panel */}
        <div
          className="hidden lg:flex relative text-white p-8 xl:p-10 flex-col justify-between overflow-hidden"
          style={{
            background: "linear-gradient(160deg, #0D4F20 0%, #10662A 45%, #0d5a26 100%)",
          }}
        >
          <div
            className="absolute inset-0 opacity-30"
            style={{
              backgroundImage:
                "linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)",
              backgroundSize: "40px 40px",
            }}
          />
          <div className="absolute -right-16 -bottom-16 size-56 rounded-full bg-white/10 blur-3xl" />

          <div className="relative flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2.5 group">
              <span className="size-9 rounded-full bg-white grid place-items-center text-[#10662A] font-display font-bold text-sm group-hover:scale-105 transition-transform">
                R
              </span>
              <span className="font-display font-bold text-base lowercase tracking-tight">
                rupeedial <span className="normal-case font-semibold text-white/90">One</span>
              </span>
            </Link>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/10 border border-white/15 text-[10px] font-semibold">
              <ShieldCheck className="size-3 text-[#E8F7EC]" />
              Secure CRM
            </span>
          </div>

          <div className="relative space-y-6">
            <div>
              <h2 className="font-display text-3xl xl:text-[2rem] font-extrabold leading-tight tracking-tight">
                Loan leads to
                <br />
                <span className="text-[#E8F7EC]">disbursal</span> — in One.
              </h2>
              <p className="mt-3 text-white/70 text-sm max-w-sm leading-relaxed">
                Marketplace buy · full form auto-fill · live pipeline for every RupeeDial product.
              </p>
            </div>

            <ul className="space-y-2 max-w-xs">
              {["New → Disbursed pipeline", "Website leads with full details", "Retail · MSME · Trade finance"].map(
                (t) => (
                  <li
                    key={t}
                    className="flex items-center gap-2.5 rounded-xl bg-white/10 border border-white/10 px-3 py-2.5 text-xs font-medium text-white/90"
                  >
                    <span className="size-1.5 rounded-full bg-[#E8F7EC] shrink-0" />
                    {t}
                  </li>
                ),
              )}
            </ul>
          </div>

          <p className="relative text-[10px] text-white/40">© {new Date().getFullYear()} RupeeDial One</p>
        </div>

        {/* Right — form */}
        <div className="flex flex-col bg-white min-h-0">
          <div className="lg:hidden shrink-0 flex items-center justify-between px-5 py-3 border-b border-[#d8ecdd]">
            <Link to="/" className="flex items-center gap-2">
              <span className="size-8 rounded-full bg-[#10662A] grid place-items-center text-white font-display font-bold text-xs">
                R
              </span>
              <span className="font-display font-bold text-sm text-[#10662A] lowercase">
                rupeedial <span className="normal-case text-[#390A5D]">One</span>
              </span>
            </Link>
          </div>

          <div className="flex-1 min-h-0 flex flex-col justify-center px-5 sm:px-8 lg:px-10 py-6 sm:py-8">
            <div className="w-full max-w-[400px] mx-auto flex flex-col gap-4">
              <div className="flex p-1 rounded-xl bg-[#E8F7EC] border border-[#d8ecdd]">
                {(["signin", "signup"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => {
                      setMode(m);
                      setForgotOpen(false);
                    }}
                    className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-all ${
                      mode === m
                        ? "bg-[#10662A] text-white shadow-sm"
                        : "text-[#10662A]/70 hover:text-[#10662A]"
                    }`}
                  >
                    {m === "signin" ? "Sign in" : "Create account"}
                  </button>
                ))}
              </div>

              <div>
                <h1 className="font-display text-2xl sm:text-[1.65rem] font-extrabold tracking-tight text-[#390A5D]">
                  {mode === "signin" ? "Welcome back" : "Create your account"}
                </h1>
                <p className="mt-1 text-sm text-[#5c4d72]">
                  {mode === "signin"
                    ? "Sign in to RupeeDial One CRM"
                    : "Admin-managed accounts on Docker CRM"}
                </p>
              </div>

              <form onSubmit={onSubmit} className="space-y-3">
                {mode === "signup" && (
                  <div className="grid grid-cols-2 gap-2.5">
                    <Field label="Name">
                      <input
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        className="rd-auth-input"
                        placeholder="Rahul Sharma"
                      />
                    </Field>
                    <Field label="Phone">
                      <input
                        type="tel"
                        inputMode="numeric"
                        autoComplete="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value.replace(/[^\d+\s-]/g, ""))}
                        className="rd-auth-input"
                        placeholder="9876543210"
                        maxLength={14}
                      />
                    </Field>
                  </div>
                )}

                <Field label="Email">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="rd-auth-input"
                    placeholder="you@company.com"
                    required
                  />
                </Field>

                <Field label="Password">
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="rd-auth-input pr-10"
                      placeholder="••••••••"
                      required
                      autoComplete={mode === "signin" ? "current-password" : "new-password"}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#5c4d72] hover:text-[#10662A]"
                      aria-label={showPassword ? "Hide" : "Show"}
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                  {mode === "signin" ? (
                    <div className="mt-1.5 flex justify-end">
                      <button
                        type="button"
                        onClick={() => setForgotOpen((v) => !v)}
                        className="text-[11px] text-[#10662A] font-bold hover:underline"
                      >
                        Forgot password?
                      </button>
                    </div>
                  ) : (
                    <p className="mt-1 text-[11px] text-[#5c4d72]">8+ characters required</p>
                  )}
                </Field>

                {mode === "signin" && forgotOpen && (
                  <div className="rounded-xl border border-[#d8ecdd] bg-[#f5fcf7] p-3 text-xs text-[#5c4d72]">
                    <p className="font-semibold text-[#390A5D]">Reset by your admin</p>
                    <p className="mt-1">
                      Ask your RupeeDial admin or call support at{" "}
                      <a href="tel:+917982953129" className="font-semibold text-[#10662A]">+91 79829 53129</a>{" "}
                      to get a temporary password. Sign in with it, then set your own from Settings → Change password.
                    </p>
                  </div>
                )}

                {mode === "signup" && (
                  <Field label="I am a">
                    <select
                      value={role}
                      onChange={(e) => setRole(e.target.value as AppRole)}
                      className="rd-auth-input"
                    >
                      {ROLES.map((r) => (
                        <option key={r.value} value={r.value}>
                          {r.label}
                        </option>
                      ))}
                    </select>
                    <p className="mt-1 text-[11px] text-[#5c4d72] leading-snug">
                      {ROLES.find((r) => r.value === role)?.hint}
                    </p>
                  </Field>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full h-11 rounded-xl bg-gradient-to-r from-[#10662A] via-[#0d5a26] to-[#0D4F20] hover:from-[#0D4F20] hover:to-[#0D4F20] text-white text-sm font-bold shadow-[0_8px_24px_rgba(16,102,42,0.28)] disabled:opacity-60 inline-flex items-center justify-center gap-2 group transition-all"
                >
                  {submitting ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <>
                      {mode === "signin" ? "Sign in to One" : "Create account"}
                      <ArrowRight className="size-4 group-hover:translate-x-0.5 transition-transform" />
                    </>
                  )}
                </button>
              </form>

              <Link
                to="/become-partner"
                className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl border-2 border-[#10662A]/40 text-[#10662A] text-xs font-bold hover:bg-[#E8F7EC] transition-colors"
              >
                <Sparkles className="size-3.5" />
                Apply as DSA Partner
              </Link>

              <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[10px] text-[#5c4d72] pt-1">
                <span className="inline-flex items-center gap-1 font-medium">
                  <Lock className="size-3 text-[#10662A]" /> SSL secure
                </span>
                <span className="font-medium">KYC · India</span>
                <Link to="/" className="font-bold text-[#10662A] hover:underline">
                  ← Back to home
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[10px] font-bold uppercase tracking-wide text-[#5c4d72]">{label}</span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}
