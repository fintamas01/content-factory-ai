import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { requireActiveClientId } from "@/lib/clients/server";
import { fetchUnreadCount } from "@/lib/notifications/server";

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

    const count = await fetchUnreadCount(supabase, { userId: user.id, clientId });
    return NextResponse.json({ count });
  } catch (e) {
    console.error("GET /api/notifications/unread-count:", e);
    return NextResponse.json({ error: "Unexpected server error." }, { status: 500 });
  }
}

