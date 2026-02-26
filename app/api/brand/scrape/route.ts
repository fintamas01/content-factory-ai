import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

function normalizeUrl(input: string) {
  let url = input.trim();
  if (!/^https?:\/\//i.test(url)) url = "https://" + url;
  return url;
}

function pickMeta(html: string, property: string) {
  // og:title -> <meta property="og:title" content="...">
  const re1 = new RegExp(
    `<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']+)["']`,
    "i"
  );
  const m1 = html.match(re1);
  if (m1?.[1]) return m1[1].trim();

  // name="description" -> <meta name="description" content="...">
  const re2 = new RegExp(
    `<meta[^>]+name=["']${property}["'][^>]+content=["']([^"']+)["']`,
    "i"
  );
  const m2 = html.match(re2);
  if (m2?.[1]) return m2[1].trim();

  return null;
}

function extractTitle(html: string) {
  const m = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return m?.[1]?.trim() ?? null;
}

function extractFonts(html: string) {
  // nagyon egyszerű: keressünk CSS font-family említést
  // később lehet okosítani
  const matches = [...html.matchAll(/font-family:\s*([^;}{]+)[;}/]/gi)]
    .map(m => m[1].trim())
    .slice(0, 20);

  const cleaned = matches
    .map(s => s.replace(/["']/g, "").split(",")[0].trim())
    .filter(Boolean);

  // fallback
  const headline = cleaned[0] ?? "Inter";
  const body = cleaned[1] ?? cleaned[0] ?? "Inter";

  return { headline, body };
}

function makePaletteSuggestion(html: string) {
  // MVP: ha talál CSS változókat (—primary, —accent), használd, különben fallback.
  const getVar = (name: string) => {
    const re = new RegExp(`--${name}\\s*:\\s*(#[0-9a-fA-F]{3,8})`, "i");
    const m = html.match(re);
    return m?.[1] ?? null;
  };

  const primary = getVar("primary") ?? getVar("color-primary") ?? "#0B1220";
  const secondary = getVar("secondary") ?? getVar("color-secondary") ?? "#0F1B33";
  const accent = getVar("accent") ?? getVar("color-accent") ?? "#7AA2FF";

  return { primary, secondary, accent };
}

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnon =
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
      process.env.NEXT_PUBLIC_SUPABASE_ANNON_KEY;

    if (!supabaseUrl || !supabaseAnon) {
      return NextResponse.json({ error: "Supabase env hiányzik." }, { status: 500 });
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
      return NextResponse.json({ error: "Nincs bejelentkezett user." }, { status: 401 });
    }

    const body = await req.json();
    const websiteInput = body?.website as string;

    if (!websiteInput || typeof websiteInput !== "string") {
      return NextResponse.json({ error: "Hiányzik a website." }, { status: 400 });
    }

    const url = normalizeUrl(websiteInput);

    const resp = await fetch(url, {
      // ne akadjon ki néhány szerver
      headers: {
        "User-Agent": "Mozilla/5.0 (BrandScraper/1.0)",
        "Accept": "text/html,*/*",
      },
      // runtime-ban néha jó, ha nincs cache
      cache: "no-store",
    });

    if (!resp.ok) {
      return NextResponse.json(
        { error: `Nem sikerült letölteni az oldalt (${resp.status}).` },
        { status: 400 }
      );
    }

    const html = await resp.text();

    const name =
      pickMeta(html, "og:site_name") ||
      pickMeta(html, "og:title") ||
      extractTitle(html) ||
      null;

    const desc =
      pickMeta(html, "description") ||
      pickMeta(html, "og:description") ||
      null;

    const fonts = extractFonts(html);
    const palette = makePaletteSuggestion(html);

    // NOTE: logót most direkt nem szedünk le automatikusan
    return NextResponse.json({
      website: url,
      brand_name: name,
      description: desc,
      target_audience: null, // ezt majd UI-ban kérjük / AI-val később
      palette,
      fonts,
      logo_candidates: [], // később: ha akarod
    });
  } catch (e: any) {
    console.error("brand scrape error:", e);
    return NextResponse.json({ error: "Scrape hiba." }, { status: 500 });
  }
}