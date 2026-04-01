import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { requireActiveClientId } from "@/lib/clients/server";
import { enforceUsageLimit } from "@/lib/usage/enforce";
import { incrementUsage } from "@/lib/usage/usage-service";
import { getPlaybookDefinition } from "@/lib/playbooks/definitions";
import { runPlaybook } from "@/lib/playbooks/runner";

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export async function POST(req: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OpenAI is not configured on the server." },
        { status: 500 }
      );
    }

    const cookieStore = await cookies();
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnon =
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
      process.env.NEXT_PUBLIC_SUPABASE_ANNON_KEY;

    if (!supabaseUrl || !supabaseAnon) {
      return NextResponse.json({ error: "Server configuration error." }, { status: 500 });
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
    if (!user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });

    let activeClientId: string;
    try {
      const active = await requireActiveClientId(supabase, cookieStore, user.id);
      activeClientId = active.clientId;
    } catch {
      return NextResponse.json({ error: "No active client." }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const playbook_id = typeof body?.playbook_id === "string" ? body.playbook_id : "";
    const params = body?.params && typeof body.params === "object" ? body.params : {};
    if (!playbook_id) return badRequest("Missing playbook_id.");

    const def = getPlaybookDefinition(playbook_id);
    if (!def) return badRequest("Unknown playbook_id.");

    const usageDenied = await enforceUsageLimit(
      supabase,
      user.id,
      def.usageFeature,
      activeClientId
    );
    if (usageDenied) return usageDenied;

    const result = await runPlaybook({
      playbookId: def.id,
      params,
      supabase,
      userId: user.id,
      clientId: activeClientId,
    });

    await incrementUsage(supabase, def.usageFeature, activeClientId);

    return NextResponse.json({ ok: true, result }, { status: 200 });
  } catch (e: any) {
    console.error("playbooks/run:", e);
    return NextResponse.json(
      { error: "Playbook execution failed.", details: String(e?.message ?? e) },
      { status: 500 }
    );
  }
}

