import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json(
        { error: "Supabase service role key hiányzik." },
        { status: 500 }
      );
    }

    // 🔥 ADMIN CLIENT (megkerüli RLS-t)
    const supabaseAdmin = createClient(supabaseUrl, serviceKey);

    const form = await req.formData();
    const file = form.get("file");

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "Hiányzik a file." }, { status: 400 });
    }

    if (file.size > 2 * 1024 * 1024) {
      return NextResponse.json({ error: "Max 2MB fájl." }, { status: 400 });
    }

    const allowed = ["image/png", "image/jpeg", "image/webp"];
    if (!allowed.includes(file.type)) {
      return NextResponse.json(
        { error: "Csak PNG/JPG/WEBP engedélyezett." },
        { status: 400 }
      );
    }

    const ext =
      file.type === "image/png"
        ? "png"
        : file.type === "image/webp"
        ? "webp"
        : "jpg";

    const path = `logos/${Date.now()}.${ext}`;

    const arrayBuffer = await file.arrayBuffer();

    const { error: uploadErr } = await supabaseAdmin.storage
      .from("brand-assets")
      .upload(path, arrayBuffer, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadErr) {
      console.error("Upload error:", uploadErr);
      return NextResponse.json({ error: "Upload hiba." }, { status: 500 });
    }

    // Signed URL
    const { data: signed, error: signErr } =
      await supabaseAdmin.storage
        .from("brand-assets")
        .createSignedUrl(path, 60 * 60);

    if (signErr || !signed?.signedUrl) {
      console.error("Signed url error:", signErr);
      return NextResponse.json(
        { error: "Signed URL hiba." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      path,
      url: signed.signedUrl,
    });
  } catch (e) {
    console.error("upload-logo hiba:", e);
    return NextResponse.json({ error: "Szerver hiba." }, { status: 500 });
  }
}