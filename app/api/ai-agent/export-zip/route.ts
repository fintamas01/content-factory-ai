import { NextResponse } from "next/server";
import JSZip from "jszip";
import { incrementUsage } from "@/lib/usage/usage-service";
import { requireSessionClientAndUsageAllowance } from "@/lib/usage/require-session-usage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

function sanitizePath(p: string) {
  // prevent zip-slip + weird paths
  let s = String(p ?? "").trim();
  s = s.replace(/^(\.\.(\/|\\))+/, "");
  s = s.replace(/^\/+/, "");
  s = s.replace(/\\/g, "/");
  s = s.replace(/\/{2,}/g, "/");
  if (!s) s = "file.txt";
  return s;
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return badRequest("Invalid JSON body.");

    const files = Array.isArray((body as any).files) ? (body as any).files : [];
    if (!Array.isArray(files) || files.length === 0) return badRequest("Missing 'files' array.");

    const zipNameRaw = typeof (body as any).zipName === "string" ? (body as any).zipName : "patch";
    const zipName = zipNameRaw.replace(/[^a-zA-Z0-9_-]+/g, "-").slice(0, 60) || "patch";

    const gate = await requireSessionClientAndUsageAllowance("content");
    if (!gate.ok) return gate.response;
    const { supabase, clientId } = gate;

    const zip = new JSZip();

    for (const f of files) {
      const path = sanitizePath(f?.path);
      const content = typeof f?.content === "string" ? f.content : String(f?.content ?? "");
      zip.file(path, content);
    }

    // Node buffer from jszip
    const buffer = await zip.generateAsync({ type: "nodebuffer" });

    await incrementUsage(supabase, "content", clientId);

    // ✅ Convert Buffer -> Uint8Array so TS is happy with BodyInit
    const bodyBytes = new Uint8Array(buffer);

    // ✅ Use standard Response for binary payloads
    return new Response(bodyBytes, {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${zipName}.zip"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: "ZIP export failed.", details: String(e?.message ?? e) },
      { status: 500 }
    );
  }
}