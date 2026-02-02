import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js'; // <--- ÚJ IMPORT
import { cookies } from 'next/headers';
import OpenAI from 'openai';
import { PLAN_LIMITS } from '@/app/lib/plan-limits';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: Request) {
  const cookieStore = await cookies();
  
  // 1. Normál kliens az Auth ellenőrzéshez (ez kezeli a sütiket)
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANNON_KEY!,
    {
      cookies: {
        get(name: string) { return cookieStore.get(name)?.value },
      },
    }
  );

  // 2. Admin kliens az adatbázis íráshoz (ez megkerüli az RLS-t)
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY! // Győződj meg róla, hogy ez benne van az .env.local-ban!
  );

  try {
    const { brandName, audience, topic, tone } = await req.json();

    // Felhasználó ellenőrzése
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Előfizetés lekérése
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('price_id, status')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .maybeSingle();

    const plan = (subscription?.price_id as keyof typeof PLAN_LIMITS) || 'free';

    // Limit ellenőrzése
    const currentMonth = new Date().toISOString().slice(0, 7);
    const { count } = await supabase
      .from('matrix_generations')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('month_year', currentMonth);

    const limit = PLAN_LIMITS[plan]?.matrixGenerations ?? 0;
    if (count !== null && count >= limit) {
      return NextResponse.json({ error: 'Havi limit elérve!' }, { status: 403 });
    }

    // AI Generálás
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { 
            role: "system", 
            content: `Profi social media manager vagy. Hangnem: "${tone || 'Professzionális'}". JSON formátumban válaszolj.` 
        },
        { 
            role: "user", 
            content: `Készíts 5 napos tartalomtervet a ${brandName} számára. Célközönség: ${audience}. Téma: ${topic}. JSON: { "days": [{ "day": "...", "title": "...", "platform": "...", "outline": "...", "content": "..." }] }` 
        }
      ],
      response_format: { type: "json_object" }
    });

    const generatedContent = JSON.parse(completion.choices[0].message.content!);

    // --- MENTÉS AZ ADMIN KLIENSSEL (Ez a javítás!) ---
    const { error: insertError } = await supabaseAdmin.from('matrix_generations').insert({
      user_id: user.id,
      brand_name: brandName,
      month_year: currentMonth,
      generation_data: generatedContent
    });

    if (insertError) {
        console.error("Adatbázis mentési hiba:", insertError);
        // Nem állítjuk meg a folyamatot, de logoljuk a hibát
    }

    return NextResponse.json(generatedContent);

  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ error: 'Szerver hiba' }, { status: 500 });
  }
}