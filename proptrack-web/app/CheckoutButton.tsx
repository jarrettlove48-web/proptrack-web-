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
  const [error, setError] = useState("");

  return (
    <>
      <button
        onClick={async () => {
          setLoading(true);
          setError("");
          try {
            await startCheckout(plan);
          } catch (err) {
            setError(err instanceof Error ? err.message : "Checkout failed");
            setLoading(false);
          }
        }}
        disabled={loading}
        className={`${className} disabled:opacity-60`}
      >
        {loading ? "Redirecting..." : children}
      </button>
      {error && <p className="text-xs text-red-500 mt-2 text-center">{error}</p>}
    </>
  );
}
