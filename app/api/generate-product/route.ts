import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { ProductCopyResult } from "@/lib/products/types";
import { fetchUserBrandProfile } from "@/lib/brand-profile/server";
import { enforceUsageLimit } from "@/lib/usage/enforce";
import { incrementUsage } from "@/lib/usage/usage-service";
import { generateProductCopy } from "@/lib/products/generate-product-copy";

export async function POST(req: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OpenAI is not configured." },
        { status: 500 }
      );
    }

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

    const { data: authData } = await supabase.auth.getUser();
    const user = authData?.user;
    if (!user) {
      return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
    }

    const usageDenied = await enforceUsageLimit(supabase, user.id, "product");
    if (usageDenied) return usageDenied;

    const body = await req.json().catch(() => ({}));
    const productName =
      typeof body.productName === "string" ? body.productName.trim() : "";
    if (!productName) {
      return NextResponse.json(
        { error: "Product name is required." },
        { status: 400 }
      );
    }

    const productDetails =
      typeof body.productDetails === "string" ? body.productDetails.trim() : "";
    const targetAudience =
      typeof body.targetAudience === "string" ? body.targetAudience.trim() : "";
    const tone = typeof body.tone === "string" ? body.tone.trim() : "";
    const keyBenefits =
      typeof body.keyBenefits === "string" ? body.keyBenefits.trim() : "";

    const input_data = {
      productDetails: productDetails || undefined,
      targetAudience: targetAudience || undefined,
      tone: tone || undefined,
      keyBenefits: keyBenefits || undefined,
    };

    const unified = await fetchUserBrandProfile(supabase, user.id);
    const gen = await generateProductCopy({
      input: { productName, ...input_data },
      brandProfile: unified,
      openaiApiKey: process.env.OPENAI_API_KEY,
      model: process.env.OPENAI_PRODUCT_MODEL ?? "gpt-4o-mini",
    });
    if (!gen.ok) return NextResponse.json({ error: gen.error }, { status: 502 });

    const result: ProductCopyResult = gen.result;

    let savedId: string | null = null;
    const { data: inserted, error: insertErr } = await supabase
      .from("product_generations")
      .insert({
        user_id: user.id,
        product_name: productName,
        input_data,
        output_data: result,
      })
      .select("id")
      .single();

    if (insertErr) {
      console.error("product_generations insert:", insertErr);
    } else if (inserted?.id) {
      savedId = inserted.id;
    }

    await incrementUsage(supabase, "product");

    return NextResponse.json({ result, savedId });
  } catch (e) {
    console.error("generate-product:", e);
    return NextResponse.json(
      { error: "Unexpected server error." },
      { status: 500 }
    );
  }
}
