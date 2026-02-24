import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { imageUrl, caption, scheduledTime } = await req.json();

    if (!imageUrl || !caption || !scheduledTime) {
      return NextResponse.json({ error: "Hiányzó adatok az ütemezéshez." }, { status: 400 });
    }

    // Ez a te meglévő, tökéletesen működő posztoló API-d linkje!
    // Ezt fogja az Upstash meghívni a jövőben.
    const targetUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/api/instagram/post`;

    // Elküldjük a feladatot az Upstash QStash-nek
    const response = await fetch(`https://qstash.upstash.io/v2/publish/${targetUrl}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.QSTASH_TOKEN}`,
        'Content-Type': 'application/json',
        // Itt mondjuk meg neki, hogy mikor süsse el (Unix Timestamp másodpercben)
        'Upstash-Not-Before': scheduledTime.toString() 
      },
      body: JSON.stringify({ 
        imageUrl: imageUrl, 
        caption: caption 
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Upstash hiba: ${errorText}`);
    }

    return NextResponse.json({ success: true, message: "Sikeresen ütemezve!" });

  } catch (error: any) {
    console.error("Ütemezési hiba:", error);
    return NextResponse.json(
      { error: error.message || "Ismeretlen hiba történt az ütemezés során." }, 
      { status: 500 }
    );
  }
}