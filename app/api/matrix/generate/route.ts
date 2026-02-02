import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import OpenAI from 'openai';
import { PLAN_LIMITS } from '@/app/lib/plan-limits';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: Request) {
  const cookieStore = await cookies();
  
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANNON_KEY!,
    {
      cookies: {
        get(name: string) { return cookieStore.get(name)?.value },
      },
    }
  );

  try {
    const { brand, audience, topic, tone } = await req.json();

    // 1. User check
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Nincs bejelentkezve' }, { status: 401 });

    // 2. Limit check
    const currentMonth = new Date().toISOString().slice(0, 7);
    // ... limit ellenőrzés kódja maradhat a régi, vagy egyszerűsíthetjük ...

    // 3. AI Generálás - JAVÍTOTT PROMPT
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { 
            role: "system", 
            content: `Profi social media content creator vagy. Hangnem: "${tone || 'Professzionális'}".
            
            FELADAT: Készíts 5 napos tartalomtervet.
            Minden naphoz generálj egy "slides" tömböt (Array) is, ami a lapozós poszt (carousel) kártyáinak szövegét tartalmazza.
            
            SZIGORÚ SZABÁLYOK A SLIDES TARTALMÁHOZ:
            1. TILOS csak címszavakat írni (pl. "SEO szempontok").
            2. Minden kártyán legyen KONKRÉT, KIFEJTETT tartalom (kb. 2-3 mondat, 30-40 szó).
            3. A szöveg legyen edukatív, adjon át valódi tudást vagy tippet.
            4. Ne számozd be a szöveget (Ne írd, hogy "1. dia:"), csak a tiszta tartalom kell.
            
            Példa egy jó slide tartalomra:
            "A algoritmusok imádják a videókat, de a feliratok még fontosabbak. A felhasználók 85%-a hang nélkül görget, így ha nincs felirat, azonnal továbbállnak."
            
            JSON formátumban válaszolj!` 
        },
        { 
            role: "user", 
            content: `Márka: ${brand}. Célközönség: ${audience}. Téma: ${topic}.
            
            A válasz JSON struktúrája (tartsd be): 
            { 
              "days": [{ 
                "day": "Hétfő", 
                "title": "Rövid, ütős cím", 
                "platform": "LinkedIn/Insta", 
                "outline": "Stratégiai cél...", 
                "content": "A poszt teljes szövege (caption), hashtagekkel...",
                "slides": [
                  "Első dia szövege (Bevezetés, figyelemfelkeltés, kb 20 szó)",
                  "Második dia szövege (Konkrét tipp részletesen kifejtve, kb 30 szó)",
                  "Harmadik dia szövege (Másik tipp vagy érv részletesen, kb 30 szó)",
                  "Negyedik dia szövege (Összefoglalás vagy CTA, kb 20 szó)"
                ]
              }] 
            }` 
        }
      ],
      response_format: { type: "json_object" }
    });

    const generatedContent = JSON.parse(completion.choices[0].message.content!);

    // 4. Mentés
    const { error: insertError } = await supabase.from('matrix_generations').insert({
      user_id: user.id,
      brand_name: brand,
      month_year: currentMonth,
      generation_data: generatedContent
    });

    if (insertError) console.error("Mentési hiba:", insertError);

    return NextResponse.json(generatedContent);

  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json({ error: 'Szerver hiba' }, { status: 500 });
  }
}