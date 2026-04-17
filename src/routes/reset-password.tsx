import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Sparkles, Loader2, Eye, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Reset password — LeadMines" },
      { name: "description", content: "Set a new password for your LeadMines account." },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    // Listen for the PASSWORD_RECOVERY event triggered by the recovery link
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) {
        setHasSession(true);
      }
      setReady(true);
    });
    // Also check existing session in case event already fired
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setHasSession(true);
      setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    if (password !== confirm) {
      toast.error("Passwords do not match");
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        toast.error(error.message);
      } else {
        toast.success("Password updated. Redirecting…");
        setTimeout(() => navigate({ to: "/dashboard" }), 800);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen grid place-items-center bg-background p-6">
      <div className="w-full max-w-md">
        <Link to="/" className="mb-8 flex items-center gap-2.5 justify-center">
          <div className="size-9 rounded-xl bg-mint-gradient grid place-items-center shadow-mint">
            <Sparkles className="size-5 text-primary" strokeWidth={2.5} />
          </div>
          <span className="font-display font-bold text-lg">LeadMines</span>
        </Link>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
          <h1 className="font-display text-2xl font-bold tracking-tight">Set a new password</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Choose a strong password you haven't used before.
          </p>

          {!ready ? (
            <div className="mt-8 flex justify-center">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : !hasSession ? (
            <div className="mt-6 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
              <div className="font-semibold text-destructive">Invalid or expired link</div>
              <p className="mt-1 text-muted-foreground">
                Please request a new password reset link from the sign-in page.
              </p>
              <Link
                to="/auth"
                className="mt-3 inline-flex h-9 items-center px-4 rounded-full bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-smooth"
              >
                Back to sign in
              </Link>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="mt-6 space-y-4">
              <label className="block">
                <span className="text-sm font-medium">New password</span>
                <div className="relative mt-1.5">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="input-base pr-10"
                    placeholder="••••••••"
                    autoComplete="new-password"
                    required
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
                <p className="mt-1 text-xs text-muted-foreground">
                  Use 8+ characters with a mix of letters, numbers & symbols.
                </p>
              </label>

              <label className="block">
                <span className="text-sm font-medium">Confirm password</span>
                <input
                  type={showPassword ? "text" : "password"}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="input-base mt-1.5"
                  placeholder="••••••••"
                  autoComplete="new-password"
                  required
                />
              </label>

              <button
                type="submit"
                disabled={submitting}
                className="w-full h-11 rounded-full bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-smooth shadow-card disabled:opacity-60 inline-flex items-center justify-center gap-2"
              >
                {submitting && <Loader2 className="size-4 animate-spin" />}
                Update password
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
