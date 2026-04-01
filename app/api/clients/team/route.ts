import { randomBytes } from "crypto";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { requireActiveClientId } from "@/lib/clients/server";
import { canInvite, parseClientRole } from "@/lib/clients/roles";
import { supabaseAdmin } from "@/lib/supabase/admin";

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

async function emailsForUserIds(ids: string[]): Promise<Map<string, string | null>> {
  const map = new Map<string, string | null>();
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    for (const id of ids) map.set(id, null);
    return map;
  }
  await Promise.all(
    ids.map(async (id) => {
      const { data, error } = await supabaseAdmin.auth.admin.getUserById(id);
      if (error || !data.user) {
        map.set(id, null);
        return;
      }
      map.set(id, data.user.email ?? null);
    })
  );
  return map;
}

/** GET: members + pending invites for active client. */
export async function GET() {
  const ctx = await getSupabase();
  if (!ctx) return NextResponse.json({ error: "Server configuration error." }, { status: 500 });
  const { supabase, cookieStore } = ctx;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  let active: Awaited<ReturnType<typeof requireActiveClientId>>;
  try {
    active = await requireActiveClientId(supabase, cookieStore, user.id);
  } catch {
    return NextResponse.json({ error: "No active client." }, { status: 400 });
  }

  const clientId = active.clientId;

  const { data: roleRow } = await supabase
    .from("client_members")
    .select("role")
    .eq("client_id", clientId)
    .eq("user_id", user.id)
    .maybeSingle();

  const myRole = parseClientRole(roleRow?.role as string | undefined);
  if (!myRole) return NextResponse.json({ error: "Forbidden." }, { status: 403 });

  const { data: members, error: memErr } = await supabase
    .from("client_members")
    .select("id, user_id, role, created_at")
    .eq("client_id", clientId)
    .order("created_at", { ascending: true });

  if (memErr) {
    return NextResponse.json({ error: "Failed to load members." }, { status: 500 });
  }

  const userIds = (members ?? []).map((m) => m.user_id);
  const emails = await emailsForUserIds(userIds);

  const memberList = (members ?? []).map((m) => ({
    id: m.id,
    userId: m.user_id,
    role: m.role,
    email: emails.get(m.user_id) ?? null,
    createdAt: m.created_at,
    isYou: m.user_id === user.id,
  }));

  let invites: Array<{
    id: string;
    email: string;
    role: string;
    status: string;
    token: string;
    createdAt: string;
  }> = [];

  if (canInvite(myRole)) {
    const { data: inv, error: invErr } = await supabase
      .from("client_invites")
      .select("id, email, role, status, token, created_at")
      .eq("client_id", clientId)
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    if (!invErr && inv) {
      invites = inv.map((r) => ({
        id: r.id,
        email: r.email,
        role: r.role,
        status: r.status,
        token: r.token,
        createdAt: r.created_at,
      }));
    }
  }

  return NextResponse.json({
    clientId,
    myRole,
    members: memberList,
    invites,
  });
}

/** POST: create pending invite (owner/admin). */
export async function POST(req: Request) {
  const ctx = await getSupabase();
  if (!ctx) return NextResponse.json({ error: "Server configuration error." }, { status: 500 });
  const { supabase, cookieStore } = ctx;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  let active: Awaited<ReturnType<typeof requireActiveClientId>>;
  try {
    active = await requireActiveClientId(supabase, cookieStore, user.id);
  } catch {
    return NextResponse.json({ error: "No active client." }, { status: 400 });
  }

  const clientId = active.clientId;

  const { data: roleRow } = await supabase
    .from("client_members")
    .select("role")
    .eq("client_id", clientId)
    .eq("user_id", user.id)
    .maybeSingle();

  const myRole = parseClientRole(roleRow?.role as string | undefined);
  if (!myRole || !canInvite(myRole)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const emailRaw = typeof body?.email === "string" ? body.email.trim() : "";
  const roleIn = typeof body?.role === "string" ? body.role.trim() : "member";
  if (!emailRaw || !emailRaw.includes("@")) {
    return NextResponse.json({ error: "Valid email is required." }, { status: 400 });
  }
  if (roleIn !== "admin" && roleIn !== "member") {
    return NextResponse.json({ error: "Role must be admin or member." }, { status: 400 });
  }

  const token = randomBytes(32).toString("hex");

  const { data: inv, error } = await supabase
    .from("client_invites")
    .insert({
      client_id: clientId,
      email: emailRaw,
      role: roleIn,
      token,
      status: "pending",
    })
    .select("id, email, role, status, token, created_at")
    .single();

  if (error) {
    const msg = error.message?.includes("unique") || error.code === "23505"
      ? "An invite for this email already exists."
      : "Could not create invite.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  return NextResponse.json({
    invite: inv
      ? {
          id: inv.id,
          email: inv.email,
          role: inv.role,
          status: inv.status,
          token: inv.token,
          createdAt: inv.created_at,
        }
      : null,
  });
}
