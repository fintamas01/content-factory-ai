import { createServerClient, type CookieOptions } from "@supabase/ssr";
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

export async function POST(req: Request) {
  try {
    // Next 15: cookies() Promise
    const cookieStore = await cookies();

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      // FONTOS: ANON (nem ANNON)
      process.env.NEXT_PUBLIC_SUPABASE_ANNON_KEY!,
      {
        cookies: {
          // Supabase SSR ajánlott minta App Routerhez
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) => {
                cookieStore.set(name, value, options);
              });
            } catch {
              // Server Component hívás esetén figyelmen kívül hagyható
            }
          },
        },
      }
    );

    const { data: authData, error: authErr } = await supabase.auth.getUser();
    if (authErr) {
      console.error("Auth hiba:", authErr);
    }
    const user = authData?.user;

    if (!user || user.email !== ADMIN_EMAIL) {
      return NextResponse.json(
        { error: "Zárt tesztfázis: Csak az adminisztrátor használhatja a rendszert." },
        { status: 403 }
      );
    }

    const { content, tone, lang, platforms, brandProfile, useResearch } =
      await req.json();

    if (!platforms || platforms.length === 0) {
      return NextResponse.json(
        { error: "Válassz legalább egy platformot!" },
        { status: 400 }
      );
    }

    // 1) BRAND TWIN MEMÓRIA LEKÉRÉS (RAG)
    let memoryBlock = "Nincs korábbi memória.";
    try {
      const memory = await getBrandMemory(user.id, content);
      if (memory?.length) {
        memoryBlock = memory
          .map((m: any) => `- (${Number(m.similarity).toFixed(2)}) ${m.content}`)
          .join("\n");
      }
    } catch (e) {
      console.error("Brand memory lekérés hiba:", e);
      // nem állítjuk le a generálást
    }

    // 2) DEEP RESEARCH (opcionális)
    let extraContext = "";
    if (useResearch) {
      // ha akarod élesben:
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

    const platformInstructions = platforms
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

    const systemPrompt = `Te egy világszínvonalú marketing stratéga és Narratív Brand Twin ügynök vagy.

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
JSON objektum, ahol a kulcsok a platformok nevei.
Minden platformhoz tartozzon egy 'text' és egy 'image_prompt'.`;

    const response = await openai.chat.completions.create({
      model: useResearch ? "gpt-4o" : "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Forrás tartalom: ${content}` },
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
    });

    const raw = response.choices[0]?.message?.content ?? "{}";

    let result: any = {};
    try {
      result = JSON.parse(raw);
    } catch (e) {
      console.error("OpenAI JSON parse hiba. RAW:", raw);
      return NextResponse.json(
        { error: "A modell nem adott vissza érvényes JSON-t." },
        { status: 500 }
      );
    }

    // 3) Mentés a generations táblába
    const { error: insertErr } = await supabase.from("generations").insert([
      {
        original_content: content,
        tone,
        results: result,
        user_id: user.id,
        metadata: {
          research: !!useResearch,
          model: useResearch ? "gpt-4o" : "gpt-4o-mini",
        },
      },
    ]);

    if (insertErr) {
      console.error("Generations insert hiba:", insertErr);
      // nem feltétlen állítjuk le a választ, de logoljuk
    }

    // 4) Brand Memory mentés (vector store)
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
          model: useResearch ? "gpt-4o" : "gpt-4o-mini",
        });
      }
    } catch (e) {
      console.error("Brand memory mentés hiba:", e);
      // nem állítjuk le a választ
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Hiba:", error);
    return NextResponse.json({ error: "Generálási hiba" }, { status: 500 });
  }
}