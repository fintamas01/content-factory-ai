import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import OpenAI from 'openai';

// CSAK ITT, KÍVÜL DEKLARÁLJUK!
const ADMIN_EMAIL = "fintatamas68@gmail.com"; 

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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

    // Admin ellenőrzés
    if (!user || user.email !== ADMIN_EMAIL) { // 
      return NextResponse.json(
        { error: "Zárt tesztfázis: Csak az adminisztrátor használhatja a rendszert." }, 
        { status: 403 }
      );
    }

    const { content, tone, lang, templatePrompt, platforms } = await req.json();

    if (!platforms || platforms.length === 0) {
       return NextResponse.json({ error: "Válassz legalább egy platformot!" }, { status: 400 });
    }

    const langMap: { [key: string]: string } = {
        en: 'English', hu: 'Hungarian', de: 'German',
        fr: 'French', es: 'Spanish', it: 'Italian'
    };

    const targetLang = langMap[lang] || 'English';

    const prompt = `Te egy profi marketinges vagy. Készíts ${tone} stílusú tartalmat szigorúan ${targetLang} nyelven.
    Platformok: ${platforms.join(', ')}.
    Forrás: ${content}
    Válaszformátum: JSON objektum a megadott platformokkal kulcsként.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
    });

    const result = JSON.parse(response.choices[0].message.content || "{}");

    await supabase.from('generations').insert([
      { original_content: content, tone, results: result, user_id: user.id }
    ]);

    return NextResponse.json(result);

  } catch (error) {
    console.error("Hiba:", error);
    return NextResponse.json({ error: "Generálási hiba" }, { status: 500 });
  }
}