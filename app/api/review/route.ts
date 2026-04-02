import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { requireActiveClientId } from "@/lib/clients/server";
import type { ReviewModule, ReviewStatus } from "@/lib/review/types";
import { notifyReviewSubmitted } from "@/lib/review/notify";

const MODULES: ReviewModule[] = ["content", "products", "site_audit", "playbooks", "matrix"];
const STATUSES: ReviewStatus[] = ["draft", "in_review", "approved", "applied"];

const MAX_PAYLOAD_CHARS = 450_000;

function getEnv() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnon =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANNON_KEY;
  return { supabaseUrl, supabaseAnon };
}

function parseModule(raw: string | null): ReviewModule | null {
  if (!raw) return null;
  return MODULES.includes(raw as ReviewModule) ? (raw as ReviewModule) : null;
}

export async function GET(req: Request) {
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

    const url = new URL(req.url);
    const moduleFilter = parseModule(url.searchParams.get("module"));
    const statusParam = url.searchParams.get("status");
    const limitRaw = url.searchParams.get("limit");
    const limit = Math.min(100, Math.max(1, Number(limitRaw) || 40));

    let q = supabase
      .from("review_items")
      .select("*")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (moduleFilter) q = q.eq("module", moduleFilter);
    if (statusParam) {
      const parts = statusParam.split(",").map((s) => s.trim()) as ReviewStatus[];
      const ok = parts.filter((p) => STATUSES.includes(p));
      if (ok.length === 1) q = q.eq("status", ok[0]);
      else if (ok.length > 1) q = q.in("status", ok);
    }

    const { data, error } = await q;
    if (error) {
      console.error("review list:", error);
      return NextResponse.json({ error: "Failed to load review queue." }, { status: 500 });
    }

    return NextResponse.json({ items: data ?? [], viewerId: user.id });
  } catch (e) {
    console.error("GET /api/review:", e);
    return NextResponse.json({ error: "Unexpected server error." }, { status: 500 });
  }
}

export async function POST(req: Request) {
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

    const body = (await req.json().catch(() => null)) as {
      module?: string;
      title?: string;
      summary?: string;
      payload?: unknown;
      status?: string;
    } | null;

    const module = parseModule(typeof body?.module === "string" ? body.module : null);
    if (!module) {
      return NextResponse.json({ error: "Invalid module." }, { status: 400 });
    }

    const title = typeof body?.title === "string" ? body.title.trim() : "";
    if (!title || title.length > 500) {
      return NextResponse.json({ error: "Title is required (max 500 chars)." }, { status: 400 });
    }

    const summary =
      typeof body?.summary === "string" ? body.summary.trim().slice(0, 2000) : null;

    const statusRaw = typeof body?.status === "string" ? body.status : "in_review";
    const status: ReviewStatus =
      statusRaw === "draft" || statusRaw === "in_review" ? statusRaw : "in_review";

    const payload =
      body?.payload && typeof body.payload === "object" ? (body.payload as Record<string, unknown>) : {};
    const raw = JSON.stringify(payload);
    if (raw.length > MAX_PAYLOAD_CHARS) {
      return NextResponse.json({ error: "Payload too large." }, { status: 400 });
    }

    const { data: inserted, error } = await supabase
      .from("review_items")
      .insert({
        client_id: clientId,
        user_id: user.id,
        module,
        status,
        title,
        summary,
        payload,
      })
      .select("*")
      .single();

    if (error || !inserted) {
      console.error("review insert:", error);
      return NextResponse.json({ error: "Could not create review item." }, { status: 500 });
    }

    if (status === "in_review") {
      await notifyReviewSubmitted({
        clientId,
        reviewItemId: inserted.id as string,
        title,
        module,
        actorUserId: user.id,
      });
    }

    return NextResponse.json({ item: inserted });
  } catch (e) {
    console.error("POST /api/review:", e);
    return NextResponse.json({ error: "Unexpected server error." }, { status: 500 });
  }
}
