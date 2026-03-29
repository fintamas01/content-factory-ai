import { NextResponse } from "next/server";

/**
 * Clears maintenance bypass cookie. Use when you want to lock the browser again.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const redirectTo = url.searchParams.get("redirect") ?? "/maintenance";
  const res = NextResponse.redirect(new URL(redirectTo, url.origin));
  res.cookies.set("maintenance_bypass", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return res;
}

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set("maintenance_bypass", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return res;
}
