import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import OpenAI from "openai";
import { getBrandMemory, saveBrandMemory } from "@/lib/agent/brand-memory";

const ADMIN_EMAIL = "fintatamas68@gmail.com";

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

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();

    // ✅ támogatjuk az ANON és ANNON env neveket is
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

    if (!user || user.email !== ADMIN_EMAIL) {
      return NextResponse.json(
        { error: "Zárt tesztfázis: Csak az adminisztrátor használhatja a rendszert." },
        { status: 403 }
      );
    }

    const { content, tone, lang, platforms, brandProfile, useResearch } =
      await req.json();

    if (!content || typeof content !== "string") {
      return NextResponse.json({ error: "Hiányzik a tartalom!" }, { status: 400 });
    }

    if (!platforms || platforms.length === 0) {
      return NextResponse.json(
        { error: "Válassz legalább egy platformot!" },
        { status: 400 }
      );
    }

    // 1) BRAND TWIN MEMÓRIA LEKÉRÉS (RAG)
    let memoryBlock = "Nincs korábbi memória.";
    try {
      const memory = await getBrandMemory(user.id, content, {
        threshold: 0.75,
        count: 5,
      });

      if (memory?.length) {
        memoryBlock = memory
          .map(
            (m: any) =>
              `- (${Number(m.similarity).toFixed(2)}) ${String(m.content).slice(0, 1200)}`
          )
          .join("\n");
      }
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

    const langMap: Record<string, string> = {
      en: "English",
      hu: "Hungarian",
      de: "German",
      fr: "French",
      es: "Spanish",
      it: "Italian",
    };
    const targetLang = langMap[lang] || "Hungarian";

    const platformInstructions = (platforms as string[])
      .map((p: string) => {
        if (p === "LinkedIn")
          return "- LinkedIn: Szakmai, tekintélyépítő, tartalmazzon bullet pointokat és releváns hashtageket.";
        if (p === "Instagram")
          return "- Instagram: Figyelemfelkeltő 'hook' az elején, emojik, és vizuális leírás (Image Prompt) a képhez.";
        if (p === "X (Twitter)")
          return "- X: Rövid, ütős, max 280 karakter, thread-szerű felépítés ha szükséges.";
        return `- ${p}: Alkalmazkodj a platform sajátosságaihoz.`;
      })
      .join("\n");

    // ---- 3) DRAFT GENERÁLÁS ----
    const systemPromptDraft = `Te egy világszínvonalú marketing stratéga és Narratív Brand Twin ügynök vagy.

KIZÁRÓLAG A KÖVETKEZŐ MÁRKASTÍLUSBAN DOLGOZZ:
- Márka: ${brandProfile.name}
- Leírás: ${brandProfile.desc}
- Célközönség: ${brandProfile.audience}

RELEVÁNS MÚLTBELI MEMÓRIÁK (tanulj belőlük, de ne másold szó szerint):
${memoryBlock}

STÍLUS: ${tone}
NYELV: ${targetLang}

FELADAT:
A megadott forrás tartalom alapján készíts posztokat.
${extraContext ? `KIEGÉSZÍTŐ INFÓK A WEBRŐL:\n${extraContext}` : ""}

PLATFORM SPECIFIKUS ELVÁRÁSOK:
${platformInstructions}

VÁLASZFORMÁTUM:
KIZÁRÓLAG érvényes JSON objektum.
Kulcsok: a platformok nevei.
Minden platform: { "text": "...", "image_prompt": "..." }`;

    const model = useResearch ? "gpt-4o" : "gpt-4o-mini";

    const draftResp = await openai.chat.completions.create({
      model,
      messages: [
        { role: "system", content: systemPromptDraft },
        { role: "user", content: `Forrás tartalom: ${content}` },
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
    const critiqueSystem = `Te egy kíméletlen, adatvezérelt social media editor vagy.
Feladatod: értékeld a posztok virális potenciálját és márkahűségét.
Add vissza KIZÁRÓLAG JSON-t: 
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
          content: `Brand: ${brandProfile.name}\nTone: ${tone}\nLanguage: ${targetLang}\nPlatforms: ${platforms.join(
            ", "
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
      return NextResponse.json(draft);
    }
    const critique = critiqueParsed.value;

    const rewriteSystem = `Te ugyanaz a Brand Twin ügynök vagy, de most KÖTELEZŐEN javítod a posztokat az editor javaslatai alapján.
KIZÁRÓLAG érvényes JSON-t adj vissza ugyanabban a formátumban.`;

    const rewriteResp = await openai.chat.completions.create({
      model,
      messages: [
        { role: "system", content: rewriteSystem },
        {
          role: "user",
          content: `Brand: ${brandProfile.name}
Leírás: ${brandProfile.desc}
Célközönség: ${brandProfile.audience}

RELEVÁNS MEMÓRIA:
${memoryBlock}

Editor értékelés:
${JSON.stringify(critique)}

Eredeti draft:
${JSON.stringify(draft)}

Feladat: írd újra a posztokat úgy, hogy a score minél közelebb legyen 100-hoz, de maradjon márkahű és természetes.`,
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.6,
    });

    const finalRaw = rewriteResp.choices[0]?.message?.content ?? "{}";
    const finalParsed = safeJsonParse(finalRaw);
    if (!finalParsed.ok) {
      console.error("Final JSON parse hiba. RAW:", finalRaw);
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

    // 6) Brand Memory mentés (final output)
    try {
      const combined = (platforms as string[])
        .map((p: string) => {
          const post = result?.[p];
          if (!post) return "";
          return `PLATFORM: ${p}\nTEXT: ${post.text}\nIMAGE_PROMPT: ${post.image_prompt}`;
        })
        .filter(Boolean)
        .join("\n\n");

      if (combined.trim().length > 0) {
        await saveBrandMemory(user.id, combined, {
          platforms,
          tone,
          lang,
          model,
          critique_score: critique?.score,
        });
      }
    } catch (e) {
      console.error("Brand memory mentés hiba:", e);
    }

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