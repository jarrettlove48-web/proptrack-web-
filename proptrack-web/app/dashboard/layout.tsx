"use client";

import { useState, useEffect, useCallback, createContext, useContext } from "react";
import { useRouter, usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";
import type { Profile, PlanTier } from "@/lib/types";
import { getUpgradeUrl, PLAN_LIMITS } from "@/lib/plans";
import Link from "next/link";
import {
  Building2,
  Wrench,
  MessageCircle,
  Receipt,
  User,
  LogOut,
  Menu,
  X,
  ChevronRight,
  CalendarDays,
  ArrowUpRight,
} from "lucide-react";

interface DashboardContextType {
  profile: Profile | null;
  refreshProfile: () => Promise<void>;
  isDark: boolean;
  toggleDarkMode: () => void;
  showUpgradeModal: (feature: string) => void;
}

const DashboardContext = createContext<DashboardContextType>({
  profile: null,
  refreshProfile: async () => {},
  isDark: false,
  toggleDarkMode: () => {},
  showUpgradeModal: () => {},
});

export function useDashboard() {
  return useContext(DashboardContext);
}

const NAV_ITEMS = [
  { href: "/dashboard", label: "Properties", icon: Building2 },
  { href: "/dashboard/requests", label: "Requests", icon: Wrench },
  { href: "/dashboard/expenses", label: "Expenses", icon: Receipt },
  { href: "/dashboard/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/dashboard/messages", label: "Messages", icon: MessageCircle },
  { href: "/dashboard/account", label: "Account", icon: User },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isDark, setIsDark] = useState(false);
  const [upgradeFeature, setUpgradeFeature] = useState<string | null>(null);

  const fetchProfile = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.push("/auth");
      return;
    }

    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    if (data) {
      if (data.role === "tenant") {
        router.push("/tenant");
        return;
      }
      setProfile(data as Profile);
      if (data.dark_mode) {
        document.documentElement.classList.add("dark");
        document.cookie = "proptrack-dark-mode=true;path=/;max-age=31536000";
        setIsDark(true);
      }
    }
    setLoading(false);
  }, [supabase, router]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const toggleDarkMode = useCallback(async () => {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle("dark", next);
    document.cookie = `proptrack-dark-mode=${next};path=/;max-age=31536000`;
    if (profile) {
      await supabase.from("profiles").update({ dark_mode: next, updated_at: new Date().toISOString() }).eq("id", profile.id);
    }
  }, [isDark, profile, supabase]);

  const showUpgradeModal = useCallback((feature: string) => {
    setUpgradeFeature(feature);
  }, []);

  async function handleSignOut() {
    await supabase.auth.signOut();
    document.documentElement.classList.remove("dark");
    document.cookie = "proptrack-dark-mode=false;path=/;max-age=31536000";
    router.push("/auth");
    router.refresh();
  }

  const plan = (profile?.plan || "starter") as PlanTier;
  const upgradeUrl = getUpgradeUrl(plan);
  const limits = PLAN_LIMITS[plan];

  const upgradeMessages: Record<string, string> = {
    properties: `You can have up to ${limits.maxProperties} propert${limits.maxProperties === 1 ? "y" : "ies"} on the ${plan} plan.`,
    units: `You can have up to ${limits.maxUnits} units on the ${plan} plan.`,
    expenses: `Expense tracking is available on Essential and Pro plans.`,
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-warm-white flex items-center justify-center">
        <div className="w-8 h-8 border-3 border-brand/20 border-t-brand rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <DashboardContext.Provider value={{ profile, refreshProfile: fetchProfile, isDark, toggleDarkMode, showUpgradeModal }}>
      <div className="min-h-screen bg-warm-white flex">
        {/* Desktop sidebar */}
        <aside className="hidden md:flex w-60 bg-surface border-r border-warm-300/60 flex-col fixed h-full">
          <div className="flex items-center gap-2.5 px-5 py-5 border-b border-warm-300/40">
            <div className="w-8 h-8 rounded-lg bg-brand flex items-center justify-center">
              <Building2 className="w-[18px] h-[18px] text-white" strokeWidth={1.8} />
            </div>
            <span
              className="text-lg font-bold tracking-tight text-charcoal"
              style={{ fontFamily: "var(--font-display)" }}
            >
              PropTrack
            </span>
          </div>

          <nav className="flex-1 px-3 py-4 space-y-0.5">
            {NAV_ITEMS.map((item) => {
              const isActive =
                pathname === item.href ||
                (item.href !== "/dashboard" && pathname.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-brand-faint text-brand-dark"
                      : "text-charcoal-secondary hover:bg-warm-100 hover:text-charcoal"
                  }`}
                >
                  <item.icon className="w-[18px] h-[18px]" strokeWidth={1.8} />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="border-t border-warm-300/40 px-4 py-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-full bg-brand-faint flex items-center justify-center text-xs font-semibold text-brand-dark">
                {profile?.name?.charAt(0)?.toUpperCase() || "?"}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-charcoal truncate">
                  {profile?.name || "Landlord"}
                </p>
                <p className="text-xs text-charcoal-tertiary truncate">
                  {profile?.plan || "starter"} plan
                </p>
              </div>
            </div>
            <button
              onClick={handleSignOut}
              className="flex items-center gap-2 text-sm text-charcoal-tertiary hover:text-danger transition-colors w-full px-1"
            >
              <LogOut className="w-4 h-4" strokeWidth={1.8} />
              Sign out
            </button>
          </div>
        </aside>

        {/* Mobile header */}
        <div className="md:hidden fixed top-0 left-0 right-0 z-40 bg-surface border-b border-warm-300/60 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-brand flex items-center justify-center">
              <Building2 className="w-4 h-4 text-white" strokeWidth={1.8} />
            </div>
            <span className="font-bold text-charcoal" style={{ fontFamily: "var(--font-display)" }}>
              PropTrack
            </span>
          </div>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 text-charcoal-secondary"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {/* Mobile menu overlay */}
        {mobileMenuOpen && (
          <div className="md:hidden fixed inset-0 z-30 bg-black/30" onClick={() => setMobileMenuOpen(false)}>
            <div
              className="absolute right-0 top-14 w-64 bg-surface border-l border-warm-300/60 h-full shadow-xl p-4"
              onClick={(e) => e.stopPropagation()}
            >
              <nav className="space-y-1">
                {NAV_ITEMS.map((item) => {
                  const isActive =
                    pathname === item.href ||
                    (item.href !== "/dashboard" && pathname.startsWith(item.href));
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex items-center justify-between px-3 py-3 rounded-xl text-sm font-medium transition-colors ${
                        isActive
                          ? "bg-brand-faint text-brand-dark"
                          : "text-charcoal-secondary hover:bg-warm-100"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <item.icon className="w-[18px] h-[18px]" strokeWidth={1.8} />
                        {item.label}
                      </div>
                      <ChevronRight className="w-4 h-4 opacity-40" />
                    </Link>
                  );
                })}
              </nav>
              <button
                onClick={handleSignOut}
                className="flex items-center gap-2 text-sm text-charcoal-tertiary hover:text-danger transition-colors mt-6 px-3"
              >
                <LogOut className="w-4 h-4" strokeWidth={1.8} />
                Sign out
              </button>
            </div>
          </div>
        )}

        {/* Main content */}
        <main className="flex-1 md:ml-60 pt-14 md:pt-0">
          <div className="max-w-5xl mx-auto px-4 md:px-8 py-6 md:py-8 page-enter">
            {children}
          </div>
        </main>
      </div>

      {/* Upgrade Modal */}
      {upgradeFeature && upgradeUrl && (
        <div className="fixed inset-0 z-50 bg-black/30 flex items-end sm:items-center justify-center p-4">
          <div className="bg-surface rounded-2xl w-full max-w-sm p-6 text-center">
            <div className="w-12 h-12 rounded-2xl bg-brand-faint flex items-center justify-center mx-auto mb-4">
              <ArrowUpRight className="w-6 h-6 text-brand" strokeWidth={1.8} />
            </div>
            <h3 className="text-lg font-bold text-charcoal mb-2">Upgrade your plan</h3>
            <p className="text-sm text-charcoal-secondary mb-6">
              {upgradeMessages[upgradeFeature] || "Upgrade to unlock this feature."}
            </p>
            <a
              href={upgradeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full bg-brand hover:bg-brand-dark text-white font-semibold py-3 rounded-xl transition-colors mb-3"
            >
              Upgrade now
            </a>
            <button
              onClick={() => setUpgradeFeature(null)}
              className="text-sm text-charcoal-secondary hover:text-charcoal transition-colors"
            >
              Maybe later
            </button>
          </div>
        </div>
      )}
    </DashboardContext.Provider>
  );
}
