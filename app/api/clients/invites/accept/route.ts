import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ACTIVE_CLIENT_COOKIE } from "@/lib/clients/constants";

function getEnv() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnon =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANNON_KEY;
  return { supabaseUrl, supabaseAnon };
}

async function getSupabase() {
  const { supabaseUrl, supabaseAnon } = getEnv();
  if (!supabaseUrl || !supabaseAnon) return null;
  const cookieStore = await cookies();
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
  return { supabase, cookieStore };
}

/** POST body: { token } — joins workspace via RPC (RLS-safe). */
export async function POST(req: Request) {
  const ctx = await getSupabase();
  if (!ctx) return NextResponse.json({ error: "Server configuration error." }, { status: 500 });
  const { supabase, cookieStore } = ctx;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const token = typeof body?.token === "string" ? body.token.trim() : "";
  if (!token) return NextResponse.json({ error: "Missing token." }, { status: 400 });

  const { data: clientId, error } = await supabase.rpc("accept_client_invite", {
    p_token: token,
  });

  if (error) {
    const msg =
      typeof error.message === "string" && error.message.length
        ? error.message
        : "Could not accept invite.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  if (typeof clientId === "string" && clientId) {
    cookieStore.set(ACTIVE_CLIENT_COOKIE, clientId, { path: "/", sameSite: "lax" });
  }

  return NextResponse.json({ ok: true, clientId });
}
