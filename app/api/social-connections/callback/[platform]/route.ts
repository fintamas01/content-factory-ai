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
  const { platform: raw } = await ctx.params;
  const platform = String(raw ?? "").toLowerCase();
  if (!isPlatform(platform)) return bad("Invalid platform.", 400);

  if (platform === "linkedin") {
    return bad("LinkedIn connections are not enabled yet.", 501);
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
    return NextResponse.redirect(
      `/dashboard/social-connections?error=${encodeURIComponent(
        errorDesc || error
      )}`
    );
  }
  if (!code) return bad("Missing code.", 400);

  const state = decodeState(u.searchParams.get("state"));
  const active = await requireActiveClientId(supabase, cookieStore, user.id);
  const clientId =
    typeof state?.clientId === "string" && state.clientId ? state.clientId : active.clientId;

  // Safety: only allow connecting within a client the user can access
  // (RLS on social_connections will enforce auth.uid = user_id + is_client_member(client_id).)

  const redirectUri = publicAbsoluteUrl(`/api/social-connections/callback/${platform}`);
  const token = await exchangeMetaCode({ code, redirectUri });
  const userAccessToken = token.access_token;

  // Fetch pages; pick first that has required fields for now (launch-safe MVP).
  // Later we can add a UI to pick which page/IG account to connect.
  const pages = await fetchMetaPages(userAccessToken);
  const page = pages.find((p) => typeof p?.id === "string" && typeof p?.access_token === "string");
  if (!page?.id || !page?.access_token) {
    return NextResponse.redirect(
      `/dashboard/social-connections?error=${encodeURIComponent(
        "No Facebook Pages available for this account (or missing permissions)."
      )}`
    );
  }

  // Store Facebook page connection
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
    return NextResponse.redirect(
      `/dashboard/social-connections?error=${encodeURIComponent("Could not save Facebook connection.")}`
    );
  }

  // IG business account (optional, but required to publish to IG)
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
      // Still allow fb connection.
    }
  }

  return NextResponse.redirect("/dashboard/social-connections?connected=1");
}

