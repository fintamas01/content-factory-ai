import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { requireActiveClientId } from "@/lib/clients/server";
import { assertPriceIntelligenceAccess } from "@/lib/price-intelligence/elite-gate";

function bad(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    if (!id) return bad("Missing id.");

    const cookieStore = await cookies();
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnon =
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANNON_KEY;
    if (!supabaseUrl || !supabaseAnon) return bad("Server configuration error.", 500);

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

    const gate = await assertPriceIntelligenceAccess(supabase, user.id);
    if (!gate.ok) return NextResponse.json({ error: gate.message }, { status: gate.status });

    let clientId: string;
    try {
      const active = await requireActiveClientId(supabase, cookieStore, user.id);
      clientId = active.clientId;
    } catch {
      return bad("No active client.", 400);
    }

    const { error } = await supabase
      .from("price_tracking")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id)
      .eq("client_id", clientId);

    if (error) {
      console.error("price_tracking delete:", error);
      return bad("Could not delete.", 500);
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("DELETE /api/price-intelligence/[id]:", e);
    return bad("Unexpected server error.", 500);
  }
}
