import { NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: Request) {
  try {
    const { text, action, lang } = await req.json();

    const prompts: { [key: string]: string } = {
      shorten: "Rövidítsd le ezt a szöveget lényegretörően, tartsd meg a stílust.",
      expand: "Fejtsd ki bővebben ezt a gondolatot, adj hozzá több részletet.",
      emoji: "Adj a szöveghez odaillő emojikat a megfelelő helyekre.",
      professional: "Alakítsd át ezt a szöveget professzionális, üzleti stílusúra.",
      funny: "Tedd ezt a szöveget humorossá és barátságossá."
    };

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: `Te egy profi szerkesztő vagy. A válaszod nyelve szigorúan legyen: ${lang === 'hu' ? 'Magyar' : 'English'}. Csak a módosított szöveget küldd vissza, semmi mást.` },
        { role: "user", content: `${prompts[action] || action}\n\nSzöveg: ${text}` }
      ],
    });

    return NextResponse.json({ updatedText: response.choices[0].message.content });
  } catch (error) {
    return NextResponse.json({ error: "Szerkesztési hiba" }, { status: 500 });
  }
}