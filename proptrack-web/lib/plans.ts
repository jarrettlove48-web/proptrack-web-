import type { PlanTier } from "./types";

export const ADMIN_EMAILS = ["jarrettlove48@gmail.com", "bullock.wesley@gmail.com"];

export function isAdmin(email: string | undefined): boolean {
  return !!email && ADMIN_EMAILS.includes(email.toLowerCase());
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

export const STRIPE_URLS = {
  essential:
    "https://checkout.stripe.com/c/pay/cs_live_b1AHg4Pv6dxfzUzqQ9KPsREMOa1LfTrocOvqaLQr4yRzWNXs1PPUUG6QQ2#fidnandhYHdWcXxpYCc%2FJ2FgY2RwaXEnKSd2cGd2ZndsdXFsamtQa2x0cGBrYHZ2QGtkZ2lgYSc%2FY2RpdmApJ2R1bE5gfCc%2FJ3VuWmlsc2BaMDRWb3dSdEJjdk5ndnZGXzE2fFc1dnZ3YU9CTjVKcHRsQEhOa21MPWsxS2NCVnxGaVdccVUyMVJDcUpCVG5gY0tiXX1saHJXZl9ndEBkMj1TMF19al9dTU01NXdrUjNjV0pjJyknY3dqaFZgd3Ngdyc%2FcXdwYCknZ2RmbmJ3anBrYUZqaWp3Jz8nJjVmPTcyMycpJ2lkfGpwcVF8dWAnPydocGlxbFpscWBoJyknYGtkZ2lgVWlkZmBtamlhYHd2Jz9xd3BgeCUl",
  pro:
    "https://checkout.stripe.com/c/pay/cs_live_b11PEdb0Es6vjZ3CgKhMoUik3fyHyg4k7RbZgXDLpzE1VFyc80iBwZdxWa#fidnandhYHdWcXxpYCc%2FJ2FgY2RwaXEnKSd2cGd2ZndsdXFsamtQa2x0cGBrYHZ2QGtkZ2lgYSc%2FY2RpdmApJ2R1bE5gfCc%2FJ3VuWmlsc2BaMDRWb3dSdEJjdk5ndnZGXzE2fFc1dnZ3YU9CTjVKcHRsQEhOa21MPWsxS2NCVnxGaVdccVUyMVJDcUpCVG5gY0tiXX1saHJXZl9ndEBkMj1TMF19al9dTU01NXdrUjNjV0pjJyknY3dqaFZgd3Ngdyc%2FcXdwYCknZ2RmbmJ3anBrYUZqaWp3Jz8nJjVmPTcyMycpJ2lkfGpwcVF8dWAnPydocGlxbFpscWBoJyknYGtkZ2lgVWlkZmBtamlhYHd2Jz9xd3BgeCUl",
} as const;

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

export function getUpgradeUrl(plan: PlanTier): string | null {
  if (plan === "starter") return STRIPE_URLS.essential;
  if (plan === "essential") return STRIPE_URLS.pro;
  return null;
}
