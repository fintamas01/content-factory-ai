import type { SupabaseClient } from "@supabase/supabase-js";
import type { UserBrandProfileRow } from "./types";

export async function fetchUserBrandProfile(
  supabase: SupabaseClient,
  userId: string
): Promise<UserBrandProfileRow | null> {
  const { data, error } = await supabase
    .from("user_brand_profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("user_brand_profiles fetch:", error);
    return null;
  }
  return data ?? null;
}
