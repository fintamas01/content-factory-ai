import { NextResponse } from "next/server";
import { requireAuthenticatedClient } from "@/lib/usage/require-session-usage";
import {
  fallbackCampaignAdCopy,
  generateCampaignAdCopy,
  resolveCampaignLanguageLabel,
  resolveCampaignTone,
} from "@/lib/campaign-jobs/generate-ad-copy";

export async function POST(req: Request) {
  try {
    const gate = await requireAuthenticatedClient();
    if (!gate.ok) return gate.response;
    const { supabase, user, clientId } = gate;

    const body = await req.json().catch(() => ({}));
    const product_name =
      typeof body?.product_name === "string" ? body.product_name.trim() : null;
    const product_image =
      typeof body?.product_image === "string" ? body.product_image.trim() : null;
    const product_price =
      typeof body?.product_price === "string" ? body.product_price.trim() : null;

    const languageLabel = resolveCampaignLanguageLabel(body?.language);
    const tone = resolveCampaignTone(body?.tone);

    const generated = await generateCampaignAdCopy({
      product_name,
      product_image,
      product_price,
      languageLabel,
      tone,
    });

    const copy = generated ?? fallbackCampaignAdCopy(product_name);

    const { data, error } = await supabase
      .from("campaign_jobs")
      .insert({
        user_id: user.id,
        client_id: clientId,
        product_name,
        product_image,
        product_price,
        headline: copy.headline,
        caption: copy.caption,
        cta: copy.cta,
        status: "pending",
      })
      .select("id")
      .single();

    if (error || !data?.id) {
      console.error("POST /api/campaign-jobs/create:", error);
      return NextResponse.json(
        { error: "Could not create campaign job." },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, job_id: data.id });
  } catch (e) {
    console.error("POST /api/campaign-jobs/create:", e);
    return NextResponse.json(
      { error: "Unexpected server error." },
      { status: 500 }
    );
  }
}
