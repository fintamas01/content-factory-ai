import type { ClientRole } from "@/lib/clients/roles";

export type ReviewModule = "content" | "products" | "site_audit" | "playbooks" | "matrix";

export type ReviewStatus = "draft" | "in_review" | "approved" | "applied";

export type ReviewItemRow = {
  id: string;
  client_id: string;
  user_id: string;
  module: ReviewModule;
  status: ReviewStatus;
  title: string;
  summary: string | null;
  payload: Record<string, unknown>;
  source_kind: string | null;
  source_id: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  applied_by: string | null;
  applied_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ReviewPermissions = {
  role: ClientRole | null;
  canSubmitForReview: boolean;
  canApprove: boolean;
  canReject: boolean;
  canMarkApplied: boolean;
};

export type ReviewPatchAction = "submit" | "approve" | "reject" | "apply";
