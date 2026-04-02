import type { ClientRole } from "@/lib/clients/roles";
import type { ReviewPermissions } from "./types";

/** UI + API helpers — server routes re-check before mutating. */
export function getReviewPermissions(role: ClientRole | null): ReviewPermissions {
  if (!role) {
    return {
      role: null,
      canSubmitForReview: false,
      canApprove: false,
      canReject: false,
      canMarkApplied: false,
    };
  }
  return {
    role,
    canSubmitForReview: true,
    canApprove: role === "admin" || role === "owner",
    canReject: role === "admin" || role === "owner",
    canMarkApplied: role === "owner",
  };
}
