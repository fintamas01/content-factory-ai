import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { requireActiveClientId } from "@/lib/clients/server";

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

    const { data } = await supabase
      .from("user_notification_settings")
      .select("*")
      .eq("user_id", user.id)
      .eq("client_id", clientId)
      .maybeSingle();

    return NextResponse.json({ settings: data ?? null });
  } catch (e) {
    console.error("GET /api/notifications/settings:", e);
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
    const email_enabled = typeof body?.email_enabled === "boolean" ? body.email_enabled : undefined;
    const email_digest_frequency =
      typeof body?.email_digest_frequency === "string" ? body.email_digest_frequency : undefined;
    const push_enabled = typeof body?.push_enabled === "boolean" ? body.push_enabled : undefined;
    const push_instant_severity =
      typeof body?.push_instant_severity === "string" ? body.push_instant_severity : undefined;

    const patch: Record<string, unknown> = {
      user_id: user.id,
      client_id: clientId,
    };
    if (email_enabled !== undefined) patch.email_enabled = email_enabled;
    if (email_digest_frequency) patch.email_digest_frequency = email_digest_frequency;
    if (push_enabled !== undefined) patch.push_enabled = push_enabled;
    if (push_instant_severity) patch.push_instant_severity = push_instant_severity;

    const { data, error } = await supabase
      .from("user_notification_settings")
      .upsert(patch, { onConflict: "user_id,client_id" })
      .select("*")
      .single();

    if (error) {
      console.error("settings upsert:", error);
      return NextResponse.json({ error: "Failed to save settings." }, { status: 500 });
    }

    return NextResponse.json({ ok: true, settings: data });
  } catch (e) {
    console.error("POST /api/notifications/settings:", e);
    return NextResponse.json({ error: "Unexpected server error." }, { status: 500 });
  }
}

