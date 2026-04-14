"use client";

export function ShopifySetupGuide() {
  return (
    <div className="space-y-5">
      <div>
        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">
          Shopify connection (coming soon)
        </p>
        <p className="mt-2 text-sm text-slate-300">
          The UI is ready so we can ship a clean, guided onboarding experience. The actual Shopify
          connector (OAuth + product sync) will be added next without crowding the Products page.
        </p>
      </div>

      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 text-xs text-slate-400">
        Planned: secure OAuth install flow, per-workspace token storage, and product sync + optimization pipelines.
      </div>
    </div>
  );
}

