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

type Step = "code" | "account";

export default function InvitePage() {
  const router = useRouter();
  const supabase = createClient();

  const [step, setStep] = useState<Step>("code");
  const [accountMode, setAccountMode] = useState<"new" | "returning">("new");

  // Code step
  const [email, setEmail] = useState("");
  const [inviteCode, setInviteCode] = useState("");

  // Account step
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // State
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [verifiedUnit, setVerifiedUnit] = useState<{
    id: string;
    label: string;
    tenant_name: string;
    property_id: string;
  } | null>(null);

  async function handleVerifyCode(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!email.trim()) {
      setError("Please enter your email");
      return;
    }
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

  async function handleAccountSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

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

      // Link tenant to unit
      const code = inviteCode.trim().toUpperCase();
      await supabase
        .from("units")
        .update({
          tenant_user_id: user.id,
          tenant_portal_active: true,
          tenant_email: email.trim(),
        })
        .eq("invite_code", code)
        .eq("is_invited", true);

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
              Get started
            </h2>
            <p className="text-sm text-charcoal-secondary text-center mb-6">
              Enter your email and the invite code your landlord sent you.
            </p>

            <form onSubmit={handleVerifyCode} className="space-y-3">
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

              <div className="flex items-center gap-3 border-2 border-warm-300 rounded-xl px-4 py-4 bg-warm-white focus-within:border-brand transition-colors">
                <KeyRound className="w-[18px] h-[18px] text-charcoal-tertiary shrink-0" strokeWidth={1.8} />
                <input
                  type="text"
                  placeholder="e.g. ABC123"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                  maxLength={8}
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
                    Verify &amp; continue
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
              {accountMode === "new" ? "Create a password" : "Welcome back"}
            </h2>
            <p className="text-sm text-charcoal-secondary text-center mb-5">
              {accountMode === "new"
                ? "Set a password to secure your tenant account."
                : "Enter your password to sign in."}
            </p>

            {/* Account mode toggle */}
            <div className="flex bg-warm-white border border-warm-300 rounded-xl p-1 mb-5">
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
              {/* Show email (locked) */}
              <div className="flex items-center gap-3 border border-warm-300 rounded-xl px-4 py-3 bg-warm-100">
                <Mail className="w-4 h-4 text-charcoal-tertiary shrink-0" strokeWidth={1.8} />
                <span className="text-sm text-charcoal-secondary truncate">{email}</span>
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
