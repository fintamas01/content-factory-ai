import { NextResponse } from 'next/server';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { imageUrl, caption } = body;

        // Ellenőrizzük, hogy megkaptuk-e az adatokat a gombnyomásból
        if (!imageUrl || !caption) {
            return NextResponse.json(
                { error: "Hiányzik a kép URL vagy a poszt szövege." }, 
                { status: 400 }
            );
        }

        // Környezeti változók beolvasása (.env.local)
        const IG_BUSINESS_ID = process.env.INSTAGRAM_BUSINESS_ID;
        const ACCESS_TOKEN = process.env.INSTAGRAM_ACCESS_TOKEN;

        if (!IG_BUSINESS_ID || !ACCESS_TOKEN) {
            return NextResponse.json(
                { error: "Szerver hiba: Hiányoznak az Instagram API kulcsok a .env.local fájlból." }, 
                { status: 500 }
            );
        }

        // --- 1. LÉPÉS: KONTÉNER LÉTREHOZÁSA ---
        const containerUrl = `https://graph.facebook.com/v19.0/${IG_BUSINESS_ID}/media?image_url=${encodeURIComponent(imageUrl)}&caption=${encodeURIComponent(caption)}&access_token=${ACCESS_TOKEN}`;
        
        const containerResponse = await fetch(containerUrl, { method: 'POST' });
        const containerData = await containerResponse.json();

        if (containerData.error) {
            throw new Error(`Konténer hiba: ${containerData.error.message}`);
        }

        const creationId = containerData.id;

        // --- 2. LÉPÉS: POSZT ÉLESÍTÉSE ---
        const publishUrl = `https://graph.facebook.com/v19.0/${IG_BUSINESS_ID}/media_publish?creation_id=${creationId}&access_token=${ACCESS_TOKEN}`;
        
        const publishResponse = await fetch(publishUrl, { method: 'POST' });
        const publishData = await publishResponse.json();

        if (publishData.error) {
            throw new Error(`Publikálási hiba: ${publishData.error.message}`);
        }

        // Ha idáig eljutott, a poszt sikeresen kikerült!
        return NextResponse.json({ success: true, postId: publishData.id });

    } catch (error: any) {
        console.error("Instagram API Hiba:", error);
        return NextResponse.json(
            { error: error.message || "Ismeretlen hiba történt a posztolás során." }, 
            { status: 500 }
        );
    }
}