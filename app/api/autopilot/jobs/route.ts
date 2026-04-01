import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

async function getSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnon =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANNON_KEY;
  if (!supabaseUrl || !supabaseAnon) return null;
  const cookieStore = await cookies();
  return createServerClient(supabaseUrl, supabaseAnon, {
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
}

export async function GET() {
  const supabase = await getSupabase();
  if (!supabase) {
    return NextResponse.json({ error: "Server configuration error." }, { status: 500 });
  }
  const { data: auth } = await supabase.auth.getUser();
  const user = auth?.user;
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const { data, error } = await supabase
    .from("autopilot_jobs")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: "Failed to load jobs." }, { status: 500 });
  return NextResponse.json({ jobs: data ?? [] });
}

export async function POST(req: Request) {
  const supabase = await getSupabase();
  if (!supabase) {
    return NextResponse.json({ error: "Server configuration error." }, { status: 500 });
  }
  const { data: auth } = await supabase.auth.getUser();
  const user = auth?.user;
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const url = typeof body?.url === "string" ? body.url.trim() : "";
  const competitors = Array.isArray(body?.competitors)
    ? (body.competitors as unknown[]).filter((x): x is string => typeof x === "string").map((s) => s.trim()).filter(Boolean).slice(0, 3)
    : [];
  const frequency = typeof body?.frequency === "string" ? body.frequency : "weekly";
  const focus = Array.isArray(body?.focus)
    ? (body.focus as unknown[]).filter((x): x is string => typeof x === "string").map((s) => s.trim()).filter(Boolean)
    : [];
  const enabled = body?.enabled === false ? false : true;

  if (!url) return NextResponse.json({ error: "Missing url." }, { status: 400 });
  if (frequency !== "weekly") {
    return NextResponse.json({ error: "Only weekly frequency is supported in MVP." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("autopilot_jobs")
    .insert({
      user_id: user.id,
      url,
      competitors,
      frequency,
      focus,
      enabled,
    })
    .select("*")
    .maybeSingle();
  if (error) return NextResponse.json({ error: "Could not create job." }, { status: 500 });
  return NextResponse.json({ job: data });
}

export async function PATCH(req: Request) {
  const supabase = await getSupabase();
  if (!supabase) {
    return NextResponse.json({ error: "Server configuration error." }, { status: 500 });
  }
  const { data: auth } = await supabase.auth.getUser();
  const user = auth?.user;
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const id = typeof body?.id === "string" ? body.id : null;
  if (!id) return NextResponse.json({ error: "Missing id." }, { status: 400 });

  const patch: Record<string, unknown> = {};
  if (typeof body?.enabled === "boolean") patch.enabled = body.enabled;
  if (typeof body?.url === "string") patch.url = body.url.trim();
  if (Array.isArray(body?.competitors)) {
    patch.competitors = (body.competitors as unknown[])
      .filter((x): x is string => typeof x === "string")
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 3);
  }
  if (typeof body?.frequency === "string") {
    if (body.frequency !== "weekly") {
      return NextResponse.json({ error: "Only weekly frequency is supported in MVP." }, { status: 400 });
    }
    patch.frequency = body.frequency;
  }
  if (Array.isArray(body?.focus)) {
    patch.focus = (body.focus as unknown[])
      .filter((x): x is string => typeof x === "string")
      .map((s) => s.trim())
      .filter(Boolean);
  }

  const { data, error } = await supabase
    .from("autopilot_jobs")
    .update(patch)
    .eq("id", id)
    .eq("user_id", user.id)
    .select("*")
    .maybeSingle();
  if (error) return NextResponse.json({ error: "Could not update job." }, { status: 500 });
  return NextResponse.json({ job: data });
}

export async function DELETE(req: Request) {
  const supabase = await getSupabase();
  if (!supabase) {
    return NextResponse.json({ error: "Server configuration error." }, { status: 500 });
  }
  const { data: auth } = await supabase.auth.getUser();
  const user = auth?.user;
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const id = typeof body?.id === "string" ? body.id : null;
  if (!id) return NextResponse.json({ error: "Missing id." }, { status: 400 });

  const { error } = await supabase
    .from("autopilot_jobs")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) return NextResponse.json({ error: "Could not delete." }, { status: 500 });
  return NextResponse.json({ ok: true });
}

