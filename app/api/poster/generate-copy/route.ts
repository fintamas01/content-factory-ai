import OpenAI from "openai";
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnon =
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
      process.env.NEXT_PUBLIC_SUPABASE_ANNON_KEY;

    if (!supabaseUrl || !supabaseAnon) {
      return NextResponse.json(
        { error: "Supabase env hiányzik (URL/ANON KEY)." },
        { status: 500 }
      );
    }

    const supabase = createServerClient(supabaseUrl, supabaseAnon, {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {}
        },
      },
    });

    const { data: authData } = await supabase.auth.getUser();
    const user = authData?.user;
    if (!user) {
      return NextResponse.json({ error: "Nincs bejelentkezve." }, { status: 401 });
    }

    const body = await req.json();
    const {
      description,
      url,
      platform = "instagram_post",
      lang = "hu",
      brandProfile,
      tone = "szakmai",
    } = body ?? {};

    if (!description || typeof description !== "string") {
      return NextResponse.json({ error: "Hiányzik a leírás." }, { status: 400 });
    }
    if (!brandProfile?.name) {
      return NextResponse.json({ error: "Hiányzik a márkaprofil." }, { status: 400 });
    }

    const langMap: Record<string, string> = {
      hu: "Hungarian",
      en: "English",
      de: "German",
      ro: "Romanian",
      fr: "French",
      es: "Spanish",
      it: "Italian",
    };

    const targetLang = langMap[lang] || "Hungarian";

    const system = `Te egy brutál jó reklámszövegíró és marketing kreatív vagy.
Feladatod: plakátra való rövid szövegeket adni.

KÖTELEZŐ: csak érvényes JSON-t adj vissza így:
{
  "headline": "...",
  "sub": "...",
  "cta": "..."
}

Szabályok:
- Headline: max 6-8 szó (ütős)
- Sub: 1-2 mondat, max ~140 karakter
- CTA: max 5-7 szó
- Nyelv: ${targetLang}
- Tone: ${tone}
- Platform: ${platform}

Márka:
- Név: ${brandProfile.name}
- Leírás: ${brandProfile.desc ?? ""}
- Célközönség: ${brandProfile.audience ?? ""}

Ha van URL, használd kontextusnak, de NE írj hosszú linket a szövegbe.`;

    const userMsg = `Leírás:
${description}

URL (opcionális):
${url ?? ""}`;

    const resp = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: system },
        { role: "user", content: userMsg },
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
    });

    const raw = resp.choices[0]?.message?.content ?? "{}";

    let parsed: any;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return NextResponse.json(
        { error: "A modell nem adott vissza érvényes JSON-t." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      headline: String(parsed.headline ?? ""),
      sub: String(parsed.sub ?? ""),
      cta: String(parsed.cta ?? ""),
    });
  } catch (e) {
    console.error("generate-copy hiba:", e);
    return NextResponse.json({ error: "Szerver hiba." }, { status: 500 });
  }
}