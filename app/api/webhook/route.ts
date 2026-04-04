import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getStripeServer } from "@/lib/stripe/server";

export const runtime = "nodejs";

let supabaseAdminSingleton: SupabaseClient | null = null;

function getSupabaseServiceRole(): SupabaseClient {
  if (supabaseAdminSingleton) return supabaseAdminSingleton;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }
  supabaseAdminSingleton = createClient(url, key);
  return supabaseAdminSingleton;
}

/** Billing period end: Stripe exposes this on subscription items (see SubscriptionItem.current_period_end). */
function periodEndIso(sub: Stripe.Subscription): string {
  const end =
    sub.items?.data?.[0]?.current_period_end ??
    (sub as Stripe.Subscription & { current_period_end?: number })
      .current_period_end;
  if (end) {
    return new Date(end * 1000).toISOString();
  }
  const now = new Date();
  now.setDate(now.getDate() + 30);
  return now.toISOString();
}

function customerIdFromStripe(
  customer: string | Stripe.Customer | Stripe.DeletedCustomer | null
): string | null {
  if (!customer) return null;
  if (typeof customer === "string") return customer;
  if (customer.deleted) return null;
  return customer.id;
}

/** Stripe API 2025+: subscription id lives on `invoice.parent.subscription_details`. */
function subscriptionIdFromInvoice(invoice: Stripe.Invoice): string | null {
  const parent = invoice.parent;
  if (parent?.type === "subscription_details" && parent.subscription_details) {
    const sub = parent.subscription_details.subscription;
    if (typeof sub === "string") return sub;
    if (sub && typeof sub === "object" && "id" in sub) return sub.id;
  }
  const legacy = (
    invoice as Stripe.Invoice & { subscription?: string | Stripe.Subscription | null }
  ).subscription;
  if (typeof legacy === "string") return legacy;
  if (legacy && typeof legacy === "object" && "id" in legacy) return legacy.id;
  return null;
}

export async function POST(req: Request) {
  if (!process.env.STRIPE_WEBHOOK_SECRET?.trim()) {
    console.error("STRIPE_WEBHOOK_SECRET is not set");
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }

  let supabaseAdmin: SupabaseClient;
  try {
    supabaseAdmin = getSupabaseServiceRole();
  } catch (e) {
    console.error("Webhook Supabase config:", e);
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }

  let stripe: ReturnType<typeof getStripeServer>;
  try {
    stripe = getStripeServer();
  } catch (e) {
    console.error("Webhook Stripe config:", e);
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }

  const body = await req.text();
  const signature = req.headers.get("Stripe-Signature") as string;

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET.trim()
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("Webhook signature error:", msg);
    return NextResponse.json({ error: `Webhook Error: ${msg}` }, { status: 400 });
  }

  console.log(`Webhook: ${event.type}`);

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const subscriptionId = session.subscription;

    if (subscriptionId && typeof subscriptionId === "string") {
      try {
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        const currentPeriodEnd = periodEndIso(subscription);
        const priceId = subscription.items?.data?.[0]?.price?.id;
        const userId = session.metadata?.userId;

        if (!userId) {
          console.error(
            "checkout.session.completed: missing metadata.userId — acknowledge to avoid Stripe retry loop"
          );
          return NextResponse.json({ received: true, error: "missing user id" });
        }

        const customer = customerIdFromStripe(session.customer as Stripe.Checkout.Session["customer"]);

        const { error } = await supabaseAdmin.from("subscriptions").upsert(
          {
            user_id: userId,
            stripe_customer_id: customer,
            stripe_subscription_id: subscriptionId,
            status: subscription.status === "active" ? "active" : subscription.status,
            price_id: priceId,
            current_period_end: currentPeriodEnd,
          },
          { onConflict: "user_id" }
        );

        if (error) {
          console.error("subscriptions upsert:", error);
          return NextResponse.json({ error: error.message }, { status: 500 });
        }
      } catch (err: unknown) {
        console.error("checkout.session.completed handler:", err);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
      }
    }
  }

  if (event.type === "invoice.payment_succeeded") {
    const invoice = event.data.object as Stripe.Invoice;
    const subscriptionId = subscriptionIdFromInvoice(invoice);

    if (subscriptionId) {
      try {
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        const currentPeriodEnd = periodEndIso(subscription);
        const priceId = subscription.items?.data?.[0]?.price?.id;

        const { error } = await supabaseAdmin
          .from("subscriptions")
          .update({
            current_period_end: currentPeriodEnd,
            status: subscription.status === "active" ? "active" : subscription.status,
            price_id: priceId,
          })
          .eq("stripe_subscription_id", subscriptionId);

        if (error) console.error("invoice update:", error);
      } catch (err) {
        console.error("invoice.payment_succeeded:", err);
      }
    }
  }

  if (
    event.type === "customer.subscription.updated" ||
    event.type === "customer.subscription.created"
  ) {
    const subscription = event.data.object as Stripe.Subscription;
    const subscriptionId = subscription.id;
    const currentPeriodEnd = periodEndIso(subscription);
    const priceId = subscription.items?.data?.[0]?.price?.id;
    let userId = subscription.metadata?.userId ?? null;
    const customer = customerIdFromStripe(subscription.customer);

    if (!userId) {
      const { data: existing } = await supabaseAdmin
        .from("subscriptions")
        .select("user_id")
        .eq("stripe_subscription_id", subscriptionId)
        .maybeSingle();
      userId = existing?.user_id ?? null;
    }

    if (userId) {
      const status =
        subscription.status === "active"
          ? "active"
          : subscription.status === "canceled"
            ? "canceled"
            : subscription.status;

      const { error } = await supabaseAdmin.from("subscriptions").upsert(
        {
          user_id: userId,
          stripe_customer_id: customer,
          stripe_subscription_id: subscriptionId,
          status,
          price_id: priceId,
          current_period_end: currentPeriodEnd,
        },
        { onConflict: "user_id" }
      );
      if (error) console.error("subscription.updated upsert:", error);
    } else {
      console.warn("subscription sync: no user id for", subscriptionId);
    }
  }

  if (event.type === "customer.subscription.deleted") {
    const subscription = event.data.object as Stripe.Subscription;
    const { error } = await supabaseAdmin
      .from("subscriptions")
      .update({
        status: "canceled",
        current_period_end: periodEndIso(subscription),
      })
      .eq("stripe_subscription_id", subscription.id);

    if (error) console.error("subscription.deleted:", error);
  }

  return NextResponse.json({ received: true });
}
