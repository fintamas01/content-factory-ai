import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  const body = await req.text();
  const signature = req.headers.get('Stripe-Signature') as string;

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body, 
      signature, 
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err: any) {
    console.error(`Webhook hiba: ${err.message}`);
    return NextResponse.json({ error: `Webhook Error: ${err.message}` }, { status: 400 });
  }

  // --- 1. ESET: ÚJ ELŐFIZETÉS (checkout.session.completed) ---
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as any; // 'any'-re castingoljuk a nyugalom érdekében
    const subscriptionId = session.subscription;

    if (subscriptionId) {
      // Itt a ': any' a kulcs, ezzel megkerüljük a TS szigorát
      const subscription: any = await stripe.subscriptions.retrieve(subscriptionId);

      // Most már a TS nem fog panaszkodni a 'items' vagy 'current_period_end' miatt
      const priceId = subscription.items.data[0].price.id;
      const currentPeriodEnd = new Date(subscription.current_period_end * 1000).toISOString();

      const { error } = await supabaseAdmin.from('subscriptions').upsert({
        user_id: session.metadata?.userId,
        stripe_customer_id: session.customer,
        stripe_subscription_id: subscriptionId,
        status: 'active',
        price_id: priceId,
        current_period_end: currentPeriodEnd,
      });

      if (error) {
        console.error("Supabase mentési hiba:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }
  }

  // --- 2. ESET: MEGÚJÍTÁS (invoice.payment_succeeded) ---
  if (event.type === 'invoice.payment_succeeded') {
    const invoice = event.data.object as any; // Itt is 'any'-t használunk
    const subscriptionId = invoice.subscription;

    if (subscriptionId) {
      const subscription: any = await stripe.subscriptions.retrieve(subscriptionId);
      
      const currentPeriodEnd = new Date(subscription.current_period_end * 1000).toISOString();
      const priceId = subscription.items.data[0].price.id;

      const { error } = await supabaseAdmin
        .from('subscriptions')
        .update({
          current_period_end: currentPeriodEnd,
          status: 'active',
          price_id: priceId 
        })
        .eq('stripe_subscription_id', subscriptionId);
        
      if (error) {
        console.error("Supabase frissítési hiba:", error);
      }
    }
  }

  return NextResponse.json({ received: true });
}