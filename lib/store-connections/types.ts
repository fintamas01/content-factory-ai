export type StorePlatform = "woocommerce" | "shopify";

export type StoreConnectionStatus = "connected" | "not_connected";

export type StoreConnection = {
  platform: StorePlatform;
  status: StoreConnectionStatus;
  storeDomain?: string | null;
  connectedAt?: string | null;
  updatedAt?: string | null;
};

export type StoreConnectionsSnapshot = {
  woocommerce: StoreConnection;
  shopify: StoreConnection;
};

