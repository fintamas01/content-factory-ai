"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createBrowserClient } from "@supabase/ssr";
import { ArrowRight, BarChart3, Megaphone, Package, Sparkles, Zap } from "lucide-react";
import { OnboardingShell } from "@/app/components/onboarding/OnboardingShell";

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANNON_KEY!
);

type Choice = {
  key: "audit" | "content" | "product";
  title: string;
  description: string;
  nextHref: string;
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  primary: string;
};

export default function OnboardingStep2() {
  const router = useRouter();
  const [hasBrand, setHasBrand] = useState<boolean | null>(null);

  const choices = useMemo<Choice[]>(
    () => [
      {
        key: "audit",
        title: "Run AI Growth Audit",
        description:
          "Get a prioritized checklist of SEO + conversion fixes—so you know what to change next.",
        nextHref: "/dashboard/site-audit",
        icon: BarChart3,
        primary: "Start my audit",
      },
      {
        key: "content",
        title: "Generate Content",
        description:
          "Create publish-ready posts faster—built to drive clicks, leads, and trust.",
        nextHref: "/dashboard/content",
        icon: Megaphone,
        primary: "Generate my first post",
      },
      {
        key: "product",
        title: "Generate Product Copy",
        description:
          "Turn product specs into benefit-driven descriptions, bullets, and SEO copy that converts.",
        nextHref: "/dashboard/products",
        icon: Package,
        primary: "Write my first product page",
      },
    ],
    []
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push("/");
        return;
      }
      const { data } = await supabase
        .from("user_brand_profiles")
        .select("brand_name")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!cancelled) {
        setHasBrand(Boolean((data?.brand_name as string | undefined)?.trim()));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <OnboardingShell
      step="firstAction"
      title="Get your first win"
      subtitle="Pick one action. You’ll land directly in the right module."
      backHref="/onboarding/step-1"
    >
      <div className="space-y-6">
        {hasBrand === false ? (
          <div className="rounded-2xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
            Tip: adding a brand takes ~30 seconds and improves quality immediately.{" "}
            <Link href="/onboarding/step-1" className="font-bold underline underline-offset-2">
              Add brand →
            </Link>
          </div>
        ) : null}

        <div className="grid gap-4 md:grid-cols-3">
          {choices.map((c) => {
            const Icon = c.icon;
            const recommended = c.key === "audit";
            return (
              <div
                key={c.key}
                className="relative flex flex-col rounded-3xl border border-white/[0.08] bg-white/[0.02] p-6 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)]"
              >
                {recommended ? (
                  <div className="absolute right-5 top-5 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 px-2.5 py-0.5 text-[9px] font-black uppercase tracking-widest text-white shadow-lg shadow-blue-900/40">
                    Recommended
                  </div>
                ) : null}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-blue-200">
                    <Icon className="h-6 w-6" aria-hidden />
                  </div>
                  <span className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[9px] font-black uppercase tracking-widest text-slate-500">
                    2 min
                  </span>
                </div>

                <h2 className="mt-4 text-lg font-bold text-white">{c.title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">
                  {c.description}
                </p>

                <div className="mt-6 flex flex-1 items-end">
                  <Link
                    href={`/onboarding/complete?next=${encodeURIComponent(
                      c.nextHref
                    )}&cta=${encodeURIComponent(c.primary)}`}
                    className={`inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl text-sm font-black text-white transition ${
                      recommended
                        ? "bg-gradient-to-r from-blue-600 via-blue-500 to-indigo-600 shadow-[0_8px_24px_-6px_rgba(37,99,235,0.55)] ring-1 ring-white/15 hover:brightness-110"
                        : "border border-white/10 bg-white/[0.04] font-bold hover:bg-white/[0.08]"
                    }`}
                  >
                    {recommended ? (
                      <Zap className="h-4 w-4" aria-hidden />
                    ) : null}
                    {c.primary}
                    <ArrowRight className="h-4 w-4 opacity-80" aria-hidden />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>

        <div className="rounded-3xl border border-blue-500/25 bg-blue-500/[0.08] p-6">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-2xl border border-blue-400/30 bg-blue-500/15 text-blue-100">
              <Sparkles className="h-5 w-5 text-amber-200/90" aria-hidden />
            </div>
            <div>
              <p className="text-sm font-bold text-white">Activation shortcut</p>
              <p className="mt-1 text-[12px] leading-relaxed text-blue-50/70">
                Choose one path now. You can explore the other modules after you finish.
              </p>
            </div>
          </div>
        </div>
      </div>
    </OnboardingShell>
  );
}

