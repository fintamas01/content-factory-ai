import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { requireActiveClientId } from "@/lib/clients/server";
import { enforceUsageLimit } from "@/lib/usage/enforce";
import type { UsageFeature } from "@/lib/usage/types";

export type AuthenticatedClientGate =
  | { ok: true; supabase: SupabaseClient; user: User; clientId: string }
  | { ok: false; response: NextResponse };

/**
 * Signed-in user + active workspace (cookie or fallback). No usage check.
 * Use when you must validate the request body before consuming quota.
 */
export async function requireAuthenticatedClient(): Promise<AuthenticatedClientGate> {
  const cookieStore = await cookies();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnon =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANNON_KEY;

  if (!supabaseUrl || !supabaseAnon) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Server configuration error." },
        { status: 500 }
      ),
    };
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

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  try {
    const { clientId } = await requireActiveClientId(
      supabase,
      cookieStore,
      user.id
    );
    return { ok: true, supabase, user, clientId };
  } catch {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "No active client." },
        { status: 400 }
      ),
    };
  }
}

/**
 * Authenticated user, workspace, and passing usage check for the given feature.
 */
export async function requireSessionClientAndUsageAllowance(
  feature: UsageFeature
): Promise<AuthenticatedClientGate> {
  const base = await requireAuthenticatedClient();
  if (!base.ok) return base;

  const usageDenied = await enforceUsageLimit(
    base.supabase,
    base.user.id,
    feature,
    base.clientId
  );
  if (usageDenied) {
    return { ok: false, response: usageDenied };
  }

  return base;
}
