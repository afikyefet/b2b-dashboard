const API_BASE = import.meta.env.VITE_API_BASE_URL;

export type ProductListItem = {
  product_id: string;
  handle: string;
  title: string;
  tags: string[];
  updated_at: string;
  featured_image_url?: string | null;
};

export type HydratedSkuItem = {
  sku: string;
  variant_id: string;
  product_id: string;
  product_title: string;
  variant_title: string;
  price: number | null;
  compare_at_price: number | null;
  available_for_sale: boolean;
  product_options?: string | null;
  variant_selected_options?: string | null;
  variant_image_url?: string | null;
  product_featured_image_url?: string | null;
};

export type SkuAvailability = {
  sku: string;
  available_for_sale: boolean;
  inventory_quantity: number | null;
};

export type SkuImage = {
  sku: string;
  image_url: string | null;
};

function addStoreParam(url: URL, store?: string) {
  if (store) url.searchParams.set("store", store);
}

export async function fetchProducts(params: {
  query?: string;
  limit?: number;
  offset?: number;
  tag?: string;
  store?: string;
}) {
  const url = new URL(`${API_BASE}/api/products`);
  if (params.query) url.searchParams.set("query", params.query);
  if (params.tag) url.searchParams.set("tag", params.tag);
  url.searchParams.set("limit", String(params.limit ?? 50));
  url.searchParams.set("offset", String(params.offset ?? 0));
  addStoreParam(url, params.store);

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<{ items: ProductListItem[]; limit: number; offset: number }>;
}

export async function hydrateBySkus(skus: string[], store?: string) {
  const url = new URL(`${API_BASE}/api/catalog/by-skus`);
  addStoreParam(url, store);
  const res = await fetch(url.toString(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ skus }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<{ items: HydratedSkuItem[] }>;
}

export async function fetchProductVariants(productId: string, store?: string) {
  const url = new URL(`${API_BASE}/api/catalog/product/variants`);
  url.searchParams.set("product_id", productId);
  addStoreParam(url, store);

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<{ items: HydratedSkuItem[] }>;
}

export async function fetchSkuAvailability(skus: string[], store?: string) {
  const url = new URL(`${API_BASE}/api/catalog/availability`);
  addStoreParam(url, store);
  const res = await fetch(url.toString(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ skus }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<{ items: SkuAvailability[] }>;
}

export async function fetchSkuImages(skus: string[], store?: string) {
  const url = new URL(`${API_BASE}/api/catalog/variant-images`);
  addStoreParam(url, store);
  const res = await fetch(url.toString(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ skus }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<{ items: SkuImage[] }>;
}
