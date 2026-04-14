import { NextResponse } from "next/server";
import { requireAuthenticatedClient } from "@/lib/usage/require-session-usage";
import { supabaseAdmin } from "@/lib/supabase/admin";

const LIMIT = 24;

export async function GET() {
  try {
    const gate = await requireAuthenticatedClient();
    if (!gate.ok) return gate.response;
    const { supabase, user, clientId } = gate;

    const { data, error } = await supabase
      .from("ad_creative_generations")
      .select(
        "id,created_at,title,product_name,brand_name,language,aspect_ratios,status,error_message,generated_copy,generated_concepts,generated_assets"
      )
      .eq("client_id", clientId)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(LIMIT);

    if (error) {
      console.error("GET /api/ad-creative/history:", error);
      return NextResponse.json(
        { error: "Could not load history." },
        { status: 500 }
      );
    }

    const items = await Promise.all(
      (data ?? []).map(async (row: any) => {
        const assets = row?.generated_assets;
        const list = Array.isArray(assets?.items) ? (assets.items as any[]) : [];
        const signedItems = await Promise.all(
          list.map(async (it: any) => {
            if (it?.status !== "succeeded") return it;

            if (it?.kind === "image") {
              const bucket = it?.storage?.bucket;
              const path = it?.storage?.path;
              if (typeof bucket !== "string" || typeof path !== "string") return it;
              const { data: signed, error: signErr } = await supabaseAdmin.storage
                .from(bucket)
                .createSignedUrl(path, 60 * 60);
              if (signErr || !signed?.signedUrl) return it;
              return { ...it, url: signed.signedUrl };
            }

            if (it?.kind === "video") {
              const bucket = it?.storage?.bucket;
              const path = it?.storage?.path;
              if (typeof bucket !== "string" || typeof path !== "string") return it;
              const { data: signed, error: signErr } = await supabaseAdmin.storage
                .from(bucket)
                .createSignedUrl(path, 60 * 60);
              if (signErr || !signed?.signedUrl) return it;
              return { ...it, url: signed.signedUrl };
            }

            return it;
          })
        );
        return {
          ...row,
          generated_assets: assets
            ? {
                ...assets,
                items: signedItems,
              }
            : assets,
        };
      })
    );

    return NextResponse.json({ items });
  } catch (e) {
    console.error("GET /api/ad-creative/history:", e);
    return NextResponse.json(
      { error: "Unexpected server error." },
      { status: 500 }
    );
  }
}

