import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { requireActiveClientId } from "@/lib/clients/server";
import { canRemoveMember, parseClientRole } from "@/lib/clients/roles";

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

/** DELETE: remove member or leave workspace (body: { userId }). */
export async function DELETE(req: Request) {
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

  const body = await req.json().catch(() => ({}));
  const targetUserId = typeof body?.userId === "string" ? body.userId : "";
  if (!targetUserId) return NextResponse.json({ error: "Missing userId." }, { status: 400 });

  const { data: actorRow } = await supabase
    .from("client_members")
    .select("role")
    .eq("client_id", clientId)
    .eq("user_id", user.id)
    .maybeSingle();

  const actorRole = parseClientRole(actorRow?.role as string | undefined);
  if (!actorRole) return NextResponse.json({ error: "Forbidden." }, { status: 403 });

  const { data: targetRow } = await supabase
    .from("client_members")
    .select("role")
    .eq("client_id", clientId)
    .eq("user_id", targetUserId)
    .maybeSingle();

  const targetRole = parseClientRole(targetRow?.role as string | undefined);
  if (!targetRow || !targetRole) {
    return NextResponse.json({ error: "Member not found." }, { status: 404 });
  }

  const self = targetUserId === user.id;
  if (!self && !canRemoveMember(actorRole, targetRole)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  if (self && actorRole === "owner") {
    const { count } = await supabase
      .from("client_members")
      .select("*", { count: "exact", head: true })
      .eq("client_id", clientId)
      .eq("role", "owner");
    if ((count ?? 0) <= 1) {
      return NextResponse.json(
        { error: "Transfer ownership or add another owner before leaving." },
        { status: 400 }
      );
    }
  }

  const { error } = await supabase
    .from("client_members")
    .delete()
    .eq("client_id", clientId)
    .eq("user_id", targetUserId);

  if (error) {
    return NextResponse.json({ error: "Could not remove member." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
