/**
 * Shared Creatomate v2 render flow (create + poll).
 * Used by /api/creatomate/render-image and campaign_jobs.
 */

export type CreatomateRenderMetadata = Record<string, unknown>;

export type RenderCreatomateImageParams = {
  /**
   * Creatomate template UUID (API field `template_id`), already resolved from the registry
   * via `resolveCreatomateTemplateId` when needed.
   */
  templateId: string;
  /** Creatomate `modifications` map (layer.property → string value). */
  modifications: Record<string, string>;
  /** Optional tracing (logging only). */
  metadata?: CreatomateRenderMetadata;
  /** Total wait before timeout (default 30s, matches previous route behavior). */
  timeoutMs?: number;
  pollEveryMs?: number;
};

export type RenderCreatomateImageResult = {
  url: string;
  renderId: string;
};

type RenderStatus =
  | "planned"
  | "waiting"
  | "rendering"
  | "succeeded"
  | "failed"
  | string;

type CreatomateRender = {
  id: string;
  status: RenderStatus;
  url?: string | null;
  snapshot_url?: string | null;
  error_message?: string | null;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJson(
  url: string,
  init: RequestInit
): Promise<
  { ok: true; status: number; json: unknown } | { ok: false; status: number; text: string }
> {
  const res = await fetch(url, init);
  const text = await res.text();
  if (!res.ok) return { ok: false, status: res.status, text };
  try {
    return { ok: true, status: res.status, json: JSON.parse(text) };
  } catch {
    return { ok: false, status: res.status, text: "Invalid JSON from Creatomate." };
  }
}

async function waitForRender(params: {
  renderId: string;
  apiKey: string;
  timeoutMs: number;
  pollEveryMs: number;
}): Promise<{ ok: true; url: string } | { ok: false; error: string; status?: string }> {
  const started = Date.now();

  while (Date.now() - started < params.timeoutMs) {
    const statusResp = await fetchJson(`https://api.creatomate.com/v2/renders/${params.renderId}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${params.apiKey}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    if (!statusResp.ok) {
      await sleep(params.pollEveryMs);
      continue;
    }

    const render = statusResp.json as CreatomateRender;
    const status = String(render?.status ?? "");

    if (process.env.NODE_ENV !== "production") {
      console.log("[creatomate] poll render:", {
        id: render?.id,
        status,
        hasUrl: Boolean(render?.url),
        hasSnapshot: Boolean(render?.snapshot_url),
        hasError: Boolean(render?.error_message),
      });
    }

    if (status === "succeeded") {
      const url = typeof render?.url === "string" ? render.url : "";
      if (!url) {
        return { ok: false, error: "Creatomate render succeeded but returned no url." };
      }
      return { ok: true, url };
    }

    if (status === "failed") {
      const msg =
        typeof render?.error_message === "string" && render.error_message.trim()
          ? render.error_message.trim()
          : "Creatomate render failed.";
      return { ok: false, error: msg, status };
    }

    await sleep(params.pollEveryMs);
  }

  return { ok: false, error: `Render timed out after ${params.timeoutMs / 1000} seconds.`, status: "timeout" };
}

/**
 * Creates a render on Creatomate and polls until success, failure, or timeout.
 * @throws Error with a clear message on HTTP errors, missing render id, or render failure.
 */
export async function renderCreatomateImage(
  params: RenderCreatomateImageParams
): Promise<RenderCreatomateImageResult> {
  const apiKey = process.env.CREATOMATE_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("CREATOMATE_API_KEY is not configured.");
  }

  const templateId = params.templateId?.trim();
  if (!templateId) {
    throw new Error("Creatomate template id is missing.");
  }

  const timeoutMs = params.timeoutMs ?? 30_000;
  const pollEveryMs = params.pollEveryMs ?? 1200;

  const createBody = {
    template_id: templateId,
    modifications: params.modifications,
  };

  if (process.env.NODE_ENV !== "production" && params.metadata) {
    console.log("[creatomate] create render:", params.metadata);
  }

  const created = await fetchJson("https://api.creatomate.com/v2/renders", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(createBody),
  });

  if (!created.ok) {
    let creatomateMessage: string | undefined;
    try {
      const j = JSON.parse(created.text) as { message?: string; error?: string };
      if (typeof j?.message === "string") creatomateMessage = j.message;
      if (typeof j?.error === "string") creatomateMessage = creatomateMessage ?? j.error;
    } catch {
      /* ignore */
    }
    const msg =
      creatomateMessage?.trim() ||
      `Creatomate render request failed (HTTP ${created.status}). ${created.text.slice(0, 500)}`;
    throw new Error(msg);
  }

  if (process.env.NODE_ENV !== "production") {
    const shape = Array.isArray(created.json) ? "array" : typeof created.json;
    console.log("[creatomate] create render response:", { shape });
  }

  const createdRender: unknown = Array.isArray(created.json) ? created.json?.[0] : created.json;
  const renderId =
    createdRender &&
    typeof createdRender === "object" &&
    createdRender !== null &&
    "id" in createdRender &&
    typeof (createdRender as { id: unknown }).id === "string"
      ? (createdRender as { id: string }).id
      : "";

  if (!renderId) {
    throw new Error("Creatomate response did not include a render id.");
  }

  const done = await waitForRender({ renderId, apiKey, timeoutMs, pollEveryMs });
  if (!done.ok) {
    throw new Error(done.error || "Creatomate render failed.");
  }

  return { url: done.url, renderId };
}
