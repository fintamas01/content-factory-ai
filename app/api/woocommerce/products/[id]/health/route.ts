import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { requireActiveClientId } from "@/lib/clients/server";
import { enforceUsageLimit } from "@/lib/usage/enforce";
import { incrementUsage } from "@/lib/usage/usage-service";
import { fetchUserBrandProfile } from "@/lib/brand-profile/server";
import { wooFetch, type WooProduct } from "@/lib/woocommerce/client";
import {
  analyzeProductHealthWithOpenAI,
  stripHtmlForAnalysis,
  type ProductHealthResult,
} from "@/lib/products/product-health";
import { createNotification } from "@/lib/notifications/server";
import { compareProductHealth } from "@/lib/progress/product-health-comparison";

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: "OpenAI is not configured." }, { status: 500 });
    }

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

    const usageDenied = await enforceUsageLimit(supabase, user.id, "product", clientId);
    if (usageDenied) return usageDenied;

    const { data: conn, error: connErr } = await supabase
      .from("woocommerce_connections")
      .select("store_url, consumer_key, consumer_secret")
      .eq("client_id", clientId)
      .maybeSingle();
    if (connErr || !conn) {
      return NextResponse.json({ error: "WooCommerce is not connected." }, { status: 400 });
    }

    const r = await wooFetch<WooProduct>(conn, `/products/${pid}`);
    if (!r.ok) {
      return NextResponse.json(
        { error: "Could not load product from WooCommerce.", details: r.error },
        { status: 502 }
      );
    }

    const p = r.data;
    const title = String(p.name ?? "");
    const shortDescription = String(p.short_description ?? "");
    const longDescription = String(p.description ?? "");

    const brand = await fetchUserBrandProfile(supabase, user.id, clientId);

    const { data: priorRows } = await supabase
      .from("product_generations")
      .select("id, output_data, input_data, created_at")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false })
      .limit(40);

    let previousHealth: ProductHealthResult | null = null;
    let previousGenId: string | null = null;
    let previousAt: string | null = null;
    for (const row of priorRows ?? []) {
      const inp = row.input_data as Record<string, unknown> | null;
      if (inp?.phase !== "health_analysis") continue;
      if (Number(inp?.woo_product_id) !== pid) continue;
      const out = row.output_data as Record<string, unknown> | null;
      if (out?.kind !== "health_analysis" || !out?.health) continue;
      previousHealth = out.health as ProductHealthResult;
      previousGenId = String(row.id);
      previousAt = typeof row.created_at === "string" ? row.created_at : null;
      break;
    }

    const analyzed = await analyzeProductHealthWithOpenAI({
      productName: title,
      title,
      shortDescription: stripHtmlForAnalysis(shortDescription),
      longDescription,
      brandProfile: brand,
      openaiApiKey: process.env.OPENAI_API_KEY,
    });

    if (!analyzed.ok) {
      return NextResponse.json({ error: analyzed.error }, { status: 502 });
    }

    const health: ProductHealthResult = analyzed.health;

    const healthProgress = compareProductHealth({
      previous: previousHealth,
      current: health,
      previousRunAt: previousAt,
      previousGenerationId: previousGenId,
    });

    // Retention-friendly alert: only create a notification when the listing is meaningfully weak.
    if (health.score <= 65) {
      void createNotification(supabase, {
        userId: user.id,
        clientId,
        type: "product_health_weak",
        title: "Product needs optimization",
        message: `${title || `Product #${pid}`} scored ${health.score}/100. Review and optimize the title + descriptions for conversion.`,
        severity: health.score <= 45 ? "critical" : "warning",
        sourceModule: "products",
        actionLabel: "Open Products",
        actionUrl: `/dashboard/products?wooProductId=${pid}`,
        metadata: { woo_product_id: pid, score: health.score },
      });
    }

    const input_data = {
      phase: "health_analysis" as const,
      woo_product_id: pid,
      snapshot: {
        title,
        short_description: shortDescription,
        description: longDescription,
      },
    };

    const output_data = {
      kind: "health_analysis" as const,
      health,
    };

    let savedId: string | null = null;
    const { data: inserted, error: insertErr } = await supabase
      .from("product_generations")
      .insert({
        user_id: user.id,
        client_id: clientId,
        product_name: title || `Product #${pid}`,
        input_data,
        output_data,
      })
      .select("id")
      .single();

    if (insertErr) {
      console.error("product_generations health insert:", insertErr);
    } else if (inserted?.id) {
      savedId = inserted.id;
    }

    await incrementUsage(supabase, "product", clientId);

    if (healthProgress.hasPrevious && healthProgress.scoreDelta >= 5) {
      try {
        await createNotification(supabase, {
          userId: user.id,
          clientId,
          type: "product_health_improved",
          title: "Product health score improved",
          message: `${title || `Product #${pid}`}: score ${healthProgress.previousScore} → ${healthProgress.currentScore} (+${healthProgress.scoreDelta}).`,
          severity: "success",
          sourceModule: "products",
          actionLabel: "Open Products",
          actionUrl: `/dashboard/products?wooProductId=${pid}`,
          metadata: {
            woo_product_id: pid,
            scoreDelta: healthProgress.scoreDelta,
            savedId,
          },
        });
      } catch (e) {
        console.warn("[health] progress notification failed:", e);
      }
    }

    return NextResponse.json({ health, savedId, healthProgress });
  } catch (e) {
    console.error("POST /api/woocommerce/products/[id]/health:", e);
    return NextResponse.json({ error: "Unexpected server error." }, { status: 500 });
  }
}
