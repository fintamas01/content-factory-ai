import fs from "node:fs";
import path from "node:path";

import type { ImageStylePresetKey } from "../lib/ad-creative/image-style-presets.ts";

function loadEnvLocal() {
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return;
  const raw = fs.readFileSync(envPath, "utf8");
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    const val = trimmed.slice(idx + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function scoreOf(qc: any) {
  if (!qc) return -Infinity;
  return qc.realism_score - qc.artifact_score * 0.9 + qc.brand_consistency_score * 0.3;
}

async function headOk(url: string) {
  try {
    const r = await fetch(url, { method: "HEAD" });
    return {
      ok: r.ok,
      status: r.status,
      type: r.headers.get("content-type") || "",
      len: r.headers.get("content-length") || "",
    };
  } catch {
    return { ok: false, status: 0, type: "", len: "" };
  }
}

async function uploadVideoToStorage(params: {
  clientId: string;
  userId: string;
  jobId: string;
  videoUrl: string;
}) {
  const { supabaseAdmin } = await import("../lib/supabase/admin.ts");
  const r = await fetch(params.videoUrl);
  if (!r.ok) throw new Error(`Video download failed (${r.status})`);
  const bytes = await r.arrayBuffer();
  const bucket = "brand-assets";
  const storagePath = `ad-creative-videos/${params.clientId}/${params.userId}/e2e/${encodeURIComponent(
    params.jobId
  )}.mp4`;
  const { error: uploadErr } = await supabaseAdmin.storage
    .from(bucket)
    .upload(storagePath, bytes, { contentType: "video/mp4", upsert: true });
  if (uploadErr) throw new Error("Storage upload failed");
  const { data: signed, error: signErr } = await supabaseAdmin.storage
    .from(bucket)
    .createSignedUrl(storagePath, 60 * 60);
  if (signErr || !signed?.signedUrl) throw new Error("Signed URL failed");
  return {
    bucket,
    path: storagePath,
    signedUrl: signed.signedUrl,
    bytes: bytes.byteLength,
  };
}

async function main() {
  loadEnvLocal();

  const { generateDraftImage } = await import("../lib/ad-creative/image-provider.ts");
  const { startAdCreativeVideoFromImage, pollAdCreativeVideoJob } = await import(
    "../lib/ad-creative/video-provider.ts"
  );
  const { supabaseAdmin } = await import("../lib/supabase/admin.ts");

  const brandName = "Nimbus";
  const generationId = `e2e-${Date.now()}`;

  // Stable reference product image for identity preservation.
  // We proxy it into our own storage so downstream providers can reliably access it.
  const sourceRef =
    "https://upload.wikimedia.org/wikipedia/commons/7/75/Coca-Cola_can_top.jpg";
  const refResp = await fetch(sourceRef);
  if (!refResp.ok) throw new Error(`Could not download reference image (${refResp.status})`);
  const refBytes = await refResp.arrayBuffer();
  const refBucket = "brand-assets";
  const refPath = `ad-creative-refs-proxy/e2e/${Date.now()}-ref.jpg`;
  const { error: refUploadErr } = await supabaseAdmin.storage
    .from(refBucket)
    .upload(refPath, refBytes, { contentType: "image/jpeg", upsert: true });
  if (refUploadErr) throw new Error("Could not upload reference image to storage.");
  const { data: refSigned, error: refSignErr } = await supabaseAdmin.storage
    .from(refBucket)
    .createSignedUrl(refPath, 60 * 60);
  if (refSignErr || !refSigned?.signedUrl) throw new Error("Could not create signed URL for reference image.");
  const referenceImageUrl = refSigned.signedUrl;

  const concepts: Array<{
    angleId: string;
    intent: string;
    preset: ImageStylePresetKey;
  }> = [
    {
      angleId: "angle_1",
      intent:
        "Lifestyle ad photo: product held naturally in hand outdoors at golden hour, city street background bokeh, candid framing, negative space for overlay.",
      preset: "iphone_ugc",
    },
    {
      angleId: "angle_2",
      intent:
        "Lifestyle ad photo: product placed on cafe table with coffee and newspaper, shallow depth of field, authentic morning vibe, natural window light, subtle imperfections.",
      preset: "natural_lifestyle",
    },
    {
      angleId: "angle_3",
      intent:
        "Lifestyle ad photo: product in a premium setting with tasteful props, editorial feel, controlled highlights, refined negative space, realistic reflections only.",
      preset: "luxury_brand",
    },
  ];

  console.log("\n== Generating 3 lifestyle images (reference-first) ==");
  const results: Array<any> = [];
  for (const c of concepts) {
    const r = await generateDraftImage({
      brandName,
      conceptIntent: c.intent,
      styleDirection: "",
      stylePreset: c.preset,
      referenceImageUrl,
      mode: "lifestyle_scene",
      aspectRatio: "9:16",
      generationId,
      angleId: c.angleId,
    });
    results.push({ concept: c, result: r });
    if (!r.ok) {
      console.log(`- ${c.angleId}: FAILED: ${r.error}`);
    } else {
      const qc = r.asset.qc;
      console.log(
        `- ${c.angleId}: OK url=${Boolean(r.asset.url)} qc=${
          qc
            ? `${qc.realism_score}/10 realism, ${qc.artifact_score}/10 artifacts, ${qc.brand_consistency_score}/10 brand (retries=${qc.retry_count})`
            : "none"
        }`
      );
    }
  }

  const succeeded = results
    .filter((x) => x.result.ok)
    .map((x) => ({ ...x, asset: x.result.asset }));
  if (!succeeded.length) {
    console.log("\nNo images succeeded; aborting video step.");
    process.exit(1);
  }

  succeeded.sort((a, b) => scoreOf(b.asset.qc) - scoreOf(a.asset.qc));
  const best = succeeded[0];
  console.log("\n== Best image ==");
  console.log({
    angleId: best.concept.angleId,
    preset: best.concept.preset,
    url: best.asset.url,
    qc: best.asset.qc,
  });

  const head = await headOk(best.asset.url);
  console.log("\nImage HEAD:", head);

  console.log("\n== Converting best image to video (image-to-video) ==");
  const started = await startAdCreativeVideoFromImage({
    image_url: best.asset.url,
    style: "cinematic",
    platform: "reels",
    duration_seconds: 6,
  });
  if (!started.ok) {
    console.log("Video start FAILED:", started.error);
    process.exit(1);
  }

  let videoUrl: string | null = null;
  let jobId: string | null = null;
  if (started.status === "completed") {
    videoUrl = started.video_url;
    jobId = "sync";
  } else {
    jobId = started.job_id;
    console.log("Job started:", jobId);
    for (let i = 0; i < 60; i++) {
      await sleep(2000);
      const polled = await pollAdCreativeVideoJob({
        job_id: jobId,
        source_image_url: best.asset.url,
      });
      if (!polled.ok) {
        console.log("Poll FAILED:", polled.error);
        process.exit(1);
      }
      if (polled.status === "processing") {
        process.stdout.write(".");
        continue;
      }
      if (polled.status === "failed") {
        console.log("\nJob FAILED:", polled.error);
        process.exit(1);
      }
      videoUrl = polled.video_url;
      console.log("\nJob completed.");
      break;
    }
  }

  if (!videoUrl) {
    console.log("\nVideo did not complete within timeout.");
    process.exit(1);
  }

  const vHead = await headOk(videoUrl);
  console.log("\nVideo HEAD:", vHead);

  const uploaded = await uploadVideoToStorage({
    clientId: "e2e",
    userId: "e2e",
    jobId: jobId ?? "job",
    videoUrl,
  });
  console.log("\nUploaded video to storage:", {
    bucket: uploaded.bucket,
    path: uploaded.path,
    bytes: uploaded.bytes,
    signedUrl: uploaded.signedUrl,
  });

  console.log("\nDONE");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

