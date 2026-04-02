import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { requireActiveClientId } from "@/lib/clients/server";
import type { ProductHealthResult } from "@/lib/products/product-health";
import { compareProductHealth } from "@/lib/progress/product-health-comparison";

function getEnv() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnon =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANNON_KEY;
  return { supabaseUrl, supabaseAnon };
}

/** GET: last two health analyses for Woo product → comparison. */
export async function GET(req: Request) {
  try {
    const { supabaseUrl, supabaseAnon } = getEnv();
    if (!supabaseUrl || !supabaseAnon) {
      return NextResponse.json({ error: "Server configuration error." }, { status: 500 });
    }
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
    if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

    let clientId: string;
    try {
      const active = await requireActiveClientId(supabase, cookieStore, user.id);
      clientId = active.clientId;
    } catch {
      return NextResponse.json({ error: "No active client." }, { status: 400 });
    }

    const url = new URL(req.url);
    const pidRaw = url.searchParams.get("wooProductId");
    const pid = Number(pidRaw);
    if (!Number.isFinite(pid) || pid <= 0) {
      return NextResponse.json({ error: "Invalid wooProductId." }, { status: 400 });
    }

    const { data: rows, error } = await supabase
      .from("product_generations")
      .select("id, output_data, input_data, created_at")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false })
      .limit(60);

    if (error) {
      console.error("product-health-comparison:", error);
      return NextResponse.json({ error: "Could not load product runs." }, { status: 500 });
    }

    const healthRows: Array<{
      id: string;
      health: ProductHealthResult;
      created_at: string;
    }> = [];

    for (const row of rows ?? []) {
      const inp = row.input_data as Record<string, unknown> | null;
      if (inp?.phase !== "health_analysis") continue;
      if (Number(inp?.woo_product_id) !== pid) continue;
      const out = row.output_data as Record<string, unknown> | null;
      if (out?.kind !== "health_analysis" || !out?.health) continue;
      healthRows.push({
        id: String(row.id),
        health: out.health as ProductHealthResult,
        created_at: String(row.created_at ?? ""),
      });
    }

    if (healthRows.length === 0) {
      return NextResponse.json({ healthProgress: null });
    }
    if (healthRows.length === 1) {
      const healthProgress = compareProductHealth({
        previous: null,
        current: healthRows[0].health,
        previousRunAt: null,
        previousGenerationId: null,
      });
      return NextResponse.json({ healthProgress });
    }

    const [latest, previous] = healthRows;
    const healthProgress = compareProductHealth({
      previous: previous.health,
      current: latest.health,
      previousRunAt: previous.created_at,
      previousGenerationId: previous.id,
    });

    return NextResponse.json({ healthProgress });
  } catch (e) {
    console.error("GET /api/progress/product-health-comparison:", e);
    return NextResponse.json({ error: "Unexpected server error." }, { status: 500 });
  }
}
