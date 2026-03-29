import Link from "next/link";
import { LayoutDashboard, Megaphone, Package, Radar } from "lucide-react";
import {
  MODULES,
  PLATFORM_DESCRIPTION,
  PLATFORM_DISPLAY_NAME,
} from "@/lib/platform/config";

const moduleCards = [
  {
    key: "content" as const,
    icon: Megaphone,
    module: MODULES.content,
    accent: "from-blue-600 to-cyan-500",
  },
  {
    key: "products" as const,
    icon: Package,
    module: MODULES.products,
    accent: "from-violet-600 to-fuchsia-500",
  },
  {
    key: "siteAudit" as const,
    icon: Radar,
    module: MODULES.siteAudit,
    accent: "from-emerald-600 to-teal-500",
  },
];

export default function PlatformDashboardPage() {
  return (
    <div className="max-w-6xl mx-auto space-y-10 pb-20 p-8">
      <header className="space-y-3">
        <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 dark:border-white/10 bg-white/60 dark:bg-white/5 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-500">
          <LayoutDashboard className="h-4 w-4 text-blue-500" />
          {PLATFORM_DISPLAY_NAME}
        </div>
        <h1 className="text-4xl font-black tracking-tight text-slate-900 dark:text-white uppercase italic">
          <span className="text-blue-600">Dashboard</span>
        </h1>
        <p className="text-slate-500 dark:text-slate-400 font-medium max-w-2xl">
          {PLATFORM_DESCRIPTION}
        </p>
      </header>

      <div className="grid gap-6 md:grid-cols-3">
        {moduleCards.map(({ icon: Icon, module, accent }) => (
          <Link
            key={module.id}
            href={module.href}
            className="group relative overflow-hidden rounded-[28px] border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0b1220] p-8 shadow-sm transition-all hover:border-blue-500/40 hover:shadow-lg hover:shadow-blue-500/10"
          >
            <div
              className={`pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-gradient-to-br ${accent} opacity-20 blur-2xl transition-opacity group-hover:opacity-30`}
            />
            <div className="relative flex flex-col gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 dark:bg-white/5 text-blue-600 dark:text-blue-400">
                <Icon className="h-6 w-6" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  {module.productName}
                </p>
                <h2 className="mt-1 text-lg font-black text-slate-900 dark:text-white">
                  {module.label}
                </h2>
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                  {module.description}
                </p>
              </div>
              <span className="text-xs font-black uppercase tracking-widest text-blue-600 dark:text-blue-400">
                Open module →
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
