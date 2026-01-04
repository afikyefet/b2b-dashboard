const API_BASE = import.meta.env.VITE_API_BASE_URL;

export type ProductListItem = {
  product_id: string;
  handle: string;
  title: string;
  tags: string[];
  updated_at: string;
};

export type HydratedSkuItem = {
  sku: string;
  variant_id: string;
  product_id: string;
  product_title: string;
  variant_title: string;
  price: string | null;
  compare_at_price: string | null;
  available_for_sale: boolean;
};

export async function fetchProducts(params: {
  query?: string;
  limit?: number;
  offset?: number;
  tag?: string;
}) {
  const url = new URL(`${API_BASE}/api/products`);
  if (params.query) url.searchParams.set("query", params.query);
  if (params.tag) url.searchParams.set("tag", params.tag);
  url.searchParams.set("limit", String(params.limit ?? 50));
  url.searchParams.set("offset", String(params.offset ?? 0));

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<{ items: ProductListItem[]; limit: number; offset: number }>;
}

export async function hydrateBySkus(skus: string[]) {
  const res = await fetch(`${API_BASE}/api/catalog/by-skus`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ skus }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<{ items: HydratedSkuItem[] }>;
}
