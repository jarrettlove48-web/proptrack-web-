import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import Link from "next/link";
import GoogleSignIn from "./GoogleSignIn";
import {
  Building2,
  Wrench,
  MessageCircle,
  Receipt,
  Users,
  LayoutDashboard,
  ArrowRight,
  Check,
} from "lucide-react";

const STRIPE_ESSENTIAL =
  "https://checkout.stripe.com/c/pay/cs_live_b1AHg4Pv6dxfzUzqQ9KPsREMOa1LfTrocOvqaLQr4yRzWNXs1PPUUG6QQ2#fidnandhYHdWcXxpYCc%2FJ2FgY2RwaXEnKSd2cGd2ZndsdXFsamtQa2x0cGBrYHZ2QGtkZ2lgYSc%2FY2RpdmApJ2R1bE5gfCc%2FJ3VuWmlsc2BaMDRWb3dSdEJjdk5ndnZGXzE2fFc1dnZ3YU9CTjVKcHRsQEhOa21MPWsxS2NCVnxGaVdccVUyMVJDcUpCVG5gY0tiXX1saHJXZl9ndEBkMj1TMF19al9dTU01NXdrUjNjV0pjJyknY3dqaFZgd3Ngdyc%2FcXdwYCknZ2RmbmJ3anBrYUZqaWp3Jz8nJjVmPTcyMycpJ2lkfGpwcVF8dWAnPydocGlxbFpscWBoJyknYGtkZ2lgVWlkZmBtamlhYHd2Jz9xd3BgeCUl";

const STRIPE_PRO =
  "https://checkout.stripe.com/c/pay/cs_live_b11PEdb0Es6vjZ3CgKhMoUik3fyHyg4k7RbZgXDLpzE1VFyc80iBwZdxWa#fidnandhYHdWcXxpYCc%2FJ2FgY2RwaXEnKSd2cGd2ZndsdXFsamtQa2x0cGBrYHZ2QGtkZ2lgYSc%2FY2RpdmApJ2R1bE5gfCc%2FJ3VuWmlsc2BaMDRWb3dSdEJjdk5ndnZGXzE2fFc1dnZ3YU9CTjVKcHRsQEhOa21MPWsxS2NCVnxGaVdccVUyMVJDcUpCVG5gY0tiXX1saHJXZl9ndEBkMj1TMF19al9dTU01NXdrUjNjV0pjJyknY3dqaFZgd3Ngdyc%2FcXdwYCknZ2RmbmJ3anBrYUZqaWp3Jz8nJjVmPTcyMycpJ2lkfGpwcVF8dWAnPydocGlxbFpscWBoJyknYGtkZ2lgVWlkZmBtamlhYHd2Jz9xd3BgeCUl";

const plans = [
  {
    name: "Starter",
    price: "Free",
    period: "",
    units: "1 property · 1 unit",
    cta: "Get started free",
    href: "/auth?mode=signup",
    external: false,
    featured: false,
    features: [
      "Maintenance request system",
      "Tenant portal & invites",
      "In-app messaging",
      "Request history & status tracking",
    ],
  },
  {
    name: "Essential",
    price: "$9",
    period: "/mo",
    units: "Up to 3 properties · 9 units",
    cta: "Start Essential",
    href: STRIPE_ESSENTIAL,
    external: true,
    featured: true,
    features: [
      "Everything in Starter",
      "Expense tracking + CSV export",
      "Calendar & lease reminders",
      "Category & vendor tagging",
      "Activity log",
      "Priority support",
    ],
  },
  {
    name: "Pro",
    price: "$19",
    period: "/mo",
    units: "Up to 10 properties · unlimited units",
    cta: "Start Pro",
    href: STRIPE_PRO,
    external: true,
    featured: false,
    features: [
      "Everything in Essential",
      "Multi-property dashboard",
      "Recurring expenses",
      "Custom categories",
      "Data export (CSV)",
      "Phone & email support",
    ],
  },
];

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
            className="text-sm font-medium text-charcoal-secondary hover:text-charcoal transition-colors px-4 py-2 hidden sm:inline-block"
          >
            I&apos;m a tenant
          </Link>
          <GoogleSignIn
            label="Sign in with Google"
            className="hidden md:inline-flex items-center gap-2.5 text-sm font-medium text-charcoal bg-white hover:bg-warm-100 border border-warm-300 px-4 py-2.5 rounded-xl transition-colors cursor-pointer"
          />
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
            <Building2 className="w-4 h-4" />
            Your personal property management system
          </div>

          <h1
            className="text-5xl md:text-6xl font-bold text-charcoal leading-[1.1] tracking-tight mb-6"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Skip the property management company. DIY with PropTrack.
          </h1>

          <p className="text-lg text-charcoal-secondary leading-relaxed mb-10 max-w-lg mx-auto">
            Maintenance tracking, tenant communication, expense management, and
            a full tenant CRM — built for independent landlords with 1–5 units.
            Not 50.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <GoogleSignIn
              label="Sign up with Google"
              className="inline-flex items-center gap-3 bg-brand hover:bg-brand-dark text-white font-semibold px-8 py-3.5 rounded-xl text-base transition-colors cursor-pointer"
            />
            <Link
              href="/auth?mode=signup"
              className="inline-flex items-center gap-2 bg-white hover:bg-warm-100 text-charcoal font-medium px-8 py-3.5 rounded-xl text-base transition-colors border border-warm-300"
            >
              Sign up with email
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>

        {/* Feature highlights */}
        <div className="mt-24 max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2
              className="text-3xl font-bold text-charcoal mb-3"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Everything you need. Nothing you don&apos;t.
            </h2>
            <p className="text-charcoal-secondary">
              Designed around the exact workflow of landlords with 1–5 units.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                icon: Wrench,
                title: "Maintenance tracking",
                desc: "Tenants submit requests in seconds. You track, respond, and resolve — with a full paper trail for every issue.",
              },
              {
                icon: MessageCircle,
                title: "Tenant communication hub",
                desc: "Stop managing your rentals with text messages. Every conversation is tied to a specific request.",
              },
              {
                icon: Receipt,
                title: "Expense tracking",
                desc: "Log repair costs by property, unit, and category. Export a tax-ready spreadsheet in seconds.",
              },
              {
                icon: Users,
                title: "Tenant CRM",
                desc: "Contact history, move-in dates, lease terms, and full request history per unit. All in one place.",
              },
              {
                icon: LayoutDashboard,
                title: "Property dashboard",
                desc: "See all your units, tenants, open requests, and expenses at a glance. Your rentals, your rules.",
              },
              {
                icon: Building2,
                title: "Tenant portal & invites",
                desc: "Send an invite code. Tenant signs in and lands in their portal — no app download required.",
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
        </div>

        {/* Pricing */}
        <div className="mt-24 text-center">
          <h2
            className="text-3xl font-bold text-charcoal mb-3"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Honest pricing. No surprises.
          </h2>
          <p className="text-charcoal-secondary mb-12">
            Start free. Upgrade when you&apos;re ready. Cancel anytime.
          </p>

          <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={`rounded-2xl p-6 border text-left flex flex-col ${
                  plan.featured
                    ? "bg-white border-brand border-2 ring-4 ring-brand/10"
                    : "bg-white border-warm-300/60"
                }`}
              >
                {plan.featured && (
                  <span className="text-xs font-semibold bg-brand-faint text-brand-dark px-3 py-1 rounded-full self-start">
                    Most popular
                  </span>
                )}
                <div className={plan.featured ? "mt-3" : ""}>
                  <p className="text-sm font-medium text-charcoal-secondary">
                    {plan.name}
                  </p>
                  <div className="flex items-baseline gap-0.5 mt-1">
                    <p
                      className="text-3xl font-bold text-charcoal"
                      style={{ fontFamily: "var(--font-display)" }}
                    >
                      {plan.price}
                    </p>
                    {plan.period && (
                      <span className="text-sm text-charcoal-tertiary">{plan.period}</span>
                    )}
                  </div>
                  <p className="text-sm text-charcoal-tertiary mt-1">
                    {plan.units}
                  </p>
                </div>

                <ul className="mt-6 space-y-3 flex-1">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2.5 text-sm text-charcoal">
                      <Check className="w-4 h-4 text-brand shrink-0 mt-0.5" strokeWidth={2.5} />
                      {feature}
                    </li>
                  ))}
                </ul>

                {plan.external ? (
                  <a
                    href={plan.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`block text-center text-sm font-semibold mt-6 py-2.5 rounded-xl transition-colors ${
                      plan.featured
                        ? "bg-brand text-white hover:bg-brand-dark"
                        : "bg-warm-100 text-charcoal hover:bg-warm-200"
                    }`}
                  >
                    {plan.cta}
                  </a>
                ) : (
                  <Link
                    href={plan.href}
                    className={`block text-center text-sm font-semibold mt-6 py-2.5 rounded-xl transition-colors ${
                      plan.featured
                        ? "bg-brand text-white hover:bg-brand-dark"
                        : "bg-warm-100 text-charcoal hover:bg-warm-200"
                    }`}
                  >
                    {plan.cta}
                  </Link>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Bottom CTA */}
        <div className="mt-24 max-w-2xl mx-auto text-center">
          <h2
            className="text-3xl font-bold text-charcoal mb-4"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Your rentals. Your rules. No property manager needed.
          </h2>
          <p className="text-charcoal-secondary mb-8">
            Free for your first unit — no credit card required.
          </p>
          <Link
            href="/auth?mode=signup"
            className="inline-flex items-center gap-2 bg-brand hover:bg-brand-dark text-white font-semibold px-8 py-3.5 rounded-xl text-base transition-colors"
          >
            Get started free
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-warm-300/60 py-8 px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-charcoal-tertiary">
          <span>&copy; {new Date().getFullYear()} PropTrack. Built for independent landlords.</span>
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
