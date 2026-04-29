import { NextResponse } from "next/server";
import { requireAuthenticatedClient } from "@/lib/usage/require-session-usage";

export async function GET() {
  try {
    const gate = await requireAuthenticatedClient();
    if (!gate.ok) return gate.response;
    const { supabase, user, clientId } = gate;

    const { data, error } = await supabase
      .from("campaign_jobs")
      .select(
        "id,user_id,client_id,product_name,product_image,product_price,headline,caption,cta,template_id,status,render_url,error_message,created_at,updated_at"
      )
      .eq("client_id", clientId)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("GET /api/campaign-jobs:", error);
      return NextResponse.json(
        { error: "Could not load campaign jobs." },
        { status: 500 }
      );
    }

    return NextResponse.json({ jobs: data ?? [] });
  } catch (e) {
    console.error("GET /api/campaign-jobs:", e);
    return NextResponse.json(
      { error: "Unexpected server error." },
      { status: 500 }
    );
  }
}

