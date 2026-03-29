import { Radar } from "lucide-react";
import { MODULES } from "@/lib/platform/config";
import { ModulePageHeader } from "@/app/components/platform/ModulePageHeader";

export default function SiteAuditPlaceholderPage() {
  const m = MODULES.siteAudit;
  return (
    <div className="max-w-3xl mx-auto space-y-8 pb-20 p-8">
      <ModulePageHeader moduleId="siteAudit" />
      <div className="rounded-[32px] border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0b1220] p-10 shadow-sm">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-600/10 text-emerald-600 mb-6">
          <Radar className="h-7 w-7" />
        </div>
        <p className="text-[10px] font-black uppercase tracking-widest text-emerald-500 mb-2">
          {m.productName}
        </p>
        <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white uppercase italic">
          {m.label}
        </h1>
        <p className="mt-3 text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
          {m.description} This module is scaffolded for future implementation.
        </p>
        <p className="mt-6 text-sm text-slate-400 dark:text-slate-500">
          Next steps: add crawl / audit jobs, AI-readiness scoring, and reports while reusing
          shared auth and usage limits. Routes stay under{" "}
          <code className="rounded bg-slate-100 dark:bg-white/10 px-2 py-0.5 text-xs">
            /dashboard/site-audit
          </code>
          .
        </p>
      </div>
    </div>
  );
}
