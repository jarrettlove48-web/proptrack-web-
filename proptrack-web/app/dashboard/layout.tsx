"use client";

import { useState, useEffect, useCallback, createContext, useContext } from "react";
import { useRouter, usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";
import type { Profile } from "@/lib/types";
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
} from "lucide-react";

interface DashboardContextType {
  profile: Profile | null;
  refreshProfile: () => Promise<void>;
}

const DashboardContext = createContext<DashboardContextType>({
  profile: null,
  refreshProfile: async () => {},
});

export function useDashboard() {
  return useContext(DashboardContext);
}

const NAV_ITEMS = [
  { href: "/dashboard", label: "Properties", icon: Building2 },
  { href: "/dashboard/requests", label: "Requests", icon: Wrench },
  { href: "/dashboard/expenses", label: "Expenses", icon: Receipt },
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
      // Redirect tenants to their portal
      if (data.role === "tenant") {
        router.push("/tenant");
        return;
      }
      setProfile(data as Profile);
    }
    setLoading(false);
  }, [supabase, router]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/auth");
    router.refresh();
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-warm-white flex items-center justify-center">
        <div className="w-8 h-8 border-3 border-brand/20 border-t-brand rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <DashboardContext.Provider value={{ profile, refreshProfile: fetchProfile }}>
      <div className="min-h-screen bg-warm-white flex">
        {/* Desktop sidebar */}
        <aside className="hidden md:flex w-60 bg-white border-r border-warm-300/60 flex-col fixed h-full">
          {/* Logo */}
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

          {/* Nav */}
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

          {/* User section */}
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
        <div className="md:hidden fixed top-0 left-0 right-0 z-40 bg-white border-b border-warm-300/60 px-4 py-3 flex items-center justify-between">
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
              className="absolute right-0 top-14 w-64 bg-white border-l border-warm-300/60 h-full shadow-xl p-4"
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
    </DashboardContext.Provider>
  );
}
