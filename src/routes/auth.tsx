import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import { forgotPassword } from "@/lib/python-api";
import type { LoginDoor } from "@/lib/login-door";

const onLocal =
  typeof window !== "undefined" &&
  (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");

const WEBSITE_URL = onLocal ? "http://localhost:5173" : "https://rupeedial.com";
const WEBSITE_API = onLocal
  ? "http://localhost:8090/rupeedial-backend/public/index.php"
  : "https://rupeedial.com/rupeedial-backend/public/index.php";

const PARTNER_TYPES = [
  ["dsa", "DSA"],
  ["sub_dsa", "Sub-DSA"],
  ["loan_consultant", "Loan Consultant"],
  ["ca", "CA"],
  ["gst_consultant", "GST Consultant"],
  ["insurance_advisor", "Insurance Advisor"],
  ["property_consultant", "Property Consultant"],
  ["telecaller", "Telecaller"],
  ["telecalling_agency", "Telecalling Agency"],
  ["freelancer", "Freelancer"],
  ["referral", "Referral Partner"],
] as const;

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — RupeeOne" },
      {
        name: "description",
        content: "Sign in to RupeeOne CRM, or create a RupeeDial partner account.",
      },
    ],
  }),
  validateSearch: (search: Record<string, unknown>): { next?: string; mode?: "signup"; door?: LoginDoor } => {
    const next = typeof search.next === "string" ? search.next : undefined;
    const mode = search.mode === "signup" ? "signup" : undefined;
    const door = search.door === "partner" || search.door === "employee" ? search.door : undefined;
    return {
      ...(next && next.startsWith("/") && !next.startsWith("//") ? { next } : {}),
      ...(mode && door !== "employee" ? { mode } : {}),
      ...(door ? { door } : {}),
    };
  },
  component: AuthPage,
});

const signinSchema = z.object({
  email: z.string().trim().email("Invalid email").max(255),
  password: z.string().min(1, "Password required").max(72),
});

const field =
  "mt-1.5 h-11 w-full rounded-xl border border-[#e6e2da] bg-white px-3.5 text-sm text-[#1c1915] outline-none focus:border-[#0e4d28]";

function AuthPage() {
  const navigate = useNavigate();
  const { user, loading, signIn } = useAuth();
  const { next, mode: startMode, door } = Route.useSearch();
  const [mode, setMode] = useState<"signin" | "signup">(startMode === "signup" ? "signup" : "signin");
  const [submitting, setSubmitting] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [fullName, setFullName] = useState("");
  const [mobile, setMobile] = useState("");
  const [city, setCity] = useState("");
  const [partnerType, setPartnerType] = useState("dsa");
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [formError, setFormError] = useState("");
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotBusy, setForgotBusy] = useState(false);
  const [forgotState, setForgotState] = useState<"idle" | "sent" | "unavailable">("idle");
  const destination = next ?? "/dashboard";

  useEffect(() => {
    if (!loading && user) navigate({ to: destination as "/dashboard" });
  }, [user, loading, navigate, destination]);

  const switchMode = (nextMode: "signin" | "signup") => {
    setMode(nextMode);
    setFormError("");
    setForgotOpen(false);
  };

  const sendReset = async () => {
    const value = forgotEmail.trim().toLowerCase();
    if (!z.string().email().safeParse(value).success) {
      toast.error("Enter the email you sign in with");
      return;
    }
    setForgotBusy(true);
    try {
      await forgotPassword(value);
      setForgotState("sent");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("not set up")) setForgotState("unavailable");
      else toast.error(msg || "Could not send reset email");
    } finally {
      setForgotBusy(false);
    }
  };

  const onSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFormError("");
    try {
      const parsed = signinSchema.safeParse({ email, password });
      if (!parsed.success) {
        setFormError(parsed.error.issues[0].message);
        return;
      }
      await signIn(parsed.data.email.trim().toLowerCase(), parsed.data.password, door);
      toast.success("Welcome to RupeeOne");
      setTimeout(() => navigate({ to: destination as "/dashboard" }), 300);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Invalid login credentials");
    } finally {
      setSubmitting(false);
    }
  };

  const onCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    if (fullName.trim().length < 2) return setFormError("Enter your full name");
    if (!/^[6-9]\d{9}$/.test(mobile)) return setFormError("Enter a 10-digit mobile number");
    if (!z.string().email().safeParse(email.trim()).success) return setFormError("Enter a valid email");
    if (city.trim().length < 2) return setFormError("Enter your city");
    setSubmitting(true);
    try {
      const body = new FormData();
      body.append("dsaType", partnerType);
      body.append("fullName", fullName.trim());
      body.append("mobile", mobile);
      body.append("email", email.trim());
      body.append("city", city.trim());
      body.append("state", "");
      body.append("profile", JSON.stringify({ source: "crm-auth" }));
      const res = await fetch(`${WEBSITE_API}?action=partner/apply`, { method: "POST", body });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success || !data?.leadId) {
        throw new Error(data?.message || "Could not create the account");
      }
      setCreatedId(String(data.leadId));
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not create the account");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || user) {
    return (
      <div className="auth-page grid min-h-svh place-items-center bg-[#f7f4ee] p-4">
        <div className="flex flex-col items-center gap-2 rounded-2xl bg-white px-8 py-8 text-[#5c4d72]">
          <Loader2 className="size-7 animate-spin text-[#0e4d28]" />
          <p className="text-sm font-medium">Restoring session…</p>
        </div>
      </div>
    );
  }

  if (!door) {
    return (
      <div className="auth-page relative grid min-h-svh place-items-center overflow-hidden bg-[#f7f4ee] px-4 py-10">
        <img src="/rupeeone-login-bg.jpg" alt="" className="pointer-events-none absolute inset-0 h-full w-full object-cover" />
        <div className="pointer-events-none absolute inset-0 bg-white/25" />
        <div className="relative w-full max-w-lg rounded-[28px] bg-white/95 p-8 text-center shadow-[0_24px_60px_rgba(16,102,42,0.12)]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#0e4d28]">RupeeOne</p>
          <h1 className="mt-3 font-display text-3xl font-bold text-[#1c1915]">Business CRM</h1>
          <p className="mt-2 text-sm text-[#6b645b]">Partners and employees use the same company login. Pick the door for your account.</p>
          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => navigate({ to: "/auth", search: { door: "partner", ...(next ? { next } : {}) } })}
              className="h-12 rounded-full bg-[#0e4d28] text-sm font-semibold text-white"
            >
              Partner Login
            </button>
            <button
              type="button"
              onClick={() => navigate({ to: "/auth", search: { door: "employee", ...(next ? { next } : {}) } })}
              className="h-12 rounded-full bg-[#0e4d28] text-sm font-semibold text-white"
            >
              Employee Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (door === "employee") {
    return (
      <div className="auth-page relative grid min-h-svh place-items-center overflow-hidden bg-[#f7f4ee] px-4 py-10">
        <img src="/rupeeone-login-bg.jpg" alt="" className="pointer-events-none absolute inset-0 h-full w-full object-cover" />
        <div className="pointer-events-none absolute inset-0 bg-white/25" />
        <form onSubmit={(event) => void onSignIn(event)} className="relative w-full max-w-md rounded-[28px] bg-white p-8 shadow-[0_24px_60px_rgba(16,102,42,0.12)]">
          <button type="button" onClick={() => navigate({ to: "/auth", search: next ? { next } : {} })} className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#0e4d28]">
            RupeeOne
          </button>
          <h1 className="mt-3 font-display text-2xl font-bold text-[#1c1915]">Employee sign in</h1>
          <p className="mt-1 text-sm text-[#6b645b]">Use the email and password from admin. Your department opens after sign in.</p>
          <label className="mt-5 block text-xs font-semibold text-[#5c5348]">
            Email
            <input value={email} onChange={(e) => setEmail(e.target.value)} className={field} autoComplete="email" />
          </label>
          <label className="mt-3 block text-xs font-semibold text-[#5c5348]">
            Password
            <span className="relative block">
              <input type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} className={`${field} pr-10`} autoComplete="current-password" />
              <button type="button" onClick={() => setShowPassword((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6b645b]" aria-label={showPassword ? "Hide password" : "Show password"}>
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </span>
          </label>
          {formError ? <p className="mt-3 text-xs font-medium text-red-700">{formError}</p> : null}
          <button type="submit" disabled={submitting} className="mt-4 h-11 w-full rounded-full bg-[#0e4d28] text-sm font-semibold text-white disabled:opacity-60">
            {submitting ? "Signing in…" : "Sign in"}
          </button>
          <p className="mt-4 text-center text-xs text-[#6b645b]">Admin creates this login. Partners use Partner Login.</p>
        </form>
      </div>
    );
  }

  return (
    <div className="auth-page relative grid min-h-svh place-items-center overflow-hidden bg-[#f7f4ee] px-4 py-8">
      <img src="/rupeeone-login-bg.jpg" alt="" className="pointer-events-none absolute inset-0 h-full w-full object-cover" />
      <div className="pointer-events-none absolute inset-0 bg-white/10" />
      <div className="relative w-full max-w-[940px]">
        <p className="mb-4 text-center text-[11px] font-semibold uppercase tracking-[0.22em] text-[#0e4d28]">RupeeOne</p>
        <div className="relative min-h-[640px] overflow-hidden rounded-[28px] bg-[#f6f5f1] shadow-[0_24px_60px_rgba(16,102,42,0.12)]">
          <form
            onSubmit={(event) => void onSignIn(event)}
            className={mode === "signin" ? "relative z-10 flex flex-col justify-center px-6 py-8 sm:px-10 md:absolute md:inset-y-0 md:left-0 md:w-1/2 md:pr-14" : "hidden"}
          >
            <button type="button" onClick={() => navigate({ to: "/auth", search: next ? { next } : {} })} className="mb-3 text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-[#0e4d28]">
              RupeeOne
            </button>
            <h1 className="font-display text-2xl font-bold text-[#1c1915]">Partner sign in</h1>
            <p className="mt-1 text-xs text-[#6b645b]">DSA, affiliate, and customer accounts.</p>
            <label className="mt-5 block text-xs font-semibold text-[#5c5348]">
              Email
              <input value={email} onChange={(e) => setEmail(e.target.value)} className={field} autoComplete="email" />
            </label>
            <label className="mt-3 block text-xs font-semibold text-[#5c5348]">
              Password
              <span className="relative block">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`${field} pr-10`}
                  autoComplete="current-password"
                />
                <button type="button" onClick={() => setShowPassword((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6b645b]" aria-label={showPassword ? "Hide password" : "Show password"}>
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </span>
            </label>
            <button
              type="button"
              onClick={() => {
                setForgotEmail((v) => v || email);
                setForgotState("idle");
                setForgotOpen((v) => !v);
              }}
              className="mt-2 self-end text-[11px] font-semibold text-[#0e4d28]"
            >
              Forgot password?
            </button>
            {forgotOpen ? (
              <div className="mt-2 rounded-xl bg-[#eef6f0] px-3 py-2 text-xs text-[#3d4a40]">
                {forgotState === "sent" ? (
                  <p>If that email has an account, the new password is on its way. Admin receives a copy too.</p>
                ) : forgotState === "unavailable" ? (
                  <p>
                    Ask your admin, or call{" "}
                    <a href="tel:+917982953129" className="font-semibold text-[#0e4d28]">+91 79829 53129</a>.
                  </p>
                ) : (
                  <div className="flex gap-2">
                    <input value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)} className={`${field} mt-0 h-10`} placeholder="Email" />
                    <button type="button" disabled={forgotBusy} onClick={() => void sendReset()} className="h-10 shrink-0 rounded-xl bg-[#0e4d28] px-3 text-xs font-semibold text-white">
                      {forgotBusy ? "Sending…" : "Send"}
                    </button>
                  </div>
                )}
              </div>
            ) : null}
            {mode === "signin" && formError ? <p className="mt-3 text-xs font-medium text-red-700">{formError}</p> : null}
            <button type="submit" disabled={submitting} className="mt-4 h-11 w-full rounded-full bg-[#0e4d28] text-sm font-semibold text-white disabled:opacity-60">
              {submitting && mode === "signin" ? "Signing in…" : "Sign in"}
            </button>
            <p className="mt-4 text-center text-xs text-[#6b645b]">
              New partner?{" "}
              <button type="button" onClick={() => switchMode("signup")} className="font-semibold text-[#0e4d28]">
                Create an account
              </button>
            </p>
          </form>

          <form
            onSubmit={(event) => void onCreate(event)}
            className={mode === "signup" ? "relative z-10 flex flex-col justify-center px-6 py-8 sm:px-10 md:absolute md:inset-y-0 md:right-0 md:w-1/2 md:overflow-y-auto md:pl-14" : "hidden"}
          >
            {createdId ? (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#0e4d28]">Account created</p>
                <h1 className="mt-2 font-display text-2xl font-bold text-[#1c1915]">You are in the partner queue</h1>
                <p className="mt-3 text-sm">
                  Application ID <span className="font-mono font-bold">{createdId}</span>
                </p>
                <p className="mt-2 text-sm leading-6 text-[#5c5348]">
                  RupeeDial reviews this application. Sign in with the same email after the login is sent.
                </p>
                <button type="button" onClick={() => switchMode("signin")} className="mt-5 h-11 w-full rounded-full bg-[#0e4d28] text-sm font-semibold text-white">
                  Back to sign in
                </button>
              </div>
            ) : (
              <>
                <h1 className="font-display text-2xl font-bold text-[#1c1915]">Create account</h1>
                <label className="mt-4 block text-xs font-semibold text-[#5c5348]">
                  Full name
                  <input value={fullName} onChange={(e) => setFullName(e.target.value)} className={field} />
                </label>
                <label className="mt-3 block text-xs font-semibold text-[#5c5348]">
                  Email
                  <input value={email} onChange={(e) => setEmail(e.target.value)} className={field} autoComplete="email" />
                </label>
                <label className="mt-3 block text-xs font-semibold text-[#5c5348]">
                  Mobile
                  <input value={mobile} inputMode="numeric" onChange={(e) => setMobile(e.target.value.replace(/\D/g, "").slice(0, 10))} className={field} placeholder="10-digit mobile" />
                </label>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <label className="block text-xs font-semibold text-[#5c5348]">
                    City
                    <input value={city} onChange={(e) => setCity(e.target.value)} className={field} />
                  </label>
                  <label className="block text-xs font-semibold text-[#5c5348]">
                    Partner type
                    <select value={partnerType} onChange={(e) => setPartnerType(e.target.value)} className={field}>
                      {PARTNER_TYPES.map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                  </label>
                </div>
                {mode === "signup" && formError ? <p className="mt-3 text-xs font-medium text-red-700">{formError}</p> : null}
                <button type="submit" disabled={submitting} className="mt-4 h-11 w-full rounded-full bg-[#16382a] text-sm font-semibold text-white disabled:opacity-60">
                  {submitting && mode === "signup" ? "Creating…" : "Create account"}
                </button>
                <p className="mt-3 text-center text-[11px] leading-5 text-[#6b645b]">
                  This creates your partner application. The login is sent after RupeeDial approves it.
                </p>
                <p className="mt-2 text-center text-xs text-[#6b645b]">
                  Already have an account?{" "}
                  <button type="button" onClick={() => switchMode("signin")} className="font-semibold text-[#0e4d28]">
                    Sign in
                  </button>
                </p>
              </>
            )}
          </form>

          <div
            className={`relative z-20 flex min-h-[210px] flex-col justify-center overflow-hidden bg-gradient-to-br from-[#0c3d22] via-[#145c32] to-[#1d7a42] px-8 py-10 text-white md:absolute md:inset-y-0 md:left-0 md:min-h-0 md:w-1/2 md:transition-transform md:duration-700 md:ease-in-out ${
              mode === "signin" ? "order-2 md:translate-x-full" : "order-1 md:translate-x-0"
            }`}
          >
            <span
              className={`pointer-events-none absolute inset-y-0 w-14 bg-[#f6f5f1] ${mode === "signin" ? "left-0" : "right-0"}`}
              style={{ clipPath: mode === "signin" ? "polygon(0 0, 70% 0, 0 100%)" : "polygon(30% 0, 100% 0, 100% 100%)" }}
            />
            <div className={`relative max-w-[280px] ${mode === "signin" ? "pl-12" : "pr-12"}`}>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/75">RupeeOne</p>
              {mode === "signin" ? (
                <>
                  <h2 className="mt-3 font-serif text-[2.35rem] italic leading-[1.15] text-white">Welcome back</h2>
                  <p className="mt-3 text-sm leading-6 text-white/85">Your partner desk is ready. Continue from the leads you left.</p>
                </>
              ) : (
                <>
                  <h2 className="mt-3 font-serif text-[2.35rem] italic leading-[1.15] text-white">Start from this page</h2>
                  <p className="mt-3 text-sm leading-6 text-white/85">Create the partner account here. RupeeDial reviews it, then the login is activated.</p>
                </>
              )}
            </div>
          </div>
        </div>
        <p className="mt-5 text-center text-xs text-[#3d4a40]">
          <a href={WEBSITE_URL} className="font-semibold text-[#0e4d28] hover:underline">Back to rupeedial.com</a>
        </p>
      </div>
    </div>
  );
}
