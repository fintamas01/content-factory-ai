import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { requireActiveClientId } from "@/lib/clients/server";
import {
  buildShopifyAuthorizeUrl,
  isValidShopDomain,
  normalizeShopDomain,
  randomState,
} from "@/lib/shopify/oauth";

export async function POST(req: Request) {
  try {
    const SHOPIFY_API_KEY = process.env.SHOPIFY_API_KEY;
    if (!SHOPIFY_API_KEY) {
      return NextResponse.json({ error: "Shopify is not configured." }, { status: 500 });
    }
    const isProd = process.env.NODE_ENV === "production";

    const cookieStore = await cookies();
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnon =
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANNON_KEY;
    if (!supabaseUrl || !supabaseAnon) {
      return NextResponse.json({ error: "Server configuration error." }, { status: 500 });
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
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Ensure active client exists; callback will repeat this lookup too.
    await requireActiveClientId(supabase, cookieStore, user.id);

    const body = await req.json().catch(() => ({}));
    const rawShop = typeof body?.shop === "string" ? body.shop : "";
    const shop = normalizeShopDomain(rawShop);
    if (!isValidShopDomain(shop)) {
      return NextResponse.json(
        { error: "Enter a valid Shopify shop domain (e.g. your-shop.myshopify.com)." },
        { status: 400 }
      );
    }

    const state = randomState();
    cookieStore.set("shopify_oauth_state", state, {
      httpOnly: true,
      sameSite: "lax",
      secure: isProd,
      path: "/",
      maxAge: 60 * 10,
    });
    cookieStore.set("shopify_oauth_shop", shop, {
      httpOnly: true,
      sameSite: "lax",
      secure: isProd,
      path: "/",
      maxAge: 60 * 10,
    });

    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL?.trim() || `${new URL(req.url).origin}`;
    const redirectUri = `${siteUrl}/api/shopify/callback`;
    const scopes = (process.env.SHOPIFY_SCOPES?.trim() || "read_products")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const url = buildShopifyAuthorizeUrl({
      shop,
      clientId: SHOPIFY_API_KEY,
      redirectUri,
      scopes,
      state,
    });

    return NextResponse.json({ ok: true, url });
  } catch (e) {
    console.error("POST /api/shopify/connect:", e);
    return NextResponse.json({ error: "Unexpected server error." }, { status: 500 });
  }
}

