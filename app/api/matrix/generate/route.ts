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
    const { brandName, audience, topic } = await req.json();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // 1. Előfizetés lekérése a 'subscriptions' táblából
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('price_id, status')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .maybeSingle();

    const plan = (subscription?.price_id as keyof typeof PLAN_LIMITS) || 'free';

    // 2. Limit ellenőrzése (Javított 'count' deklaráció)
    const currentMonth = new Date().toISOString().slice(0, 7);
    const { count, error: countError } = await supabase
      .from('matrix_generations')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('month_year', currentMonth);

    if (countError) throw countError;

    // Biztonságos ellenőrzés: ha free vagy elérte a limitet
    const limit = PLAN_LIMITS[plan]?.matrixGenerations ?? 0;
    if (count !== null && count >= limit) {
      return NextResponse.json({ error: 'Havi limit elérve!' }, { status: 403 });
    }

    // 3. AI Generálás
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: "Profi social media stratégia készítő vagy. JSON formátumban válaszolj, a 'days' kulcs alatt egy tömbbel." },
        { role: "user", content: `Készíts 5 napos tartalomtervet a ${brandName} számára. Célközönség: ${audience}. Téma: ${topic}. JSON formátum: { "days": [{ "day": "Hétfő", "title": "...", "platform": "...", "outline": "..." }] }` }
      ],
      response_format: { type: "json_object" }
    });

    // 4. Mentés
    await supabase.from('matrix_generations').insert({
      user_id: user.id,
      brand_name: brandName,
      month_year: currentMonth
    });

    return NextResponse.json(JSON.parse(completion.choices[0].message.content!));
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ error: 'Szerver hiba' }, { status: 500 });
  }
}