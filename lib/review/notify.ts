import { supabaseAdmin } from "@/lib/supabase/admin";
import type { ReviewModule } from "./types";

const QUEUE_URL = "/dashboard/review";

function adminAvailable(): boolean {
  return Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export async function notifyReviewSubmitted(opts: {
  clientId: string;
  reviewItemId: string;
  title: string;
  module: ReviewModule;
  actorUserId: string;
}): Promise<void> {
  if (!adminAvailable()) return;
  const { data: members } = await supabaseAdmin
    .from("client_members")
    .select("user_id, role")
    .eq("client_id", opts.clientId)
    .in("role", ["owner", "admin"]);

  const targets = (members ?? [])
    .map((m) => m.user_id as string)
    .filter((uid) => uid && uid !== opts.actorUserId);
  if (targets.length === 0) return;

  const label =
    opts.module === "content"
      ? "Content"
      : opts.module === "products"
        ? "Products"
        : opts.module === "site_audit"
          ? "Growth Audit"
          : opts.module === "playbooks"
            ? "Playbooks"
            : "Matrix";

  await Promise.all(
    targets.map((user_id) =>
      supabaseAdmin.from("notifications").insert({
        user_id,
        client_id: opts.clientId,
        type: "review_submitted",
        title: "Ready for review",
        message: `${label}: ${opts.title}`,
        severity: "info",
        source_module: "review",
        action_label: "Open queue",
        action_url: QUEUE_URL,
        metadata: { review_item_id: opts.reviewItemId, module: opts.module },
      })
    )
  );
}

export async function notifyReviewDecision(opts: {
  clientId: string;
  reviewItemId: string;
  title: string;
  kind: "approved" | "rejected" | "applied";
  targetUserId: string;
}): Promise<void> {
  if (!adminAvailable()) return;
  if (!opts.targetUserId) return;

  const copy =
    opts.kind === "approved"
      ? { title: "Output approved", message: `Approved: ${opts.title}` }
      : opts.kind === "rejected"
        ? { title: "Sent back to draft", message: `Needs changes: ${opts.title}` }
        : { title: "Marked as applied", message: `Applied: ${opts.title}` };

  await supabaseAdmin.from("notifications").insert({
    user_id: opts.targetUserId,
    client_id: opts.clientId,
    type: `review_${opts.kind}`,
    title: copy.title,
    message: copy.message,
    severity: opts.kind === "rejected" ? "warning" : "success",
    source_module: "review",
    action_label: "Open queue",
    action_url: QUEUE_URL,
    metadata: { review_item_id: opts.reviewItemId },
  });
}
