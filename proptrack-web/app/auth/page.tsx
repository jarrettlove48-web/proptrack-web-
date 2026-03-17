"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";
import { Building2, Mail, Lock, User, ArrowRight, Eye, EyeOff } from "lucide-react";
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

function AuthForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialMode = searchParams.get("mode") === "signup" ? "signup" : "login";
  const nextPath = searchParams.get("next") || "/dashboard";

  const [mode, setMode] = useState<"login" | "signup">(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState("");

  const supabase = createClient();

  async function handleGoogleSignIn() {
    setError("");
    setGoogleLoading(true);
    try {
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}`,
        },
      });
      if (oauthError) throw oauthError;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Google sign-in failed";
      setError(message);
      setGoogleLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (mode === "signup") {
        const { error: signUpError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: { name: name.trim() || email.trim().split("@")[0] },
          },
        });
        if (signUpError) throw signUpError;

        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await supabase
            .from("profiles")
            .update({ role: "landlord", name: name.trim() || email.trim().split("@")[0] })
            .eq("id", user.id);
        }
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (signInError) throw signInError;
      }

      router.push(nextPath);
      router.refresh();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Something went wrong";
      setError(message);
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
        <p className="text-white/70 text-sm mt-1">Landlord dashboard</p>
      </div>

      {/* Form card */}
      <div className="w-full max-w-md bg-white rounded-3xl p-8 shadow-xl">
        <h2 className="text-xl font-bold text-charcoal text-center mb-1">
          {mode === "signup" ? "Create your account" : "Welcome back"}
        </h2>
        <p className="text-sm text-charcoal-secondary text-center mb-6">
          {mode === "signup"
            ? "Start tracking maintenance in minutes."
            : "Sign in to your dashboard."}
        </p>

        {/* Google Sign-In */}
        <button
          onClick={handleGoogleSignIn}
          disabled={googleLoading}
          className="w-full flex items-center justify-center gap-3 bg-white hover:bg-gray-50 text-charcoal font-medium py-3 rounded-xl transition-colors border border-warm-300 disabled:opacity-60 mb-5"
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
        <div className="flex items-center gap-4 mb-5">
          <div className="flex-1 h-px bg-warm-300" />
          <span className="text-xs text-charcoal-tertiary font-medium">or</span>
          <div className="flex-1 h-px bg-warm-300" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {mode === "signup" && (
            <div className="flex items-center gap-3 border border-warm-300 rounded-xl px-4 py-3 bg-warm-white focus-within:border-brand transition-colors">
              <User className="w-[18px] h-[18px] text-charcoal-tertiary shrink-0" strokeWidth={1.8} />
              <input
                type="text"
                placeholder="Full name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="flex-1 bg-transparent text-sm text-charcoal outline-none placeholder:text-charcoal-tertiary"
              />
            </div>
          )}

          <div className="flex items-center gap-3 border border-warm-300 rounded-xl px-4 py-3 bg-warm-white focus-within:border-brand transition-colors">
            <Mail className="w-[18px] h-[18px] text-charcoal-tertiary shrink-0" strokeWidth={1.8} />
            <input
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="flex-1 bg-transparent text-sm text-charcoal outline-none placeholder:text-charcoal-tertiary"
              autoComplete="email"
            />
          </div>

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
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
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
                {mode === "signup" ? "Create account" : "Sign in"}
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <div className="text-center mt-6">
          <button
            onClick={() => {
              setMode(mode === "login" ? "signup" : "login");
              setError("");
            }}
            className="text-sm text-charcoal-secondary"
          >
            {mode === "login" ? "Don't have an account? " : "Already have an account? "}
            <span className="text-brand font-semibold">
              {mode === "login" ? "Sign up" : "Sign in"}
            </span>
          </button>
        </div>

        <div className="text-center mt-4">
          <Link
            href="/invite"
            className="text-sm text-charcoal-tertiary hover:text-charcoal-secondary transition-colors"
          >
            I&apos;m a tenant with an invite code →
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function AuthPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-brand flex items-center justify-center">
          <div className="w-8 h-8 border-3 border-white/30 border-t-white rounded-full animate-spin" />
        </div>
      }
    >
      <AuthForm />
    </Suspense>
  );
}
