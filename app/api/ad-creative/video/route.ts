import { NextResponse } from "next/server";
import { requireSessionClientAndUsageAllowance } from "@/lib/usage/require-session-usage";
import { requireFeatureAccess } from "@/lib/entitlements/api";
import { incrementUsage } from "@/lib/usage/usage-service";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  pollAdCreativeVideoJob,
  startAdCreativeVideoFromImage,
  type AdCreativeVideoPlatform,
  type AdCreativeVideoStyle,
} from "@/lib/ad-creative/video-provider";

function asString(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function safeSlug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 48);
}

function isHttpUrl(s: string): boolean {
  try {
    const u = new URL(s);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function parseStyle(v: unknown): AdCreativeVideoStyle | null {
  const s = asString(v).trim();
  if (s === "cinematic" || s === "handheld" || s === "product showcase" || s === "product_showcase" || s === "UGC" || s === "ugc") {
    if (s === "product showcase") return "product_showcase";
    if (s === "UGC") return "ugc";
    return s as AdCreativeVideoStyle;
  }
  return null;
}

function parsePlatform(v: unknown): AdCreativeVideoPlatform | null {
  const s = asString(v).trim().toLowerCase();
  if (s === "tiktok" || s === "reels" || s === "square") return s as AdCreativeVideoPlatform;
  return null;
}

function parseDuration(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return 6;
  return Math.max(5, Math.min(8, Math.round(n)));
}

async function uploadAndSignVideo(params: {
  videoSourceUrl: string;
  bucket: string;
  path: string;
}): Promise<{ ok: true; url: string; storage: { bucket: string; path: string } } | { ok: false; error: string }> {
  const r = await fetch(params.videoSourceUrl);
  if (!r.ok) return { ok: false, error: "Failed to download provider video." };
  const bytes = await r.arrayBuffer();

  const { error: uploadErr } = await supabaseAdmin.storage
    .from(params.bucket)
    .upload(params.path, bytes, { contentType: "video/mp4", upsert: true });
  if (uploadErr) return { ok: false, error: "Could not upload video to storage." };

  const { data: signed, error: signErr } = await supabaseAdmin.storage
    .from(params.bucket)
    .createSignedUrl(params.path, 60 * 60);
  if (signErr || !signed?.signedUrl) return { ok: false, error: "Could not create signed URL." };

  return { ok: true, url: signed.signedUrl, storage: { bucket: params.bucket, path: params.path } };
}

/**
 * POST: starts an image-to-video job (or returns completed result if provider is synchronous).
 * GET: polls an existing job_id and returns completed result once ready.
 */
export async function POST(req: Request) {
  try {
    const gate = await requireSessionClientAndUsageAllowance("content");
    if (!gate.ok) return gate.response;
    const { supabase, user, clientId } = gate;

    const denied = await requireFeatureAccess({
      supabase,
      userId: user.id,
      featureKey: "adCreativeStudio",
    });
    if (denied) return denied;

    const body = await req.json().catch(() => ({}));
    const image_url = asString(body?.image_url).trim();
    const style = parseStyle(body?.style);
    const platform = parsePlatform(body?.platform);
    const duration = parseDuration(body?.duration);

    if (!image_url || !isHttpUrl(image_url)) {
      return NextResponse.json({ ok: false, error: "image_url must be a valid http(s) URL." }, { status: 400 });
    }
    if (!style) {
      return NextResponse.json(
        { ok: false, error: "style must be one of: cinematic, handheld, product_showcase, ugc." },
        { status: 400 }
      );
    }
    if (!platform) {
      return NextResponse.json(
        { ok: false, error: "platform must be one of: tiktok, reels, square." },
        { status: 400 }
      );
    }

    const started = await startAdCreativeVideoFromImage({
      image_url,
      style,
      platform,
      duration_seconds: duration,
    });

    if (!started.ok) {
      return NextResponse.json({ ok: false, error: started.error }, { status: 500 });
    }

    if (started.status === "processing") {
      // Do not consume usage quota until the job is actually completed and returned to the user.
      return NextResponse.json({
        ok: true,
        status: "processing",
        provider: started.provider,
        job_id: started.job_id,
        poll: { method: "GET", url: `/api/ad-creative/video?job_id=${encodeURIComponent(started.job_id)}` },
        metadata: started.metadata,
      });
    }

    // Completed (rare): finalize to storage now.
    const bucket = "brand-assets";
    const path = `ad-creative-videos/${clientId}/${user.id}/${Date.now()}-${safeSlug(style)}-${safeSlug(platform)}.mp4`;
    const saved = await uploadAndSignVideo({ videoSourceUrl: started.video_url, bucket, path });
    if (!saved.ok) {
      return NextResponse.json({ ok: false, error: saved.error }, { status: 500 });
    }

    await incrementUsage(supabase, "content", clientId);

    return NextResponse.json({
      ok: true,
      status: "completed",
      provider: started.provider,
      video_url: saved.url,
      thumbnail: started.thumbnail_url ?? image_url,
      storage: saved.storage,
      metadata: started.metadata,
    });
  } catch (e) {
    console.error("POST /api/ad-creative/video:", e);
    return NextResponse.json({ ok: false, error: "Server error." }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const gate = await requireSessionClientAndUsageAllowance("content");
    if (!gate.ok) return gate.response;
    const { supabase, user, clientId } = gate;

    const denied = await requireFeatureAccess({
      supabase,
      userId: user.id,
      featureKey: "adCreativeStudio",
    });
    if (denied) return denied;

    const { searchParams } = new URL(req.url);
    const job_id = asString(searchParams.get("job_id")).trim();
    const source_image_url = asString(searchParams.get("image_url")).trim();

    if (!job_id) {
      return NextResponse.json({ ok: false, error: "job_id is required." }, { status: 400 });
    }

    const polled = await pollAdCreativeVideoJob({
      job_id,
      source_image_url: source_image_url && isHttpUrl(source_image_url) ? source_image_url : undefined,
    });

    if (!polled.ok) {
      return NextResponse.json({ ok: false, error: polled.error }, { status: 500 });
    }

    if (polled.status === "processing") {
      return NextResponse.json({
        ok: true,
        status: "processing",
        provider: polled.provider,
        job_id: polled.job_id,
        metadata: polled.metadata,
      });
    }

    if (polled.status === "failed") {
      return NextResponse.json({
        ok: true,
        status: "failed",
        provider: polled.provider,
        job_id: polled.job_id,
        error: polled.error,
        metadata: polled.metadata,
      });
    }

    // Completed: persist deterministically (idempotent per job_id).
    const bucket = "brand-assets";
    const path = `ad-creative-videos/${clientId}/${user.id}/jobs/${encodeURIComponent(job_id)}.mp4`;
    const saved = await uploadAndSignVideo({ videoSourceUrl: polled.video_url, bucket, path });
    if (!saved.ok) {
      return NextResponse.json({ ok: false, error: saved.error }, { status: 500 });
    }

    await incrementUsage(supabase, "content", clientId);

    return NextResponse.json({
      ok: true,
      status: "completed",
      provider: polled.provider,
      job_id: polled.job_id,
      video_url: saved.url,
      thumbnail: polled.thumbnail_url ?? undefined,
      storage: saved.storage,
      metadata: polled.metadata,
    });
  } catch (e) {
    console.error("GET /api/ad-creative/video:", e);
    return NextResponse.json({ ok: false, error: "Server error." }, { status: 500 });
  }
}

