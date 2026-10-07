import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { KeyRound, Loader2, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { changePassword, resetPasswordWithToken } from "@/lib/python-api";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Change password — RupeeDial One" },
      { name: "description", content: "Set a new password for your RupeeDial account." },
    ],
  }),
  validateSearch: (search: Record<string, unknown>): { token?: string } =>
    typeof search.token === "string" && search.token ? { token: search.token } : {},
  component: ChangePasswordPage,
});

function ChangePasswordPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { token } = Route.useSearch();
  const [current, setCurrent] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      toast.error("New password must be at least 8 characters");
      return;
    }
    if (password !== confirm) {
      toast.error("Passwords do not match");
      return;
    }
    setSubmitting(true);
    try {
      if (token) {
        await resetPasswordWithToken(token, password);
        toast.success("Password updated. Sign in with your new password.");
        setTimeout(() => navigate({ to: "/auth" }), 800);
        return;
      }
      await changePassword(current, password);
      toast.success("Password updated");
      setTimeout(() => navigate({ to: "/dashboard" }), 600);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update password");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen grid place-items-center bg-[#F5FBF7] p-6">
      <div className="w-full max-w-md">
        <Link to="/" className="mb-8 flex items-center gap-2.5 justify-center">
          <div className="size-9 rounded-xl bg-[#10662A] grid place-items-center">
            <KeyRound className="size-5 text-white" strokeWidth={2.5} />
          </div>
          <span className="font-display font-bold text-lg text-[#390A5D]">RupeeDial One</span>
        </Link>

        <div className="rounded-2xl border border-[#d8ecdd] bg-white p-6 shadow-[0_10px_30px_rgba(16,102,42,0.07)]">
          <h1 className="font-display text-2xl font-bold tracking-tight text-[#390A5D]">
            {token ? "Set a new password" : "Change password"}
          </h1>
          <p className="mt-1.5 text-sm text-[#5c4d72]">
            {token
              ? "Choose a new password for your account. This link works once."
              : "Enter your current or temporary password, then choose a new one."}
          </p>

          {loading && !token ? (
            <div className="mt-8 flex justify-center">
              <Loader2 className="size-5 animate-spin text-[#10662A]" />
            </div>
          ) : !user && !token ? (
            <div className="mt-6 rounded-xl border border-[#d8ecdd] bg-[#F5FBF7] p-4 text-sm">
              <div className="font-semibold text-[#390A5D]">Sign in first</div>
              <p className="mt-1 text-[#5c4d72]">
                Forgot your password? Use "Forgot password?" on the sign-in page to get a reset link by email.
              </p>
              <Link
                to="/auth"
                search={{ next: "/reset-password" } as never}
                className="mt-3 inline-flex h-9 items-center px-4 rounded-full bg-[#10662A] text-white text-sm font-semibold"
              >
                Sign in
              </Link>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="mt-6 space-y-4">
              {!token && (
                <label className="block">
                  <span className="text-sm font-medium text-[#390A5D]">Current or temporary password</span>
                  <input
                    type={showPassword ? "text" : "password"}
                    value={current}
                    onChange={(e) => setCurrent(e.target.value)}
                    className="input-base mt-1.5"
                    autoComplete="current-password"
                    required
                  />
                </label>
              )}

              <label className="block">
                <span className="text-sm font-medium text-[#390A5D]">New password</span>
                <div className="relative mt-1.5">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="input-base pr-10"
                    autoComplete="new-password"
                    minLength={8}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-800"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
                <p className="mt-1 text-xs text-[#5c4d72]">At least 8 characters. Mix letters, numbers and symbols.</p>
              </label>

              <label className="block">
                <span className="text-sm font-medium text-[#390A5D]">Confirm new password</span>
                <input
                  type={showPassword ? "text" : "password"}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="input-base mt-1.5"
                  autoComplete="new-password"
                  required
                />
              </label>

              <button
                type="submit"
                disabled={submitting}
                className="w-full h-11 rounded-full bg-[#10662A] text-white font-semibold hover:bg-[#0d5523] disabled:opacity-60 inline-flex items-center justify-center gap-2"
              >
                {submitting && <Loader2 className="size-4 animate-spin" />}
                Update password
              </button>
              <Link to={token ? "/auth" : "/dashboard"} className="block text-center text-sm text-[#5c4d72] hover:text-[#10662A]">
                {token ? "Back to sign in" : "Back to dashboard"}
              </Link>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
