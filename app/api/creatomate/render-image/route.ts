import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { requireActiveClientId } from "@/lib/clients/server";
import {
  buildCreatomateModifications,
  getSocialPostTemplateById,
  resolveCreatomateTemplateId,
  validateTemplateValues,
  valuesToLegacyRow,
} from "@/lib/creatomate/social-post-templates";

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
 * Official status polling uses the v2 endpoint.
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
      await sleep(pollEveryMs);
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
    const { data: authData } = await supabase.auth.getUser();
    const user = authData?.user ?? null;

    const apiKey = process.env.CREATOMATE_API_KEY?.trim();
    if (!apiKey) return jsonError("Missing env var: CREATOMATE_API_KEY", 500);

    const body = await req.json().catch(() => ({}));
    const templateId = typeof body?.templateId === "string" ? body.templateId.trim() : "";
    const valuesRaw = body?.values;
    const valuesObj =
      valuesRaw && typeof valuesRaw === "object" && valuesRaw !== null && !Array.isArray(valuesRaw)
        ? (valuesRaw as Record<string, unknown>)
        : null;

    if (!templateId) {
      return jsonError("Missing templateId.", 400);
    }
    if (!valuesObj) {
      return jsonError("Missing values object.", 400);
    }

    const template = getSocialPostTemplateById(templateId);
    if (!template) {
      return jsonError(`Unknown templateId: ${templateId}`, 400);
    }

    const validated = validateTemplateValues(template, valuesObj);
    if (!validated.ok) {
      return jsonError(validated.error, 400);
    }

    const creatomateTemplateId = resolveCreatomateTemplateId(template);
    if (!creatomateTemplateId) {
      return jsonError(
        "Creatomate template id is not configured. Set CREATOMATE_TEMPLATE_ID for the primary template, or set a real id on the template registry entry.",
        500
      );
    }

    const modifications = buildCreatomateModifications(template, validated.values);

    const createBody = {
      template_id: creatomateTemplateId,
      modifications,
    };

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
        const j = JSON.parse(created.text);
        if (typeof j?.message === "string") creatomateMessage = j.message;
        if (typeof j?.error === "string") creatomateMessage = creatomateMessage ?? j.error;
      } catch {
        /* ignore */
      }
      return jsonError("Creatomate render request failed.", 502, {
        status: created.status,
        body: created.text,
        ...(creatomateMessage ? { creatomateMessage } : {}),
      });
    }

    if (process.env.NODE_ENV !== "production") {
      const shape = Array.isArray(created.json) ? "array" : typeof created.json;
      console.log("[creatomate] create render response:", { shape });
    }

    const createdRender: unknown = Array.isArray(created.json) ? created.json?.[0] : created.json;
    const renderId =
      createdRender &&
      typeof createdRender === "object" &&
      "id" in createdRender &&
      typeof (createdRender as { id: unknown }).id === "string"
        ? (createdRender as { id: string }).id
        : "";

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

    let saved: { id: string; created_at: string } | null = null;
    const legacy = valuesToLegacyRow(validated.values);

    if (user) {
      try {
        const active = await requireActiveClientId(supabase, cookieStore, user.id);
        const clientId = active.clientId;

        const { data: inserted, error: insErr } = await supabase
          .from("social_post_generations")
          .insert({
            user_id: user.id,
            client_id: clientId,
            template_id: template.id,
            template_name: template.name,
            values: validated.values,
            headline: legacy.headline || null,
            subheadline: legacy.subheadline || null,
            body: legacy.body || null,
            image_top: legacy.image_top || null,
            image_middle: legacy.image_middle || null,
            image_bottom: legacy.image_bottom || null,
            output_url: done.url,
          })
          .select("id, created_at")
          .single();

        if (insErr) {
          console.error("social_post_generations insert:", insErr);
        } else if (inserted?.id) {
          saved = {
            id: String(inserted.id),
            created_at: String(inserted.created_at),
          };
        }
      } catch (e) {
        console.warn("social_post_generations persist failed:", e);
      }
    }

    return NextResponse.json({ success: true, url: done.url, saved });
  } catch (e) {
    console.error("POST /api/creatomate/render-image:", e);
    return jsonError("Unexpected server error.", 500);
  }
}
