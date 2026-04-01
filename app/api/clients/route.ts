import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { requireActiveClientId } from "@/lib/clients/server";

function getEnv() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnon =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANNON_KEY;
  return { supabaseUrl, supabaseAnon };
}

async function getSupabase() {
  const { supabaseUrl, supabaseAnon } = getEnv();
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
  if (!ctx) return NextResponse.json({ error: "Server configuration error." }, { status: 500 });
  const { supabase, cookieStore } = ctx;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const active = await requireActiveClientId(supabase, cookieStore, user.id);

  const { data, error } = await supabase
    .from("client_members")
    .select("role, clients(id, name, website_url, created_at, user_id)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });
  if (error) return NextResponse.json({ error: "Failed to load clients." }, { status: 500 });

  const clients = (data ?? []).map((row: Record<string, unknown>) => {
    const c = row.clients as Record<string, unknown> | null;
    const role = typeof row.role === "string" ? row.role : "member";
    if (!c?.id) return null;
    return {
      id: c.id,
      name: c.name,
      website_url: c.website_url ?? null,
      created_at: c.created_at,
      owner_user_id: c.user_id,
      role,
    };
  }).filter(Boolean);

  return NextResponse.json({ clients, activeClientId: active.clientId });
}

export async function POST(req: Request) {
  const ctx = await getSupabase();
  if (!ctx) return NextResponse.json({ error: "Server configuration error." }, { status: 500 });
  const { supabase, cookieStore } = ctx;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const website_url =
    typeof body?.website_url === "string" ? body.website_url.trim() : null;
  if (!name) return NextResponse.json({ error: "Missing name." }, { status: 400 });

  const { data, error } = await supabase
    .from("clients")
    .insert({ user_id: user.id, name, website_url: website_url || null })
    .select("id, name, website_url, created_at")
    .single();
  if (error) {
    return NextResponse.json({ error: "Could not create client." }, { status: 500 });
  }

  // If user has no active client cookie yet, set it to the newly created one.
  // (Otherwise keep current active client.)
  const existing = cookieStore.get("cf_client_id")?.value ?? "";
  if (!existing && data?.id) {
    cookieStore.set("cf_client_id", data.id, { path: "/", sameSite: "lax" });
  }

  return NextResponse.json({ client: data });
}

export async function PATCH(req: Request) {
  const ctx = await getSupabase();
  if (!ctx) return NextResponse.json({ error: "Server configuration error." }, { status: 500 });
  const { supabase } = ctx;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const id = typeof body?.id === "string" ? body.id : "";
  const name = typeof body?.name === "string" ? body.name.trim() : null;
  const website_url =
    typeof body?.website_url === "string" ? body.website_url.trim() : null;
  if (!id) return NextResponse.json({ error: "Missing id." }, { status: 400 });

  const patch: Record<string, unknown> = {};
  if (name !== null) patch.name = name;
  if (website_url !== null) patch.website_url = website_url || null;

  const { data, error } = await supabase
    .from("clients")
    .update(patch)
    .eq("id", id)
    .select("id, name, website_url, created_at")
    .maybeSingle();
  if (error) return NextResponse.json({ error: "Could not update client." }, { status: 500 });

  return NextResponse.json({ client: data ?? null });
}

