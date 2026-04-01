import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ACTIVE_CLIENT_COOKIE } from "@/lib/clients/constants";

export async function POST(req: Request) {
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

  const body = await req.json().catch(() => ({}));
  const clientId = typeof body?.clientId === "string" ? body.clientId : "";
  if (!clientId) return NextResponse.json({ error: "Missing clientId." }, { status: 400 });

  const { data, error } = await supabase.from("clients").select("id").eq("id", clientId).maybeSingle();
  if (error || !data?.id) return NextResponse.json({ error: "Client not found." }, { status: 404 });

  cookieStore.set(ACTIVE_CLIENT_COOKIE, clientId, { path: "/", sameSite: "lax" });
  return NextResponse.json({ ok: true, activeClientId: clientId });
}

