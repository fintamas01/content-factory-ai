import type { SupabaseClient } from "@supabase/supabase-js";
import type { WooConnection } from "@/lib/woocommerce/client";
import { wooFetch, type WooProductListItem } from "@/lib/woocommerce/client";
import {
  heuristicListingScore,
  isWeakShortDescription,
  needsOptimizationHeuristic,
} from "@/lib/products/health-heuristic";

export type WooOptimizationInsights = {
  total: number;
  needOptimization: number;
  weakShort: number;
  /** Lowest heuristic scores first */
  queue: Array<{
    id: number;
    name: string;
    heuristicScore: number;
    sku?: string | null;
  }>;
};

type WooListProduct = WooProductListItem & {
  description?: string;
  short_description?: string;
};

export async function fetchWooOptimizationInsights(
  supabase: SupabaseClient,
  clientId: string
): Promise<WooOptimizationInsights | null> {
  const { data: conn, error } = await supabase
    .from("woocommerce_connections")
    .select("store_url, consumer_key, consumer_secret")
    .eq("client_id", clientId)
    .maybeSingle();

  if (error || !conn?.store_url || !conn.consumer_key || !conn.consumer_secret) {
    return null;
  }

  const connection: WooConnection = {
    store_url: conn.store_url,
    consumer_key: conn.consumer_key,
    consumer_secret: conn.consumer_secret,
  };

  const r = await wooFetch<WooListProduct[]>(connection, "/products?per_page=100&orderby=date&order=desc");
  if (!r.ok) return null;

  const items = Array.isArray(r.data) ? r.data : [];
  let needOptimization = 0;
  let weakShort = 0;

  const queue = items.map((p) => {
    const heuristicScore = heuristicListingScore({
      name: p.name ?? "",
      description: p.description,
      short_description: p.short_description,
    });
    if (needsOptimizationHeuristic({
      name: p.name ?? "",
      description: p.description,
      short_description: p.short_description,
    })) {
      needOptimization += 1;
    }
    if (isWeakShortDescription(p.short_description)) weakShort += 1;
    return {
      id: p.id,
      name: p.name ?? "Product",
      heuristicScore,
      sku: p.sku ?? null,
    };
  });

  queue.sort((a, b) => a.heuristicScore - b.heuristicScore);

  return {
    total: items.length,
    needOptimization,
    weakShort,
    queue: queue.slice(0, 24),
  };
}
