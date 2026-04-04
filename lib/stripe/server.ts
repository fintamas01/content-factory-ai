import Stripe from "stripe";

let stripeSingleton: Stripe | null = null;

/**
 * Stripe server client. Requires STRIPE_SECRET_KEY (test or live — must match
 * STRIPE_WEBHOOK_SECRET and Dashboard mode).
 */
export function getStripeServer(): Stripe {
  if (stripeSingleton) return stripeSingleton;
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is not set");
  }
  stripeSingleton = new Stripe(key);
  return stripeSingleton;
}
