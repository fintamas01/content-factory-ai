import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { requireActiveClientId } from "@/lib/clients/server";
import { notifyReviewDecision, notifyReviewSubmitted } from "@/lib/review/notify";
import type { ReviewPatchAction } from "@/lib/review/types";
import {
  fetchClientRole,
  fetchReviewItemAdmin,
  planReviewTransition,
  updateReviewItemAdmin,
} from "@/lib/review/server";

function getEnv() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnon =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANNON_KEY;
  return { supabaseUrl, supabaseAnon };
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { supabaseUrl, supabaseAnon } = getEnv();
    if (!supabaseUrl || !supabaseAnon) {
      return NextResponse.json({ error: "Server configuration error." }, { status: 500 });
    }
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
    if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

    let clientId: string;
    try {
      const active = await requireActiveClientId(supabase, cookieStore, user.id);
      clientId = active.clientId;
    } catch {
      return NextResponse.json({ error: "No active client." }, { status: 400 });
    }

    const { id } = await ctx.params;
    if (!id) return NextResponse.json({ error: "Missing id." }, { status: 400 });

    const { data, error } = await supabase
      .from("review_items")
      .select("*")
      .eq("id", id)
      .eq("client_id", clientId)
      .maybeSingle();

    if (error || !data) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    return NextResponse.json({ item: data });
  } catch (e) {
    console.error("GET /api/review/[id]:", e);
    return NextResponse.json({ error: "Unexpected server error." }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: "Server misconfigured." }, { status: 500 });
    }

    const { supabaseUrl, supabaseAnon } = getEnv();
    if (!supabaseUrl || !supabaseAnon) {
      return NextResponse.json({ error: "Server configuration error." }, { status: 500 });
    }
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
    if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

    let clientId: string;
    try {
      const active = await requireActiveClientId(supabase, cookieStore, user.id);
      clientId = active.clientId;
    } catch {
      return NextResponse.json({ error: "No active client." }, { status: 400 });
    }

    const { id } = await ctx.params;
    if (!id) return NextResponse.json({ error: "Missing id." }, { status: 400 });

    const body = (await req.json().catch(() => null)) as { action?: string } | null;
    const action = body?.action as ReviewPatchAction | undefined;
    if (action !== "submit" && action !== "approve" && action !== "reject" && action !== "apply") {
      return NextResponse.json({ error: "Invalid action." }, { status: 400 });
    }

    const row = await fetchReviewItemAdmin(id);
    if (!row || row.client_id !== clientId) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    const role = await fetchClientRole(supabase, clientId, user.id);
    const planned = planReviewTransition({
      action,
      role,
      row,
      actorId: user.id,
    });

    if (!planned.ok) {
      return NextResponse.json({ error: planned.error }, { status: planned.status });
    }

    const now = new Date().toISOString();
    const patch: Record<string, unknown> = { status: planned.nextStatus };

    if (action === "approve" || action === "reject") {
      patch.reviewed_by = user.id;
      patch.reviewed_at = now;
    }
    if (action === "apply") {
      patch.applied_by = user.id;
      patch.applied_at = now;
    }

    const { error: upErr } = await updateReviewItemAdmin(id, patch);
    if (upErr) {
      console.error("review patch:", upErr);
      return NextResponse.json({ error: "Could not update review item." }, { status: 500 });
    }

    const updated = await fetchReviewItemAdmin(id);
    if (!updated) {
      return NextResponse.json({ error: "Could not load updated item." }, { status: 500 });
    }

    if (action === "submit" && planned.nextStatus === "in_review") {
      await notifyReviewSubmitted({
        clientId,
        reviewItemId: id,
        title: row.title,
        module: row.module,
        actorUserId: user.id,
      });
    }

    if (action === "approve") {
      await notifyReviewDecision({
        clientId,
        reviewItemId: id,
        title: row.title,
        kind: "approved",
        targetUserId: row.user_id,
      });
    }
    if (action === "reject") {
      await notifyReviewDecision({
        clientId,
        reviewItemId: id,
        title: row.title,
        kind: "rejected",
        targetUserId: row.user_id,
      });
    }
    if (action === "apply") {
      await notifyReviewDecision({
        clientId,
        reviewItemId: id,
        title: row.title,
        kind: "applied",
        targetUserId: row.user_id,
      });
    }

    return NextResponse.json({ item: updated });
  } catch (e) {
    console.error("PATCH /api/review/[id]:", e);
    return NextResponse.json({ error: "Unexpected server error." }, { status: 500 });
  }
}
