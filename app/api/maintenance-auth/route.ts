import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import {
  computeMaintenanceToken,
} from "@/lib/maintenance/token";

function safeEqualStrings(a: string, b: string): boolean {
  const aa = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (aa.length !== bb.length) return false;
  return timingSafeEqual(aa, bb);
}

export async function POST(req: Request) {
  const secret = process.env.MAINTENANCE_SESSION_SECRET?.trim();
  const expectedUser = process.env.MAINTENANCE_USERNAME?.trim();
  const expectedPass = process.env.MAINTENANCE_PASSWORD;

  if (!secret || !expectedUser || expectedPass === undefined) {
    return NextResponse.json(
      { error: "Maintenance gate is not configured." },
      { status: 503 }
    );
  }

  let body: { username?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const username = typeof body.username === "string" ? body.username.trim() : "";
  const password =
    typeof body.password === "string" ? body.password : "";

  if (!username || !password) {
    return NextResponse.json(
      { error: "Username and password are required." },
      { status: 400 }
    );
  }

  if (
    !safeEqualStrings(username, expectedUser) ||
    !safeEqualStrings(password, String(expectedPass))
  ) {
    return NextResponse.json({ error: "Invalid credentials." }, { status: 401 });
  }

  const token = await computeMaintenanceToken(secret);
  const res = NextResponse.json({ ok: true });
  const isProd = process.env.NODE_ENV === "production";
  res.cookies.set("maintenance_bypass", token, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return res;
}
