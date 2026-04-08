import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { requireActiveClientId } from "@/lib/clients/server";
import { publicAbsoluteUrl } from "@/lib/env/public-site-url";
import {
  exchangeMetaCode,
  fetchInstagramBusinessAccount,
  fetchMetaPages,
} from "@/lib/social/meta";
import { encryptToken } from "@/lib/social/crypto";

function bad(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function isPlatform(p: string): p is "instagram" | "facebook" | "linkedin" {
  return p === "instagram" || p === "facebook" || p === "linkedin";
}

function decodeState(raw: string | null): any | null {
  if (!raw) return null;
  try {
    const json = Buffer.from(raw, "base64url").toString("utf8");
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export async function GET(req: Request, ctx: { params: Promise<{ platform: string }> }) {
  const redirectOk = (code: string) =>
    NextResponse.redirect(`/dashboard/social-connections?success=${encodeURIComponent(code)}`);
  const redirectErr = (code: string) =>
    NextResponse.redirect(`/dashboard/social-connections?error=${encodeURIComponent(code)}`);

  try {
    const { platform: raw } = await ctx.params;
    const platform = String(raw ?? "").toLowerCase();
    if (!isPlatform(platform)) return bad("Invalid platform.", 400);

    if (platform === "linkedin") {
      return redirectErr("linkedin_not_enabled");
    }

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

    const u = new URL(req.url);
    const code = u.searchParams.get("code");
    const error = u.searchParams.get("error");
    const errorDesc = u.searchParams.get("error_description");
    if (error) {
      return redirectErr(errorDesc ? "oauth_denied" : String(error));
    }
    if (!code) return redirectErr("missing_code");

    const state = decodeState(u.searchParams.get("state"));
    const active = await requireActiveClientId(supabase, cookieStore, user.id);
    const clientId =
      typeof state?.clientId === "string" && state.clientId ? state.clientId : active.clientId;

    const redirectUri = publicAbsoluteUrl(`/api/social-connections/callback/${platform}`);
    let token: { access_token: string; token_type: string; expires_in: number };
    try {
      token = await exchangeMetaCode({ code, redirectUri });
    } catch (e) {
      console.error("meta exchange failed:", e);
      return redirectErr("meta_exchange_failed");
    }
    const userAccessToken = token.access_token;

    let pages: Array<{ id: string; name: string; access_token?: string }>;
    try {
      pages = await fetchMetaPages(userAccessToken);
    } catch (e) {
      console.error("meta pages fetch failed:", e);
      return redirectErr("meta_pages_fetch_failed");
    }
    const page = pages.find(
      (p) => typeof p?.id === "string" && typeof p?.access_token === "string"
    );
    if (!page?.id || !page?.access_token) {
      return redirectErr("meta_pages_missing");
    }

    const pageTokenEnc = encryptToken(page.access_token);
    const expiresAt =
      typeof token.expires_in === "number" && Number.isFinite(token.expires_in)
        ? new Date(Date.now() + token.expires_in * 1000).toISOString()
        : null;

    const fbUpsert = await supabase
      .from("social_connections")
      .upsert(
        {
          user_id: user.id,
          client_id: clientId,
          platform: "facebook",
          account_type: "fb_page",
          provider_account_id: page.id,
          account_display_name: page.name ?? null,
          scopes: [],
          access_token_ciphertext: pageTokenEnc.ciphertext,
          access_token_iv: pageTokenEnc.iv,
          access_token_tag: pageTokenEnc.tag,
          expires_at: expiresAt,
          status: "connected",
        },
        { onConflict: "client_id,platform,provider_account_id" }
      )
      .select("id")
      .maybeSingle();

    if (fbUpsert.error) {
      console.error("social_connections facebook upsert:", fbUpsert.error);
      return redirectErr("save_facebook_failed");
    }

    let igBusinessId: string | null = null;
    try {
      const ig = await fetchInstagramBusinessAccount(page.id, page.access_token);
      igBusinessId = ig.igBusinessId;
    } catch (e) {
      console.error("meta ig business fetch:", e);
    }

    if (igBusinessId) {
      const igUpsert = await supabase
        .from("social_connections")
        .upsert(
          {
            user_id: user.id,
            client_id: clientId,
            platform: "instagram",
            account_type: "ig_business",
            provider_account_id: igBusinessId,
            account_display_name: page.name ?? null,
            scopes: [],
            access_token_ciphertext: pageTokenEnc.ciphertext,
            access_token_iv: pageTokenEnc.iv,
            access_token_tag: pageTokenEnc.tag,
            expires_at: expiresAt,
            status: "connected",
          },
          { onConflict: "client_id,platform,provider_account_id" }
        )
        .select("id")
        .maybeSingle();

      if (igUpsert.error) {
        console.error("social_connections instagram upsert:", igUpsert.error);
        if (platform === "instagram") return redirectErr("save_instagram_failed");
      }
    }
    if (platform === "facebook") return redirectOk("facebook_connected");
    if (platform === "instagram") {
      return igBusinessId ? redirectOk("instagram_connected") : redirectErr("missing_instagram_business_account");
    }
    return redirectOk("connected");
  } catch (e) {
    console.error("meta oauth callback:", e);
    return redirectErr("oauth_callback_failed");
  }
}

