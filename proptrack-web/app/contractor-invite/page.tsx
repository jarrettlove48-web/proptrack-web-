"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";
import { Building2, HardHat, ArrowRight, AlertTriangle, KeyRound } from "lucide-react";

export default function ContractorInvitePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-warm-white flex items-center justify-center">
        <div className="w-8 h-8 border-3 border-brand/20 border-t-brand rounded-full animate-spin" />
      </div>
    }>
      <ContractorInviteContent />
    </Suspense>
  );
}

function ContractorInviteContent() {
  const supabase = createClient();
  const searchParams = useSearchParams();
  const codeFromUrl = searchParams.get("code") || "";
  const errorFromUrl = searchParams.get("error") || "";

  const [inviteCode, setInviteCode] = useState(codeFromUrl);
  const [verifying, setVerifying] = useState(false);
  const [verified, setVerified] = useState<{ company: string | null; owner_name: string | null } | null>(null);
  const [error, setError] = useState(errorFromUrl);
  const [resetEmail, setResetEmail] = useState("");
  const [resetSent, setResetSent] = useState(false);
  const [showReset, setShowReset] = useState(false);

  // Auto-verify if code came from URL
  useEffect(() => {
    if (codeFromUrl && !verified) {
      handleVerify();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleVerify() {
    if (!inviteCode.trim()) return;
    setVerifying(true);
    setError("");

    const { data, error: rpcErr } = await supabase.rpc("verify_contractor_invite_code", {
      code: inviteCode.trim(),
    });

    if (rpcErr || !data?.valid) {
      setError("Invalid or expired invite code. Please check with your landlord.");
      setVerifying(false);
      return;
    }

    setVerified({ company: data.company, owner_name: data.owner_name });
    setVerifying(false);
  }

  async function handleGoogleSignIn() {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin;
    // Store invite code in cookie so the callback can read it server-side
    // (query params can get stripped during OAuth redirects)
    document.cookie = `contractor_invite_code=${encodeURIComponent(inviteCode.trim())}; path=/; max-age=600; SameSite=Lax`;
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${siteUrl}/auth/callback?contractor_invite_code=${encodeURIComponent(inviteCode.trim())}`,
      },
    });
  }

  async function handleEmailSignIn(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const email = form.get("email") as string;
    const password = form.get("password") as string;
    setError("");

    // Try sign in first, then sign up
    let { error: signInErr } = await supabase.auth.signInWithPassword({ email, password });

    if (signInErr) {
      // Try sign up (immediate login — no email confirmation needed)
      const { error: signUpErr } = await supabase.auth.signUp({ email, password });
      if (signUpErr) {
        setError(signUpErr.message);
        return;
      }
    }

    // Redeem invite, set role, and redirect
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { error: redeemErr } = await supabase.rpc("redeem_contractor_invite", { code: inviteCode.trim(), uid: user.id });
      if (redeemErr) {
        setError(redeemErr.message || "Failed to redeem invite.");
        return;
      }
      // Explicitly set profile role to contractor (RPC may not do this)
      await supabase.from("profiles").update({ role: "contractor" }).eq("id", user.id);
      window.location.href = "/contractor";
    }
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!resetEmail.trim()) return;
    setError("");
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin;
    const { error: resetErr } = await supabase.auth.resetPasswordForEmail(resetEmail.trim(), {
      redirectTo: `${siteUrl}/contractor-invite${inviteCode ? `?code=${encodeURIComponent(inviteCode)}` : ""}`,
    });
    if (resetErr) { setError(resetErr.message); return; }
    setResetSent(true);
  }

  return (
    <div className="min-h-screen bg-warm-white flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex items-center gap-2.5 justify-center mb-8">
          <div className="w-10 h-10 rounded-xl bg-brand flex items-center justify-center">
            <Building2 className="w-5 h-5 text-white" strokeWidth={1.8} />
          </div>
          <span className="text-xl font-bold tracking-tight text-charcoal" style={{ fontFamily: "var(--font-display)" }}>
            PropTrack
          </span>
        </div>

        <div className="bg-surface rounded-2xl border border-warm-300/50 p-6">
          {!verified ? (
            /* Step 1: Enter invite code */
            <>
              <div className="flex items-center gap-2 mb-4">
                <HardHat className="w-5 h-5 text-brand" />
                <h2 className="text-lg font-bold text-charcoal">Contractor invite</h2>
              </div>
              <p className="text-sm text-charcoal-secondary mb-5">
                Enter the invite code from your landlord to access your assigned jobs.
              </p>

              {error && (
                <div className="flex items-start gap-2 px-4 py-3 rounded-xl bg-danger-light text-danger text-sm mb-4">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  {error}
                </div>
              )}

              <form onSubmit={(e) => { e.preventDefault(); handleVerify(); }} className="space-y-4">
                <input
                  type="text"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value)}
                  placeholder="Paste invite code"
                  className="w-full border border-warm-300 rounded-xl px-4 py-3 text-sm text-charcoal bg-warm-white outline-none focus:border-brand transition-colors placeholder:text-charcoal-tertiary text-center tracking-widest font-mono"
                  autoFocus
                />
                <button type="submit" disabled={verifying || !inviteCode.trim()}
                  className="w-full bg-brand hover:bg-brand-dark text-white font-semibold py-3 rounded-xl transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
                  {verifying ? "Verifying..." : "Continue"}
                  {!verifying && <ArrowRight className="w-4 h-4" />}
                </button>
              </form>
            </>
          ) : (
            /* Step 2: Sign in */
            <>
              <div className="text-center mb-5">
                <div className="w-12 h-12 rounded-2xl bg-success-light flex items-center justify-center mx-auto mb-3">
                  <HardHat className="w-6 h-6 text-success" />
                </div>
                <h2 className="text-lg font-bold text-charcoal mb-1">You&apos;re invited!</h2>
                <p className="text-sm text-charcoal-secondary">
                  {verified.owner_name && <>{verified.owner_name} invited you</>}
                  {verified.company && <> to work with <strong>{verified.company}</strong></>}
                </p>
              </div>

              {error && (
                <div className="flex items-start gap-2 px-4 py-3 rounded-xl bg-danger-light text-danger text-sm mb-4">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  {error}
                </div>
              )}

              <button onClick={handleGoogleSignIn}
                className="w-full flex items-center justify-center gap-3 border border-warm-300 rounded-xl px-4 py-3 text-sm font-medium text-charcoal hover:bg-warm-100 transition-colors mb-4">
                <svg className="w-5 h-5" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                Continue with Google
              </button>

              <div className="flex items-center gap-3 mb-4">
                <div className="flex-1 border-t border-warm-300/50" />
                <span className="text-xs text-charcoal-tertiary">or</span>
                <div className="flex-1 border-t border-warm-300/50" />
              </div>

              {showReset ? (
                /* Password reset form */
                resetSent ? (
                  <div className="text-center py-2">
                    <KeyRound className="w-6 h-6 text-brand mx-auto mb-2" />
                    <p className="text-sm font-medium text-charcoal mb-1">Reset email sent!</p>
                    <p className="text-xs text-charcoal-secondary mb-3">Check your inbox for a password reset link.</p>
                    <button onClick={() => { setShowReset(false); setResetSent(false); }}
                      className="text-xs font-medium text-brand hover:text-brand-dark">Back to sign in</button>
                  </div>
                ) : (
                  <form onSubmit={handleResetPassword} className="space-y-3">
                    <p className="text-sm text-charcoal-secondary">Enter your email to receive a password reset link.</p>
                    <input type="email" value={resetEmail} onChange={(e) => setResetEmail(e.target.value)}
                      placeholder="Email" required autoFocus
                      className="w-full border border-warm-300 rounded-xl px-4 py-3 text-sm text-charcoal bg-warm-white outline-none focus:border-brand transition-colors placeholder:text-charcoal-tertiary" />
                    <button type="submit"
                      className="w-full bg-brand hover:bg-brand-dark text-white font-semibold py-3 rounded-xl transition-colors">
                      Send reset link
                    </button>
                    <button type="button" onClick={() => setShowReset(false)}
                      className="w-full text-xs font-medium text-charcoal-tertiary hover:text-charcoal transition-colors">
                      Back to sign in
                    </button>
                  </form>
                )
              ) : (
                <>
                  <form onSubmit={handleEmailSignIn} className="space-y-3">
                    <input name="email" type="email" placeholder="Email" required
                      className="w-full border border-warm-300 rounded-xl px-4 py-3 text-sm text-charcoal bg-warm-white outline-none focus:border-brand transition-colors placeholder:text-charcoal-tertiary" />
                    <input name="password" type="password" placeholder="Password" required minLength={6}
                      className="w-full border border-warm-300 rounded-xl px-4 py-3 text-sm text-charcoal bg-warm-white outline-none focus:border-brand transition-colors placeholder:text-charcoal-tertiary" />
                    <button type="submit"
                      className="w-full bg-brand hover:bg-brand-dark text-white font-semibold py-3 rounded-xl transition-colors">
                      Sign in / Sign up
                    </button>
                  </form>
                  <button onClick={() => setShowReset(true)}
                    className="w-full text-xs font-medium text-charcoal-tertiary hover:text-brand transition-colors mt-3">
                    Forgot password?
                  </button>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
