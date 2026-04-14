import { NextResponse } from "next/server";
import { requireAuthenticatedClient } from "@/lib/usage/require-session-usage";
import { requireFeatureAccess } from "@/lib/entitlements/api";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function POST(req: Request) {
  try {
    const gate = await requireAuthenticatedClient();
    if (!gate.ok) return gate.response;

    const denied = await requireFeatureAccess({
      supabase: gate.supabase,
      userId: gate.user.id,
      featureKey: "adCreativeStudio",
    });
    if (denied) return denied;

    const form = await req.formData();
    const file = form.get("file");
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "Missing file." }, { status: 400 });
    }

    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: "Max file size is 10MB." }, { status: 400 });
    }
    const allowed = ["image/png", "image/jpeg", "image/webp"];
    if (!allowed.includes(file.type)) {
      return NextResponse.json({ error: "Only PNG/JPG/WEBP are allowed." }, { status: 400 });
    }

    const ext =
      file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";

    const path = `ad-creative-refs/${gate.clientId}/${gate.user.id}/${Date.now()}.${ext}`;
    const arrayBuffer = await file.arrayBuffer();

    const { error: uploadErr } = await supabaseAdmin.storage
      .from("brand-assets")
      .upload(path, arrayBuffer, { contentType: file.type, upsert: true });

    if (uploadErr) {
      console.error("ad-creative upload-image:", uploadErr);
      return NextResponse.json({ error: "Upload failed." }, { status: 500 });
    }

    const { data: signed, error: signErr } = await supabaseAdmin.storage
      .from("brand-assets")
      .createSignedUrl(path, 60 * 60);

    if (signErr || !signed?.signedUrl) {
      console.error("ad-creative signed url:", signErr);
      return NextResponse.json({ error: "Could not create signed URL." }, { status: 500 });
    }

    return NextResponse.json({ path, url: signed.signedUrl });
  } catch (e) {
    console.error("ad-creative upload-image:", e);
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}

