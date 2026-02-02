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
    const { brandName, audience, topic, tone } = await req.json();

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
            content: `Profi social media manager vagy. Hangnem: "${tone || 'Professzionális'}". 
            
            FELADAT: Készíts 5 napos tartalomtervet.
            Minden naphoz generálj egy "slides" tömböt is, ami kifejezetten a lapozós posztok (carousel) KÉPEIRE kerülő szövegeket tartalmazza.
            
            FONTOS SZABÁLYOK A SLIDES-HOZ:
            1. Ne adj utasítást (pl. "Ide írd a tippet"), hanem írd meg a KONKRÉT tartalmat.
            2. Legyen tömör, olvasható, edukatív.
            3. 4-5 diából álljon.
            
            JSON formátumban válaszolj!` 
        },
        { 
            role: "user", 
            content: `Márka: ${brandName}. Célközönség: ${audience}. Téma: ${topic}.
            
            A válasz JSON struktúrája EZ legyen (tartsd be pontosan): 
            { 
              "days": [{ 
                "day": "Hétfő", 
                "title": "Rövid cím", 
                "platform": "LinkedIn/Insta", 
                "outline": "Stratégia cél...", 
                "content": "A poszt teljes szövege (caption), hashtagekkel...",
                "slides": [
                  "1. dia: Figyelemfelkeltő Címsor",
                  "2. dia: Az első konkrét tipp vagy gondolat kifejtve...",
                  "3. dia: A második konkrét tipp vagy érv...",
                  "4. dia: Összefoglalás vagy CTA"
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
      brand_name: brandName,
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