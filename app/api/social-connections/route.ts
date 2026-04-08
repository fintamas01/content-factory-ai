import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { requireActiveClientId } from "@/lib/clients/server";
import { requireFeatureAccess } from "@/lib/entitlements/api";

function bad(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function getSupabaseEnv() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnon =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANNON_KEY;
  return { supabaseUrl, supabaseAnon };
}

async function getSupabase() {
  const { supabaseUrl, supabaseAnon } = getSupabaseEnv();
  if (!supabaseUrl || !supabaseAnon) return null;
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
  return { supabase, cookieStore };
}

export async function GET() {
  const ctx = await getSupabase();
  if (!ctx) return bad("Server configuration error.", 500);
  const { supabase, cookieStore } = ctx;

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

  const { data, error } = await supabase
    .from("social_connections")
    .select(
      "id, platform, account_type, provider_account_id, account_display_name, scopes, expires_at, status, connected_at, updated_at"
    )
    .eq("user_id", user.id)
    .eq("client_id", active.clientId)
    .order("connected_at", { ascending: false });

  if (error) {
    console.error("social_connections list:", error);
    return bad("Could not load social connections.", 500);
  }

  const rows = (data ?? []).map((r: any) => ({
    id: r.id,
    platform: r.platform,
    account_type: r.account_type,
    provider_account_id: r.provider_account_id,
    account_display_name: r.account_display_name ?? null,
    scopes: Array.isArray(r.scopes) ? r.scopes : [],
    expires_at: r.expires_at ?? null,
    status: r.status ?? "connected",
    connected_at: r.connected_at,
    updated_at: r.updated_at,
  }));

  const status = {
    instagram: rows.some((r: any) => r.platform === "instagram" && r.status === "connected"),
    facebook: rows.some((r: any) => r.platform === "facebook" && r.status === "connected"),
    linkedin: rows.some((r: any) => r.platform === "linkedin" && r.status === "connected"),
  };

  return NextResponse.json({ connections: rows, status, activeClientId: active.clientId });
}

