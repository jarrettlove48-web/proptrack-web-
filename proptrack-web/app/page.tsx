import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import Link from "next/link";
import {
  Building2,
  Wrench,
  MessageCircle,
  Shield,
  ArrowRight,
} from "lucide-react";

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role === "tenant") {
      redirect("/tenant");
    } else {
      redirect("/dashboard");
    }
  }

  return (
    <div className="min-h-screen bg-warm-white">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-5 max-w-6xl mx-auto">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-brand flex items-center justify-center">
            <Building2 className="w-5 h-5 text-white" strokeWidth={1.8} />
          </div>
          <span
            className="text-xl font-bold tracking-tight text-charcoal"
            style={{ fontFamily: "var(--font-display)" }}
          >
            PropTrack
          </span>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/invite"
            className="text-sm font-medium text-charcoal-secondary hover:text-charcoal transition-colors px-4 py-2"
          >
            I&apos;m a tenant
          </Link>
          <Link
            href="/auth"
            className="text-sm font-semibold text-white bg-brand hover:bg-brand-dark px-5 py-2.5 rounded-xl transition-colors"
          >
            Sign in
          </Link>
        </div>
      </header>

      {/* Hero */}
      <main className="max-w-6xl mx-auto px-6 pt-16 pb-24">
        <div className="max-w-2xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-brand-faint text-brand-dark text-sm font-medium px-4 py-2 rounded-full mb-8">
            <Shield className="w-4 h-4" />
            Now available on web — no app download needed
          </div>

          <h1
            className="text-5xl md:text-6xl font-bold text-charcoal leading-[1.1] tracking-tight mb-6"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Maintenance tracking for the landlord next door
          </h1>

          <p className="text-lg text-charcoal-secondary leading-relaxed mb-10 max-w-lg mx-auto">
            Track requests, message tenants, and log expenses for your 1–5 unit
            property. No spreadsheets. No text chains. No empire required.
          </p>

          <div className="flex items-center justify-center gap-4">
            <Link
              href="/auth?mode=signup"
              className="inline-flex items-center gap-2 bg-brand hover:bg-brand-dark text-white font-semibold px-8 py-3.5 rounded-xl text-base transition-colors"
            >
              Get started free
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/invite"
              className="inline-flex items-center gap-2 bg-white hover:bg-warm-100 text-charcoal font-medium px-8 py-3.5 rounded-xl text-base transition-colors border border-warm-300"
            >
              Tenant portal
            </Link>
          </div>
        </div>

        {/* Feature highlights */}
        <div className="grid md:grid-cols-3 gap-6 mt-24 max-w-4xl mx-auto">
          {[
            {
              icon: Wrench,
              title: "Maintenance requests",
              desc: "Tenants submit requests. You track, respond, and resolve — all in one place.",
            },
            {
              icon: MessageCircle,
              title: "Built-in messaging",
              desc: "No more text chains. Every conversation is tied to a specific request.",
            },
            {
              icon: Building2,
              title: "Property dashboard",
              desc: "See all your units, tenants, open requests, and expenses at a glance.",
            },
          ].map((f) => (
            <div
              key={f.title}
              className="bg-white rounded-2xl p-6 border border-warm-300/60"
            >
              <div className="w-10 h-10 rounded-xl bg-brand-faint flex items-center justify-center mb-4">
                <f.icon
                  className="w-5 h-5 text-brand"
                  strokeWidth={1.8}
                />
              </div>
              <h3 className="font-semibold text-charcoal mb-1.5">{f.title}</h3>
              <p className="text-sm text-charcoal-secondary leading-relaxed">
                {f.desc}
              </p>
            </div>
          ))}
        </div>

        {/* Pricing */}
        <div className="mt-24 text-center">
          <h2
            className="text-3xl font-bold text-charcoal mb-3"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Simple pricing
          </h2>
          <p className="text-charcoal-secondary mb-10">
            Start free. Upgrade when you grow.
          </p>

          <div className="grid md:grid-cols-3 gap-6 max-w-3xl mx-auto">
            {[
              { name: "Starter", price: "Free", units: "1 unit", cta: "Get started" },
              { name: "Essential", price: "$9/mo", units: "Up to 3 units", cta: "Start trial", featured: true },
              { name: "Pro", price: "$19/mo", units: "Up to 10 units", cta: "Start trial" },
            ].map((plan) => (
              <div
                key={plan.name}
                className={`rounded-2xl p-6 border text-left ${
                  plan.featured
                    ? "bg-white border-brand border-2 ring-4 ring-brand/10"
                    : "bg-white border-warm-300/60"
                }`}
              >
                {plan.featured && (
                  <span className="text-xs font-semibold bg-brand-faint text-brand-dark px-3 py-1 rounded-full">
                    Most popular
                  </span>
                )}
                <div className="mt-3">
                  <p className="text-sm font-medium text-charcoal-secondary">
                    {plan.name}
                  </p>
                  <p
                    className="text-3xl font-bold text-charcoal mt-1"
                    style={{ fontFamily: "var(--font-display)" }}
                  >
                    {plan.price}
                  </p>
                  <p className="text-sm text-charcoal-tertiary mt-1">
                    {plan.units}
                  </p>
                </div>
                <Link
                  href="/auth?mode=signup"
                  className={`block text-center text-sm font-semibold mt-6 py-2.5 rounded-xl transition-colors ${
                    plan.featured
                      ? "bg-brand text-white hover:bg-brand-dark"
                      : "bg-warm-100 text-charcoal hover:bg-warm-200"
                  }`}
                >
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-warm-300/60 py-8 px-6">
        <div className="max-w-6xl mx-auto flex items-center justify-between text-sm text-charcoal-tertiary">
          <span>&copy; {new Date().getFullYear()} PropTrack</span>
          <a
            href="https://proptrack.app"
            className="hover:text-charcoal transition-colors"
          >
            proptrack.app
          </a>
        </div>
      </footer>
    </div>
  );
}
