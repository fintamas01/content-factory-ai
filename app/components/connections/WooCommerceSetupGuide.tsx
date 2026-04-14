"use client";

export function WooCommerceSetupGuide() {
  return (
    <div className="space-y-5">
      <div>
        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">
          What you’ll need
        </p>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-300">
          <li>Your WooCommerce store URL (e.g. `https://yourstore.com`).</li>
          <li>A WooCommerce REST API Consumer Key + Consumer Secret.</li>
        </ul>
      </div>

      <div>
        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">
          How to create keys
        </p>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-slate-300">
          <li>In WordPress admin, go to WooCommerce → Settings → Advanced → REST API.</li>
          <li>Click “Add key”.</li>
          <li>Set permissions to <strong>Read/Write</strong> (required for pushing updates).</li>
          <li>Copy the Consumer Key and Consumer Secret into the connection form.</li>
        </ol>
      </div>

      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 text-xs text-slate-400">
        Tip: If your host blocks API requests, ensure WooCommerce REST API is enabled and your site is reachable over HTTPS.
      </div>
    </div>
  );
}

