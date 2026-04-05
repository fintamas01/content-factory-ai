import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { requireActiveClientId } from "@/lib/clients/server";
import { assertPriceIntelligenceAccess } from "@/lib/price-intelligence/elite-gate";
import { assertPublicProductUrl } from "@/lib/price-intelligence/ssrf-guard";
import { scrapeCompetitorPrice } from "@/lib/price-intelligence/scrape-price";
import { computeDifferencePct } from "@/lib/price-intelligence/compute";
import { generatePriceRecommendationOrFallback } from "@/lib/price-intelligence/openai-recommendation";
import type { PriceTrackingRow } from "@/lib/price-intelligence/types";

function bad(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET() {
  try {
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

    const { data, error } = await supabase
      .from("price_tracking")
      .select("*")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      console.error("price_tracking list:", error);
      return bad("Could not load tracking rows.", 500);
    }

    return NextResponse.json({ rows: (data ?? []) as PriceTrackingRow[] });
  } catch (e) {
    console.error("GET /api/price-intelligence:", e);
    return bad("Unexpected server error.", 500);
  }
}

export async function POST(req: Request) {
  try {
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

    const body = await req.json().catch(() => ({}));
    const product_name = typeof body?.product_name === "string" ? body.product_name.trim() : "";
    const competitor_url = typeof body?.competitor_url === "string" ? body.competitor_url.trim() : "";
    let ownNum: number | null = null;
    const ownRaw = body?.own_price;
    if (ownRaw != null && ownRaw !== "") {
      const n = typeof ownRaw === "number" ? ownRaw : Number(ownRaw);
      if (!Number.isFinite(n) || n < 0) return bad("Enter a valid own price or leave it blank.");
      ownNum = Math.round(n * 100) / 100;
    }
    const wooRaw = body?.woo_product_id;
    const woo_product_id =
      wooRaw != null && wooRaw !== "" && Number.isFinite(Number(wooRaw))
        ? Math.floor(Number(wooRaw))
        : null;

    if (!product_name || product_name.length > 200) return bad("Enter a product name.");
    if (!competitor_url) return bad("Enter a competitor product URL.");

    let safeUrl: URL;
    try {
      safeUrl = assertPublicProductUrl(competitor_url);
    } catch (e) {
      return bad(e instanceof Error ? e.message : "Invalid URL.");
    }

    let competitor_price: number | null = null;
    let scrapeFailed = false;
    try {
      competitor_price = await scrapeCompetitorPrice(safeUrl.toString());
      if (competitor_price === null) scrapeFailed = true;
    } catch (e) {
      console.error("price scrape:", e);
      scrapeFailed = true;
    }

    const difference_pct = computeDifferencePct(ownNum, competitor_price);

    const recommendation = await generatePriceRecommendationOrFallback({
      productName: product_name,
      ownPrice: ownNum,
      competitorPrice: competitor_price,
      differencePct: difference_pct,
      scrapeFailed,
    });

    const { data: row, error: insErr } = await supabase
      .from("price_tracking")
      .insert({
        user_id: user.id,
        client_id: clientId,
        product_name,
        own_price: ownNum,
        competitor_url: safeUrl.toString(),
        competitor_price,
        difference_pct,
        recommendation,
        woo_product_id,
      })
      .select("*")
      .single();

    if (insErr || !row) {
      console.error("price_tracking insert:", insErr);
      return bad("Could not save tracking row.", 500);
    }

    return NextResponse.json({ row: row as PriceTrackingRow });
  } catch (e) {
    console.error("POST /api/price-intelligence:", e);
    return bad("Unexpected server error.", 500);
  }
}
