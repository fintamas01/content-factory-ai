import { NextResponse } from "next/server";
import OpenAI from "openai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

function safeTrim(s: any) {
  return typeof s === "string" ? s.trim() : "";
}

type CaptionResult = {
  hook: string;
  platform: "instagram" | "linkedin" | "tiktok" | "facebook" | "x";
  tone: string;
  topic: string;

  output: {
    title: string;              // short internal label
    caption: string;            // full caption
    cta: string;                // CTA line
    hashtags: string[];         // hashtag pack
    altCaptions: string[];      // 2-3 alternates
    postingTips: string[];      // small actionable tips
    predictedEngagement: {
      score10: number;          // 1..10
      reasoning: string;        // short reason
    };
  };
};

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    if (!body) return badRequest("Invalid JSON body.");

    const hook = safeTrim(body.hook);
    const topic = safeTrim(body.topic);
    const tone = safeTrim(body.tone) || "modern, premium, direct";
    const platform = safeTrim(body.platform) || "instagram";

    if (!hook) return badRequest("Missing 'hook'.");
    if (!topic) return badRequest("Missing 'topic'.");

    // If no key, return deterministic fallback (so UI won’t break)
    if (!process.env.OPENAI_API_KEY) {
      const fallback: CaptionResult = {
        hook,
        platform: "instagram",
        tone,
        topic,
        output: {
          title: "Fallback Caption",
          caption:
            `${hook}\n\n` +
            `Here’s a practical, actionable take on ${topic}.\n` +
            `1) Do X\n2) Avoid Y\n3) Repeat Z\n\n` +
            `Want the full checklist? Comment “CHECKLIST”.`,
          cta: "Comment “CHECKLIST” and I’ll send it.",
          hashtags: ["#marketing", "#content", "#socialmedia", "#growth"],
          altCaptions: [
            `${hook}\n\nIf you’re serious about ${topic}, start with this: X → Y → Z.\n\nComment “START” for the template.`,
            `${hook}\n\nMost people overcomplicate ${topic}. Keep it simple:\n• X\n• Y\n• Z\n\nSave this for later.`,
          ],
          postingTips: [
            "Keep the first 2 lines punchy (hook + promise).",
            "Use 1 short list (3 bullets max).",
            "End with a single CTA (comment OR save OR DM).",
          ],
          predictedEngagement: {
            score10: 6,
            reasoning: "Fallback mode: no model call. Decent structure, but not optimized by AI.",
          },
        },
      };

      return NextResponse.json(
        {
          ok: true,
          diagnostics: { hasOpenAIKey: false },
          result: fallback,
        },
        { status: 200 }
      );
    }

    // IMPORTANT: We want STRUCTURED JSON back for easy UI rendering.
    const system = `
You output STRICT JSON only. No markdown.
You are a social media copywriter + growth strategist.
Do not invent personal/company facts. Keep it general.
Return JSON with this exact structure:

{
  "title": string,
  "caption": string,
  "cta": string,
  "hashtags": string[],
  "altCaptions": string[],
  "postingTips": string[],
  "predictedEngagement": { "score10": number, "reasoning": string }
}

Rules:
- caption: 900-1400 chars for Instagram/FB, 900-1600 for LinkedIn, shorter for X
- hashtags: 8-14 tags max, no duplicates, must start with #
- altCaptions: 3 items
- postingTips: 3-5 items, actionable
- predictedEngagement.score10: 1..10
`.trim();

    const user = {
      hook,
      topic,
      tone,
      platform,
    };

    const r = await openai.chat.completions.create({
      model: "gpt-4.1",
      messages: [
        { role: "system", content: system },
        { role: "user", content: JSON.stringify(user) },
      ],
      temperature: 0.6,
    });

    const raw = (r.choices[0]?.message?.content ?? "").trim();

    let parsed: any = null;
    try {
      parsed = JSON.parse(raw);
    } catch {
      // fallback if model responded weirdly
      parsed = {
        title: "Model Output (raw parse failed)",
        caption: raw,
        cta: "",
        hashtags: [],
        altCaptions: [],
        postingTips: [],
        predictedEngagement: { score10: 5, reasoning: "Model output parse failed. Returned raw." },
      };
    }

    const result: CaptionResult = {
      hook,
      platform:
        platform === "linkedin" || platform === "tiktok" || platform === "facebook" || platform === "x"
          ? platform
          : "instagram",
      tone,
      topic,
      output: {
        title: String(parsed?.title ?? "Generated Post"),
        caption: String(parsed?.caption ?? ""),
        cta: String(parsed?.cta ?? ""),
        hashtags: Array.isArray(parsed?.hashtags) ? parsed.hashtags.map((x: any) => String(x)) : [],
        altCaptions: Array.isArray(parsed?.altCaptions)
          ? parsed.altCaptions.map((x: any) => String(x)).slice(0, 3)
          : [],
        postingTips: Array.isArray(parsed?.postingTips)
          ? parsed.postingTips.map((x: any) => String(x)).slice(0, 6)
          : [],
        predictedEngagement: {
          score10: Number(parsed?.predictedEngagement?.score10 ?? 7),
          reasoning: String(parsed?.predictedEngagement?.reasoning ?? ""),
        },
      },
    };

    return NextResponse.json(
      {
        ok: true,
        diagnostics: { hasOpenAIKey: true },
        result,
      },
      { status: 200 }
    );
  } catch (e: any) {
    console.error("caption-from-hook error:", e);
    return NextResponse.json(
      { error: "Caption generation failed.", details: String(e?.message ?? e) },
      { status: 500 }
    );
  }
}