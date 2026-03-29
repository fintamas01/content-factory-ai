import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import OpenAI from "openai";
import { parseJsonFromAssistantContent } from "@/lib/openai/parse-json-content";
import type { ProductCopyResult } from "@/lib/products/types";
import { fetchUserBrandProfile } from "@/lib/brand-profile/server";
import { mergeBrandProfileForContent } from "@/lib/brand-profile/merge";
import { buildProductBrandIdentityAddendumEn } from "@/lib/brand-profile/prompts";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function coerceProductCopy(data: unknown): ProductCopyResult | null {
  if (!data || typeof data !== "object") return null;
  const o = data as Record<string, unknown>;

  const title = typeof o.title === "string" ? o.title.trim() : "";
  const description =
    typeof o.description === "string" ? o.description.trim() : "";
  const bulletsRaw = Array.isArray(o.bullets) ? o.bullets : [];
  const bullets = bulletsRaw
    .filter((b): b is string => typeof b === "string" && b.trim().length > 0)
    .map((b) => b.trim())
    .slice(0, 10);

  const seo_title =
    typeof o.seo_title === "string" ? o.seo_title.trim() : "";
  const seo_description =
    typeof o.seo_description === "string" ? o.seo_description.trim() : "";

  if (!title && !description) return null;

  return {
    title: title || "Product",
    description: description || "",
    bullets,
    seo_title: seo_title || title.slice(0, 60),
    seo_description:
      seo_description || description.slice(0, 160) || title.slice(0, 160),
  };
}

const SYSTEM = `You are a senior ecommerce and B2B SaaS copy chief. Your job is copy that could ship on a real storefront or PDP: specific, benefit-led, and commercially credible—not template filler.

INPUT: You receive JSON with productName plus optional productDetails, targetAudience, tone, keyBenefits. When brandVoiceContext is present, it is the saved brand profile (facts). If a BRAND IDENTITY section appears below in the system message, follow it for how to apply that context—natural voice, no robotic repetition across fields. Product-level JSON fields override for factual product details when they conflict.

Ground every claim in that input. If details are thin, write tightly from what is given; do not invent certifications, awards, numbers, materials, or guarantees unless the user supplied them.

OUTPUT: Strictly valid JSON only. No markdown, no code fences, no keys beyond this schema (no extra keys):
{
  "title": "string",
  "description": "string",
  "bullets": ["string", ...],
  "seo_title": "string",
  "seo_description": "string"
}

TITLE: Short, specific headline (listing or hero). Prefer concrete nouns and outcome over vague adjectives. Avoid “The ultimate…”, “Revolutionary…”, “Best-in-class…” unless the input supports it.

DESCRIPTION: 2–4 sentences. Lead with the clearest outcome for the buyer (who it’s for + what problem it removes or result it enables). Tie features to benefits using details from the input. No bullet list here. No empty hype.

BULLETS: Exactly 4–6 items. Each line: one tight idea—prefer “[Concrete feature or fact] → [buyer payoff]” or a sharp standalone benefit. Under ~120 characters per bullet where possible. No “Lorem” style repeats; each line must add a new angle (use case, proof point from input, objection handled, differentiator).

TONE: Honor the requested tone (professional, modern, persuasive, luxury, friendly) or default to confident and clear. Luxury = refined, not flowery. Persuasive = proof and specificity, not exclamation spam.

SEO_TITLE: ~50–60 characters when possible. Read like a real search result: primary intent + product type + differentiator if space. Clickable and human—no ALL CAPS, no pipe-stuffed keyword stuffing.

SEO_DESCRIPTION: ~150–160 characters. One natural sentence (or two very short ones) with benefit + light CTA or qualifier (“for …”, “with …”). Should read like a trustworthy snippet, not a keyword dump.

BANNED: Generic phrases alone (“high quality”, “great value”, “perfect for everyone”) without tying to input. Repeated synonyms across fields. Fabricated stats.

Plain text inside JSON strings only (no ** or HTML).`;

export async function POST(req: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OpenAI is not configured." },
        { status: 500 }
      );
    }

    const cookieStore = await cookies();
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnon =
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
      process.env.NEXT_PUBLIC_SUPABASE_ANNON_KEY;

    if (!supabaseUrl || !supabaseAnon) {
      return NextResponse.json(
        { error: "Server configuration error." },
        { status: 500 }
      );
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

    const { data: authData } = await supabase.auth.getUser();
    const user = authData?.user;
    if (!user) {
      return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const productName =
      typeof body.productName === "string" ? body.productName.trim() : "";
    if (!productName) {
      return NextResponse.json(
        { error: "Product name is required." },
        { status: 400 }
      );
    }

    const productDetails =
      typeof body.productDetails === "string" ? body.productDetails.trim() : "";
    const targetAudience =
      typeof body.targetAudience === "string" ? body.targetAudience.trim() : "";
    const tone = typeof body.tone === "string" ? body.tone.trim() : "";
    const keyBenefits =
      typeof body.keyBenefits === "string" ? body.keyBenefits.trim() : "";

    const input_data = {
      productDetails: productDetails || undefined,
      targetAudience: targetAudience || undefined,
      tone: tone || undefined,
      keyBenefits: keyBenefits || undefined,
    };

    const unified = await fetchUserBrandProfile(supabase, user.id);
    const effectiveBrand = mergeBrandProfileForContent(undefined, unified);
    const systemContent =
      unified && effectiveBrand.name.trim()
        ? `${SYSTEM}\n\n${buildProductBrandIdentityAddendumEn(effectiveBrand)}`
        : SYSTEM;

    const userPayload: Record<string, unknown> = {
      productName,
      ...input_data,
    };

    if (unified) {
      userPayload.brandVoiceContext = {
        brandName: unified.brand_name,
        brandDescription: unified.brand_description,
        targetAudience: unified.target_audience,
        toneOfVoice: unified.tone_of_voice,
        keySellingPoints: unified.key_selling_points,
        websiteUrl: unified.website_url,
      };
    }

    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_PRODUCT_MODEL ?? "gpt-4o-mini",
      temperature: 0.45,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemContent },
        { role: "user", content: JSON.stringify(userPayload) },
      ],
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      return NextResponse.json(
        { error: "No response from the model." },
        { status: 502 }
      );
    }

    let parsed: unknown;
    try {
      parsed = parseJsonFromAssistantContent(content);
    } catch {
      return NextResponse.json(
        { error: "Could not parse model output." },
        { status: 502 }
      );
    }

    const result = coerceProductCopy(parsed);
    if (!result) {
      return NextResponse.json(
        { error: "Invalid product copy shape." },
        { status: 502 }
      );
    }

    let savedId: string | null = null;
    const { data: inserted, error: insertErr } = await supabase
      .from("product_generations")
      .insert({
        user_id: user.id,
        product_name: productName,
        input_data,
        output_data: result,
      })
      .select("id")
      .single();

    if (insertErr) {
      console.error("product_generations insert:", insertErr);
    } else if (inserted?.id) {
      savedId = inserted.id;
    }

    return NextResponse.json({ result, savedId });
  } catch (e) {
    console.error("generate-product:", e);
    return NextResponse.json(
      { error: "Unexpected server error." },
      { status: 500 }
    );
  }
}
