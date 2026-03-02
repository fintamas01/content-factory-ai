import { NextResponse } from "next/server";
import { patchBundleToUnifiedDiff, type PatchFile } from "@/lib/diff/unifiedDiff";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return badRequest("Invalid JSON body.");

    const files = Array.isArray((body as any).files) ? ((body as any).files as PatchFile[]) : [];
    if (!files.length) return badRequest("Missing 'files' array.");

    const normalized = files
      .map((f) => ({
        path: String((f as any)?.path ?? "").trim(),
        before: typeof (f as any)?.before === "string" ? (f as any).before : undefined,
        after: String((f as any)?.after ?? ""),
      }))
      .filter((f) => f.path);

    if (!normalized.length) return badRequest("No valid files.");

    const unified = patchBundleToUnifiedDiff(normalized);

    return NextResponse.json({
      files: normalized.map((f) => ({
        path: f.path,
        hasBefore: Boolean(f.before),
        afterBytes: Buffer.byteLength(f.after, "utf8"),
      })),
      unifiedDiff: unified,
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: "Patch diff failed.", details: String(e?.message ?? e) },
      { status: 500 }
    );
  }
}