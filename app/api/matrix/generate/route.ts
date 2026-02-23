import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Kereső funkció (ugyanaz a logika, mint a Dashboardnál)
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
    return data.results.map((r: any) => `Info: ${r.content} (Forrás: ${r.url})`).join("\n\n");
  } catch (error) {
    return "Nem sikerült friss adatokat találni.";
  }
}

export async function POST(req: Request) {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANNON_KEY!,
    { cookies: { get(name: string) { return cookieStore.get(name)?.value }, }, }
  );

  try {
    // ÚJ: useResearch paraméter fogadása
    const { brand, audience, topic, tone, useResearch } = await req.json();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Nincs bejelentkezve' }, { status: 401 });

    // 1. LÉPÉS: Kutatás (ha kérik)
    let researchData = "";
    if (useResearch) {
      researchData = await performDeepResearch(topic);
    }

    // 2. LÉPÉS: Komplex heti stratégia generálása
    const completion = await openai.chat.completions.create({
      model: useResearch ? "gpt-4o" : "gpt-4o-mini",
      messages: [
        { 
            role: "system", 
            content: `Te egy Senior Social Media Strategist vagy. Hangnem: "${tone}".
            
            FELADAT: Készíts egy 5 napos, több-platformos "Content Pack"-et.
            
            DIVERZIFIKÁCIÓ:
            - Day 1: LinkedIn (Szakmai tekintélyépítés)
            - Day 2: Instagram (Carousel/Lapozós poszt)
            - Day 3: X/Twitter (Rövid, ütős gondolatébresztő)
            - Day 4: Instagram (Sztori vagy egyetlen kép)
            - Day 5: LinkedIn/Newsletter (Heti összefoglaló/CTA)
            
            Minden naphoz kötelező egy 'image_prompt', ami részletesen leírja az AI-nak, milyen vizuális elemet generáljon.` 
        },
        { 
            role: "user", 
            content: `Márka: ${brand}. Célközönség: ${audience}. Téma: ${topic}.
            ${researchData ? `FRISS PIACI INFÓK: ${researchData}` : ''}
            
            JSON formátum:
            { 
              "days": [{ 
                "day": "Hétfő", 
                "title": "Cím", 
                "platform": "Platform neve", 
                "outline": "Stratégia", 
                "content": "A teljes poszt szövege",
                "image_prompt": "Dall-E 3 prompt a képhez",
                "slides": ["Opcionális: kártyák szövege, ha Carousel"]
              }] 
            }` 
        }
      ],
      response_format: { type: "json_object" }
    });

    const generatedContent = JSON.parse(completion.choices[0].message.content!);

    // Mentés az adatbázisba
    await supabase.from('matrix_generations').insert({
      user_id: user.id,
      brand_name: brand,
      month_year: new Date().toISOString().slice(0, 7),
      generation_data: generatedContent
    });

    return NextResponse.json(generatedContent);

  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json({ error: 'Szerver hiba' }, { status: 500 });
  }
}