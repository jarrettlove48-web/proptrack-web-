import type { PlanTier } from "./types";

// Server reads from env var; client falls back to defaults (cosmetic UI only)
const DEFAULT_ADMIN_EMAILS = ["jarrettlove48@gmail.com", "bullock.wesley@gmail.com"];

function getAdminEmails(): string[] {
  if (typeof process !== "undefined" && process.env?.ADMIN_EMAILS) {
    return process.env.ADMIN_EMAILS.split(",").map((e) => e.trim().toLowerCase());
  }
  return DEFAULT_ADMIN_EMAILS;
}

export function isAdmin(email: string | undefined): boolean {
  return !!email && getAdminEmails().includes(email.toLowerCase());
}

export function getEffectivePlan(plan: PlanTier, email?: string, adminOverride?: PlanTier | null): PlanTier {
  if (isAdmin(email)) return adminOverride || "pro";
  return plan;
}

export const PLAN_LIMITS = {
  starter: { maxProperties: 1, maxUnits: 3, expenseTracking: false, maxContractors: 0 },
  essential: { maxProperties: 5, maxUnits: 15, expenseTracking: true, maxContractors: 5 },
  pro: { maxProperties: Infinity, maxUnits: Infinity, expenseTracking: true, maxContractors: Infinity },
} as const;

/** Create a Stripe Checkout session and redirect. Call from client-side. */
export async function startCheckout(plan: "essential" | "pro"): Promise<void> {
  const res = await fetch("/api/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ plan }),
  });
  const data = await res.json();
  if (data.url) {
    window.location.href = data.url;
  } else {
    throw new Error(data.error || "Failed to start checkout");
  }
}

export const PLAN_LABELS: Record<PlanTier, string> = {
  starter: "Starter (Free)",
  essential: "Essential ($9/mo)",
  pro: "Pro ($19/mo)",
};

export function canAddProperty(plan: PlanTier, currentCount: number): boolean {
  return currentCount < PLAN_LIMITS[plan].maxProperties;
}

export function canAddUnit(plan: PlanTier, currentCount: number): boolean {
  return currentCount < PLAN_LIMITS[plan].maxUnits;
}

export function canTrackExpenses(plan: PlanTier): boolean {
  return PLAN_LIMITS[plan].expenseTracking;
}

export function canUseContractors(plan: PlanTier): boolean {
  return PLAN_LIMITS[plan].maxContractors > 0;
}

export function canAddContractor(plan: PlanTier, currentCount: number): boolean {
  return currentCount < PLAN_LIMITS[plan].maxContractors;
}

export function getUpgradePlan(plan: PlanTier): "essential" | "pro" | null {
  if (plan === "starter") return "essential";
  if (plan === "essential") return "pro";
  return null;
}
