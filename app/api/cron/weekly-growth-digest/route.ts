import { NextResponse } from "next/server";
import { runWeeklyGrowthDigestSend } from "@/lib/notifications/weekly-growth-cron";

function authorized(req: Request) {
  const secret = process.env.CRON_SECRET || "";
  if (!secret) return false;
  const x = req.headers.get("x-cron-secret") || "";
  const auth = req.headers.get("authorization") || "";
  const bearer = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  return (x && x === secret) || (bearer && bearer === secret);
}

async function run(req: Request, body: { ignoreLastSent?: boolean; maxPairs?: number }) {
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const ignoreLastSent = body?.ignoreLastSent === true;
  const maxPairs =
    typeof body?.maxPairs === "number" && body.maxPairs > 0
      ? Math.min(500, Math.floor(body.maxPairs))
      : undefined;

  const res = await runWeeklyGrowthDigestSend({ maxPairs, ignoreLastSent });
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 500 });
  return NextResponse.json(res);
}

/**
 * Vercel Cron invokes GET weekly. Use CRON_SECRET as Bearer or x-cron-secret.
 */
export async function GET(req: Request) {
  try {
    return await run(req, {});
  } catch (e) {
    console.error("GET /api/cron/weekly-growth-digest:", e);
    return NextResponse.json({ error: "Unexpected server error." }, { status: 500 });
  }
}

/**
 * Manual runs: POST with x-cron-secret or Authorization: Bearer CRON_SECRET
 * Body (optional): { "ignoreLastSent": true } bypasses 6.5d throttle for testing.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    return await run(req, {
      ignoreLastSent: body?.ignoreLastSent === true,
      maxPairs: body?.maxPairs,
    });
  } catch (e) {
    console.error("POST /api/cron/weekly-growth-digest:", e);
    return NextResponse.json({ error: "Unexpected server error." }, { status: 500 });
  }
}
