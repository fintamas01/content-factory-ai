import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import OpenAI from "openai";
import type { ProductCopyResult } from "@/lib/products/types";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function parseJsonContent(raw: string): unknown {
  let cleaned = raw.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/s, "");
  }
  return JSON.parse(cleaned);
}

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

const SYSTEM = `You are an expert ecommerce and SaaS copywriter. Generate compelling, accurate product listing copy. Output strictly valid JSON only with these keys (no extra keys, no markdown):
{
  "title": "string — short product title for listing or PDP headline",
  "description": "string — 2–4 sentences, benefits-led, ready to paste on a product page",
  "bullets": ["string", ...] — 4–6 bullet points, each one line, feature+benefit style",
  "seo_title": "string — under ~60 chars, primary keyword natural",
  "seo_description": "string — meta description under ~160 chars, click-worthy"
}
Respect the user's tone if provided. Do not invent specs or awards not implied by the input. Plain text in strings only.`;

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
    if (!authData?.user) {
      return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const productName = typeof body.productName === "string" ? body.productName.trim() : "";
    if (!productName) {
      return NextResponse.json(
        { error: "Product name is required." },
        { status: 400 }
      );
    }

    const description =
      typeof body.description === "string" ? body.description.trim() : "";
    const targetAudience =
      typeof body.targetAudience === "string" ? body.targetAudience.trim() : "";
    const tone = typeof body.tone === "string" ? body.tone.trim() : "";

    const userPayload = {
      productName,
      description: description || undefined,
      targetAudience: targetAudience || undefined,
      tone: tone || undefined,
    };

    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_PRODUCT_MODEL ?? "gpt-4o-mini",
      temperature: 0.45,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM },
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
      parsed = parseJsonContent(content);
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

    return NextResponse.json({ result });
  } catch (e) {
    console.error("generate-product:", e);
    return NextResponse.json(
      { error: "Unexpected server error." },
      { status: 500 }
    );
  }
}
