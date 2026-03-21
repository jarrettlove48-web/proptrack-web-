import { NextResponse } from "next/server";
import crypto from "crypto";

const PRICE_TO_PLAN: Record<string, string> = {
  "price_1TBNajGfsKbssCZ4OjUVIsvg": "essential",
  "price_1TBNb4GfsKbssCZ4oa3fn82v": "pro",
};

export async function POST(request: Request) {
  const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
  const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!STRIPE_WEBHOOK_SECRET || !SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  // 1. Read raw body BEFORE any parsing (stream can only be consumed once)
  const rawBody = await request.text();

  // 2. Verify Stripe signature
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 });
  }

  let event: any;
  try {
    event = verifyStripeSignature(rawBody, signature, STRIPE_WEBHOOK_SECRET);
  } catch (err: any) {
    console.error("Webhook signature verification failed:", err.message);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  // 3. Handle events
  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const supabaseUserId =
          session.client_reference_id || session.metadata?.supabase_user_id;
        const customerId = session.customer;
        const subscriptionId = session.subscription;

        if (!supabaseUserId) {
          console.warn("checkout.session.completed: no supabase_user_id, skipping");
          break;
        }

        // Fetch subscription to get the price ID → plan tier
        let plan = "starter";
        if (subscriptionId && STRIPE_SECRET_KEY) {
          const sub = await stripeGet(`/v1/subscriptions/${subscriptionId}`, STRIPE_SECRET_KEY);
          const priceId = sub?.items?.data?.[0]?.price?.id;
          plan = PRICE_TO_PLAN[priceId] || "starter";
        }

        await updateProfileById(supabaseUserId, {
          plan,
          stripe_customer_id: customerId,
          stripe_subscription_id: subscriptionId,
        }, SUPABASE_URL, SUPABASE_SERVICE_KEY);

        console.log(`checkout.session.completed: user=${supabaseUserId} plan=${plan}`);
        break;
      }

      case "customer.subscription.updated": {
        const sub = event.data.object;
        const priceId = sub.items?.data?.[0]?.price?.id;
        const plan = PRICE_TO_PLAN[priceId] || "starter";
        const supabaseUserId = sub.metadata?.supabase_user_id;
        const customerId = sub.customer;

        const updates = { plan, stripe_subscription_id: sub.id };

        if (supabaseUserId) {
          await updateProfileById(supabaseUserId, updates, SUPABASE_URL, SUPABASE_SERVICE_KEY);
        } else {
          await updateProfileByCustomerId(customerId, updates, SUPABASE_URL, SUPABASE_SERVICE_KEY);
        }

        console.log(`subscription.updated: plan=${plan}`);
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object;
        await updateProfileByCustomerId(sub.customer, {
          plan: "starter",
          stripe_subscription_id: null,
        }, SUPABASE_URL, SUPABASE_SERVICE_KEY);

        console.log(`subscription.deleted: customer=${sub.customer}`);
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object;
        console.warn(`invoice.payment_failed: customer=${invoice.customer}`);
        break;
      }

      default:
        // Acknowledge unhandled events to prevent Stripe retries
        break;
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("Webhook processing error:", err);
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }
}

// --- Stripe signature verification (HMAC-SHA256 with timing-safe comparison) ---

function verifyStripeSignature(rawBody: string, signature: string, secret: string): any {
  const parts: Record<string, string> = {};
  signature.split(",").forEach((part) => {
    const [key, val] = part.split("=");
    parts[key] = val;
  });

  const timestamp = parts.t;
  const sig = parts.v1;
  if (!timestamp || !sig) throw new Error("Invalid signature format");

  // Verify HMAC
  const payload = `${timestamp}.${rawBody}`;
  const expected = crypto.createHmac("sha256", secret).update(payload).digest("hex");

  if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig))) {
    throw new Error("Signature mismatch");
  }

  // Reject events older than 5 minutes (replay protection)
  if (Math.abs(Date.now() / 1000 - parseInt(timestamp)) > 300) {
    throw new Error("Timestamp outside tolerance");
  }

  return JSON.parse(rawBody);
}

// --- Stripe API helper ---

async function stripeGet(path: string, secretKey: string) {
  const res = await fetch(`https://api.stripe.com${path}`, {
    headers: { Authorization: `Bearer ${secretKey}` },
  });
  return res.json();
}

// --- Supabase REST helpers (bypass RLS with service role key) ---

async function updateProfileById(
  userId: string,
  updates: Record<string, any>,
  supabaseUrl: string,
  serviceKey: string,
) {
  const res = await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${userId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      Prefer: "return=minimal",
    },
    body: JSON.stringify(updates),
  });
  if (!res.ok) {
    throw new Error(`Supabase update failed for ${userId}: ${await res.text()}`);
  }
}

async function updateProfileByCustomerId(
  customerId: string,
  updates: Record<string, any>,
  supabaseUrl: string,
  serviceKey: string,
) {
  const res = await fetch(
    `${supabaseUrl}/rest/v1/profiles?stripe_customer_id=eq.${customerId}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        Prefer: "return=minimal",
      },
      body: JSON.stringify(updates),
    },
  );
  if (!res.ok) {
    throw new Error(`Supabase update by customer_id failed: ${await res.text()}`);
  }
}
