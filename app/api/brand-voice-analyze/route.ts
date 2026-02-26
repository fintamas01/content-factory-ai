import { NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: Request) {
  try {
    const { text, brandName, platform } = await req.json();

    if (!text || typeof text !== "string" || text.trim().length < 20) {
      return NextResponse.json(
        { error: "A szöveg kötelező, és legalább 20 karakter hosszú legyen." },
        { status: 400 }
      );
    }

    let context = "";
    if (brandName || platform) {
      context = `A márkanév: ${brandName ? brandName : 'N/A'}, Platform: ${platform ? platform : 'N/A'}.\n`;
    }

    const prompt = `
Te egy profi marketing nyelvész vagy. Elemezd a következő szöveget a márkahang (brand voice) szempontjából!

${context}
Szöveg:
"${text}"

Feladatok:
- Foglald össze a szöveg HANGVÉTELÉT ("tone").
- Írj 2-3 kulcsfontosságú ERŐSSÉGET a márkahanggal kapcsolatban ("strengths").
- Emelj ki 2-3 LEHETSÉGES RIZIKÓT/kockázatot a márkahangban ("risks").
- Adj 2-3 KONKRÉT JAVASLATOT a szöveg márkahangjának tökéletesítésére ("suggestions").
- Írd át a szöveget (pár mondatban) úgy, hogy a márkahang még erősebb, egységesebb legyen a fenti javaslatok alapján ("improvedText").

A választ kizárólag ilyen szerkezetű, tömör JSON-ben add vissza:
{
  "tone": "...",
  "strengths": ["...", "..."],
  "risks": ["...", "..."],
  "suggestions": ["...", "..."],
  "improvedText": "..."
}
Magyarul válaszolj!
`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4-turbo",
      messages: [{ role: "user", content: prompt.trim() }],
      response_format: { type: "json_object" }
    });

    const result = completion.choices[0].message.content;

    return NextResponse.json(JSON.parse(result!));
  } catch (err: any) {
    console.error("Brand Voice Analyze Error:", err);
    return NextResponse.json(
      { error: "Hiba történt az elemzés során." },
      { status: 500 }
    );
  }
}
