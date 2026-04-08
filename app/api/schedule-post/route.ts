import { NextResponse } from "next/server";
import { getPublicSiteUrl, publicAbsoluteUrl } from "@/lib/env/public-site-url";
import { requireAuthenticatedClient } from "@/lib/usage/require-session-usage";
import { requireFeatureAccess } from "@/lib/entitlements/api";

export async function POST(req: Request) {
  try {
    const { imageUrl, caption, scheduledTime, platform } = await req.json();

    if (!caption || !scheduledTime || !platform) {
      return NextResponse.json({ error: "Missing scheduling fields." }, { status: 400 });
    }

    if (!getPublicSiteUrl()) {
      return NextResponse.json(
        { error: "NEXT_PUBLIC_SITE_URL (or NEXT_PUBLIC_APP_URL) is not configured." },
        { status: 500 }
      );
    }

    const targetUrl = publicAbsoluteUrl("/api/social/publish");

    const gate = await requireAuthenticatedClient();
    if (!gate.ok) return gate.response;

    const denied = await requireFeatureAccess({
      supabase: gate.supabase,
      userId: gate.user.id,
      featureKey: "socialPublish",
    });
    if (denied) return denied;

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
        platform,
        imageUrl: imageUrl || null,
        text: caption,
        scheduledTime,
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Upstash hiba: ${errorText}`);
    }

    return NextResponse.json({ success: true, message: "Scheduled." });

  } catch (error: any) {
    console.error("schedule-post:", error);
    return NextResponse.json(
      { error: error.message || "Scheduling failed." }, 
      { status: 500 }
    );
  }
}