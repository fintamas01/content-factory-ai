import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { requireActiveClientId } from "@/lib/clients/server";
import { normalizeShopifyProduct, shopifyFetch, type ShopifyConnection, type ShopifyProduct } from "@/lib/shopify/client";

export async function GET(req: Request) {
  try {
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

    let clientId: string;
    try {
      const active = await requireActiveClientId(supabase, cookieStore, user.id);
      clientId = active.clientId;
    } catch {
      return NextResponse.json({ error: "No active client." }, { status: 400 });
    }

    const { data: conn, error: connErr } = await supabase
      .from("shopify_connections")
      .select("store_domain, access_token, status")
      .eq("client_id", clientId)
      .maybeSingle();
    if (connErr) {
      console.error("shopify conn read:", connErr);
      return NextResponse.json({ error: "Could not load Shopify connection." }, { status: 500 });
    }
    if (!conn || conn.status !== "connected") {
      return NextResponse.json({ error: "Shopify is not connected." }, { status: 400 });
    }

    const url = new URL(req.url);
    const search = (url.searchParams.get("search") ?? "").trim();
    const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? 25), 1), 50);

    const qs = new URLSearchParams();
    qs.set("limit", String(limit));
    if (search) qs.set("title", search);

    const r = await shopifyFetch<{ products: ShopifyProduct[] }>(conn as ShopifyConnection, `/products.json?${qs.toString()}`);
    if (!r.ok) {
      console.error("shopify products list:", r.status, r.error);
      return NextResponse.json({ error: "Shopify fetch failed.", details: r.error }, { status: 502 });
    }

    const items = (r.data.products ?? []).map((p) => normalizeShopifyProduct(p));
    return NextResponse.json({ ok: true, items });
  } catch (e) {
    console.error("GET /api/shopify/products:", e);
    return NextResponse.json({ error: "Unexpected server error." }, { status: 500 });
  }
}

