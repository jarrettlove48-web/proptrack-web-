"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";
import { Building2, Mail, Lock, User, ArrowRight, Eye, EyeOff } from "lucide-react";
import Link from "next/link";

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
  const [error, setError] = useState("");

  const supabase = createClient();

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

        // After signup, update the profile role to landlord
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
