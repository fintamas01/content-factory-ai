import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { requireActiveClientId } from "@/lib/clients/server";
import { requireFeatureAccess } from "@/lib/entitlements/api";

async function getRouteCtx() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnon =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANNON_KEY;
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

export async function GET(req: Request) {
  const ctx = await getRouteCtx();
  if (!ctx) {
    return NextResponse.json({ error: "Server configuration error." }, { status: 500 });
  }
  const { supabase, cookieStore } = ctx;
  const { data: auth } = await supabase.auth.getUser();
  const user = auth?.user;
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const denied = await requireFeatureAccess({
    supabase,
    userId: user.id,
    featureKey: "autopilot",
  });
  if (denied) return denied;

  let clientId: string;
  try {
    const active = await requireActiveClientId(supabase, cookieStore, user.id);
    clientId = active.clientId;
  } catch {
    return NextResponse.json({ error: "No active client." }, { status: 400 });
  }

  const { searchParams } = new URL(req.url);
  const jobId = searchParams.get("jobId");
  const limit = Math.min(50, Math.max(1, Number(searchParams.get("limit") ?? 20)));

  let q = supabase
    .from("autopilot_results")
    .select("*")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (jobId) q = q.eq("job_id", jobId);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: "Failed to load results." }, { status: 500 });
  return NextResponse.json({ results: data ?? [] });
}
