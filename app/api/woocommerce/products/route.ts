import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { wooFetch, type WooProductListItem } from "@/lib/woocommerce/client";

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export async function GET(req: Request) {
  try {
    const cookieStore = await cookies();
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnon =
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
      process.env.NEXT_PUBLIC_SUPABASE_ANNON_KEY;
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

    const { data: conn, error: connErr } = await supabase
      .from("woocommerce_connections")
      .select("store_url, consumer_key, consumer_secret")
      .eq("user_id", user.id)
      .maybeSingle();
    if (connErr) {
      console.error("woocommerce conn read:", connErr);
      return NextResponse.json({ error: "Could not load WooCommerce connection." }, { status: 500 });
    }
    if (!conn) return NextResponse.json({ error: "WooCommerce is not connected." }, { status: 400 });

    const url = new URL(req.url);
    const search = (url.searchParams.get("search") ?? "").trim();
    const per_page = Math.min(Math.max(Number(url.searchParams.get("per_page") ?? 25), 1), 50);

    const qs = new URLSearchParams();
    if (search) qs.set("search", search);
    qs.set("per_page", String(per_page));
    qs.set("orderby", "date");
    qs.set("order", "desc");

    const r = await wooFetch<WooProductListItem[]>(conn, `/products?${qs.toString()}`);
    if (!r.ok) {
      console.error("woocommerce products list:", r.status, r.error);
      return NextResponse.json({ error: "WooCommerce fetch failed.", details: r.error }, { status: 502 });
    }

    const items = (r.data ?? []).map((p) => ({
      id: p.id,
      name: p.name,
      sku: p.sku ?? null,
      status: p.status ?? null,
      permalink: p.permalink ?? null,
      image: p.images?.[0]?.src ?? null,
    }));

    return NextResponse.json({ ok: true, items });
  } catch (e) {
    console.error("GET /api/woocommerce/products:", e);
    return NextResponse.json({ error: "Unexpected server error." }, { status: 500 });
  }
}

