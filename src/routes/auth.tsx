import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import {
  MessageCircle,
  Loader2,
  Eye,
  EyeOff,
  ShieldCheck,
  CheckCheck,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import type { AppRole } from "@/lib/auth-context";
import { ThemeToggle } from "@/components/landing/ThemeToggle";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in or create account — LeadMines" },
      {
        name: "description",
        content: "Access your LeadMines dashboard. DSA partners, lenders, callers and admins log in here.",
      },
    ],
  }),
  component: AuthPage,
});

const ROLES: { value: AppRole; label: string; hint: string }[] = [
  { value: "dsa", label: "DSA Partner", hint: "Buy leads & run your pipeline. KYC via Become a Partner for verified DSA ID." },
  { value: "caller", label: "Telecaller", hint: "Call queue, scripts & lead qualification." },
  { value: "coordinator", label: "Sales Coordinator", hint: "Documents, submissions & lender routing." },
  { value: "lender", label: "Lender (Bank/NBFC)", hint: "Review cases & update disbursal status." },
  { value: "affiliate", label: "Affiliate / Influencer", hint: "Referral links & commission tracking." },
  { value: "customer", label: "Customer", hint: "Track your loan application & upload docs." },
];

const signupSchema = z.object({
  full_name: z.string().trim().min(2, "Enter your full name").max(80),
  email: z.string().trim().email("Enter a valid email").max(255),
  phone: z
    .string()
    .trim()
    .transform((v) => v.replace(/\D/g, ""))
    .pipe(z.string().regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit Indian mobile number")),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(72, "Password is too long"),
  role: z.enum(["dsa", "caller", "coordinator", "lender", "affiliate", "customer"]),
});

function formatSignupError(err: z.ZodError): string {
  const issue = err.issues[0];
  return issue?.message ?? "Please check the form and try again.";
}

const signinSchema = z.object({
  email: z.string().trim().email("Invalid email").max(255),
  password: z.string().min(1, "Password required").max(72),
});

function AuthPage() {
  const navigate = useNavigate();
  const { user, loading, refreshRole } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [submitting, setSubmitting] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<AppRole>("dsa");
  const [showPassword, setShowPassword] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotSubmitting, setForgotSubmitting] = useState(false);

  const onForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    const target = forgotEmail.trim() || email.trim();
    if (!target || !/^\S+@\S+\.\S+$/.test(target)) {
      toast.error("Enter a valid email");
      return;
    }
    setForgotSubmitting(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(target, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) toast.error(error.message);
      else {
        toast.success("Reset link sent. Check your email.");
        setForgotOpen(false);
      }
    } finally {
      setForgotSubmitting(false);
    }
  };

  useEffect(() => {
    if (!loading && user) navigate({ to: "/dashboard" });
  }, [user, loading, navigate]);

  if (loading || (!loading && user)) {
    return (
      <div className="auth-page grid place-items-center wa-pattern p-4">
        <div className="auth-card flex flex-col items-center gap-2 text-muted-foreground px-8 py-8">
          <Loader2 className="size-7 animate-spin text-[var(--wa-green)]" />
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
        const parsed = signupSchema.safeParse({ full_name: fullName, email, phone, password, role });
        if (!parsed.success) {
          toast.error(formatSignupError(parsed.error));
          return;
        }
        const { data, error } = await supabase.auth.signUp({
          email: parsed.data.email.trim().toLowerCase(),
          password: parsed.data.password,
          options: {
            emailRedirectTo: `${window.location.origin}/dashboard`,
            data: {
              full_name: parsed.data.full_name,
              phone: parsed.data.phone,
              role: parsed.data.role,
            },
          },
        });
        if (error) {
          toast.error(error.message);
          return;
        }
        if (data.session) {
          await refreshRole();
          toast.success(`Welcome! Your ${ROLES.find((r) => r.value === parsed.data.role)?.label ?? "account"} dashboard is ready.`);
          setTimeout(() => navigate({ to: "/dashboard" }), 400);
        } else {
          toast.success("Account created! Check your email to confirm, then sign in.");
          setMode("signin");
        }
      } else {
        const parsed = signinSchema.safeParse({ email, password });
        if (!parsed.success) {
          toast.error(parsed.error.issues[0].message);
          return;
        }
        const { error } = await supabase.auth.signInWithPassword({
          email: parsed.data.email.trim().toLowerCase(),
          password: parsed.data.password,
        });
        if (error) toast.error(error.message);
        else {
          await refreshRole();
          toast.success("Welcome back!");
          setTimeout(() => navigate({ to: "/dashboard" }), 400);
        }
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-page wa-pattern p-3 sm:p-4 lg:p-5 flex flex-col">
      <div className="flex-1 min-h-0 max-w-[1200px] w-full mx-auto auth-shell grid grid-cols-1 lg:grid-cols-[0.95fr_1.05fr]">
        {/* Left — compact brand */}
        <div className="hidden lg:flex relative wa-header-bar text-white p-6 xl:p-8 flex-col justify-between overflow-hidden min-h-0">
          <div className="absolute inset-0 wa-pattern opacity-[0.06]" />
          <div className="absolute -top-20 -right-20 size-64 rounded-full bg-[var(--wa-green)]/20 blur-3xl" />

          <div className="relative flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2 group">
              <div className="size-8 rounded-full bg-white/15 grid place-items-center group-hover:scale-105 transition-smooth">
                <MessageCircle className="size-4 text-white" fill="white" fillOpacity={0.15} />
              </div>
              <span className="font-display font-bold text-sm">LeadMines</span>
            </Link>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/10 border border-white/15 text-[10px] font-semibold">
              <ShieldCheck className="size-3 text-[var(--wa-green)]" />
              RBI-ready CRM
            </div>
          </div>

          <div className="relative space-y-4">
            <div>
              <h2 className="font-display text-2xl xl:text-[1.75rem] font-bold leading-tight tracking-tight">
                Mine your next <span className="text-[var(--wa-green)]">₹1 Cr</span>
                <br />
                with AI-verified leads.
              </h2>
              <p className="mt-2 text-white/70 text-xs xl:text-sm max-w-sm leading-relaxed">
                12,400+ DSAs · 60+ lenders · ₹420 Cr+ disbursed.
              </p>
            </div>

            <div className="space-y-1.5 max-w-[280px]">
              <div className="wa-bubble-in px-3 py-2 text-[11px] text-foreground/90 !rounded-xl !rounded-tl-sm">
                🔥 Hot lead: PL · ₹8L · Mumbai
                <span className="float-right text-[9px] text-[var(--wa-muted)] ml-2">
                  10:24 <CheckCheck className="size-2.5 inline text-[var(--wa-tick)]" />
                </span>
              </div>
              <div className="wa-bubble-out px-3 py-1.5 text-[11px] ml-auto max-w-[78%] !rounded-xl !rounded-tr-sm">
                Purchased! CRM created ✓
              </div>
            </div>

            <div className="flex items-center gap-4">
              {[
                { v: "₹500", l: "Welcome bonus" },
                { v: "14d", l: "Free trial" },
                { v: "98%", l: "Verified" },
              ].map((s, i) => (
                <div key={s.l} className="contents">
                  {i > 0 && <div className="h-7 w-px bg-white/15" />}
                  <div>
                    <div className="text-lg xl:text-xl font-display font-bold">{s.v}</div>
                    <div className="text-white/50 text-[10px]">{s.l}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <p className="relative text-[10px] text-white/35">© 2026 MoneyMines Pvt Ltd.</p>
        </div>

        {/* Right — form, no scroll */}
        <div className="flex flex-col bg-card min-h-0 flex-1 lg:flex-none">
          {/* Mobile header */}
          <div className="lg:hidden shrink-0 flex items-center justify-between px-4 py-2.5 border-b border-border">
            <Link to="/" className="flex items-center gap-2">
              <div className="size-7 rounded-full bg-[var(--wa-green)] grid place-items-center">
                <MessageCircle className="size-3.5 text-white" fill="white" fillOpacity={0.15} />
              </div>
              <span className="font-display font-bold text-sm">LeadMines</span>
            </Link>
            <ThemeToggle />
          </div>

          <div className="flex-1 min-h-0 flex flex-col justify-center px-4 sm:px-6 lg:px-8 py-3 sm:py-4">
            <div className="w-full max-w-[400px] mx-auto flex flex-col gap-3 sm:gap-3.5">
              {/* Top row: toggle + theme (desktop) */}
              <div className="flex items-center gap-3">
                <div className="flex-1 flex p-0.5 rounded-xl bg-secondary border border-border">
                  {(["signin", "signup"] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => {
                        setMode(m);
                        setForgotOpen(false);
                      }}
                      className={`flex-1 py-2 rounded-[0.65rem] text-xs font-semibold transition-smooth ${
                        mode === m
                          ? "bg-[var(--wa-green)] text-white shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {m === "signin" ? "Sign in" : "Create account"}
                    </button>
                  ))}
                </div>
                <div className="hidden lg:block shrink-0">
                  <ThemeToggle />
                </div>
              </div>

              <div>
                <h1 className="font-display text-xl sm:text-2xl font-bold tracking-tight leading-tight">
                  {mode === "signin" ? "Welcome back" : "Create your account"}
                </h1>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {mode === "signin"
                    ? "Sign in to your DSA dashboard"
                    : "₹500 free wallet credit · No card required"}
                </p>
              </div>

              <form onSubmit={onSubmit} className="space-y-2.5">
                {mode === "signup" && (
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="Name" compact>
                      <input
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        className="auth-input"
                        placeholder="Rahul Sharma"
                      />
                    </Field>
                    <Field label="Phone" compact>
                      <input
                        type="tel"
                        inputMode="numeric"
                        autoComplete="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value.replace(/[^\d+\s-]/g, ""))}
                        className="auth-input"
                        placeholder="9876543210"
                        maxLength={14}
                      />
                    </Field>
                  </div>
                )}

                <Field label="Email" compact>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="auth-input"
                    placeholder="you@company.com"
                    required
                  />
                </Field>

                <Field label="Password" compact>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="auth-input pr-9"
                      placeholder="••••••••"
                      required
                      autoComplete={mode === "signin" ? "current-password" : "new-password"}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-[var(--wa-green)]"
                      aria-label={showPassword ? "Hide" : "Show"}
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                    </button>
                  </div>
                  {mode === "signin" ? (
                    <div className="mt-1 flex justify-end">
                      <button
                        type="button"
                        onClick={() => {
                          setForgotEmail(email);
                          setForgotOpen((v) => !v);
                        }}
                        className="text-[10px] text-[var(--wa-green)] font-semibold hover:underline"
                      >
                        Forgot password?
                      </button>
                    </div>
                  ) : (
                    <p className="mt-0.5 text-[10px] text-muted-foreground">8+ chars · letters, numbers & symbols</p>
                  )}
                </Field>

                {mode === "signin" && forgotOpen && (
                  <div className="flex gap-1.5">
                    <input
                      type="email"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      className="auth-input flex-1"
                      placeholder="Email for reset link"
                    />
                    <button
                      type="button"
                      onClick={onForgot}
                      disabled={forgotSubmitting}
                      className="h-10 px-3 rounded-lg bg-[var(--wa-green)] text-white text-xs font-semibold shrink-0 disabled:opacity-60 inline-flex items-center gap-1"
                    >
                      {forgotSubmitting ? <Loader2 className="size-3 animate-spin" /> : "Send"}
                    </button>
                  </div>
                )}

                {mode === "signup" && (
                  <Field label="I am a" compact>
                    <select
                      value={role}
                      onChange={(e) => setRole(e.target.value as AppRole)}
                      className="auth-select"
                    >
                      {ROLES.map((r) => (
                        <option key={r.value} value={r.value}>
                          {r.label}
                        </option>
                      ))}
                    </select>
                    <p className="mt-1 text-[10px] text-muted-foreground leading-snug">
                      {ROLES.find((r) => r.value === role)?.hint}
                    </p>
                  </Field>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full h-10 rounded-xl bg-[var(--wa-green)] hover:bg-[var(--wa-green-dark)] text-white text-sm font-semibold shadow-mint disabled:opacity-60 inline-flex items-center justify-center gap-1.5 group"
                >
                  {submitting ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <>
                      {mode === "signin" ? "Sign in" : "Create account"}
                      <ArrowRight className="size-3.5 group-hover:translate-x-0.5 transition-smooth" />
                    </>
                  )}
                </button>
              </form>

              <Link
                to="/become-partner"
                className="flex items-center justify-center gap-1.5 w-full py-2 rounded-xl border border-[var(--wa-green)]/35 text-[var(--wa-teal)] dark:text-[var(--wa-green)] text-xs font-semibold hover:bg-[var(--wa-green)]/6 transition-smooth"
              >
                <Sparkles className="size-3.5" />
                Apply as DSA Partner
              </Link>

              <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-0.5 text-[9px] text-muted-foreground pt-0.5">
                <span className="flex items-center gap-1">
                  <ShieldCheck className="size-2.5 text-[var(--wa-green)]" /> SSL
                </span>
                <span className="flex items-center gap-1">
                  <CheckCheck className="size-2.5 text-[var(--wa-tick)]" /> WhatsApp
                </span>
                <span>KYC · 24h approval</span>
                <span>🇮🇳 India</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
  compact,
}: {
  label: string;
  children: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <label className="block">
      <span
        className={`font-semibold uppercase tracking-wide text-muted-foreground ${
          compact ? "text-[10px]" : "text-xs"
        }`}
      >
        {label}
      </span>
      <div className={compact ? "mt-1" : "mt-1.5"}>{children}</div>
    </label>
  );
}
