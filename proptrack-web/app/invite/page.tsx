"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";
import {
  Building2,
  KeyRound,
  Mail,
  Lock,
  User,
  ArrowRight,
  CheckCircle,
  ChevronLeft,
  Eye,
  EyeOff,
} from "lucide-react";
import Link from "next/link";

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
      <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
    </svg>
  );
}

type Step = "code" | "account";

export default function InvitePage() {
  const router = useRouter();
  const supabase = createClient();

  const [step, setStep] = useState<Step>("code");
  const [accountMode, setAccountMode] = useState<"new" | "returning">("new");

  // Code step
  const [inviteCode, setInviteCode] = useState("");

  // Account step
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // State
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState("");
  const [resetSent, setResetSent] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [verifiedUnit, setVerifiedUnit] = useState<{
    id: string;
    label: string;
    tenant_name: string;
    property_id: string;
  } | null>(null);

  async function handleForgotPassword() {
    if (!email.trim()) {
      setError("Enter your email first, then click Forgot password.");
      return;
    }
    setResetLoading(true);
    setError("");
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      });
      if (resetError) throw resetError;
      setResetSent(true);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to send reset email";
      setError(message);
    } finally {
      setResetLoading(false);
    }
  }

  async function handleVerifyCode(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const code = inviteCode.trim().toUpperCase();
    if (code.length < 4) {
      setError("Please enter your invite code");
      return;
    }

    setLoading(true);
    try {
      const { data, error: rpcError } = await supabase.rpc("verify_invite_code", {
        invite_code_input: code,
      });

      if (rpcError) throw rpcError;
      if (!data) {
        setError("Invalid or expired invite code. Check with your landlord.");
        return;
      }

      setVerifiedUnit(data);
      setStep("account");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Could not verify code";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleSignIn() {
    setError("");
    setGoogleLoading(true);
    try {
      const code = inviteCode.trim().toUpperCase();
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback?role=tenant&invite_code=${encodeURIComponent(code)}`,
        },
      });
      if (oauthError) throw oauthError;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Google sign-in failed";
      setError(message);
      setGoogleLoading(false);
    }
  }

  async function handleAccountSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!email.trim()) {
      setError("Please enter your email");
      return;
    }
    if (!password.trim() || password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setLoading(true);
    try {
      // Sign up or sign in
      if (accountMode === "new") {
        const { error: signUpError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: {
              name: name.trim() || verifiedUnit?.tenant_name || email.trim().split("@")[0],
            },
          },
        });
        if (signUpError) throw signUpError;
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (signInError) throw signInError;
      }

      // Get current user and set role to tenant
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Authentication failed");

      // Update profile to tenant role
      await supabase
        .from("profiles")
        .update({
          role: "tenant",
          name: name.trim() || verifiedUnit?.tenant_name || email.trim().split("@")[0],
        })
        .eq("id", user.id);

      // Redeem invite code via RPC (bypasses RLS)
      const code = inviteCode.trim().toUpperCase();
      const { data: redeemData, error: redeemError } = await supabase.rpc("redeem_invite", {
        code,
      });

      if (redeemError) throw redeemError;
      if (!redeemData?.success) {
        throw new Error(redeemData?.error || "Failed to redeem invite code.");
      }

      router.push("/tenant");
      router.refresh();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Something went wrong";
      if (message.includes("already registered")) {
        setError('This email already has an account. Try "Returning tenant".');
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-brand flex flex-col items-center justify-center px-6 py-12">
      {/* Branding */}
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
        <p className="text-white/70 text-sm mt-1">Tenant portal</p>
      </div>

      {/* Form card */}
      <div className="w-full max-w-md bg-white rounded-3xl p-8 shadow-xl">
        {step === "code" ? (
          <>
            <div className="w-14 h-14 rounded-2xl bg-brand-faint flex items-center justify-center mx-auto mb-5">
              <KeyRound className="w-7 h-7 text-brand" strokeWidth={1.6} />
            </div>
            <h2 className="text-xl font-bold text-charcoal text-center mb-1">
              Enter your invite code
            </h2>
            <p className="text-sm text-charcoal-secondary text-center mb-6">
              Your landlord sent you a code to link your account to your unit.
            </p>

            <form onSubmit={handleVerifyCode} className="space-y-3">
              <div className="flex items-center gap-3 border-2 border-warm-300 rounded-xl px-4 py-4 bg-warm-white focus-within:border-brand transition-colors">
                <KeyRound className="w-[18px] h-[18px] text-charcoal-tertiary shrink-0" strokeWidth={1.8} />
                <input
                  type="text"
                  placeholder="e.g. ABC123"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                  maxLength={8}
                  autoFocus
                  className="flex-1 bg-transparent text-xl font-bold text-charcoal tracking-[0.25em] text-center outline-none placeholder:text-charcoal-tertiary placeholder:text-base placeholder:font-normal placeholder:tracking-normal"
                />
              </div>

              {error && (
                <div className="bg-danger-light text-danger text-sm font-medium text-center rounded-xl px-4 py-3">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 bg-brand hover:bg-brand-dark text-white font-semibold py-3.5 rounded-xl transition-colors disabled:opacity-60"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    Verify code
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            <p className="text-xs text-charcoal-tertiary text-center mt-5 leading-relaxed">
              Don&apos;t have a code? Ask your landlord to send you an invite from
              PropTrack.
            </p>
          </>
        ) : (
          <>
            {/* Back button */}
            <button
              onClick={() => {
                setStep("code");
                setError("");
              }}
              className="flex items-center gap-1 text-sm text-charcoal-secondary hover:text-charcoal mb-4 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              Back
            </button>

            {/* Verified banner */}
            {verifiedUnit && (
              <div className="flex items-center gap-2 bg-success-light text-success rounded-xl px-4 py-3 mb-5">
                <CheckCircle className="w-4 h-4 shrink-0" strokeWidth={2} />
                <span className="text-sm font-medium">
                  Code verified — {verifiedUnit.label}
                </span>
              </div>
            )}

            <h2 className="text-xl font-bold text-charcoal text-center mb-1">
              Create your account
            </h2>
            <p className="text-sm text-charcoal-secondary text-center mb-5">
              Choose how you&apos;d like to sign in to your tenant portal.
            </p>

            {/* Google Sign-In */}
            <button
              onClick={handleGoogleSignIn}
              disabled={googleLoading}
              className="w-full flex items-center justify-center gap-3 bg-white hover:bg-gray-50 text-charcoal font-medium py-3 rounded-xl transition-colors border border-warm-300 disabled:opacity-60 mb-4"
            >
              {googleLoading ? (
                <div className="w-5 h-5 border-2 border-charcoal-tertiary/30 border-t-charcoal-tertiary rounded-full animate-spin" />
              ) : (
                <>
                  <GoogleIcon />
                  Continue with Google
                </>
              )}
            </button>

            {/* Divider */}
            <div className="flex items-center gap-4 mb-4">
              <div className="flex-1 h-px bg-warm-300" />
              <span className="text-xs text-charcoal-tertiary font-medium">or use email</span>
              <div className="flex-1 h-px bg-warm-300" />
            </div>

            {/* Account mode toggle */}
            <div className="flex bg-warm-white border border-warm-300 rounded-xl p-1 mb-4">
              {(["new", "returning"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => {
                    setAccountMode(m);
                    setError("");
                    setPassword("");
                  }}
                  className={`flex-1 text-sm font-semibold py-2.5 rounded-lg transition-colors ${
                    accountMode === m
                      ? "bg-brand text-white"
                      : "text-charcoal-secondary"
                  }`}
                >
                  {m === "new" ? "New here" : "Returning tenant"}
                </button>
              ))}
            </div>

            <form onSubmit={handleAccountSubmit} className="space-y-3">
              <div className="flex items-center gap-3 border border-warm-300 rounded-xl px-4 py-3 bg-warm-white focus-within:border-brand transition-colors">
                <Mail className="w-[18px] h-[18px] text-charcoal-tertiary shrink-0" strokeWidth={1.8} />
                <input
                  type="email"
                  placeholder="Email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="flex-1 bg-transparent text-sm text-charcoal outline-none placeholder:text-charcoal-tertiary"
                />
              </div>

              {accountMode === "new" && (
                <div className="flex items-center gap-3 border border-warm-300 rounded-xl px-4 py-3 bg-warm-white focus-within:border-brand transition-colors">
                  <User className="w-[18px] h-[18px] text-charcoal-tertiary shrink-0" strokeWidth={1.8} />
                  <input
                    type="text"
                    placeholder="Full name (optional)"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="flex-1 bg-transparent text-sm text-charcoal outline-none placeholder:text-charcoal-tertiary"
                  />
                </div>
              )}

              <div className="flex items-center gap-3 border border-warm-300 rounded-xl px-4 py-3 bg-warm-white focus-within:border-brand transition-colors">
                <Lock className="w-[18px] h-[18px] text-charcoal-tertiary shrink-0" strokeWidth={1.8} />
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="flex-1 bg-transparent text-sm text-charcoal outline-none placeholder:text-charcoal-tertiary"
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

              {accountMode === "returning" && (
                <div className="text-right">
                  <button
                    type="button"
                    onClick={handleForgotPassword}
                    disabled={resetLoading}
                    className="text-sm text-brand hover:text-brand-dark font-medium transition-colors disabled:opacity-60"
                  >
                    {resetLoading ? "Sending..." : "Forgot password?"}
                  </button>
                </div>
              )}

              {resetSent && (
                <div className="bg-success-light text-success text-sm font-medium text-center rounded-xl px-4 py-3">
                  Check your email for a password reset link.
                </div>
              )}

              {error && (
                <div className="bg-danger-light text-danger text-sm font-medium text-center rounded-xl px-4 py-3">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 bg-brand hover:bg-brand-dark text-white font-semibold py-3.5 rounded-xl transition-colors disabled:opacity-60"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    {accountMode === "new" ? "Create account & enter" : "Sign in & enter"}
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          </>
        )}

        <div className="text-center mt-5">
          <Link
            href="/auth"
            className="text-sm text-charcoal-tertiary hover:text-charcoal-secondary transition-colors"
          >
            I&apos;m a landlord →
          </Link>
        </div>
      </div>
    </div>
  );
}
