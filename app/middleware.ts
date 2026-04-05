import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isMaintenanceGateEnabled } from "@/lib/maintenance/config";
import {
  computeMaintenanceToken,
  timingSafeEqualHex,
} from "@/lib/maintenance/token";

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnon =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANNON_KEY;

  if (!supabaseUrl || !supabaseAnon) {
    return NextResponse.next({
      request: { headers: request.headers },
    });
  }

  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(supabaseUrl, supabaseAnon, {
    cookies: {
      get(name: string) {
        return request.cookies.get(name)?.value;
      },
      set(name: string, value: string, options: CookieOptions) {
        request.cookies.set({ name, value, ...options });
        response = NextResponse.next({
          request: {
            headers: request.headers,
          },
        });
        response.cookies.set({ name, value, ...options });
      },
      remove(name: string, options: CookieOptions) {
        request.cookies.set({ name, value: "", ...options });
        response = NextResponse.next({
          request: {
            headers: request.headers,
          },
        });
        response.cookies.set({ name, value: "", ...options });
      },
    },
  });

  if (isMaintenanceGateEnabled()) {
    const secret = process.env.MAINTENANCE_SESSION_SECRET!.trim();
    const token = await computeMaintenanceToken(secret);
    const cookieVal = request.cookies.get("maintenance_bypass")?.value;
    const hasAccess = Boolean(
      cookieVal && timingSafeEqualHex(cookieVal, token)
    );

    const skipMaintenanceCheck =
      pathname === "/api/maintenance-auth" ||
      pathname === "/api/maintenance-logout";

    if (!skipMaintenanceCheck) {
      if (pathname === "/maintenance") {
        if (hasAccess) {
          return NextResponse.redirect(new URL("/dashboard", request.url));
        }
      } else if (!hasAccess) {
        return NextResponse.redirect(new URL("/maintenance", request.url));
      }
    }
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Onboarding gating:
  // - Logged-in users must complete onboarding before accessing /dashboard/*
  // - /onboarding/* always allowed
  // - Keeps behavior production-safe (RLS-protected table, no auth changes)
  const isOnboardingPath = pathname === "/onboarding" || pathname.startsWith("/onboarding/");
  /** App areas that assume onboarding is done (same as dashboard for gating). */
  const isAppPathRequiringOnboarding =
    pathname === "/settings" ||
    pathname === "/dashboard" ||
    pathname.startsWith("/dashboard/");

  if (user && isAppPathRequiringOnboarding) {
    const { data: onboardingRow } = await supabase
      .from("user_onboarding")
      .select("onboarding_completed")
      .eq("user_id", user.id)
      .maybeSingle();

    const completed = Boolean(onboardingRow?.onboarding_completed);
    if (!completed && !isOnboardingPath) {
      return NextResponse.redirect(new URL("/onboarding", request.url));
    }
  }

  if (user && isOnboardingPath) {
    const { data: onboardingRow } = await supabase
      .from("user_onboarding")
      .select("onboarding_completed")
      .eq("user_id", user.id)
      .maybeSingle();

    const completed = Boolean(onboardingRow?.onboarding_completed);
    if (completed) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!api/webhook|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
