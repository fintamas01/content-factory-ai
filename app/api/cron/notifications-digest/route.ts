import { NextResponse } from "next/server";
import { runEmailDigestSend } from "@/lib/notifications/cron";

function authorized(req: Request) {
  const secret = process.env.CRON_SECRET || "";
  if (!secret) return false;
  const got = req.headers.get("x-cron-secret") || "";
  return got && got === secret;
}

export async function POST(req: Request) {
  try {
    if (!authorized(req)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const frequency = body?.frequency === "weekly" ? "weekly" : "daily";
    const res = await runEmailDigestSend({ frequency, maxUsers: 80, perUserMax: 8 });
    if (!res.ok) return NextResponse.json({ error: res.error }, { status: 500 });
    return NextResponse.json(res);
  } catch (e) {
    console.error("POST /api/cron/notifications-digest:", e);
    return NextResponse.json({ error: "Unexpected server error." }, { status: 500 });
  }
}

