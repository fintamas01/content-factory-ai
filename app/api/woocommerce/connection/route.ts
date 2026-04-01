import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

function normalizeStoreUrl(raw: string): string {
  const t = raw.trim();
  const u = t.startsWith("http") ? t : `https://${t}`;
  return u.replace(/\/+$/, "");
}

export async function GET() {
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

    const { data, error } = await supabase
      .from("woocommerce_connections")
      .select("store_url, created_at, updated_at")
      .eq("user_id", user.id)
      .maybeSingle();
    if (error) {
      console.error("woocommerce connection fetch:", error);
      return NextResponse.json({ error: "Could not load connection." }, { status: 500 });
    }
    return NextResponse.json({ connected: Boolean(data), connection: data ?? null });
  } catch (e) {
    console.error("GET /api/woocommerce/connection:", e);
    return NextResponse.json({ error: "Unexpected server error." }, { status: 500 });
  }
}

export async function POST(req: Request) {
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

    const body = await req.json().catch(() => ({}));
    const store_url = typeof body?.store_url === "string" ? body.store_url : "";
    const consumer_key = typeof body?.consumer_key === "string" ? body.consumer_key : "";
    const consumer_secret =
      typeof body?.consumer_secret === "string" ? body.consumer_secret : "";

    if (!store_url.trim()) return badRequest("Missing store_url.");
    if (!consumer_key.trim()) return badRequest("Missing consumer_key.");
    if (!consumer_secret.trim()) return badRequest("Missing consumer_secret.");

    const row = {
      user_id: user.id,
      store_url: normalizeStoreUrl(store_url),
      consumer_key: consumer_key.trim(),
      consumer_secret: consumer_secret.trim(),
    };

    const { error } = await supabase
      .from("woocommerce_connections")
      .upsert(row, { onConflict: "user_id" });
    if (error) {
      console.error("woocommerce connection upsert:", error);
      return NextResponse.json({ error: "Could not save connection." }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      connection: { store_url: row.store_url },
    });
  } catch (e) {
    console.error("POST /api/woocommerce/connection:", e);
    return NextResponse.json({ error: "Unexpected server error." }, { status: 500 });
  }
}

export async function DELETE() {
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

    const { error } = await supabase
      .from("woocommerce_connections")
      .delete()
      .eq("user_id", user.id);
    if (error) {
      console.error("woocommerce connection delete:", error);
      return NextResponse.json({ error: "Could not disconnect." }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("DELETE /api/woocommerce/connection:", e);
    return NextResponse.json({ error: "Unexpected server error." }, { status: 500 });
  }
}

