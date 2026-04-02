export type PriceTrackingRow = {
  id: string;
  user_id: string;
  client_id: string;
  product_name: string;
  own_price: number | null;
  competitor_url: string;
  competitor_price: number | null;
  difference_pct: number | null;
  recommendation: string | null;
  woo_product_id: number | null;
  created_at: string;
  updated_at: string;
};
