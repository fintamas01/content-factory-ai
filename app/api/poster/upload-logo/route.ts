import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANNON_KEY;

    if (!supabaseUrl || !supabaseAnon) {
      return NextResponse.json(
        { error: "Supabase env hiányzik (URL/ANON KEY)." },
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
          } catch {}
        },
      },
    });

    const { data: authData } = await supabase.auth.getUser();
    const user = authData?.user;

    if (!user) {
      return NextResponse.json({ error: "Nincs bejelentkezve." }, { status: 401 });
    }

    const form = await req.formData();
    const file = form.get("file");

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "Hiányzik a file." }, { status: 400 });
    }

    // Alap validáció
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

    const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
    const path = `logos/${user.id}/${Date.now()}.${ext}`;

    const arrayBuffer = await file.arrayBuffer();
    const { error: uploadErr } = await supabase.storage
      .from("brand-assets")
      .upload(path, arrayBuffer, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadErr) {
      console.error("Upload error:", uploadErr);
      return NextResponse.json({ error: "Upload hiba." }, { status: 500 });
    }

    // Signed URL (private buckethez)
    const { data: signed, error: signErr } = await supabase.storage
      .from("brand-assets")
      .createSignedUrl(path, 60 * 60); // 1 óra

    if (signErr || !signed?.signedUrl) {
      console.error("Signed url error:", signErr);
      return NextResponse.json({ error: "Signed URL hiba." }, { status: 500 });
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