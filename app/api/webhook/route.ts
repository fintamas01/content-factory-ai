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
    console.error(`Webhook Signature Error: ${err.message}`);
    return NextResponse.json({ error: `Webhook Error: ${err.message}` }, { status: 400 });
  }

  console.log(`🔔 Webhook received: ${event.type}`);

  // --- 1. ÚJ ELŐFIZETÉS (checkout.session.completed) ---
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as any;
    const subscriptionId = session.subscription;

    console.log(`Processing Session: ${session.id}, Sub ID: ${subscriptionId}`);

    if (subscriptionId) {
      try {
        // Lekérjük az előfizetést
        const subscription: any = await stripe.subscriptions.retrieve(subscriptionId);
        
        console.log("Stripe Subscription Data:", JSON.stringify(subscription, null, 2)); // Debug log

        // BIZTONSÁGOS DÁTUM KONVERTÁLÁS
        let currentPeriodEnd;
        if (subscription.current_period_end) {
            currentPeriodEnd = new Date(subscription.current_period_end * 1000).toISOString();
        } else {
            console.warn("⚠️ HIÁNYZÓ current_period_end! Fallback dátum használata.");
            // Ha nincs dátum, adjunk hozzá 30 napot a mostanihoz
            const now = new Date();
            now.setDate(now.getDate() + 30);
            currentPeriodEnd = now.toISOString();
        }

        const priceId = subscription.items?.data?.[0]?.price?.id;

        const { error } = await supabaseAdmin.from('subscriptions').upsert({
          user_id: session.metadata?.userId,
          stripe_customer_id: session.customer,
          stripe_subscription_id: subscriptionId,
          status: 'active',
          price_id: priceId,
          current_period_end: currentPeriodEnd,
        });

        if (error) {
          console.error("❌ Supabase Upsert Error:", error);
          return NextResponse.json({ error: error.message }, { status: 500 });
        }
        console.log("✅ Subscription saved successfully!");

      } catch (err: any) {
        console.error("❌ Error retrieving/saving subscription:", err);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
      }
    } else {
        console.error("❌ No subscription ID found in session.");
    }
  }

  // --- 2. MEGÚJÍTÁS (invoice.payment_succeeded) ---
  if (event.type === 'invoice.payment_succeeded') {
    const invoice = event.data.object as any;
    const subscriptionId = invoice.subscription;

    if (subscriptionId) {
      try {
        const subscription: any = await stripe.subscriptions.retrieve(subscriptionId);
        
        let currentPeriodEnd;
        if (subscription.current_period_end) {
             currentPeriodEnd = new Date(subscription.current_period_end * 1000).toISOString();
        } else {
             const now = new Date();
             now.setDate(now.getDate() + 30);
             currentPeriodEnd = now.toISOString();
        }
        
        const priceId = subscription.items?.data?.[0]?.price?.id;

        const { error } = await supabaseAdmin
          .from('subscriptions')
          .update({
            current_period_end: currentPeriodEnd,
            status: 'active',
            price_id: priceId 
          })
          .eq('stripe_subscription_id', subscriptionId);
          
        if (error) console.error("❌ Supabase Update Error:", error);
        else console.log("✅ Subscription renewed successfully!");

      } catch (err) {
        console.error("❌ Error in invoice handler:", err);
      }
    }
  }

  return NextResponse.json({ received: true });
}