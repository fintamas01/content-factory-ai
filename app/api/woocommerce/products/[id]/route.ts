import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { requireActiveClientId } from "@/lib/clients/server";
import { wooFetch, type WooProduct } from "@/lib/woocommerce/client";

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const pid = Number(id);
    if (!Number.isFinite(pid) || pid <= 0) return badRequest("Invalid product id.");

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

    let clientId: string;
    try {
      const active = await requireActiveClientId(supabase, cookieStore, user.id);
      clientId = active.clientId;
    } catch {
      return NextResponse.json({ error: "No active client." }, { status: 400 });
    }

    const { data: conn, error: connErr } = await supabase
      .from("woocommerce_connections")
      .select("store_url, consumer_key, consumer_secret")
      .eq("client_id", clientId)
      .maybeSingle();
    if (connErr) {
      console.error("woocommerce conn read:", connErr);
      return NextResponse.json({ error: "Could not load WooCommerce connection." }, { status: 500 });
    }
    if (!conn) return NextResponse.json({ error: "WooCommerce is not connected." }, { status: 400 });

    const r = await wooFetch<WooProduct>(conn, `/products/${pid}`);
    if (!r.ok) {
      console.error("woocommerce product fetch:", r.status, r.error);
      return NextResponse.json({ error: "WooCommerce fetch failed.", details: r.error }, { status: 502 });
    }

    const p = r.data;
    return NextResponse.json({
      ok: true,
      product: {
        id: p.id,
        name: p.name,
        sku: p.sku ?? null,
        status: p.status ?? null,
        permalink: p.permalink ?? null,
        price: p.price ?? null,
        description: p.description ?? "",
        short_description: p.short_description ?? "",
        image: p.images?.[0]?.src ?? null,
      },
    });
  } catch (e) {
    console.error("GET /api/woocommerce/products/[id]:", e);
    return NextResponse.json({ error: "Unexpected server error." }, { status: 500 });
  }
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const pid = Number(id);
    if (!Number.isFinite(pid) || pid <= 0) return badRequest("Invalid product id.");

    const body = await req.json().catch(() => ({}));
    const patch: Record<string, unknown> = {};
    if (typeof body?.name === "string") patch.name = body.name;
    if (typeof body?.description === "string") patch.description = body.description;
    if (typeof body?.short_description === "string")
      patch.short_description = body.short_description;

    const keys = Object.keys(patch);
    if (keys.length === 0) return badRequest("No updatable fields provided.");

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

    let clientId: string;
    try {
      const active = await requireActiveClientId(supabase, cookieStore, user.id);
      clientId = active.clientId;
    } catch {
      return NextResponse.json({ error: "No active client." }, { status: 400 });
    }

    const { data: conn, error: connErr } = await supabase
      .from("woocommerce_connections")
      .select("store_url, consumer_key, consumer_secret")
      .eq("client_id", clientId)
      .maybeSingle();
    if (connErr) {
      console.error("woocommerce conn read:", connErr);
      return NextResponse.json({ error: "Could not load WooCommerce connection." }, { status: 500 });
    }
    if (!conn) return NextResponse.json({ error: "WooCommerce is not connected." }, { status: 400 });

    const r = await wooFetch<WooProduct>(conn, `/products/${pid}`, {
      method: "PUT",
      body: JSON.stringify(patch),
    });
    if (!r.ok) {
      console.error("woocommerce product update:", r.status, r.error);
      return NextResponse.json({ error: "WooCommerce update failed.", details: r.error }, { status: 502 });
    }

    return NextResponse.json({ ok: true, updated: keys });
  } catch (e) {
    console.error("PATCH /api/woocommerce/products/[id]:", e);
    return NextResponse.json({ error: "Unexpected server error." }, { status: 500 });
  }
}

