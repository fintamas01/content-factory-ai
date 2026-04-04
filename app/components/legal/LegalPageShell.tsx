import Link from "next/link";
import { PLATFORM_DISPLAY_NAME } from "@/lib/platform/config";

export function LegalPageShell({
  title,
  effectiveLabel,
  children,
}: {
  title: string;
  effectiveLabel: string;
  children: React.ReactNode;
}) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#030712] text-slate-100">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(59,130,246,0.14),transparent)]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -left-32 top-1/4 h-96 w-96 rounded-full bg-blue-600/12 blur-[100px]"
        aria-hidden
      />

      <div className="relative mx-auto max-w-3xl px-5 py-14 md:px-8 md:py-20">
        <nav className="mb-10 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs font-semibold text-slate-500">
          <Link href="/" className="text-slate-400 transition hover:text-white">
            ← Home
          </Link>
          <Link href="/pricing" className="transition hover:text-slate-300">
            Pricing
          </Link>
          <Link href="/privacy" className="transition hover:text-slate-300">
            Privacy
          </Link>
          <Link href="/terms" className="transition hover:text-slate-300">
            Terms
          </Link>
        </nav>

        <header className="border-b border-white/[0.08] pb-8">
          <p className="text-[10px] font-black uppercase tracking-[0.28em] text-blue-400/90">
            {PLATFORM_DISPLAY_NAME}
          </p>
          <h1 className="mt-3 text-3xl font-black tracking-tight text-white md:text-4xl">
            {title}
          </h1>
          <p className="mt-3 text-xs font-medium text-slate-500">{effectiveLabel}</p>
        </header>

        <div className="mt-10 space-y-8 text-sm leading-relaxed text-slate-300 [&_h2]:mt-10 [&_h2]:scroll-mt-24 [&_h2]:text-base [&_h2]:font-bold [&_h2]:tracking-tight [&_h2]:text-white [&_h3]:mt-6 [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:text-slate-200 [&_li]:mt-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_strong]:font-semibold [&_strong]:text-slate-200 [&_ul]:list-disc [&_ul]:pl-5">
          {children}
        </div>
      </div>
    </div>
  );
}
