import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { isAllowedCheckoutPriceId } from "@/lib/billing/pricing";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const priceId =
    typeof body === "object" &&
    body !== null &&
    "priceId" in body &&
    typeof (body as { priceId: unknown }).priceId === "string"
      ? (body as { priceId: string }).priceId.trim()
      : "";

  if (!priceId || !isAllowedCheckoutPriceId(priceId)) {
    return NextResponse.json({ error: "Invalid or disallowed price" }, { status: 400 });
  }

  const cookieStore = await cookies();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnon =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANNON_KEY!;

  const supabase = createServerClient(supabaseUrl, supabaseAnon, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          /* ignore */
        }
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");
  if (!siteUrl) {
    console.error("NEXT_PUBLIC_SITE_URL is not set");
    return NextResponse.json(
      { error: "Server configuration error" },
      { status: 500 }
    );
  }

  const session = await stripe.checkout.sessions.create({
    customer_email: user.email ?? undefined,
    line_items: [{ price: priceId, quantity: 1 }],
    mode: "subscription",
    success_url: `${siteUrl}/dashboard/billing?checkout=success`,
    cancel_url: `${siteUrl}/pricing`,
    metadata: { userId: user.id },
    subscription_data: {
      metadata: { userId: user.id },
    },
    client_reference_id: user.id,
  });

  return NextResponse.json({ url: session.url });
}
