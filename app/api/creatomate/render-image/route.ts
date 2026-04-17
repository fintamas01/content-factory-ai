import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

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

function jsonError(message: string, status = 400, details?: unknown) {
  return NextResponse.json(
    { success: false, error: message, ...(details ? { details } : {}) },
    { status }
  );
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJson(
  url: string,
  init: RequestInit
): Promise<
  | { ok: true; status: number; json: any }
  | { ok: false; status: number; text: string }
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

/**
 * Polls Creatomate until render succeeds/fails, or times out.
 *
 * Notes:
 * - Creatomate also supports webhooks, but polling is acceptable for this MVP route.
 * - Official status polling for this route uses the v2 endpoint.
 */
async function waitForRender(params: {
  renderId: string;
  apiKey: string;
  timeoutMs: number;
}): Promise<{ ok: true; url: string } | { ok: false; error: string; status?: string }> {
  const started = Date.now();
  const pollEveryMs = 1200;

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
      // If Creatomate is temporarily unhappy, keep polling until timeout.
      await sleep(pollEveryMs);
      continue;
    }

    // v2 returns a single render object.
    const render = statusResp.json as CreatomateRender;
    const status = String(render?.status ?? "");

    // Dev-only log (never log API keys/secrets).
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
      if (!url) return { ok: false, error: "Creatomate render succeeded but returned no url." };
      return { ok: true, url };
    }

    if (status === "failed") {
      const msg =
        typeof render?.error_message === "string" && render.error_message.trim()
          ? render.error_message.trim()
          : "Creatomate render failed.";
      return { ok: false, error: msg, status };
    }

    await sleep(pollEveryMs);
  }

  return { ok: false, error: "Render timed out after 30 seconds.", status: "timeout" };
}

export async function POST(req: Request) {
  try {
    // TODO(SECURITY): Re-enable auth protection after curl testing on production.
    // Temporary: auth is disabled ONLY for this route so it can be invoked from curl.
    const cookieStore = await cookies();
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnon =
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANNON_KEY;
    if (!supabaseUrl || !supabaseAnon) {
      return jsonError("Server configuration error.", 500);
    }
    const supabase = createServerClient(supabaseUrl, supabaseAnon, {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            /* ignore */
          }
        },
      },
    });
    // Intentionally do not enforce Supabase auth during testing.
    void (await supabase.auth.getUser());

    const apiKey = process.env.CREATOMATE_API_KEY?.trim();
    const templateId = process.env.CREATOMATE_TEMPLATE_ID?.trim();
    if (!apiKey) return jsonError("Missing env var: CREATOMATE_API_KEY", 500);
    if (!templateId) return jsonError("Missing env var: CREATOMATE_TEMPLATE_ID", 500);

    const body = await req.json().catch(() => ({}));
    const headline = typeof body?.headline === "string" ? body.headline.trim() : "";
    const subheadline = typeof body?.subheadline === "string" ? body.subheadline.trim() : "";
    const bodyText = typeof body?.body === "string" ? body.body.trim() : "";
    const image_top = typeof body?.image_top === "string" ? body.image_top.trim() : "";
    const image_middle =
      typeof body?.image_middle === "string" ? body.image_middle.trim() : "";
    const image_bottom =
      typeof body?.image_bottom === "string" ? body.image_bottom.trim() : "";

    if (!headline || !subheadline || !bodyText || !image_top || !image_middle || !image_bottom) {
      return jsonError(
        "All fields are required: headline, subheadline, body, image_top, image_middle, image_bottom",
        400
      );
    }

    const createBody = {
      template_id: templateId,
      modifications: {
        "image_middle.source": image_middle,
        "image_top.source": image_top,
        "image_bottom.source": image_bottom,
        "headline.text": headline,
        "subheadline.text": subheadline,
        "body.text": bodyText,
      },
    };

    // Official v2 API: create a render job.
    const created = await fetchJson("https://api.creatomate.com/v2/renders", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(createBody),
    });

    if (!created.ok) {
      return jsonError("Creatomate render request failed.", 502, {
        status: created.status,
        body: created.text,
      });
    }

    // Dev-only log (never log API keys/secrets).
    if (process.env.NODE_ENV !== "production") {
      const shape = Array.isArray(created.json) ? "array" : typeof created.json;
      console.log("[creatomate] create render response:", { shape });
    }

    // Creatomate may return an object or an array depending on API usage.
    const createdRender: any = Array.isArray(created.json) ? created.json?.[0] : created.json;
    const renderId = typeof createdRender?.id === "string" ? createdRender.id : "";

    if (!renderId) {
      return jsonError("Creatomate response did not include a render id.", 502, created.json);
    }

    const done = await waitForRender({ renderId, apiKey, timeoutMs: 30_000 });
    if (!done.ok) {
      return jsonError(done.error, done.status === "timeout" ? 504 : 502, {
        renderId,
        status: done.status ?? null,
      });
    }

    // Final URL must come from the succeeded status response.
    return NextResponse.json({ success: true, url: done.url });
  } catch (e) {
    console.error("POST /api/creatomate/render-image:", e);
    return jsonError("Unexpected server error.", 500);
  }
}

