"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";
import { Building2, Lock, ArrowRight, CheckCircle, Eye, EyeOff } from "lucide-react";

export default function ResetPasswordPage() {
  const router = useRouter();
  const supabase = createClient();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);

  // Pick up the recovery session from the URL hash tokens
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event) => {
        if (event === "PASSWORD_RECOVERY") {
          setSessionReady(true);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [supabase]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password,
      });
      if (updateError) throw updateError;
      setSuccess(true);
      setTimeout(() => {
        router.push("/auth");
        router.refresh();
      }, 2000);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to update password";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-brand flex flex-col items-center justify-center px-6 py-12">
      <div className="text-center mb-8">
        <div className="w-16 h-16 rounded-2xl bg-white/15 flex items-center justify-center mx-auto mb-4">
          <Building2 className="w-8 h-8 text-white" strokeWidth={1.6} />
        </div>
        <h1
          className="text-3xl font-bold text-white tracking-tight"
          style={{ fontFamily: "var(--font-display)" }}
        >
          PropTrack
        </h1>
        <p className="text-white/70 text-sm mt-1">Reset your password</p>
      </div>

      <div className="w-full max-w-md bg-white rounded-3xl p-8 shadow-xl">
        {success ? (
          <div className="text-center">
            <div className="w-14 h-14 rounded-2xl bg-success-light flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-7 h-7 text-success" strokeWidth={1.6} />
            </div>
            <h2 className="text-xl font-bold text-charcoal mb-2">Password updated</h2>
            <p className="text-sm text-charcoal-secondary">
              Redirecting you to the dashboard...
            </p>
          </div>
        ) : (
          <>
            <h2 className="text-xl font-bold text-charcoal text-center mb-1">
              Set new password
            </h2>
            <p className="text-sm text-charcoal-secondary text-center mb-6">
              Enter your new password below.
            </p>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="flex items-center gap-3 border border-warm-300 rounded-xl px-4 py-3 bg-warm-white focus-within:border-brand transition-colors">
                <Lock className="w-[18px] h-[18px] text-charcoal-tertiary shrink-0" strokeWidth={1.8} />
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="New password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="flex-1 bg-transparent text-sm text-charcoal outline-none placeholder:text-charcoal-tertiary"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-charcoal-tertiary hover:text-charcoal transition-colors"
                >
                  {showPassword ? (
                    <EyeOff className="w-[18px] h-[18px]" strokeWidth={1.8} />
                  ) : (
                    <Eye className="w-[18px] h-[18px]" strokeWidth={1.8} />
                  )}
                </button>
              </div>

              <div className="flex items-center gap-3 border border-warm-300 rounded-xl px-4 py-3 bg-warm-white focus-within:border-brand transition-colors">
                <Lock className="w-[18px] h-[18px] text-charcoal-tertiary shrink-0" strokeWidth={1.8} />
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Confirm new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={6}
                  className="flex-1 bg-transparent text-sm text-charcoal outline-none placeholder:text-charcoal-tertiary"
                />
              </div>

              {error && (
                <div className="bg-danger-light text-danger text-sm font-medium text-center rounded-xl px-4 py-3">
                  {error}
                </div>
              )}

              {!sessionReady && (
                <div className="bg-warning-light text-warning text-sm font-medium text-center rounded-xl px-4 py-3">
                  Establishing recovery session...
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !sessionReady}
                className="w-full flex items-center justify-center gap-2 bg-brand hover:bg-brand-dark text-white font-semibold py-3.5 rounded-xl transition-colors disabled:opacity-60"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    Update password
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
