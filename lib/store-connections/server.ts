import type { SupabaseClient } from "@supabase/supabase-js";
import type { StoreConnectionsSnapshot } from "@/lib/store-connections/types";

function domainFromUrl(raw: string): string {
  try {
    const u = raw.startsWith("http") ? new URL(raw) : new URL(`https://${raw}`);
    return u.host;
  } catch {
    return raw.replace(/^https?:\/\//, "").replace(/\/+$/, "");
  }
}

export async function fetchStoreConnectionsSnapshot(params: {
  supabase: SupabaseClient;
  clientId: string;
}): Promise<StoreConnectionsSnapshot> {
  const { supabase, clientId } = params;

  const { data: woo } = await supabase
    .from("woocommerce_connections")
    .select("store_url, created_at, updated_at")
    .eq("client_id", clientId)
    .maybeSingle();

  const { data: sh } = await supabase
    .from("shopify_connections")
    .select("store_domain, created_at, updated_at, status")
    .eq("client_id", clientId)
    .maybeSingle();

  const woocommerce = woo?.store_url
    ? {
        platform: "woocommerce" as const,
        status: "connected" as const,
        storeDomain: domainFromUrl(String(woo.store_url)),
        connectedAt: String(woo.created_at ?? ""),
        updatedAt: String(woo.updated_at ?? ""),
      }
    : {
        platform: "woocommerce" as const,
        status: "not_connected" as const,
        storeDomain: null,
        connectedAt: null,
        updatedAt: null,
      };

  const shopify =
    sh?.store_domain && sh?.status === "connected"
      ? {
          platform: "shopify" as const,
          status: "connected" as const,
          storeDomain: String(sh.store_domain),
          connectedAt: String(sh.created_at ?? ""),
          updatedAt: String(sh.updated_at ?? ""),
        }
      : {
          platform: "shopify" as const,
          status: "not_connected" as const,
          storeDomain: null,
          connectedAt: null,
          updatedAt: null,
        };

  return { woocommerce, shopify };
}

