import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { requireAuthenticatedClient } from "@/lib/usage/require-session-usage";
import { requireFeatureAccess } from "@/lib/entitlements/api";

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json(
        { error: "Server configuration error." },
        { status: 500 }
      );
    }

    // 🔥 ADMIN CLIENT (megkerüli RLS-t)
    const supabaseAdmin = createClient(supabaseUrl, serviceKey);

    const gate = await requireAuthenticatedClient();
    if (!gate.ok) return gate.response;
    const denied = await requireFeatureAccess({
      supabase: gate.supabase,
      userId: gate.user.id,
      featureKey: "posterStudio",
    });
    if (denied) return denied;

    const form = await req.formData();
    const file = form.get("file");

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "Missing file." }, { status: 400 });
    }

    // ✅ háttérkép lehet nagyobb
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: "Max file size is 10MB." }, { status: 400 });
    }

    const allowed = ["image/png", "image/jpeg", "image/webp"];
    if (!allowed.includes(file.type)) {
      return NextResponse.json(
        { error: "Only PNG/JPG/WEBP are allowed." },
        { status: 400 }
      );
    }

    const ext =
      file.type === "image/png"
        ? "png"
        : file.type === "image/webp"
        ? "webp"
        : "jpg";

    // ✅ külön mappa háttérképeknek
    const path = `poster-bg/${Date.now()}.${ext}`;

    const arrayBuffer = await file.arrayBuffer();

    const { error: uploadErr } = await supabaseAdmin.storage
      .from("brand-assets")
      .upload(path, arrayBuffer, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadErr) {
      console.error("Upload error:", uploadErr);
      return NextResponse.json({ error: "Upload failed." }, { status: 500 });
    }

    // ✅ Signed URL
    const { data: signed, error: signErr } = await supabaseAdmin.storage
      .from("brand-assets")
      .createSignedUrl(path, 60 * 60);

    if (signErr || !signed?.signedUrl) {
      console.error("Signed url error:", signErr);
      return NextResponse.json({ error: "Could not create signed URL." }, { status: 500 });
    }

    return NextResponse.json({
      path,
      url: signed.signedUrl,
    });
  } catch (e) {
    console.error("upload-image hiba:", e);
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}