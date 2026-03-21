import Stripe from "stripe";
import { NextResponse } from "next/server";

const PRICE_IDS: Record<string, string> = {
  essential: "price_1TBNajGfsKbssCZ4OjUVIsvg",
  pro: "price_1TBNb4GfsKbssCZ4oa3fn82v",
};

let _stripe: Stripe | null = null;
function getStripe() {
  if (!_stripe && process.env.STRIPE_SECRET_KEY) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  }
  return _stripe;
}

export async function POST(request: Request) {
  try {
    const stripe = getStripe();
    if (!stripe) {
      return NextResponse.json({ error: "Stripe not configured" }, { status: 500 });
    }

    const { plan, email } = await request.json();

    const priceId = PRICE_IDS[plan];
    if (!priceId) {
      return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
    }

    const successUrl = "https://app.proptrack.app/dashboard/account?upgraded=" + plan;
    const cancelUrl = "https://app.proptrack.app/dashboard/account";

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      ...(email ? { customer_email: email } : {}),
    });

    return NextResponse.json({ url: session.url });
  } catch (err: unknown) {
    console.error("Checkout error:", err);
    const message = err instanceof Error ? err.message : "Failed to create checkout session";
    const stripeCode = (err as { code?: string })?.code || undefined;
    const stripeType = (err as { type?: string })?.type || undefined;
    return NextResponse.json({ error: message, code: stripeCode, type: stripeType }, { status: 500 });
  }
}
