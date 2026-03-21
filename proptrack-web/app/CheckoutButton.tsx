"use client";

import { useState } from "react";
import { startCheckout } from "@/lib/plans";

export default function CheckoutButton({
  plan,
  className,
  children,
}: {
  plan: "essential" | "pro";
  className: string;
  children: React.ReactNode;
}) {
  const [loading, setLoading] = useState(false);

  return (
    <button
      onClick={async () => {
        setLoading(true);
        try {
          await startCheckout(plan);
        } catch {
          setLoading(false);
        }
      }}
      disabled={loading}
      className={`${className} disabled:opacity-60`}
    >
      {loading ? "Redirecting..." : children}
    </button>
  );
}
