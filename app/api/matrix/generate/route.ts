import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import OpenAI from 'openai';
import { PLAN_LIMITS } from '@/app/lib/plan-limits';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: Request) {
  // 1. A sütik lekérése aszinkron módon (Javítás a 'get' hibára)
  const cookieStore = await cookies();
  
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANNON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
      },
    }
  );

  try {
    const { brandName, audience, topic } = await req.json();

    // 2. Felhasználó lekérése
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Nincs bejelentkezve' }, { status: 401 });

    // 3. Előfizetés lekérése típusbiztosan (Javítás a PLAN_LIMITS[plan] hibára)
    const { data: subscription } = await supabase
    .from('subscriptions') // Itt is átírva profiles-ról
    .select('plan')
    .eq('user_id', user.id)
    .single();

    const plan = (subscription?.plan as keyof typeof PLAN_LIMITS) || 'free';

    // 4. Limit ellenőrzése
    const currentMonth = new Date().toISOString().slice(0, 7);
    const { count } = await supabase
      .from('matrix_generations')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('month_year', currentMonth);

    if (count !== null && count >= PLAN_LIMITS[plan].matrixGenerations) {
      return NextResponse.json({ error: 'Havi limit elérve!' }, { status: 403 });
    }

    // 5. OpenAI hívás
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: "Profi social media stratégia készítő vagy. JSON formátumban válaszolj, a 'days' kulcs alatt egy tömbbel." },
        { role: "user", content: `Készíts 5 napos tartalomtervet a ${brandName} számára. Célközönség: ${audience}. Téma: ${topic}. JSON formátum: { "days": [{ "day": "Hétfő", "title": "...", "platform": "...", "outline": "..." }] }` }
      ],
      response_format: { type: "json_object" }
    });

    // 6. Generálás rögzítése
    await supabase.from('matrix_generations').insert({
      user_id: user.id,
      brand_name: brandName,
      month_year: currentMonth
    });

    return NextResponse.json(JSON.parse(completion.choices[0].message.content!));
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ error: 'Hiba történt a generálás során' }, { status: 500 });
  }
}