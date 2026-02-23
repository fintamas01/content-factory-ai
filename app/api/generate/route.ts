import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import OpenAI from 'openai';

const ADMIN_EMAIL = "fintatamas68@gmail.com"; 

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// --- VALÓDI DEEP RESEARCH FUNKCIÓ ---
async function performDeepResearch(query: string) {
  try {
    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: process.env.TAVILY_API_KEY,
        query: query,
        search_depth: "advanced",
        max_results: 5
      })
    });
    
    const data = await response.json();
    // Összefűzzük a találatokat egy szöveggé a GPT-nek
    return data.results.map((r: any) => `Cím: ${r.title}\nForrás: ${r.url}\nTartalom: ${r.content}`).join("\n\n");
  } catch (error) {
    console.error("Keresési hiba:", error);
    return "Nem sikerült friss adatokat találni.";
  }
}

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANNON_KEY!,
      {
        cookies: {
          get(name: string) { return cookieStore.get(name)?.value; },
          set(name: string, value: string, options: CookieOptions) { cookieStore.set({ name, value, ...options }); },
          remove(name: string, options: CookieOptions) { cookieStore.set({ name, value: '', ...options }); },
        },
      }
    );

    const { data: { user } } = await supabase.auth.getUser();

    if (!user || user.email !== ADMIN_EMAIL) {
      return NextResponse.json(
        { error: "Zárt tesztfázis: Csak az adminisztrátor használhatja a rendszert." }, 
        { status: 403 }
      );
    }

    // Új paraméter: useResearch (ezt majd a UI-ról küldjük)
    const { content, tone, lang, platforms, brandProfile, useResearch } = await req.json();

    if (!platforms || platforms.length === 0) {
       return NextResponse.json({ error: "Válassz legalább egy platformot!" }, { status: 400 });
    }

    // 1. LÉPÉS: DEEP RESEARCH (Ha be van kapcsolva)
    let extraContext = "";
    if (useResearch) {
        // Itt hívnánk meg egy valós keresőt
        // extraContext = await performDeepResearch(content);
    }

    const langMap: { [key: string]: string } = {
        en: 'English', hu: 'Hungarian', de: 'German',
        fr: 'French', es: 'Spanish', it: 'Italian'
    };
    const targetLang = langMap[lang] || 'Hungarian';

    // 2. LÉPÉS: DINAMIKUS PROMPT ÖSSZEÁLLÍTÁSA
    // Platform-specifikus instrukciókat adunk hozzá
    const platformInstructions = platforms.map((p: string) => {
        if (p === 'LinkedIn') return "- LinkedIn: Szakmai, tekintélyépítő, tartalmazzon bullet pointokat és releváns hashtageket.";
        if (p === 'Instagram') return "- Instagram: Figyelemfelkeltő 'hook' az elején, emojik, és vizuális leírás (Image Prompt) a képhez.";
        if (p === 'X (Twitter)') return "- X: Rövid, ütős, max 280 karakter, thread-szerű felépítés ha szükséges.";
        return `- ${p}: Alkalmazkodj a platform sajátosságaihoz.`;
    }).join('\n');

    const systemPrompt = `Te egy világszínvonalú marketing stratéga és copywriter vagy.
    KIZÁRÓLAG A KÖVETKEZŐ MÁRKASTÍLUSBAN DOLGOZZ:
    - Márka: ${brandProfile.name}
    - Leírás: ${brandProfile.desc}
    - Célközönség: ${brandProfile.audience} 

    STÍLUS: ${tone}
    NYELV: ${targetLang}

    FELADAT:
    A megadott forrás tartalom alapján készíts posztokat.
    ${extraContext ? `KIEGÉSZÍTŐ INFÓK A WEBRŐL: ${extraContext}` : ''}

    PLATFORM SPECIFIKUS ELVÁRÁSOK:
    ${platformInstructions}

    VÁLASZFORMÁTUM:
    JSON objektum, ahol a kulcsok a platformok nevei. 
    Minden platformhoz tartozzon egy 'text' (a poszt szövege) és egy 'image_prompt' (leírás egy AI képgenerátornak).`;

    // 3. LÉPÉS: GENERÁLÁS (gpt-4o a jobb minőségért, ha kutatunk)
    const response = await openai.chat.completions.create({
      model: useResearch ? "gpt-4o" : "gpt-4o-mini",
      messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Forrás tartalom: ${content}` }
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
    });

    const result = JSON.parse(response.choices[0].message.content || "{}");

    // Mentés az adatbázisba
    await supabase.from('generations').insert([
      { 
        original_content: content, 
        tone, 
        results: result, 
        user_id: user.id,
        metadata: { research: useResearch, model: useResearch ? "gpt-4o" : "gpt-4o-mini" }
      }
    ]);

    return NextResponse.json(result);

  } catch (error) {
    console.error("Hiba:", error);
    return NextResponse.json({ error: "Generálási hiba" }, { status: 500 });
  }
}