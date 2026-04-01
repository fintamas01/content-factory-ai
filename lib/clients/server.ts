import type { SupabaseClient } from "@supabase/supabase-js";
import type { cookies as CookiesFn } from "next/headers";
import { ACTIVE_CLIENT_COOKIE } from "./constants";

type CookieStore = Awaited<ReturnType<typeof CookiesFn>>;

type ClientRow = {
  id: string;
  user_id: string;
  name: string;
  website_url: string | null;
  created_at: string;
};

export async function requireActiveClientId(
  supabase: SupabaseClient,
  cookieStore: CookieStore,
  userId: string
): Promise<{ clientId: string; client: ClientRow }> {
  const fromCookie = cookieStore.get(ACTIVE_CLIENT_COOKIE)?.value ?? "";

  if (fromCookie) {
    const { data, error } = await supabase
      .from("clients")
      .select("id, user_id, name, website_url, created_at")
      .eq("id", fromCookie)
      .eq("user_id", userId)
      .maybeSingle();
    if (!error && data?.id) return { clientId: data.id, client: data as ClientRow };
  }

  // Fallback: first client for user (or create a Default client if none exist yet).
  const { data: first, error: firstErr } = await supabase
    .from("clients")
    .select("id, user_id, name, website_url, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  let active = first as ClientRow | null;
  if (firstErr) {
    // ignore and try create
    active = null;
  }

  if (!active?.id) {
    const { data: created, error: createErr } = await supabase
      .from("clients")
      .insert({ user_id: userId, name: "Default" })
      .select("id, user_id, name, website_url, created_at")
      .single();
    if (createErr || !created?.id) {
      throw new Error("Could not ensure an active client.");
    }
    active = created as ClientRow;
  }

  cookieStore.set(ACTIVE_CLIENT_COOKIE, active.id, {
    path: "/",
    sameSite: "lax",
  });

  return { clientId: active.id, client: active };
}

