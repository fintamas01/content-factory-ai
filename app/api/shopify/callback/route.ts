import crypto from "node:crypto";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { requireActiveClientId } from "@/lib/clients/server";
import { isValidShopDomain, normalizeShopDomain, verifyShopifyHmac } from "@/lib/shopify/oauth";

async function exchangeAccessToken(params: {
  shop: string;
  code: string;
  apiKey: string;
  apiSecret: string;
}): Promise<{ ok: true; access_token: string } | { ok: false; error: string }> {
  const resp = await fetch(`https://${params.shop}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: params.apiKey,
      client_secret: params.apiSecret,
      code: params.code,
    }),
  });
  const text = await resp.text();
  if (!resp.ok) return { ok: false, error: text || `HTTP ${resp.status}` };
  try {
    const json = JSON.parse(text);
    const token = typeof json?.access_token === "string" ? json.access_token : "";
    if (!token) return { ok: false, error: "Missing access_token." };
    return { ok: true, access_token: token };
  } catch {
    return { ok: false, error: "Invalid JSON from Shopify token exchange." };
  }
}

export async function GET(req: Request) {
  try {
    const SHOPIFY_API_KEY = process.env.SHOPIFY_API_KEY;
    const SHOPIFY_API_SECRET = process.env.SHOPIFY_API_SECRET;
    if (!SHOPIFY_API_KEY || !SHOPIFY_API_SECRET) {
      return NextResponse.redirect(new URL("/dashboard/connections?error=shopify_not_configured", req.url));
    }
    const isProd = process.env.NODE_ENV === "production";

    const url = new URL(req.url);
    const shopRaw = url.searchParams.get("shop") ?? "";
    const code = url.searchParams.get("code") ?? "";
    const state = url.searchParams.get("state") ?? "";
    const hmac = url.searchParams.get("hmac") ?? "";

    const shop = normalizeShopDomain(shopRaw);
    if (!shop || !isValidShopDomain(shop) || !code || !state || !hmac) {
      return NextResponse.redirect(new URL("/dashboard/connections?error=shopify_invalid_callback", req.url));
    }

    const cookieStore = await cookies();
    const stateCookie = cookieStore.get("shopify_oauth_state")?.value ?? "";
    const shopCookie = cookieStore.get("shopify_oauth_shop")?.value ?? "";
    if (!stateCookie || stateCookie !== state || (shopCookie && shopCookie !== shop)) {
      return NextResponse.redirect(new URL("/dashboard/connections?error=shopify_state_mismatch", req.url));
    }

    // HMAC validation
    const query: Record<string, string> = {};
    url.searchParams.forEach((v, k) => {
      query[k] = v;
    });
    const okHmac = verifyShopifyHmac({ query, secret: SHOPIFY_API_SECRET });
    if (!okHmac) {
      return NextResponse.redirect(new URL("/dashboard/connections?error=shopify_hmac_invalid", req.url));
    }

    // Optional: prevent replay within cookie lifetime by rotating state.
    cookieStore.set("shopify_oauth_state", crypto.randomBytes(8).toString("hex"), {
      httpOnly: true,
      sameSite: "lax",
      secure: isProd,
      path: "/",
      maxAge: 1,
    });

    // Auth + client scoping
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnon =
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANNON_KEY;
    if (!supabaseUrl || !supabaseAnon) {
      return NextResponse.redirect(new URL("/dashboard/connections?error=server_config", req.url));
    }
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

    const { data: authData } = await supabase.auth.getUser();
    const user = authData?.user;
    if (!user) {
      return NextResponse.redirect(new URL("/?error=unauthorized", req.url));
    }

    let clientId: string;
    try {
      const active = await requireActiveClientId(supabase, cookieStore, user.id);
      clientId = active.clientId;
    } catch {
      return NextResponse.redirect(new URL("/dashboard/connections?error=no_active_client", req.url));
    }

    const exchanged = await exchangeAccessToken({
      shop,
      code,
      apiKey: SHOPIFY_API_KEY,
      apiSecret: SHOPIFY_API_SECRET,
    });
    if (!exchanged.ok) {
      console.error("shopify token exchange:", exchanged.error);
      return NextResponse.redirect(new URL("/dashboard/connections?error=shopify_exchange_failed", req.url));
    }

    const { error: upsertErr } = await supabase
      .from("shopify_connections")
      .upsert(
        {
          user_id: user.id,
          client_id: clientId,
          store_domain: shop,
          access_token: exchanged.access_token,
          status: "connected",
        },
        { onConflict: "user_id,client_id" }
      );

    if (upsertErr) {
      console.error("shopify connection upsert:", upsertErr);
      return NextResponse.redirect(new URL("/dashboard/connections?error=shopify_save_failed", req.url));
    }

    return NextResponse.redirect(new URL("/dashboard/connections?success=shopify_connected", req.url));
  } catch (e) {
    console.error("GET /api/shopify/callback:", e);
    return NextResponse.redirect(new URL("/dashboard/connections?error=shopify_callback_failed", req.url));
  }
}

