import { NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: Request) {
  try {
    const { content, platform, brandName } = await req.json();

    if (!content) {
      return NextResponse.json({ error: "Hiányzó tartalom az elemzéshez." }, { status: 400 });
    }

    console.log("🕵️‍♂️ AI Agent: Téma kinyerése a posztból...");

    // 1. LÉPÉS: Miről szól a poszt? (Egy gyors keresőszó generálása)
    const searchPrompt = `Készíts egy nagyon rövid, 3-4 szavas ANGOL nyelvű keresőkifejezést (search query), ami a leginkább lefedi ennek a posztnak a témáját, hogy rákereshessek az aktuális trendekre: "${content.substring(0, 150)}..." Csak a kifejezést add vissza!`;
    const searchCompletion = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: searchPrompt }]
    });
    const searchQuery = searchCompletion.choices[0].message.content?.trim().replace(/['"]/g, '') || "current marketing trends";

    console.log(`🌍 AI Agent: Keresés a weben a Tavily segítségével: "${searchQuery}"...`);

    // 2. LÉPÉS: Élő webes keresés a Tavily-vel
    // Ehhez nem is kell plusz csomagot telepítened, simán meghívjuk az API-jukat!
    const tavilyRes = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            api_key: process.env.TAVILY_API_KEY,
            query: `${searchQuery} current trends 2026`,
            search_depth: "basic",
            include_answer: true,
            max_results: 3
        })
    });
    
    if (!tavilyRes.ok) throw new Error("A Tavily API nem válaszolt.");
    
    const tavilyData = await tavilyRes.json();
    const webContext = tavilyData.answer || JSON.stringify(tavilyData.results);

    console.log("🧠 AI Agent: Elemzés az élő adatok alapján...");

    // 3. LÉPÉS: A kegyetlen elemzés GPT-4-gyel, JSON formátumban
    const analysisPrompt = `
    Te egy profi, adatalapú, kíméletlen Viral Social Media Elemző Agent vagy.
    A feladatod, hogy kielemezz egy poszttervezetet, amit a(z) '${brandName}' márka készített a(z) ${platform} platformra.
    
    AKTUÁLIS ÉLŐ WEBES KONTEXTUS (A Tavily friss keresési eredménye a témában):
    ${webContext}
    
    A FELHASZNÁLÓ POSZTTERVEZETE:
    "${content}"
    
    Értékeld a posztot az élő piaci adatok, a figyelemfelkeltés (hook) és a platform sajátosságai alapján. 
    Légy nagyon őszinte! Ne csak dicsérj. Adj egy pontszámot 1-100 között (ahol 100 a tökéletes, virális poszt).
    
    A VÁLASZOD KIZÁRÓLAG EGY NYERS JSON FORMATUM LEGYEN, PONTOSAN EZEKKEL A KULCSOKKAL (Magyar nyelven):
    {
      "score": szám, // 1-100 közötti érték
      "critique": "szöveg", // Egy rövid, 2-3 mondatos lényegretörő, szakmai kritika.
      "suggestions": ["szöveg", "szöveg", "szöveg"] // Pontosan 3 db konkrét, azonnal alkalmazható javaslat a javításra.
    }`;

    const analysisCompletion = await openai.chat.completions.create({
      model: "gpt-4-turbo", // Itt a nagyágyút használjuk a precíz formátum miatt
      response_format: { type: "json_object" },
      messages: [{ role: "user", content: analysisPrompt }],
    });

    const resultJson = analysisCompletion.choices[0].message.content;
    
    console.log("✅ AI Agent: Elemzés kész!");
    
    // Visszaküldjük a tökéletesen formázott JSON-t a felületednek
    return NextResponse.json(JSON.parse(resultJson!));

  } catch (error: any) {
    console.error("Agent Hiba:", error);
    return NextResponse.json({ error: "Hiba az AI Agent futtatása közben." }, { status: 500 });
  }
}