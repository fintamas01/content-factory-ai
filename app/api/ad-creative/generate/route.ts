import OpenAI from "openai";
import { NextResponse } from "next/server";
import { requireSessionClientAndUsageAllowance } from "@/lib/usage/require-session-usage";
import { incrementUsage } from "@/lib/usage/usage-service";
import { requireFeatureAccess } from "@/lib/entitlements/api";
import { fetchUserBrandProfile } from "@/lib/brand-profile/server";
import { mergeBrandProfileForContent } from "@/lib/brand-profile/merge";
import { buildProductBrandIdentityAddendumEn } from "@/lib/brand-profile/prompts";
import { getBrandMemory } from "@/lib/agent/brand-memory";
import {
  buildAdCreativeV1Prompts,
  normalizeAdCreativeV1Output,
  type AdCreativeV1Input,
  type AspectRatio,
} from "@/lib/ad-creative/v1";
import { generateDraftImage } from "@/lib/ad-creative/image-provider";
import type { AdCreativeAssets, AdCreativeAsset, AdCreativeAspectRatio } from "@/lib/ad-creative/types";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function asString(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function asOptionalString(v: unknown): string | undefined {
  const s = asString(v).trim();
  return s ? s : undefined;
}

function parseAspectRatios(v: unknown): AspectRatio[] {
  const allowed: AspectRatio[] = ["1:1", "4:5", "9:16"];
  const arr = Array.isArray(v) ? v : [];
  const out: AspectRatio[] = [];
  for (const x of arr) {
    const s = typeof x === "string" ? x.trim() : "";
    if (allowed.includes(s as AspectRatio) && !out.includes(s as AspectRatio)) {
      out.push(s as AspectRatio);
    }
  }
  return out.length ? out : ["1:1", "4:5", "9:16"];
}

export async function POST(req: Request) {
  let generationId: string | null = null;
  let supabaseRef: Awaited<
    ReturnType<typeof requireSessionClientAndUsageAllowance>
  > extends { ok: true; supabase: infer S }
    ? S
    : null = null;
  let userIdRef: string | null = null;
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OpenAI is not configured." },
        { status: 500 }
      );
    }

    const gate = await requireSessionClientAndUsageAllowance("content");
    if (!gate.ok) return gate.response;
    const { supabase, user, clientId } = gate;
    supabaseRef = supabase;
    userIdRef = user.id;

    const denied = await requireFeatureAccess({
      supabase,
      userId: user.id,
      featureKey: "adCreativeStudio",
    });
    if (denied) return denied;

    const body = await req.json().catch(() => ({}));
    const productName = asString(body?.productName).trim();
    const brandName = asString(body?.brandName).trim();
    const targetAudience = asString(body?.targetAudience).trim();
    const offerSummary = asString(body?.offerSummary).trim();

    if (!productName) {
      return NextResponse.json(
        { error: "productName is required." },
        { status: 400 }
      );
    }
    if (!brandName) {
      return NextResponse.json(
        { error: "brandName is required." },
        { status: 400 }
      );
    }
    if (!targetAudience) {
      return NextResponse.json(
        { error: "targetAudience is required." },
        { status: 400 }
      );
    }
    if (!offerSummary) {
      return NextResponse.json(
        { error: "offerSummary is required." },
        { status: 400 }
      );
    }

    const input: AdCreativeV1Input = {
      productName,
      brandName,
      targetAudience,
      offerSummary,
      landingPageUrl: asOptionalString(body?.landingPageUrl),
      sourceImageUrl: asOptionalString(body?.sourceImageUrl),
      language: asOptionalString(body?.language),
      aspectRatios: parseAspectRatios(body?.aspectRatios),
      styleDirection: asOptionalString(body?.styleDirection),
      callToAction: asOptionalString(body?.callToAction),
    };
    const generateImages = Boolean(body?.generateImages);

    const source_type =
      input.landingPageUrl && input.landingPageUrl.trim()
        ? "url"
        : input.sourceImageUrl && input.sourceImageUrl.trim()
          ? "product_image"
          : "manual_prompt";

    const { data: inserted, error: insertErr } = await supabase
      .from("ad_creative_generations")
      .insert({
        user_id: user.id,
        client_id: clientId,
        title: `${productName} · Ad Creative`,
        source_type,
        source_image_url: input.sourceImageUrl ?? null,
        product_name: input.productName,
        brand_name: input.brandName,
        audience: input.targetAudience,
        offer_summary: input.offerSummary,
        language: input.language ?? "en",
        aspect_ratios: input.aspectRatios,
        status: "running",
        generated_copy: {},
        generated_concepts: {},
        generated_assets: {},
      })
      .select("id")
      .single();

    if (insertErr) {
      console.error("ad_creative_generations insert:", insertErr);
      return NextResponse.json(
        { error: "Could not create generation record." },
        { status: 500 }
      );
    }

    generationId = inserted?.id ?? null;

    const unified = await fetchUserBrandProfile(supabase, user.id, clientId);
    const effectiveBrand = mergeBrandProfileForContent(
      { name: input.brandName, audience: input.targetAudience, desc: "" },
      unified
    );
    const brandIdentityAddendumEn = effectiveBrand.name.trim()
      ? buildProductBrandIdentityAddendumEn(effectiveBrand)
      : undefined;

    let memoryBlock = "";
    try {
      const q = `${input.brandName}\n${input.productName}\n${input.offerSummary}\n${input.targetAudience}`.trim();
      const mem = await getBrandMemory(user.id, q, {
        threshold: 0.72,
        count: 5,
        platform: "adCreative",
      });
      if (Array.isArray(mem) && mem.length) {
        memoryBlock = mem
          .map((m: any) => {
            const w = Number(m?.weight);
            const weight = Number.isFinite(w) ? `w:${w.toFixed(2)}` : "";
            const content = typeof m?.content === "string" ? m.content : "";
            return content ? `- ${weight ? `(${weight}) ` : ""}${content}` : "";
          })
          .filter(Boolean)
          .join("\n");
      }
    } catch (e) {
      console.error("ad-creative brand memory:", e);
    }

    const { system, user: userPrompt } = buildAdCreativeV1Prompts({
      input,
      brandIdentityAddendumEn,
      memoryBlock: memoryBlock || undefined,
    });
    const model = process.env.OPENAI_AD_CREATIVE_MODEL ?? "gpt-4o-mini";

    const resp = await openai.chat.completions.create({
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
    });

    const raw = resp.choices[0]?.message?.content ?? "";
    if (!raw.trim()) {
      throw new Error("Empty model response.");
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error("Invalid JSON from model.");
    }

    const normalized = normalizeAdCreativeV1Output({
      raw: parsed,
      language: input.language,
      aspectRatios: input.aspectRatios,
    });

    const generated_copy = {
      angles: normalized.angles.map((a) => ({
        id: a.id,
        hook: a.hook,
        headlines: a.headlines,
        primaryTexts: a.primaryTexts,
        ctas: a.ctas,
      })),
    };

    const generated_concepts = {
      angles: normalized.angles.map((a) => ({
        id: a.id,
        hook: a.hook,
        visualConcept: a.visualConcept,
        adaptations: a.adaptations,
      })),
    };

    const generated_assets: AdCreativeAssets = {
      provider: generateImages ? "openai-dalle3" : null,
      items: [],
    };

    if (generateImages) {
      const ar = (input.aspectRatios[0] ?? "1:1") as AdCreativeAspectRatio;
      for (const a of normalized.angles) {
        const promptParts = [
          a.visualConcept.subject,
          a.visualConcept.scene,
          a.visualConcept.composition,
          a.visualConcept.lighting,
          a.visualConcept.palette,
          a.visualConcept.typography,
          a.visualConcept.overlays?.length ? `Overlays ideas: ${a.visualConcept.overlays.join("; ")}` : "",
          input.styleDirection ? `Style direction: ${input.styleDirection}` : "",
          input.sourceImageUrl ? `Reference image URL (context only): ${input.sourceImageUrl}` : "",
        ].filter(Boolean);

        const img = await generateDraftImage({
          prompt: promptParts.join("\n"),
          brandName: input.brandName,
          aspectRatio: ar,
          generationId: generationId!,
          angleId: a.id,
        });
        if (img.ok) {
          generated_assets.items.push(img.asset);
        } else {
          const failed: AdCreativeAsset = {
            id: `${generationId}:${a.id}:${Date.now()}`,
            kind: "image",
            angleId: a.id,
            aspectRatio: ar,
            createdAt: new Date().toISOString(),
            provider: img.provider,
            status: "failed",
            error: img.error,
            draft: true,
          };
          generated_assets.items.push(failed);
        }
      }
      generated_assets.provider = "openai-dalle3";
    }

    // Persist storage metadata only (signed URLs expire).
    const persisted_assets: AdCreativeAssets = {
      ...generated_assets,
      items: generated_assets.items.map((it) => {
        if (it.kind === "image" && it.status === "succeeded") {
          return { ...it, url: undefined };
        }
        if (it.kind === "video" && it.status === "succeeded") {
          return { ...it, url: undefined, posterImageUrl: undefined };
        }
        return it;
      }),
    };

    const { error: updateErr } = await supabase
      .from("ad_creative_generations")
      .update({
        status: "succeeded",
        error_message: null,
        generated_copy,
        generated_concepts,
        generated_assets: persisted_assets,
      })
      .eq("id", generationId)
      .eq("user_id", user.id);

    if (updateErr) {
      console.error("ad_creative_generations update:", updateErr);
      // still return generated result to user; history save can be retried later
    }

    await incrementUsage(supabase, "content", clientId);

    return NextResponse.json({
      ok: true,
      generationId,
      result: {
        ...normalized,
        assets: generated_assets,
      },
    });
  } catch (e: any) {
    const msg = String(e?.message ?? e ?? "Server error.");
    if (generationId) {
      try {
        if (supabaseRef && userIdRef) {
          await supabaseRef
            .from("ad_creative_generations")
            .update({ status: "failed", error_message: msg })
            .eq("id", generationId)
            .eq("user_id", userIdRef);
        }
      } catch {
        // ignore
      }
    }
    console.error("ad-creative generate:", e);
    return NextResponse.json(
      { ok: false, error: "Generation failed.", details: msg, generationId },
      { status: 500 }
    );
  }
}

