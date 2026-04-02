import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { requireActiveClientId } from "@/lib/clients/server";
import { assertPriceIntelligenceAccess } from "@/lib/price-intelligence/elite-gate";
import { assertPublicProductUrl } from "@/lib/price-intelligence/ssrf-guard";
import { scrapeCompetitorPrice } from "@/lib/price-intelligence/scrape-price";
import { computeDifferencePct } from "@/lib/price-intelligence/compute";
import { generatePriceRecommendation } from "@/lib/price-intelligence/openai-recommendation";
import { createNotification } from "@/lib/notifications/server";
import type { PriceTrackingRow } from "@/lib/price-intelligence/types";

function bad(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function priceChanged(a: number | null, b: number | null): boolean {
  if (a == null || b == null) return false;
  return Math.abs(a - b) > 0.009;
}

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    if (!process.env.OPENAI_API_KEY) return bad("OpenAI is not configured.", 500);

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

    const { data: existing, error: fetchErr } = await supabase
      .from("price_tracking")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .eq("client_id", clientId)
      .maybeSingle();

    if (fetchErr || !existing) return bad("Not found.", 404);

    const row = existing as PriceTrackingRow;
    let safeUrl: URL;
    try {
      safeUrl = assertPublicProductUrl(row.competitor_url);
    } catch (e) {
      return bad(e instanceof Error ? e.message : "Invalid URL.");
    }

    const previousComp = row.competitor_price != null ? Number(row.competitor_price) : null;

    let competitor_price: number | null = null;
    let scrapeFailed = false;
    try {
      competitor_price = await scrapeCompetitorPrice(safeUrl.toString());
      if (competitor_price === null) scrapeFailed = true;
    } catch (e) {
      console.error("price scrape refresh:", e);
      scrapeFailed = true;
    }

    const ownNum = row.own_price != null ? Number(row.own_price) : null;
    const difference_pct = computeDifferencePct(ownNum, competitor_price);

    let recommendation: string;
    try {
      recommendation = await generatePriceRecommendation({
        productName: row.product_name,
        ownPrice: ownNum,
        competitorPrice: competitor_price,
        differencePct: difference_pct,
        scrapeFailed,
      });
    } catch (e) {
      console.error("price intel openai refresh:", e);
      return bad("Could not refresh recommendation.", 500);
    }

    const { data: updated, error: upErr } = await supabase
      .from("price_tracking")
      .update({
        competitor_price,
        difference_pct,
        recommendation,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("user_id", user.id)
      .eq("client_id", clientId)
      .select("*")
      .single();

    if (upErr || !updated) {
      console.error("price_tracking update:", upErr);
      return bad("Could not save refresh.", 500);
    }

    if (
      priceChanged(previousComp, competitor_price) &&
      competitor_price != null
    ) {
      const prevLabel = previousComp != null ? `$${previousComp.toFixed(2)}` : "unknown";
      const newLabel = `$${competitor_price.toFixed(2)}`;
      await createNotification(supabase, {
        userId: user.id,
        clientId,
        type: "price_intel_change",
        title: `Competitor price changed: ${row.product_name}`,
        message: `Tracked listing moved from ${prevLabel} to ${newLabel}. Review Price Intelligence for context.`,
        severity: "warning",
        sourceModule: "competitor",
        actionLabel: "Open Price Intelligence",
        actionUrl: "/dashboard/price-intelligence",
        metadata: { price_tracking_id: id },
      });
    }

    return NextResponse.json({ row: updated as PriceTrackingRow });
  } catch (e) {
    console.error("POST /api/price-intelligence/[id]/refresh:", e);
    return bad("Unexpected server error.", 500);
  }
}
