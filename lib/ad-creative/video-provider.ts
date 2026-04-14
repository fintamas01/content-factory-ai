export type AdCreativeVideoStyle = "cinematic" | "handheld" | "product_showcase" | "ugc";
export type AdCreativeVideoPlatform = "tiktok" | "reels" | "square";

export type VideoProviderId = "replicate";

export type StartVideoJobResult =
  | {
      ok: true;
      provider: VideoProviderId;
      status: "processing";
      job_id: string;
      metadata: Record<string, unknown>;
    }
  | {
      ok: true;
      provider: VideoProviderId;
      status: "completed";
      video_url: string;
      thumbnail_url?: string;
      metadata: Record<string, unknown>;
    }
  | { ok: false; provider: VideoProviderId; error: string };

export type PollVideoJobResult =
  | {
      ok: true;
      provider: VideoProviderId;
      status: "processing";
      job_id: string;
      metadata: Record<string, unknown>;
    }
  | {
      ok: true;
      provider: VideoProviderId;
      status: "completed";
      job_id: string;
      video_url: string;
      thumbnail_url?: string;
      metadata: Record<string, unknown>;
    }
  | {
      ok: true;
      provider: VideoProviderId;
      status: "failed";
      job_id: string;
      error: string;
      metadata: Record<string, unknown>;
    }
  | { ok: false; provider: VideoProviderId; error: string };

function safeJsonParse(s: string): any {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

function stylePrompt(style: AdCreativeVideoStyle): string {
  switch (style) {
    case "cinematic":
      return "cinematic commercial feel, smooth dolly/slider motion, subtle parallax, stable framing";
    case "handheld":
      return "handheld but controlled, slight natural sway, documentary realism, no jittery chaos";
    case "product_showcase":
      return "clean product showcase, slow orbit/pan, gentle push-in, crisp details, stable lighting";
    case "ugc":
      return "UGC feel, natural phone camera motion, believable exposure, authentic casual vibe, not over-stylized";
  }
}

function platformAspect(platform: AdCreativeVideoPlatform): "9:16" | "1:1" {
  if (platform === "square") return "1:1";
  return "9:16";
}

function clampDurationSeconds(n: unknown): number {
  const v = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(v)) return 6;
  return Math.max(5, Math.min(8, Math.round(v)));
}

function parseAllowedDurations(): number[] {
  const raw = (process.env.REPLICATE_IMAGE_TO_VIDEO_ALLOWED_DURATIONS ?? "5,10")
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);
  const uniq = Array.from(new Set(raw)).sort((a, b) => a - b);
  return uniq.length ? uniq : [5, 10];
}

function mapToAllowedDurationSeconds(requested: number): { requested: number; mapped: number; allowed: number[] } {
  const allowed = parseAllowedDurations();
  let best = allowed[0]!;
  let bestDist = Math.abs(best - requested);
  for (const a of allowed) {
    const d = Math.abs(a - requested);
    if (d < bestDist) {
      best = a;
      bestDist = d;
    }
  }
  return { requested, mapped: best, allowed };
}

async function replicateFetch(path: string, init: RequestInit) {
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) throw new Error("REPLICATE_API_TOKEN is not configured.");
  const resp = await fetch(`https://api.replicate.com${path}`, {
    ...init,
    headers: {
      Authorization: `Token ${token}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  });
  const text = await resp.text();
  const json = safeJsonParse(text);
  return { ok: resp.ok, status: resp.status, json, text };
}

function pickOutputVideoUrl(output: any): string | null {
  if (typeof output === "string" && output.startsWith("http")) return output;
  if (Array.isArray(output)) {
    for (const x of output) {
      if (typeof x === "string" && x.startsWith("http")) return x;
    }
  }
  if (output && typeof output === "object") {
    const maybe = (output as any).video ?? (output as any).url ?? (output as any).mp4;
    if (typeof maybe === "string" && maybe.startsWith("http")) return maybe;
  }
  return null;
}

export async function startAdCreativeVideoFromImage(params: {
  image_url: string;
  style: AdCreativeVideoStyle;
  platform: AdCreativeVideoPlatform;
  duration_seconds: number;
}): Promise<StartVideoJobResult> {
  const provider: VideoProviderId = "replicate";
  try {
    const version = process.env.REPLICATE_IMAGE_TO_VIDEO_VERSION;
    if (!version) {
      return {
        ok: false,
        provider,
        error:
          "Video provider is not configured (missing REPLICATE_IMAGE_TO_VIDEO_VERSION).",
      };
    }

    const durationRequested = clampDurationSeconds(params.duration_seconds);
    const durationMapped = mapToAllowedDurationSeconds(durationRequested);
    const duration = durationMapped.mapped;
    const aspect = platformAspect(params.platform);

    const prompt = `Create a short (${duration}s) photoreal ad video from this source image.
Motion: ${stylePrompt(params.style)}.
Constraints:
- subtle camera motion (pan/tilt/slow push), no chaotic movement
- keep lighting consistent across frames
- preserve the product identity and shape (no warping/melting)
- avoid AI artifacts (weird textures, broken geometry, duplicated objects)
- maintain realism (natural shadows, believable motion blur, stable exposure)
Output: mp4 video. Aspect ratio: ${aspect}.`;

    const { ok, json, text, status } = await replicateFetch("/v1/predictions", {
      method: "POST",
      body: JSON.stringify({
        version,
        input: {
          image: params.image_url,
          prompt,
          duration,
          aspect_ratio: aspect,
        },
      }),
    });

    if (!ok) {
      return {
        ok: false,
        provider,
        error: `Replicate request failed (${status}). ${typeof text === "string" ? text : ""}`.trim(),
      };
    }

    const id = typeof json?.id === "string" ? json.id : null;
    const st = typeof json?.status === "string" ? json.status : "processing";

    const maybeVideo = pickOutputVideoUrl(json?.output);
    if (st === "succeeded" && maybeVideo) {
      return {
        ok: true,
        provider,
        status: "completed",
        video_url: maybeVideo,
        thumbnail_url: params.image_url,
        metadata: { raw: json, duration: durationMapped },
      };
    }

    if (!id) {
      return { ok: false, provider, error: "Provider did not return a job id." };
    }

    return {
      ok: true,
      provider,
      status: "processing",
      job_id: id,
      metadata: { raw: json, duration: durationMapped },
    };
  } catch (e: any) {
    return { ok: false, provider, error: String(e?.message ?? e ?? "Video generation failed.") };
  }
}

export async function pollAdCreativeVideoJob(params: {
  job_id: string;
  source_image_url?: string;
}): Promise<PollVideoJobResult> {
  const provider: VideoProviderId = "replicate";
  try {
    const { ok, json, text, status } = await replicateFetch(
      `/v1/predictions/${encodeURIComponent(params.job_id)}`,
      { method: "GET" }
    );

    if (!ok) {
      return {
        ok: false,
        provider,
        error: `Replicate poll failed (${status}). ${typeof text === "string" ? text : ""}`.trim(),
      };
    }

    const st = typeof json?.status === "string" ? json.status : "processing";
    if (st === "failed" || st === "canceled") {
      return {
        ok: true,
        provider,
        status: "failed",
        job_id: params.job_id,
        error: typeof json?.error === "string" ? json.error : "Video job failed.",
        metadata: { raw: json },
      };
    }

    if (st === "succeeded") {
      const maybeVideo = pickOutputVideoUrl(json?.output);
      if (!maybeVideo) {
        return {
          ok: true,
          provider,
          status: "failed",
          job_id: params.job_id,
          error: "Provider returned succeeded but no output video URL was found.",
          metadata: { raw: json },
        };
      }
      return {
        ok: true,
        provider,
        status: "completed",
        job_id: params.job_id,
        video_url: maybeVideo,
        thumbnail_url: params.source_image_url,
        metadata: { raw: json },
      };
    }

    return {
      ok: true,
      provider,
      status: "processing",
      job_id: params.job_id,
      metadata: { raw: json },
    };
  } catch (e: any) {
    return { ok: false, provider, error: String(e?.message ?? e ?? "Video polling failed.") };
  }
}

