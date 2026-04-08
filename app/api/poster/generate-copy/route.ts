import OpenAI from "openai";
import { NextResponse } from "next/server";
import { incrementUsage } from "@/lib/usage/usage-service";
import { requireSessionClientAndUsageAllowance } from "@/lib/usage/require-session-usage";
import { resolveOutputLanguage } from "@/lib/i18n/output-language";
import { requireFeatureAccess } from "@/lib/entitlements/api";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnon =
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnon) {
      return NextResponse.json(
        { error: "Server configuration error." },
        { status: 500 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const {
      description,
      url,
      platform = "instagram_post",
      lang,
      brandProfile,
      tone = "professional",
    } = body ?? {};

    if (!description || typeof description !== "string") {
      return NextResponse.json({ error: "Description is required." }, { status: 400 });
    }
    if (!brandProfile?.name) {
      return NextResponse.json({ error: "Brand profile is required." }, { status: 400 });
    }

    const gate = await requireSessionClientAndUsageAllowance("content");
    if (!gate.ok) return gate.response;

    const { supabase, user, clientId } = gate;

    const denied = await requireFeatureAccess({
      supabase,
      userId: user.id,
      featureKey: "posterStudio",
    });
    if (denied) return denied;

    const { label: targetLang } = resolveOutputLanguage(lang);

    const system = `You are a sharp advertising copywriter. Output short poster copy as JSON only.

REQUIRED JSON shape:
{
  "headline": "...",
  "sub": "...",
  "cta": "..."
}

Rules:
- Headline: max 6–8 words, punchy.
- Sub: 1–2 sentences, ~140 characters max.
- CTA: max 5–7 words.
- Language: all three strings must be entirely in ${targetLang}. Do not use Hungarian unless the output language is Hungarian.
- Tone: ${String(tone)}
- Platform: ${String(platform)}

Brand:
- Name: ${brandProfile.name}
- Description: ${brandProfile.desc ?? ""}
- Audience: ${brandProfile.audience ?? ""}

If a URL is provided, use it as context only — do not put long URLs in the copy.`;

    const userMsg = `Brief / description:
${description}

Optional URL:
${url ?? ""}`;

    const resp = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: system },
        { role: "user", content: userMsg },
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
    });

    const raw = resp.choices[0]?.message?.content ?? "{}";

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return NextResponse.json(
        { error: "The model did not return valid JSON." },
        { status: 500 }
      );
    }

    await incrementUsage(supabase, "content", clientId);

    return NextResponse.json({
      headline: String(parsed.headline ?? ""),
      sub: String(parsed.sub ?? ""),
      cta: String(parsed.cta ?? ""),
    });
  } catch (e) {
    console.error("poster generate-copy:", e);
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}
