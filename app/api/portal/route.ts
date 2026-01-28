import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANNON_KEY!,
    {
      cookies: {
        get(name: string) { return cookieStore.get(name)?.value },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: subData } = await supabase
    .from('subscriptions')
    .select('stripe_customer_id')
    .eq('user_id', user.id)
    .single();

  if (!subData?.stripe_customer_id) {
    return NextResponse.json({ error: 'Nincs Stripe azonosító' }, { status: 400 });
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: subData.stripe_customer_id,
    return_url: `${process.env.NEXT_PUBLIC_SITE_URL}/billing`,
  });

  return NextResponse.json({ url: session.url });
}