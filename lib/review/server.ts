import type { SupabaseClient } from "@supabase/supabase-js";
import { parseClientRole, type ClientRole } from "@/lib/clients/roles";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { ReviewItemRow, ReviewPatchAction, ReviewStatus } from "./types";

export async function fetchClientRole(
  supabase: SupabaseClient,
  clientId: string,
  userId: string
): Promise<ClientRole | null> {
  const { data } = await supabase
    .from("client_members")
    .select("role")
    .eq("client_id", clientId)
    .eq("user_id", userId)
    .maybeSingle();
  return parseClientRole(data?.role as string | undefined);
}

export async function fetchReviewItemAdmin(id: string): Promise<ReviewItemRow | null> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  const { data, error } = await supabaseAdmin
    .from("review_items")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  return data as ReviewItemRow;
}

export type TransitionResult =
  | { ok: true; nextStatus: ReviewStatus }
  | { ok: false; error: string; status: number };

/**
 * Applies a workflow action with role + state checks. Caller must pass clientId from session.
 */
export function planReviewTransition(opts: {
  action: ReviewPatchAction;
  role: ClientRole | null;
  row: ReviewItemRow;
  actorId: string;
}): TransitionResult {
  const { action, role, row, actorId } = opts;
  if (!role) return { ok: false, error: "Not a workspace member.", status: 403 };

  const isCreator = row.user_id === actorId;
  const isReviewer = role === "admin" || role === "owner";
  const ownerOnly = role === "owner";

  if (action === "submit") {
    if (row.status !== "draft") {
      return { ok: false, error: "Only draft items can be submitted.", status: 400 };
    }
    if (!isCreator) {
      return { ok: false, error: "Only the author can submit for review.", status: 403 };
    }
    return { ok: true, nextStatus: "in_review" };
  }

  if (action === "approve") {
    if (row.status !== "in_review") {
      return { ok: false, error: "Only items in review can be approved.", status: 400 };
    }
    if (!isReviewer) {
      return { ok: false, error: "Only admins and owners can approve.", status: 403 };
    }
    return { ok: true, nextStatus: "approved" };
  }

  if (action === "reject") {
    if (row.status !== "in_review") {
      return { ok: false, error: "Only items in review can be sent back.", status: 400 };
    }
    if (!isReviewer) {
      return { ok: false, error: "Only admins and owners can send back.", status: 403 };
    }
    return { ok: true, nextStatus: "draft" };
  }

  if (action === "apply") {
    if (row.status !== "approved") {
      return { ok: false, error: "Only approved items can be marked applied.", status: 400 };
    }
    if (!ownerOnly) {
      return { ok: false, error: "Only workspace owners can mark as applied.", status: 403 };
    }
    return { ok: true, nextStatus: "applied" };
  }

  return { ok: false, error: "Unknown action.", status: 400 };
}

export async function updateReviewItemAdmin(
  id: string,
  patch: Partial<{
    status: ReviewStatus;
    reviewed_by: string | null;
    reviewed_at: string | null;
    applied_by: string | null;
    applied_at: string | null;
  }>
): Promise<{ error: string | null }> {
  const { error } = await supabaseAdmin.from("review_items").update(patch).eq("id", id);
  return { error: error?.message ?? null };
}
