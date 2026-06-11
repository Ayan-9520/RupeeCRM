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

const ROLES: { value: AppRole; label: string; desc: string }[] = [
  { value: "dsa", label: "DSA Partner", desc: "Buy leads, manage pipeline" },
  { value: "caller", label: "Telecaller", desc: "Call & qualify leads" },
  { value: "coordinator", label: "Sales Coordinator", desc: "Submit cases to lenders" },
  { value: "lender", label: "Lender (Bank/NBFC)", desc: "Approve and disburse" },
  { value: "affiliate", label: "Affiliate / Influencer", desc: "Earn via referrals" },
  { value: "customer", label: "Customer", desc: "Apply for a loan" },
];

const signupSchema = z.object({
  full_name: z.string().trim().min(2, "Name too short").max(80),
  email: z.string().trim().email("Invalid email").max(255),
  phone: z.string().trim().min(8).max(20),
  password: z.string().min(6, "Min 6 characters").max(72),
  role: z.enum(["dsa", "caller", "coordinator", "lender", "affiliate", "customer"]),
});

const signinSchema = z.object({
  email: z.string().trim().email("Invalid email").max(255),
  password: z.string().min(1, "Password required").max(72),
});

function AuthPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
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
      if (error) {
        toast.error(error.message);
      } else {
        toast.success("Reset link sent. Check your email.");
        setForgotOpen(false);
      }
    } finally {
      setForgotSubmitting(false);
    }
  };

  useEffect(() => {
    if (!loading && user) {
      navigate({ to: "/dashboard" });
    }
  }, [user, loading, navigate]);

  if (loading || (!loading && user)) {
    return (
      <div className="min-h-screen grid place-items-center bg-background wa-pattern p-6">
        <div className="auth-card flex flex-col items-center gap-3 text-muted-foreground px-10 py-12">
          <Loader2 className="size-8 animate-spin text-[var(--wa-green)]" />
          <p className="text-sm font-medium">Restoring your session…</p>
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
          toast.error(parsed.error.issues[0].message);
          setSubmitting(false);
          return;
        }
        const redirectUrl = `${window.location.origin}/dashboard`;
        const { error } = await supabase.auth.signUp({
          email: parsed.data.email,
          password: parsed.data.password,
          options: {
            emailRedirectTo: redirectUrl,
            data: {
              full_name: parsed.data.full_name,
              phone: parsed.data.phone,
              role: parsed.data.role,
            },
          },
        });
        if (error) {
          toast.error(error.message);
        } else {
          toast.success("Account created! Welcome to LeadMines 🎉");
          setTimeout(() => navigate({ to: "/dashboard" }), 500);
        }
      } else {
        const parsed = signinSchema.safeParse({ email, password });
        if (!parsed.success) {
          toast.error(parsed.error.issues[0].message);
          setSubmitting(false);
          return;
        }
        const { error } = await supabase.auth.signInWithPassword({
          email: parsed.data.email,
          password: parsed.data.password,
        });
        if (error) {
          toast.error(error.message);
        } else {
          toast.success("Welcome back!");
          setTimeout(() => navigate({ to: "/dashboard" }), 500);
        }
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen wa-pattern p-4 sm:p-5 md:p-6 lg:p-8">
      {/* Top bar */}
      <div className="max-w-[1280px] mx-auto flex items-center justify-between mb-4 sm:mb-5">
        <Link to="/" className="flex items-center gap-2 group">
          <div className="size-8 sm:size-9 rounded-full bg-[var(--wa-green)] grid place-items-center shadow-mint group-hover:scale-105 transition-smooth">
            <MessageCircle className="size-4 sm:size-5 text-white" fill="white" fillOpacity={0.15} />
          </div>
          <span className="font-display font-bold text-sm sm:text-base">LeadMines</span>
        </Link>
        <ThemeToggle />
      </div>

      {/* Main shell — margins on all sides */}
      <div className="max-w-[1280px] mx-auto auth-shell grid lg:grid-cols-[1fr_1.05fr] min-h-[calc(100vh-5.5rem)] max-h-[920px]">
        {/* Left brand panel */}
        <div className="hidden lg:flex relative wa-header-bar text-white p-10 xl:p-12 flex-col justify-between overflow-hidden">
          <div className="absolute inset-0 wa-pattern opacity-[0.07]" />
          <div className="absolute -top-24 -right-24 size-80 rounded-full bg-[var(--wa-green)]/25 blur-3xl" />
          <div className="absolute bottom-0 left-0 w-full h-1/2 bg-gradient-to-t from-black/20 to-transparent" />

          <div className="relative">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 border border-white/15 text-[11px] font-semibold">
              <ShieldCheck className="size-3.5 text-[var(--wa-green)]" />
              Bank-grade secure · RBI-ready CRM
            </div>
          </div>

          <div className="relative space-y-8">
            <div>
              <h2 className="font-display text-3xl xl:text-4xl font-bold leading-[1.15] tracking-tight">
                Mine your next{" "}
                <span className="text-[var(--wa-green)]">₹1 Cr</span> with AI-verified leads.
              </h2>
              <p className="mt-4 text-white/75 text-sm xl:text-base max-w-md leading-relaxed">
                12,400+ DSAs, 60+ lenders, ₹420 Cr+ disbursed. Join the platform serious DSAs use every day.
              </p>
            </div>

            {/* Mini chat preview */}
            <div className="space-y-2.5 max-w-sm">
              <div className="wa-bubble-in px-4 py-3 text-[13px] text-foreground/90 !rounded-2xl !rounded-tl-sm">
                🔥 Hot lead: Personal Loan · ₹8L · Mumbai
                <div className="flex justify-end items-center gap-1 mt-1 text-[10px] text-[var(--wa-muted)]">
                  10:24 <CheckCheck className="size-3 text-[var(--wa-tick)]" />
                </div>
              </div>
              <div className="wa-bubble-out px-4 py-2.5 text-[13px] ml-auto max-w-[85%] !rounded-2xl !rounded-tr-sm">
                Purchased! CRM profile created ✓
              </div>
            </div>

            <div className="flex items-center gap-8">
              <div>
                <div className="text-2xl xl:text-3xl font-display font-bold">₹500</div>
                <div className="text-white/55 text-xs mt-0.5">Welcome wallet bonus</div>
              </div>
              <div className="h-10 w-px bg-white/15" />
              <div>
                <div className="text-2xl xl:text-3xl font-display font-bold">14d</div>
                <div className="text-white/55 text-xs mt-0.5">Free trial</div>
              </div>
              <div className="h-10 w-px bg-white/15" />
              <div>
                <div className="text-2xl xl:text-3xl font-display font-bold">98%</div>
                <div className="text-white/55 text-xs mt-0.5">Lead verification</div>
              </div>
            </div>
          </div>

          <p className="relative text-[11px] text-white/40">© 2026 MoneyMines Pvt Ltd. All rights reserved.</p>
        </div>

        {/* Right form panel */}
        <div className="flex flex-col bg-card overflow-hidden">
          <div className="flex-1 overflow-y-auto p-6 sm:p-8 lg:p-10 xl:p-12">
            <div className="w-full max-w-[420px] mx-auto">
              {/* Mode toggle */}
              <div className="flex p-1 rounded-2xl bg-secondary border border-border mb-8">
                {(["signin", "signup"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMode(m)}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-smooth ${
                      mode === m
                        ? "bg-[var(--wa-green)] text-white shadow-mint"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {m === "signin" ? "Sign in" : "Create account"}
                  </button>
                ))}
              </div>

              <div className="mb-7">
                <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight">
                  {mode === "signin" ? "Welcome back" : "Create your account"}
                </h1>
                <p className="mt-2 text-sm text-muted-foreground">
                  {mode === "signin"
                    ? "Sign in to your DSA dashboard"
                    : "Get ₹500 free wallet credit. No card required."}
                </p>
              </div>

              <form onSubmit={onSubmit} className="space-y-4">
                {mode === "signup" && (
                  <>
                    <Field label="Full name">
                      <input
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        className="auth-input"
                        placeholder="Rahul Sharma"
                      />
                    </Field>
                    <Field label="Phone">
                      <input
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="auth-input"
                        placeholder="+91 98765 43210"
                      />
                    </Field>
                  </>
                )}

                <Field label="Email">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="auth-input"
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
                      className="auth-input pr-11"
                      placeholder="••••••••"
                      required
                      autoComplete={mode === "signin" ? "current-password" : "new-password"}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-[var(--wa-green)] transition-smooth"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                  {mode === "signup" && (
                    <p className="mt-1.5 text-[11px] text-muted-foreground">
                      Use 8+ characters with a mix of letters, numbers & symbols.
                    </p>
                  )}
                  {mode === "signin" && (
                    <div className="mt-2 text-right">
                      <button
                        type="button"
                        onClick={() => {
                          setForgotEmail(email);
                          setForgotOpen((v) => !v);
                        }}
                        className="text-xs text-[var(--wa-green)] font-semibold hover:underline"
                      >
                        Forgot password?
                      </button>
                    </div>
                  )}
                </Field>

                {mode === "signin" && forgotOpen && (
                  <div className="rounded-2xl border border-[var(--wa-green)]/25 bg-[var(--wa-green)]/5 p-4 space-y-3">
                    <div className="text-sm font-semibold">Reset your password</div>
                    <p className="text-xs text-muted-foreground">We'll email you a secure link.</p>
                    <div className="flex gap-2">
                      <input
                        type="email"
                        value={forgotEmail}
                        onChange={(e) => setForgotEmail(e.target.value)}
                        className="auth-input flex-1 h-10"
                        placeholder="you@company.com"
                      />
                      <button
                        type="button"
                        onClick={onForgot}
                        disabled={forgotSubmitting}
                        className="h-10 px-4 rounded-xl bg-[var(--wa-green)] text-white text-sm font-semibold hover:bg-[var(--wa-green-dark)] transition-smooth disabled:opacity-60 inline-flex items-center gap-2 shrink-0"
                      >
                        {forgotSubmitting && <Loader2 className="size-3.5 animate-spin" />}
                        Send
                      </button>
                    </div>
                  </div>
                )}

                {mode === "signup" && (
                  <Field label="I am a">
                    <div className="grid grid-cols-2 gap-2">
                      {ROLES.map((r) => (
                        <button
                          type="button"
                          key={r.value}
                          onClick={() => setRole(r.value)}
                          className={`text-left p-3 rounded-xl border-2 transition-smooth ${
                            role === r.value
                              ? "border-[var(--wa-green)] bg-[var(--wa-green)]/8 shadow-sm"
                              : "border-border hover:border-[var(--wa-green)]/40 bg-card"
                          }`}
                        >
                          <div className="text-xs sm:text-sm font-semibold leading-tight">{r.label}</div>
                          <div className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 leading-snug">{r.desc}</div>
                        </button>
                      ))}
                    </div>
                  </Field>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full h-12 rounded-2xl bg-[var(--wa-green)] hover:bg-[var(--wa-green-dark)] text-white font-semibold transition-smooth shadow-mint disabled:opacity-60 inline-flex items-center justify-center gap-2 mt-2 group"
                >
                  {submitting ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <>
                      {mode === "signin" ? "Sign in" : "Create account"}
                      <ArrowRight className="size-4 group-hover:translate-x-0.5 transition-smooth" />
                    </>
                  )}
                </button>
              </form>

              <div className="mt-8 pt-6 border-t border-border">
                <Link
                  to="/become-partner"
                  className="flex items-center justify-center gap-2 w-full py-3.5 rounded-2xl border-2 border-[var(--wa-green)]/40 text-[var(--wa-teal)] dark:text-[var(--wa-green)] text-sm font-semibold hover:bg-[var(--wa-green)]/8 transition-smooth"
                >
                  <Sparkles className="size-4" />
                  Apply as DSA Partner — Get your DSA ID
                </Link>
                <p className="mt-2.5 text-[11px] text-center text-muted-foreground">
                  Public KYC · Auto-approval in 24h · No upfront fees
                </p>
              </div>
            </div>
          </div>

          {/* Trust footer strip */}
          <div className="shrink-0 px-6 sm:px-8 py-3 border-t border-border bg-secondary/40 flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="size-3 text-[var(--wa-green)]" /> 256-bit SSL
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCheck className="size-3 text-[var(--wa-tick)]" /> WhatsApp alerts
            </span>
            <span>Made in India 🇮🇳</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
      <div className="mt-2">{children}</div>
    </label>
  );
}
