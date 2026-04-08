import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { requireActiveClientId } from "@/lib/clients/server";
import { getPublicSiteUrl, publicAbsoluteUrl } from "@/lib/env/public-site-url";
import { buildMetaAuthorizeUrl } from "@/lib/social/meta";
import { requireFeatureAccess } from "@/lib/entitlements/api";

function bad(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function isPlatform(p: string): p is "instagram" | "facebook" | "linkedin" {
  return p === "instagram" || p === "facebook" || p === "linkedin";
}

export async function GET(_req: Request, ctx: { params: Promise<{ platform: string }> }) {
  const { platform: raw } = await ctx.params;
  const platform = String(raw ?? "").toLowerCase();
  if (!isPlatform(platform)) return bad("Invalid platform.", 400);

  const base = getPublicSiteUrl();
  if (!base) return bad("NEXT_PUBLIC_SITE_URL (or NEXT_PUBLIC_APP_URL) is not configured.", 500);

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
    featureKey: "socialConnections",
  });
  if (denied) return denied;

  const active = await requireActiveClientId(supabase, cookieStore, user.id);

  if (platform === "linkedin") {
    // Stub (no fake publishing): return a clear error for now.
    return bad("LinkedIn connections are not enabled yet.", 501);
  }

  // Meta OAuth: Instagram/Facebook share the same OAuth.
  const redirectUri = publicAbsoluteUrl(`/api/social-connections/callback/${platform}`);
  const state = Buffer.from(
    JSON.stringify({
      clientId: active.clientId,
      userId: user.id,
      platform,
      ts: Date.now(),
    })
  ).toString("base64url");

  const url = buildMetaAuthorizeUrl({ redirectUri, state });
  return NextResponse.redirect(url);
}

