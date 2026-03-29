import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  mapAuditRow,
  mapContentRow,
  mapMatrixRow,
  mapProductRow,
  mergeAndSort,
} from "@/lib/history/map-rows";
import type { HistoryKind } from "@/lib/history/types";

const LIMIT = 120;

export async function GET() {
  try {
    const cookieStore = await cookies();
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnon =
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
      process.env.NEXT_PUBLIC_SUPABASE_ANNON_KEY;

    if (!supabaseUrl || !supabaseAnon) {
      return NextResponse.json(
        { error: "Server configuration error." },
        { status: 500 }
      );
    }

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
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [genRes, prodRes, auditRes, matrixRes] = await Promise.all([
      supabase
        .from("generations")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(LIMIT),
      supabase
        .from("product_generations")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(LIMIT),
      supabase
        .from("site_audit_runs")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(LIMIT),
      supabase
        .from("matrix_generations")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(LIMIT),
    ]);

    if (genRes.error) console.error("history generations:", genRes.error);
    if (prodRes.error) console.error("history product_generations:", prodRes.error);
    if (auditRes.error) console.error("history site_audit_runs:", auditRes.error);
    if (matrixRes.error) console.error("history matrix_generations:", matrixRes.error);

    const items = mergeAndSort([
      ...(genRes.data ?? []).map((r) => mapContentRow(r as Record<string, unknown>)),
      ...(prodRes.data ?? []).map((r) => mapProductRow(r as Record<string, unknown>)),
      ...(auditRes.data ?? []).map((r) => mapAuditRow(r as Record<string, unknown>)),
      ...(matrixRes.data ?? []).map((r) => mapMatrixRow(r as Record<string, unknown>)),
    ]);

    return NextResponse.json({ items });
  } catch (e) {
    console.error("GET /api/history:", e);
    return NextResponse.json(
      { error: "Unexpected server error." },
      { status: 500 }
    );
  }
}

function isKind(v: unknown): v is HistoryKind {
  return (
    v === "content" ||
    v === "product" ||
    v === "audit" ||
    v === "matrix"
  );
}

export async function DELETE(req: Request) {
  try {
    const cookieStore = await cookies();
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnon =
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
      process.env.NEXT_PUBLIC_SUPABASE_ANNON_KEY;

    if (!supabaseUrl || !supabaseAnon) {
      return NextResponse.json(
        { error: "Server configuration error." },
        { status: 500 }
      );
    }

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
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const id = typeof body.id === "string" ? body.id : "";
    const kind = body.kind;
    if (!id || !isKind(kind)) {
      return NextResponse.json(
        { error: "Invalid id or kind." },
        { status: 400 }
      );
    }

    const table =
      kind === "content"
        ? "generations"
        : kind === "product"
          ? "product_generations"
          : kind === "audit"
            ? "site_audit_runs"
            : "matrix_generations";

    const { error } = await supabase.from(table).delete().eq("id", id);

    if (error) {
      console.error("history delete:", error);
      return NextResponse.json(
        { error: "Could not delete item." },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("DELETE /api/history:", e);
    return NextResponse.json(
      { error: "Unexpected server error." },
      { status: 500 }
    );
  }
}
