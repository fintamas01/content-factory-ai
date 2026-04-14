"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2, Zap } from "lucide-react";
import { createBrowserClient } from "@supabase/ssr";

type Variant = "primary" | "secondary";

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANNON_KEY!
);

export function StartFreeButton({ variant = "primary" }: { variant?: Variant }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [hasUser, setHasUser] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase.auth.getUser();
        if (!cancelled) setHasUser(Boolean(data.user));
      } catch {
        if (!cancelled) setHasUser(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const classes = useMemo(() => {
    if (variant === "secondary") {
      return "inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-6 text-sm font-bold text-white transition hover:bg-white/[0.08]";
    }
    return "inline-flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 via-blue-500 to-indigo-600 px-7 text-[15px] font-black text-white shadow-[0_8px_28px_-4px_rgba(37,99,235,0.55)] ring-1 ring-white/15 transition hover:brightness-110 active:scale-[0.99] sm:w-auto";
  }, [variant]);

  const label = hasUser ? "Go to dashboard" : "Start Free Trial";

  const onClick = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const { data } = await supabase.auth.getUser();
      if (data.user) {
        router.push("/dashboard");
        router.refresh();
        return;
      }
      await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          // Land on onboarding first; middleware sends completed users to /dashboard.
          redirectTo: `${window.location.origin}/onboarding`,
        },
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className={classes}
      disabled={loading}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
      ) : variant === "primary" ? (
        <Zap className="h-5 w-5" aria-hidden />
      ) : null}
      {label}
      <ArrowRight className="h-4 w-4 opacity-80" aria-hidden />
    </button>
  );
}

