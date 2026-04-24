import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { Sparkles, Loader2, Eye, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import type { AppRole } from "@/lib/auth-context";

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
    console.log("Auth state:", { user, loading });
  }, [user, loading]);

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
          setTimeout(() => {
            navigate({ to: "/dashboard" });
          }, 500);
        }
      } else {
        const parsed = signinSchema.safeParse({ email, password });
        if (!parsed.success) {
          toast.error(parsed.error.issues[0].message);
          setSubmitting(false);
          return;
        }
        const { data, error } = await supabase.auth.signInWithPassword({
          email: parsed.data.email,
          password: parsed.data.password,
        });

        if (error) {
          toast.error(error.message);
        } else {
          console.log("LOGIN SUCCESS:", data);

          toast.success("Welcome back!");

          // 🔥 delay add करो (important)
          setTimeout(() => {
            navigate({ to: "/dashboard" });
          }, 500);
        }
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-background">
      {/* Left brand panel */}
      <div className="hidden lg:flex relative bg-hero-gradient text-white p-12 flex-col justify-between overflow-hidden">
        <div className="absolute inset-0 grid-bg opacity-20" />
        <div className="absolute -top-32 -right-32 size-96 rounded-full bg-[oklch(0.78_0.16_165_/_0.3)] blur-3xl" />

        <Link to="/" className="relative flex items-center gap-2.5">
          <div className="size-9 rounded-xl bg-mint-gradient grid place-items-center shadow-mint">
            <Sparkles className="size-5 text-primary" strokeWidth={2.5} />
          </div>
          <div className="leading-tight">
            <div className="font-display font-bold tracking-tight">LeadMines</div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-white/60 -mt-0.5">by MoneyMines</div>
          </div>
        </Link>

        <div className="relative">
          <h2 className="font-display text-4xl font-bold leading-tight">
            Mine your next <span className="text-gradient">₹1 Cr</span> with AI-verified leads.
          </h2>
          <p className="mt-4 text-white/75 max-w-md">
            12,400+ DSAs, 60+ lenders, ₹420 Cr+ disbursed. Join the platform serious DSAs use every day.
          </p>
          <div className="mt-8 flex items-center gap-6 text-sm">
            <div>
              <div className="text-2xl font-bold">₹500</div>
              <div className="text-white/60">Welcome wallet bonus</div>
            </div>
            <div className="h-10 w-px bg-white/20" />
            <div>
              <div className="text-2xl font-bold">14d</div>
              <div className="text-white/60">Free trial</div>
            </div>
          </div>
        </div>

        <p className="relative text-xs text-white/50">© 2026 MoneyMines Pvt Ltd. All rights reserved.</p>
      </div>

      {/* Right form */}
      <div className="flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-md">
          <Link to="/" className="lg:hidden mb-8 flex items-center gap-2.5 justify-center">
            <div className="size-9 rounded-xl bg-mint-gradient grid place-items-center shadow-mint">
              <Sparkles className="size-5 text-primary" strokeWidth={2.5} />
            </div>
            <span className="font-display font-bold text-lg">LeadMines</span>
          </Link>

          <h1 className="font-display text-3xl font-bold tracking-tight">
            {mode === "signin" ? "Welcome back" : "Create your account"}
          </h1>
          <p className="mt-2 text-muted-foreground">
            {mode === "signin" ? "Sign in to your dashboard" : "Get ₹500 free wallet credit. No card required."}
          </p>

          <form onSubmit={onSubmit} className="mt-8 space-y-4">
            {mode === "signup" && (
              <>
                <Field label="Full name">
                  <input
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="input-base"
                    placeholder="Rahul Sharma"
                  />
                </Field>
                <Field label="Phone">
                  <input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="input-base"
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
                className="input-base"
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
                  className="input-base pr-10"
                  placeholder="••••••••"
                  required
                  autoComplete={mode === "signin" ? "current-password" : "new-password"}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-smooth"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
              {mode === "signup" && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Use 8+ characters with a mix of letters, numbers & symbols.
                </p>
              )}
              {mode === "signin" && (
                <div className="mt-1.5 text-right">
                  <button
                    type="button"
                    onClick={() => {
                      setForgotEmail(email);
                      setForgotOpen((v) => !v);
                    }}
                    className="text-xs text-accent font-medium hover:underline"
                  >
                    Forgot password?
                  </button>
                </div>
              )}
            </Field>

            {mode === "signin" && forgotOpen && (
              <div className="rounded-xl border border-border bg-muted/30 p-3 space-y-2">
                <div className="text-sm font-medium">Reset your password</div>
                <p className="text-xs text-muted-foreground">We'll email you a secure link to set a new password.</p>
                <div className="flex gap-2">
                  <input
                    type="email"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    className="input-base flex-1"
                    placeholder="you@company.com"
                  />
                  <button
                    type="button"
                    onClick={onForgot}
                    disabled={forgotSubmitting}
                    className="h-10 px-4 rounded-full bg-foreground text-background text-sm font-semibold hover:opacity-90 transition-smooth disabled:opacity-60 inline-flex items-center gap-2"
                  >
                    {forgotSubmitting && <Loader2 className="size-3.5 animate-spin" />}
                    Send link
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
                        role === r.value ? "border-accent bg-accent/10" : "border-border hover:border-accent/50"
                      }`}
                    >
                      <div className="text-sm font-semibold">{r.label}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{r.desc}</div>
                    </button>
                  ))}
                </div>
              </Field>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full h-11 rounded-full bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-smooth shadow-card disabled:opacity-60 inline-flex items-center justify-center gap-2"
            >
              {submitting && <Loader2 className="size-4 animate-spin" />}
              {mode === "signin" ? "Sign in" : "Create account"}
            </button>
          </form>

          <p className="mt-6 text-sm text-center text-muted-foreground">
            {mode === "signin" ? "New to LeadMines?" : "Already have an account?"}{" "}
            <button
              onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
              className="text-accent font-semibold hover:underline"
            >
              {mode === "signin" ? "Create account" : "Sign in"}
            </button>
          </p>

          <div className="mt-6 pt-6 border-t border-border">
            <Link
              to="/become-partner"
              className="block w-full py-3 text-center rounded-full border-2 border-accent text-accent text-sm font-semibold hover:bg-accent/10 transition-smooth"
            >
              Apply as DSA Partner — Get your own DSA ID
            </Link>
            <p className="mt-2 text-xs text-center text-muted-foreground">
              Public KYC application · Auto-approval in 24h · No upfront fees
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-foreground">{label}</span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}
