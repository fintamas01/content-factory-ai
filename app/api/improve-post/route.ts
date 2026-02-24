import { NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: Request) {
  try {
    const { content, critique, suggestions } = await req.json();

    if (!content || !critique) {
      return NextResponse.json({ error: "Hiányzó adatok az újraíráshoz." }, { status: 400 });
    }

    const prompt = `
    Te egy profi Senior Social Media Copywriter vagy.
    Az alábbi posztot egy AI Viral Agent elemezte az élő webtrendek alapján, és ezt a kritikát fogalmazta meg:
    "${critique}"

    A kötelezően beépítendő javaslatok:
    ${suggestions.map((s: string) => `- ${s}`).join('\n')}

    EREDETI POSZT:
    "${content}"

    FELADAT:
    Írd át a posztot úgy, hogy TÖKÉLETESEN beépíted a javaslatokat és kijavítod a kritizált hibákat. 
    A poszt legyen sokkal virálisabb, figyelemfelkeltőbb, és illeszkedjen az aktuális trendekhez.
    CSAK AZ ÚJ POSZT SZÖVEGÉT ADD VISSZA formázva, semmi más magyarázatot ne fűzz hozzá!
    `;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o", // A leggyorsabb és legokosabb modell az újraíráshoz
      messages: [{ role: "user", content: prompt }],
    });

    const updatedText = completion.choices[0].message.content?.trim();

    return NextResponse.json({ updatedText });

  } catch (error: any) {
    console.error("Improvement Hiba:", error);
    return NextResponse.json({ error: "Hiba az AI újraírás közben." }, { status: 500 });
  }
}