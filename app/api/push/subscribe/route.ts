import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { requireActiveClientId } from "@/lib/clients/server";

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

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

    let clientId: string;
    try {
      const active = await requireActiveClientId(supabase, cookieStore, user.id);
      clientId = active.clientId;
    } catch {
      return NextResponse.json({ error: "No active client." }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const sub = body?.subscription as any;
    const endpoint = typeof sub?.endpoint === "string" ? sub.endpoint : "";
    const p256dh = typeof sub?.keys?.p256dh === "string" ? sub.keys.p256dh : "";
    const auth = typeof sub?.keys?.auth === "string" ? sub.keys.auth : "";
    const ua = typeof body?.userAgent === "string" ? body.userAgent : null;

    if (!endpoint || !p256dh || !auth) {
      return NextResponse.json({ error: "Invalid subscription." }, { status: 400 });
    }

    const { error } = await supabase.from("web_push_subscriptions").upsert(
      {
        user_id: user.id,
        client_id: clientId,
        endpoint,
        p256dh,
        auth,
        user_agent: ua,
      },
      { onConflict: "endpoint" }
    );
    if (error) {
      console.error("push subscribe:", error);
      return NextResponse.json({ error: "Failed to save subscription." }, { status: 500 });
    }

    // Enable push by default when user subscribes (MVP).
    await supabase.from("user_notification_settings").upsert(
      {
        user_id: user.id,
        client_id: clientId,
        push_enabled: true,
      },
      { onConflict: "user_id,client_id" }
    );

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("POST /api/push/subscribe:", e);
    return NextResponse.json({ error: "Unexpected server error." }, { status: 500 });
  }
}

