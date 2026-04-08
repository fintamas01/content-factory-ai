import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { requireActiveClientId } from "@/lib/clients/server";
import type { MetaConnectionRow } from "@/lib/social/meta";
import {
  getDecryptedAccessToken,
  publishFacebookPagePost,
  publishInstagramImage,
} from "@/lib/social/meta";
import { requireFeatureAccess } from "@/lib/entitlements/api";

function bad(message: string, status = 400, extra?: Record<string, unknown>) {
  return NextResponse.json({ error: message, ...(extra ?? {}) }, { status });
}

type Platform = "instagram" | "facebook" | "linkedin";

function isPlatform(p: unknown): p is Platform {
  return p === "instagram" || p === "facebook" || p === "linkedin";
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const platform = body?.platform;
    if (!isPlatform(platform)) return bad("Invalid platform.", 400);

    const text = typeof body?.text === "string" ? body.text.trim() : "";
    const imageUrl = typeof body?.imageUrl === "string" ? body.imageUrl.trim() : "";
    const scheduleUnix = body?.scheduledTime;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnon =
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
      process.env.NEXT_PUBLIC_SUPABASE_ANNON_KEY;
    if (!supabaseUrl || !supabaseAnon) return bad("Server configuration error.", 500);

    const cookieStore = await cookies();
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

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return bad("Unauthorized.", 401);

    const denied = await requireFeatureAccess({
      supabase,
      userId: user.id,
      featureKey: "socialPublish",
    });
    if (denied) return denied;

    const active = await requireActiveClientId(supabase, cookieStore, user.id);

    if (platform === "linkedin") {
      return bad("LinkedIn publishing is not enabled yet.", 501);
    }

    // Load the latest connected row for this platform.
    const { data: conn, error: connErr } = await supabase
      .from("social_connections")
      .select(
        "id, platform, account_type, provider_account_id, account_display_name, scopes, access_token_ciphertext, access_token_iv, access_token_tag, expires_at, status"
      )
      .eq("user_id", user.id)
      .eq("client_id", active.clientId)
      .eq("platform", platform)
      .eq("status", "connected")
      .order("connected_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (connErr) {
      console.error("social_connections fetch:", connErr);
      return bad("Could not load connection.", 500);
    }
    if (!conn?.id) {
      return bad(`No ${platform} account is connected.`, 403, { code: "NOT_CONNECTED" });
    }

    const row = conn as unknown as MetaConnectionRow;
    const token = getDecryptedAccessToken(row);

    // Log row (queued)
    const payload: Record<string, unknown> = {
      platform,
      hasImage: Boolean(imageUrl),
      textLength: text.length,
      imageHost: imageUrl ? (() => { try { return new URL(imageUrl).host; } catch { return null; } })() : null,
    };
    const scheduledFor =
      typeof scheduleUnix === "number" && Number.isFinite(scheduleUnix) && scheduleUnix > 0
        ? new Date(scheduleUnix * 1000).toISOString()
        : null;

    const { data: logRow } = await supabase
      .from("social_post_logs")
      .insert({
        user_id: user.id,
        client_id: active.clientId,
        platform,
        connection_id: row.id,
        status: "queued",
        scheduled_for: scheduledFor,
        payload,
      })
      .select("id")
      .maybeSingle();

    const logId = (logRow as any)?.id as string | undefined;

    if (platform === "instagram") {
      if (!imageUrl) return bad("Instagram publishing requires an image URL.", 400);
      if (!text) return bad("Caption is required.", 400);

      const r = await publishInstagramImage({
        igBusinessId: row.provider_account_id,
        pageAccessToken: token,
        imageUrl,
        caption: text,
      });

      if (logId) {
        await supabase
          .from("social_post_logs")
          .update({
            status: "posted",
            published_at: new Date().toISOString(),
            provider_response: { id: r.postId },
          })
          .eq("id", logId);
      }

      return NextResponse.json({ ok: true, platform, postId: r.postId });
    }

    // facebook
    if (!text) return bad("Post text is required.", 400);
    const r = await publishFacebookPagePost({
      pageId: row.provider_account_id,
      pageAccessToken: token,
      message: text,
    });

    if (logId) {
      await supabase
        .from("social_post_logs")
        .update({
          status: "posted",
          published_at: new Date().toISOString(),
          provider_response: { id: r.postId },
        })
        .eq("id", logId);
    }

    return NextResponse.json({ ok: true, platform, postId: r.postId });
  } catch (e) {
    console.error("social publish:", e);
    return bad(e instanceof Error ? e.message : "Unexpected server error.", 500);
  }
}

