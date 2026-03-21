import { NextResponse } from "next/server";

const PRICE_IDS: Record<string, string> = {
  essential: "price_1TBNajGfsKbssCZ4OjUVIsvg",
  pro: "price_1TBNb4GfsKbssCZ4oa3fn82v",
};

export async function POST(request: Request) {
  try {
    const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
    if (!STRIPE_SECRET_KEY) {
      return NextResponse.json({ error: "Stripe not configured" }, { status: 500 });
    }

    const { plan, email } = await request.json();

    const priceId = PRICE_IDS[plan];
    if (!priceId) {
      return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
    }

    const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        mode: "subscription",
        "line_items[0][price]": priceId,
        "line_items[0][quantity]": "1",
        success_url: `https://app.proptrack.app/dashboard/account?upgraded=${plan}`,
        cancel_url: "https://app.proptrack.app/dashboard/account",
        allow_promotion_codes: "true",
        ...(email ? { customer_email: email } : {}),
      }),
    });

    const session = await response.json();

    if (!response.ok) {
      console.error("Stripe error:", session);
      return NextResponse.json({ error: session.error?.message || "Stripe error" }, { status: 500 });
    }

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("Checkout error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
