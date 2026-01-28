import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: Request) {
  try {
    // 1. Next.js cookie-k kezelése
    const cookieStore = await cookies();

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANNON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
          set(name: string, value: string, options: CookieOptions) {
            cookieStore.set({ name, value, ...options });
          },
          remove(name: string, options: CookieOptions) {
            cookieStore.set({ name, value: '', ...options });
          },
        },
      }
    );

    // 2. Felhasználó azonosítása
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Bejelentkezés szükséges!" }, { status: 401 });
    }

    // 3. ELŐFIZETÉS ELLENŐRZÉSE
    // Megnézzük, van-e 'active' státuszú előfizetése a felhasználónak
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('status')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single();

    // Hozzáférés kezelése: Admin VAGY Aktív előfizető mehet tovább
    const adminEmail = "fintatamas68@gmail.com";
    const isOwner = user.email === adminEmail;
    const hasActiveSub = !!subscription;

    if (!isOwner && !hasActiveSub) {
      return NextResponse.json(
        { error: "A tartalomgeneráláshoz Pro előfizetés szükséges!" }, 
        { status: 403 }
      );
    }

    // 4. Adatok feldolgozása a kérésből
    const { content, tone, lang, templatePrompt, platforms } = await req.json();

    const langMap: { [key: string]: string } = {
        en: 'English',
        hu: 'Hungarian',
        de: 'German',
        fr: 'French',
        es: 'Spanish',
        it: 'Italian'
    };

    const targetLang = langMap[lang] || 'English';

    const prompt = `Te egy világszínvonalú közösségi média stratéga vagy.
    A feladatod: Készíts egy ${templatePrompt || 'Alakítsd át a következő forrásszöveget'} 5 különböző típusú tartalommá, szigorúan ${tone} stílusban.
    FONTOS: A válaszod minden egyes mezőjét szigorúan ${targetLang} nyelven írd meg! 
    A válaszod szigorúan egy JSON objektum legyen, kizárólag a következő platformokra készíts tartalmat: ${platforms.join(', ')}.
    Forrásszöveg: ${content}`;

    // 5. OpenAI hívás
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "Te egy segítőkész marketing automatizációs szoftver vagy." }, 
        { role: "user", content: prompt }
      ],
      response_format: { type: "json_object" },
    });

    const result = JSON.parse(response.choices[0].message.content || "{}");

    // 6. Mentés az adatbázisba
    const { error: dbError } = await supabase.from('generations').insert([
      { 
        original_content: content, 
        tone: tone, 
        results: result,
        user_id: user.id 
      }
    ]);

    if (dbError) console.error("Supabase Error:", dbError);

    return NextResponse.json(result);

  } catch (error) {
    console.error("Critical Error:", error);
    return NextResponse.json({ error: "Hiba történt a generálás során" }, { status: 500 });
  }
}