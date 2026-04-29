import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { requireActiveClientId } from "@/lib/clients/server";
import { renderCreatomateImage } from "@/lib/creatomate/render";
import {
  buildCreatomateModifications,
  getSocialPostTemplateById,
  resolveCreatomateTemplateId,
  validateTemplateValues,
  valuesToLegacyRow,
} from "@/lib/creatomate/social-post-templates";

function jsonError(message: string, status = 400, details?: unknown) {
  return NextResponse.json(
    { success: false, error: message, ...(details ? { details } : {}) },
    { status }
  );
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

    const body = await req.json().catch(() => ({}));
    const templateId = typeof body.templateId === "string" ? body.templateId.trim() : "";
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

    let done: { url: string; renderId: string };
    try {
      done = await renderCreatomateImage({
        templateId: creatomateTemplateId,
        modifications,
        metadata: { source: "render-image", registryTemplateId: template.id },
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Creatomate render failed.";
      const lower = msg.toLowerCase();
      const status =
        lower.includes("timed out") || lower.includes("timeout") ? 504 : 502;
      return jsonError(msg, status);
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
