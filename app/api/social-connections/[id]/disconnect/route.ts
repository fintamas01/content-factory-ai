import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { requireActiveClientId } from "@/lib/clients/server";

function bad(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const connectionId = typeof id === "string" ? id : "";
  if (!connectionId) return bad("Missing id.", 400);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnon =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANNON_KEY;
  if (!supabaseUrl || !supabaseAnon) return bad("Server configuration error.", 500);

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

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return bad("Unauthorized.", 401);

  const active = await requireActiveClientId(supabase, cookieStore, user.id);

  const { error } = await supabase
    .from("social_connections")
    .delete()
    .eq("id", connectionId)
    .eq("user_id", user.id)
    .eq("client_id", active.clientId);

  if (error) {
    console.error("social_connections delete:", error);
    return bad("Could not disconnect.", 500);
  }

  return NextResponse.json({ ok: true });
}

