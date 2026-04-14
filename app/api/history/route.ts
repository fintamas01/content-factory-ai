import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  mapAuditRow,
  mapContentRow,
  mapAdCreativeRow,
  mapMatrixRow,
  mapProductRow,
  mergeAndSort,
} from "@/lib/history/map-rows";
import { requireActiveClientId } from "@/lib/clients/server";
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

    let clientId: string;
    try {
      const active = await requireActiveClientId(supabase, cookieStore, user.id);
      clientId = active.clientId;
    } catch {
      return NextResponse.json({ error: "No active client." }, { status: 400 });
    }

    const [genRes, prodRes, auditRes, matrixRes, adCreativeRes] = await Promise.all([
      supabase
        .from("generations")
        .select("*")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false })
        .limit(LIMIT),
      supabase
        .from("product_generations")
        .select("*")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false })
        .limit(LIMIT),
      supabase
        .from("site_audit_runs")
        .select("*")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false })
        .limit(LIMIT),
      supabase
        .from("matrix_generations")
        .select("*")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false })
        .limit(LIMIT),
      supabase
        .from("ad_creative_generations")
        .select("*")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false })
        .limit(LIMIT),
    ]);

    const errors: Array<{ table: string; message: string; code?: string }> = [];
    if (genRes.error) {
      console.error("history generations:", genRes.error);
      errors.push({
        table: "generations",
        message: genRes.error.message,
        code: (genRes.error as any).code,
      });
    }
    if (prodRes.error) {
      console.error("history product_generations:", prodRes.error);
      errors.push({
        table: "product_generations",
        message: prodRes.error.message,
        code: (prodRes.error as any).code,
      });
    }
    if (auditRes.error) {
      console.error("history site_audit_runs:", auditRes.error);
      errors.push({
        table: "site_audit_runs",
        message: auditRes.error.message,
        code: (auditRes.error as any).code,
      });
    }
    if (matrixRes.error) {
      console.error("history matrix_generations:", matrixRes.error);
      errors.push({
        table: "matrix_generations",
        message: matrixRes.error.message,
        code: (matrixRes.error as any).code,
      });
    }
    if (adCreativeRes.error) {
      console.error("history ad_creative_generations:", adCreativeRes.error);
      errors.push({
        table: "ad_creative_generations",
        message: adCreativeRes.error.message,
        code: (adCreativeRes.error as any).code,
      });
    }

    const items = mergeAndSort([
      ...(genRes.data ?? []).map((r) => mapContentRow(r as Record<string, unknown>)),
      ...(prodRes.data ?? []).map((r) => mapProductRow(r as Record<string, unknown>)),
      ...(auditRes.data ?? []).map((r) => mapAuditRow(r as Record<string, unknown>)),
      ...(matrixRes.data ?? []).map((r) => mapMatrixRow(r as Record<string, unknown>)),
      ...(adCreativeRes.data ?? []).map((r) =>
        mapAdCreativeRow(r as Record<string, unknown>)
      ),
    ]);

    return NextResponse.json({ items, errors: errors.length ? errors : undefined });
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
    v === "matrix" ||
    v === "adCreative"
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
            : kind === "matrix"
              ? "matrix_generations"
              : "ad_creative_generations";

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
