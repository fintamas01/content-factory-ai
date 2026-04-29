import { NextResponse } from "next/server";
import { requireAuthenticatedClient } from "@/lib/usage/require-session-usage";
import {
  mapCampaignJobToRegistryValues,
  resolveCampaignRegistryTemplateId,
} from "@/lib/campaign-jobs/campaign-creatomate";
import {
  fallbackCampaignAdCopy,
  generateCampaignAdCopy,
  resolveCampaignLanguageLabel,
  resolveCampaignTone,
} from "@/lib/campaign-jobs/generate-ad-copy";
import { renderCreatomateImage } from "@/lib/creatomate/render";
import {
  buildCreatomateModifications,
  resolveCreatomateTemplateId,
  validateTemplateValues,
} from "@/lib/creatomate/social-post-templates";

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

    const registryTemplateRequested =
      typeof body?.template_id === "string"
        ? body.template_id
        : typeof body?.templateId === "string"
          ? body.templateId
          : null;

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

    const { template, registryId } = resolveCampaignRegistryTemplateId(registryTemplateRequested);

    const valuesRaw = mapCampaignJobToRegistryValues(template, {
      headline: copy.headline,
      caption: copy.caption,
      cta: copy.cta,
      product_name,
      product_image,
      product_price,
    });

    const validated = validateTemplateValues(template, valuesRaw);
    if (!validated.ok) {
      const { data: failRow, error: failIns } = await supabase
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
          template_id: registryId,
          status: "failed",
          error_message: validated.error,
        })
        .select("id")
        .single();

      if (failIns || !failRow?.id) {
        console.error("POST /api/campaign-jobs/create validation insert:", failIns);
        return NextResponse.json({ error: "Could not create campaign job." }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        job_id: failRow.id,
        status: "failed" as const,
        render_url: null as string | null,
        error_message: validated.error,
      });
    }

    const creatomateTemplateId = resolveCreatomateTemplateId(template);
    if (!creatomateTemplateId) {
      const msg =
        "Creatomate template id is not configured. Set CREATOMATE_TEMPLATE_ID for env-backed templates, or use a registry template with a real Creatomate id.";
      const { data: failRow, error: failIns } = await supabase
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
          template_id: registryId,
          status: "failed",
          error_message: msg,
        })
        .select("id")
        .single();

      if (failIns || !failRow?.id) {
        return NextResponse.json({ error: "Could not create campaign job." }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        job_id: failRow.id,
        status: "failed" as const,
        render_url: null as string | null,
        error_message: msg,
      });
    }

    const modifications = buildCreatomateModifications(template, validated.values);

    const { data: row, error: insErr } = await supabase
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
        template_id: registryId,
        status: "rendering",
      })
      .select("id")
      .single();

    if (insErr || !row?.id) {
      console.error("POST /api/campaign-jobs/create:", insErr);
      return NextResponse.json({ error: "Could not create campaign job." }, { status: 500 });
    }

    const jobId = row.id as string;

    try {
      const rendered = await renderCreatomateImage({
        templateId: creatomateTemplateId,
        modifications,
        metadata: {
          source: "campaign-jobs/create",
          registryTemplateId: registryId,
          jobId,
        },
      });

      const { error: upErr } = await supabase
        .from("campaign_jobs")
        .update({
          status: "completed",
          render_url: rendered.url,
          error_message: null,
        })
        .eq("id", jobId)
        .eq("user_id", user.id)
        .eq("client_id", clientId);

      if (upErr) {
        console.error("campaign_jobs completed update:", upErr);
      }

      return NextResponse.json({
        success: true,
        job_id: jobId,
        status: "completed" as const,
        render_url: rendered.url,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);

      await supabase
        .from("campaign_jobs")
        .update({
          status: "failed",
          error_message: msg,
        })
        .eq("id", jobId)
        .eq("user_id", user.id)
        .eq("client_id", clientId);

      return NextResponse.json({
        success: true,
        job_id: jobId,
        status: "failed" as const,
        render_url: null as string | null,
        error_message: msg,
      });
    }
  } catch (e) {
    console.error("POST /api/campaign-jobs/create:", e);
    return NextResponse.json({ error: "Unexpected server error." }, { status: 500 });
  }
}
