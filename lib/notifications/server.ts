import type { SupabaseClient } from "@supabase/supabase-js";
import type { CreateNotificationInput, NotificationRow } from "./types";

export async function createNotification(
  supabase: SupabaseClient,
  input: CreateNotificationInput
): Promise<{ ok: true; row: NotificationRow } | { ok: false; error: string }> {
  const payload = {
    user_id: input.userId,
    client_id: input.clientId,
    type: input.type,
    title: input.title,
    message: input.message,
    severity: input.severity,
    source_module: input.sourceModule,
    action_label: input.actionLabel ?? null,
    action_url: input.actionUrl ?? null,
    metadata: input.metadata ?? {},
  };

  const { data, error } = await supabase
    .from("notifications")
    .insert(payload)
    .select("*")
    .single();

  if (error || !data) {
    console.error("notifications insert:", error);
    return { ok: false, error: "Failed to create notification." };
  }

  return { ok: true, row: data as unknown as NotificationRow };
}

export async function fetchNotifications(
  supabase: SupabaseClient,
  args: { userId: string; clientId: string; limit?: number; unreadOnly?: boolean }
): Promise<NotificationRow[]> {
  const limit = Math.max(1, Math.min(50, args.limit ?? 20));
  let q = supabase
    .from("notifications")
    .select("*")
    .eq("user_id", args.userId)
    .eq("client_id", args.clientId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (args.unreadOnly) q = q.eq("is_read", false);
  const { data } = await q;
  return (data ?? []) as unknown as NotificationRow[];
}

export async function fetchUnreadCount(
  supabase: SupabaseClient,
  args: { userId: string; clientId: string }
): Promise<number> {
  const { count } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", args.userId)
    .eq("client_id", args.clientId)
    .eq("is_read", false);
  return typeof count === "number" ? count : 0;
}

