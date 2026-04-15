"use client";

export function ShopifySetupGuide() {
  return (
    <div className="space-y-5">
      <div>
        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">
          Shopify connection (coming soon)
        </p>
        <p className="mt-2 text-sm text-slate-300">
          The UI is ready. Once the Shopify app is created and credentials are added, you’ll be able to
          connect your store here without moving onboarding back into Products.
        </p>
      </div>

      <div>
        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">
          Shopify app setup (admin)
        </p>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-slate-300">
          <li>Create a Shopify app in your Shopify Partner dashboard.</li>
          <li>
            Set the app URL to your site (e.g. <span className="font-mono">https://yourapp.com</span>).
          </li>
          <li>
            Add the allowed redirection URL:
            <span className="ml-2 font-mono">https://yourapp.com/api/shopify/callback</span>
          </li>
          <li>Copy the API key + API secret into your environment variables.</li>
        </ol>
      </div>

      <div>
        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">
          Permissions (scopes)
        </p>
        <p className="mt-2 text-sm text-slate-300">
          MVP uses <span className="font-mono">read_products</span>. You can extend scopes later (e.g.
          write access) by updating <span className="font-mono">SHOPIFY_SCOPES</span>.
        </p>
      </div>

      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 text-xs text-slate-400">
        Once enabled, the connection will use Shopify OAuth and store tokens server-side scoped to your
        active workspace/client.
      </div>
    </div>
  );
}

