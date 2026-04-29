import OpenAI from "openai";
import { NextResponse } from "next/server";
import { resolveOutputLanguage } from "@/lib/i18n/output-language";
import {
  buildSocialPostGenerateTextMessages,
  parseWooCommerceProductContext,
} from "@/lib/social-posts/generate-text-messages";
import { incrementUsage } from "@/lib/usage/usage-service";
import { requireSessionClientAndUsageAllowance } from "@/lib/usage/require-session-usage";
import {
  getSocialPostTemplateById,
  getTemplateTextFieldDefinitions,
} from "@/lib/creatomate/social-post-templates";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: Request) {
  try {
    if (!process.env.OPENAI_API_KEY?.trim()) {
      return NextResponse.json(
        { success: false, error: "AI is not configured on the server." },
        { status: 500 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const templateId = typeof body.templateId === "string" ? body.templateId.trim() : "";
    const brief = typeof body.brief === "string" ? body.brief.trim() : "";
    const tone =
      body.tone === null || body.tone === undefined
        ? null
        : typeof body.tone === "string"
          ? body.tone.trim() || null
          : null;

    const languageRaw = typeof body.language === "string" ? body.language.trim() : "";
    const { label: languageLabel } = resolveOutputLanguage(languageRaw || "en");

    if (!templateId) {
      return NextResponse.json({ success: false, error: "templateId is required." }, { status: 400 });
    }
    if (!brief) {
      return NextResponse.json({ success: false, error: "Brief is required." }, { status: 400 });
    }

    const template = getSocialPostTemplateById(templateId);
    if (!template) {
      return NextResponse.json({ success: false, error: "Unknown template." }, { status: 404 });
    }

    const textFields = getTemplateTextFieldDefinitions(template);
    if (textFields.length === 0) {
      return NextResponse.json(
        { success: false, error: "This template has no text fields to generate." },
        { status: 400 }
      );
    }

    const productRaw = body.product;
    const product = parseWooCommerceProductContext(productRaw);
    if (
      productRaw != null &&
      typeof productRaw === "object" &&
      !Array.isArray(productRaw) &&
      product === null
    ) {
      return NextResponse.json({ success: false, error: "Invalid product context." }, { status: 400 });
    }

    const gate = await requireSessionClientAndUsageAllowance("content");
    if (!gate.ok) return gate.response;

    const { supabase, clientId } = gate;

    const { system, user: userMsg } = buildSocialPostGenerateTextMessages({
      template,
      textFields,
      brief,
      tone,
      languageLabel,
      product,
    });

    const resp = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: system },
        { role: "user", content: userMsg },
      ],
      response_format: { type: "json_object" },
      temperature: 0.75,
    });

    const raw = resp.choices[0]?.message?.content ?? "{}";
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return NextResponse.json(
        { success: false, error: "The model did not return valid JSON." },
        { status: 500 }
      );
    }

    const values: Record<string, string> = {};
    for (const f of textFields) {
      const v = parsed[f.key];
      values[f.key] = typeof v === "string" ? v : "";
    }

    await incrementUsage(supabase, "content", clientId);

    return NextResponse.json({ success: true, values });
  } catch (e) {
    console.error("social-posts/generate-text:", e);
    return NextResponse.json({ success: false, error: "Server error." }, { status: 500 });
  }
}
