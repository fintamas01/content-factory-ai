import { NextResponse } from "next/server";
import OpenAI from "openai";
import { incrementUsage } from "@/lib/usage/usage-service";
import { requireSessionClientAndUsageAllowance } from "@/lib/usage/require-session-usage";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: Request) {
  try {
    const gate = await requireSessionClientAndUsageAllowance("content");
    if (!gate.ok) return gate.response;

    const { supabase, clientId } = gate;

    const { brand, audience, topic, tone, day, platform, currentPost } =
      await req.json();

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `Profi social media manager vagy. Hangnem: "${tone}".
            
            FELADAT: Írd újra a megadott social media posztot.
            A felhasználónak nem tetszett az előző verzió, ezért csinálj egy KREATÍVABB, JOBB változatot ugyanarra a témára/napra.
            
            Generálj hozzá "slides" tömböt is (carousel szövegek), edukatív stílusban.
            
            JSON Válasz formátum:
            {
              "title": "Új, ütős cím",
              "outline": "Új stratégiai megközelítés...",
              "content": "A kész poszt szövege...",
              "slides": ["Dia 1 szöveg", "Dia 2 szöveg", "Dia 3 szöveg", "Dia 4 szöveg"]
            }`,
        },
        {
          role: "user",
          content: `
            Márka: ${brand}
            Célközönség: ${audience}
            Téma: ${topic}
            Nap: ${day}
            Platform: ${platform}
            
            Ezt írtad előzőleg (EZT NE ISMÉTELD MEG, LEGYEN MÁS): 
            "${currentPost.title}"
            `,
        },
      ],
      response_format: { type: "json_object" },
    });

    const newPostData = JSON.parse(completion.choices[0].message.content!);

    await incrementUsage(supabase, "content", clientId);

    return NextResponse.json({
      ...currentPost,
      day: day,
      platform: platform,
      title: newPostData.title,
      outline: newPostData.outline,
      content: newPostData.content,
      slides: newPostData.slides,
    });
  } catch (error: unknown) {
    console.error("Remix Error:", error);
    return NextResponse.json({ error: "Szerver hiba" }, { status: 500 });
  }
}
