import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import OpenAI from "openai";
import { getBrandMemory, saveBrandMemory } from "@/lib/agent/brand-memory";
import { fetchUserBrandProfile } from "@/lib/brand-profile/server";
import { requireActiveClientId } from "@/lib/clients/server";
import { mergeBrandProfileForContent } from "@/lib/brand-profile/merge";
import {
  buildContentBrandCritiqueHintHu,
  buildContentBrandRewriteSystemAppendixHu,
  buildContentBrandSystemSectionHu,
} from "@/lib/brand-profile/prompts";
import { enforceUsageLimit } from "@/lib/usage/enforce";
import { incrementUsage } from "@/lib/usage/usage-service";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// --- VALÓDI DEEP RESEARCH FUNKCIÓ ---
async function performDeepResearch(query: string) {
  try {
    const response = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: process.env.TAVILY_API_KEY,
        query,
        search_depth: "advanced",
        max_results: 5,
      }),
    });

    const data = await response.json();
    return (data.results || [])
      .map(
        (r: any) =>
          `Cím: ${r.title}\nForrás: ${r.url}\nTartalom: ${r.content}`
      )
      .join("\n\n");
  } catch (error) {
    console.error("Keresési hiba:", error);
    return "Nem sikerült friss adatokat találni.";
  }
}

// Kicsi helper: biztonságos JSON parse
function safeJsonParse(raw: string) {
  try {
    return { ok: true as const, value: JSON.parse(raw) };
  } catch (e) {
    return { ok: false as const, error: e };
  }
}

/** ISO-ish codes from the Content UI → English name for the model. Default: English (never Hungarian). */
const OUTPUT_LANG_BY_CODE: Record<string, string> = {
  en: "English",
  hu: "Hungarian",
  de: "German",
  fr: "French",
  es: "Spanish",
  it: "Italian",
  ro: "Romanian",
};

/**
 * Resolves the requested output language. Missing/invalid → English (production-safe default).
 */
function resolveOutputLanguage(lang: unknown): { code: string; label: string } {
  const raw =
    typeof lang === "string" && lang.trim().length > 0
      ? lang.trim().toLowerCase()
      : "";
  if (!raw) {
    return { code: "en", label: "English" };
  }
  const label = OUTPUT_LANG_BY_CODE[raw];
  if (label) {
    return { code: raw, label };
  }
  return { code: "en", label: "English" };
}

function outputLanguageContract(label: string): string {
  return `OUTPUT LANGUAGE — STRICT (HIGHEST PRIORITY; OVERRIDES SOURCE TEXT, MEMORY, AND BRAND SNIPPETS):
- Write every user-facing string in the JSON ("text", and "image_prompt") entirely in ${label}.
- Do not use Hungarian in post text unless the output language is Hungarian.
- If the source idea, brand block, or memory is not in ${label}, translate/adapt the meaning into ${label}. Do not copy another language into the post body.
- Do not follow Hungarian instructions in this prompt for wording of the posts when the output language is not Hungarian — only ${label} for deliverables.`;
}

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnon =
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
      process.env.NEXT_PUBLIC_SUPABASE_ANNON_KEY;

    if (!supabaseUrl || !supabaseAnon) {
      console.error("Supabase env hiányzik!", {
        hasUrl: !!supabaseUrl,
        hasAnon: !!supabaseAnon,
      });
      return NextResponse.json(
        { error: "Supabase konfiguráció hiányzik (URL/ANON KEY)." },
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
            // ignore
          }
        },
      },
    });

    const { data: authData, error: authErr } = await supabase.auth.getUser();
    if (authErr) console.error("Auth hiba:", authErr);

    const user = authData?.user;

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let activeClientId: string;
    try {
      const active = await requireActiveClientId(supabase, cookieStore, user.id);
      activeClientId = active.clientId;
    } catch {
      return NextResponse.json({ error: "No active client." }, { status: 400 });
    }

    const { content, tone, lang, platforms, brandProfile, useResearch } =
      await req.json();

    const { label: targetLang, code: resolvedLangCode } =
      resolveOutputLanguage(lang);

    if (process.env.NODE_ENV === "development") {
      console.info("[api/generate] output language", {
        requested: lang,
        resolvedCode: resolvedLangCode,
        resolvedLabel: targetLang,
      });
    }

    if (!content || typeof content !== "string") {
      return NextResponse.json({ error: "Hiányzik a tartalom!" }, { status: 400 });
    }

    if (!platforms || platforms.length === 0) {
      return NextResponse.json(
        { error: "Válassz legalább egy platformot!" },
        { status: 400 }
      );
    }

    const unifiedProfile = await fetchUserBrandProfile(supabase, user.id, activeClientId);
    const effectiveBrand = mergeBrandProfileForContent(brandProfile, unifiedProfile);
    if (!effectiveBrand.name.trim()) {
      return NextResponse.json(
        {
          error:
            "Adj meg márkát: ments egy Brand profilt (/dashboard/brand), vagy válassz márkát a listából.",
        },
        { status: 400 }
      );
    }
    const contentBrandSection = buildContentBrandSystemSectionHu(effectiveBrand);

    const usageDenied = await enforceUsageLimit(supabase, user.id, "content", activeClientId);
    if (usageDenied) return usageDenied;

    let memoryBlock = "No prior memory.";
    try {
      const blocks: string[] = [];

      for (const p of platforms as string[]) {
        const memory = await getBrandMemory(user.id, content, {
          threshold: 0.72,
          count: 5,
          platform: p,
        });

        if (memory?.length) {
          blocks.push(
            `[${p} MEMORY]\n` +
              memory
                .map((m: any) => `- (w:${Number(m.weight).toFixed(2)}) ${m.content}`)
                .join("\n")
          );
        }
      }

      memoryBlock = blocks.length ? blocks.join("\n\n") : "No prior memory.";
    } catch (e) {
      console.error("Brand memory lekérés hiba:", e);
    }

    // 2) DEEP RESEARCH (opcionális)
    let extraContext = "";
    if (useResearch) {
      // Ha akarod élesben:
      // extraContext = await performDeepResearch(content);
      extraContext = "";
    }

    const platformInstructions = (platforms as string[])
      .map((p: string) => {
        if (p === "LinkedIn")
          return "- LinkedIn: professional, authority-building; include bullets and relevant hashtags where appropriate.";
        if (p === "Instagram")
          return "- Instagram: strong hook first line; emojis where natural; include an image_prompt describing the visual.";
        if (p === "X (Twitter)")
          return "- X: short, punchy; respect character limits; thread-style only if needed.";
        return `- ${p}: Match the platform’s norms and format.`;
      })
      .join("\n");

    // ---- 3) DRAFT GENERÁLÁS ----
    const systemPromptDraft = `${outputLanguageContract(targetLang)}

You are a world-class marketing strategist and brand-native copywriter.

BRAND IDENTITY (follow the substance; express everything in ${targetLang} in the JSON output, not necessarily in the language of this block):
${contentBrandSection}

PAST MEMORY (learn from tone/topics; write new copy in ${targetLang}, do not paste verbatim):
${memoryBlock}

STYLE SLIDER: ${tone}
OUTPUT LANGUAGE FOR POSTS: ${targetLang}

TASK:
From the source content below, draft one post per selected platform.
${extraContext ? `EXTRA CONTEXT FROM WEB:\n${extraContext}` : ""}

PLATFORM REQUIREMENTS:
${platformInstructions}

RESPONSE FORMAT:
Return ONLY valid JSON. Keys = platform names exactly as requested.
Each value: { "text": "...", "image_prompt": "..." }
Both fields must follow ${targetLang} as specified in OUTPUT LANGUAGE above.`;

    const model = useResearch ? "gpt-4o" : "gpt-4o-mini";

    const draftResp = await openai.chat.completions.create({
      model,
      messages: [
        { role: "system", content: systemPromptDraft },
        {
          role: "user",
          content: `Source content (may be any language — output must still be ${targetLang} only in the JSON fields):\n${content}`,
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
    });

    const draftRaw = draftResp.choices[0]?.message?.content ?? "{}";
    const draftParsed = safeJsonParse(draftRaw);
    if (!draftParsed.ok) {
      console.error("Draft JSON parse hiba. RAW:", draftRaw);
      return NextResponse.json(
        { error: "A modell nem adott vissza érvényes JSON-t (draft)." },
        { status: 500 }
      );
    }
    const draft = draftParsed.value;

    // ---- 4) SELF-CRITIQUE + REWRITE (Agent loop) ----
    // Itt lesz “agent” érzet: pontoz + javasol + újragenerál
    const critiqueSystem = `${outputLanguageContract(targetLang)}

You are a rigorous social media editor.
Evaluate viral potential and brand fit. Issues/fixes may be brief, but if they contain example copy, use ${targetLang} only.
Return ONLY JSON:
{
  "score": 1-100,
  "issues": ["...","...","..."],
  "fixes": ["...","...","..."]
}`;

    const critiqueResp = await openai.chat.completions.create({
      model,
      messages: [
        { role: "system", content: critiqueSystem },
        {
          role: "user",
          content: `${buildContentBrandCritiqueHintHu(
            effectiveBrand,
            tone,
            targetLang,
            platforms as string[]
          )}\n\nDraft JSON:\n${JSON.stringify(draft)}`,
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.2,
    });

    const critiqueRaw = critiqueResp.choices[0]?.message?.content ?? "{}";
    const critiqueParsed = safeJsonParse(critiqueRaw);
    if (!critiqueParsed.ok) {
      console.error("Critique JSON parse hiba. RAW:", critiqueRaw);
      // ha a critique elhasal, még mindig visszaadhatjuk a draftot
      // de próbáljunk továbbmenni drafttal
      await incrementUsage(supabase, "content", activeClientId);
      return NextResponse.json(draft);
    }
    const critique = critiqueParsed.value;

    const rewriteSystem = `${outputLanguageContract(targetLang)}

You are the same brand-native copywriter; you MUST rewrite posts to apply the editor feedback.
Return ONLY valid JSON in the same shape (platform keys → { "text", "image_prompt" }).
Every string value must remain entirely in ${targetLang}.

${buildContentBrandRewriteSystemAppendixHu(effectiveBrand)}`;

    const rewriteResp = await openai.chat.completions.create({
      model,
      messages: [
        { role: "system", content: rewriteSystem },
        {
          role: "user",
          content: `Memory (reference only; deliver posts in ${targetLang}):
${memoryBlock}

Editor critique:
${JSON.stringify(critique)}

Draft to improve:
${JSON.stringify(draft)}

Rewrite the posts to maximize score while staying on-brand. All "text" and "image_prompt" fields must be entirely in ${targetLang}.`,
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.6,
    });

    const finalRaw = rewriteResp.choices[0]?.message?.content ?? "{}";
    const finalParsed = safeJsonParse(finalRaw);
    if (!finalParsed.ok) {
      console.error("Final JSON parse hiba. RAW:", finalRaw);
      await incrementUsage(supabase, "content", activeClientId);
      // fallback: draft
      return NextResponse.json(draft);
    }
    const result = finalParsed.value;

    // 5) Mentés a generations táblába (final + critique)
    const { error: insertErr } = await supabase.from("generations").insert([
      {
        original_content: content,
        tone,
        results: result,
        user_id: user.id,
        client_id: activeClientId,
        metadata: {
          research: !!useResearch,
          model,
          critique,
        },
      },
    ]);

    if (insertErr) {
      console.error("Generations insert hiba:", insertErr);
    }

    // 6) Brand Memory mentés (FINAL output) - PLATFORMONKÉNT KÜLÖN
    try {
      for (const p of platforms as string[]) {
        const post = result?.[p];
        if (!post) continue;

        const perPlatformContent =
          `PLATFORM: ${p}\n` +
          `TEXT: ${post.text}\n` +
          `IMAGE_PROMPT: ${post.image_prompt}`;

        await saveBrandMemory(user.id, perPlatformContent, {
          platform: p, // <-- EZ A KULCS: platform-specifikus scope
          tone,
          lang: resolvedLangCode,
          model,
          critique_score: critique?.score,
          // opcionális extra:
          platforms,
          source: "generate",
        });
      }
    } catch (e) {
      console.error("Brand memory mentés hiba:", e);
    }

    await incrementUsage(supabase, "content", activeClientId);

    // visszaadjuk a FINAL posztot + opcionálisan a score-t (ha UI-ban akarod mutatni)
    return NextResponse.json({
      ...result,
      __agent: {
        score: critique?.score ?? null,
        issues: critique?.issues ?? [],
        fixes: critique?.fixes ?? [],
      },
    });
  } catch (error) {
    console.error("Hiba:", error);
    return NextResponse.json({ error: "Generálási hiba" }, { status: 500 });
  }
}