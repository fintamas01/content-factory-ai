import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { ProductCopyResult } from "@/lib/products/types";
import { fetchUserBrandProfile } from "@/lib/brand-profile/server";
import { requireActiveClientId } from "@/lib/clients/server";
import { enforceUsageLimit } from "@/lib/usage/enforce";
import { incrementUsage } from "@/lib/usage/usage-service";
import { generateProductCopy } from "@/lib/products/generate-product-copy";
import { wooFetch, type WooProduct } from "@/lib/woocommerce/client";
import { buildListingSignalsForPrompt } from "@/lib/products/listing-signals";
import { createNotification } from "@/lib/notifications/server";
import {
  healthToOptimizationBrief,
  stripHtmlForAnalysis,
  type ProductHealthResult,
} from "@/lib/products/product-health";

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

function parseHealthBody(raw: unknown): ProductHealthResult | null {
  if (!raw || typeof raw !== "object") return null;
  const h = raw as Record<string, unknown>;
  const score = typeof h.score === "number" ? h.score : Number(h.score);
  if (!Number.isFinite(score)) return null;
  return h as unknown as ProductHealthResult;
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: "OpenAI is not configured." }, { status: 500 });
    }

    const { id } = await ctx.params;
    const pid = Number(id);
    if (!Number.isFinite(pid) || pid <= 0) return badRequest("Invalid product id.");

    const body = await req.json().catch(() => ({}));
    const healthFromClient = parseHealthBody(body?.health);

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
    const productName = String(p.name ?? "").trim();
    if (!productName) return badRequest("Product has no name.");

    const existingTitle = String(p.name ?? "");
    const existingDescription = String(p.description ?? "");
    const existingShortDescription = String(p.short_description ?? "");

    const brand = await fetchUserBrandProfile(supabase, user.id, clientId);

    const listingSignals = buildListingSignalsForPrompt({
      title: existingTitle,
      shortDescription: existingShortDescription,
      longDescriptionHtml: existingDescription,
    });

    let optimizationContext: string | undefined;
    const signalsBlock = `HEURISTIC LISTING SIGNALS (hints only, not product facts):\n${JSON.stringify(listingSignals)}`;
    if (healthFromClient) {
      optimizationContext = [healthToOptimizationBrief(healthFromClient), "", signalsBlock].join("\n").slice(0, 12000);
    } else {
      optimizationContext = [
        "No structured health analysis was provided for this run — infer gaps from the listing text and the signals below.",
        "",
        signalsBlock,
      ].join("\n").slice(0, 12000);
    }

    const gen = await generateProductCopy({
      input: {
        productName,
        existingTitle,
        existingDescription: stripHtmlForAnalysis(existingDescription) || existingDescription,
        existingShortDescription: stripHtmlForAnalysis(existingShortDescription) || existingShortDescription,
        goal: "improve",
      },
      brandProfile: brand,
      openaiApiKey: process.env.OPENAI_API_KEY,
      model: process.env.OPENAI_PRODUCT_MODEL ?? "gpt-4o-mini",
      optimizationContext,
    });

    if (!gen.ok) return NextResponse.json({ error: gen.error }, { status: 502 });

    const result: ProductCopyResult = gen.result;

    const input_data = {
      phase: "woo_optimize" as const,
      woo_product_id: pid,
      health_snapshot: healthFromClient ?? undefined,
      source: "woocommerce",
      sourceMeta: { product_id: pid, store_url: conn.store_url },
    };

    let savedId: string | null = null;
    const { data: inserted, error: insertErr } = await supabase
      .from("product_generations")
      .insert({
        user_id: user.id,
        client_id: clientId,
        product_name: productName,
        input_data,
        output_data: result,
      })
      .select("id")
      .single();

    if (insertErr) {
      console.error("product_generations optimize insert:", insertErr);
    } else if (inserted?.id) {
      savedId = inserted.id;
    }

    await incrementUsage(supabase, "product", clientId);

    void createNotification(supabase, {
      userId: user.id,
      clientId,
      type: "product_optimization_ready",
      title: "Optimization ready to review",
      message: `AI copy is ready for "${productName}". Review side-by-side and choose exactly what to update in WooCommerce.`,
      severity: "success",
      sourceModule: "products",
      actionLabel: "Review & update",
      actionUrl: `/dashboard/products?wooProductId=${pid}`,
      metadata: { woo_product_id: pid },
    });

    return NextResponse.json({ result, savedId });
  } catch (e) {
    console.error("POST /api/woocommerce/products/[id]/optimize:", e);
    return NextResponse.json({ error: "Unexpected server error." }, { status: 500 });
  }
}
