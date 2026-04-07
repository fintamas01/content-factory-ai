import { NextResponse } from "next/server";

/**
 * Legacy endpoint (previously published to a single shared IG account via env tokens).
 * Kept for backward compatibility, but publishing is now user/workspace-scoped via:
 * `POST /api/social/publish` with a connected account.
 */
export async function POST() {
  return NextResponse.json(
    {
      error:
        "This endpoint is deprecated. Use /api/social/publish with a connected account instead.",
      code: "DEPRECATED",
    },
    { status: 410 }
  );
}