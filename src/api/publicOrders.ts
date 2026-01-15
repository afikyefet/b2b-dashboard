import { type HydratedSkuItem, type ProductListItem } from "./catalogApi";
import { type Order, type UpdateOrderPayload } from "./orders";

const API_BASE = import.meta.env.VITE_API_BASE_URL;

export async function getPublicOrder(token: string): Promise<Order> {
  const res = await fetch(`${API_BASE}/public/orders/${token}`);
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  return {
    ...data,
    shopify_checkout_url: data.checkout_url
  };
}

export async function patchPublicOrder(token: string, payload: UpdateOrderPayload): Promise<Order> {
  const res = await fetch(`${API_BASE}/public/orders/${token}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  return {
    ...data,
    shopify_checkout_url: data.checkout_url
  };
}

export async function createCheckout(token: string): Promise<{ checkoutUrl: string }> {
  const res = await fetch(`${API_BASE}/public/orders/${token}/checkout`, {
    method: "POST",
  });
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  return { checkoutUrl: data.checkout_url };
}

export async function getPublicCatalog(token: string): Promise<{ items: HydratedSkuItem[] }> {
  const res = await fetch(`${API_BASE}/public/orders/${token}/catalog`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getPublicProducts(token: string, params?: { query?: string; tag?: string; limit?: number; offset?: number }) {
  const url = new URL(`${API_BASE}/public/orders/${token}/catalog/products`);
  if (params?.query) url.searchParams.set("query", params.query);
  if (params?.tag) url.searchParams.set("tag", params.tag);
  if (params?.limit !== undefined) url.searchParams.set("limit", String(params.limit));
  if (params?.offset !== undefined) url.searchParams.set("offset", String(params.offset));
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<{ items: ProductListItem[]; limit: number; offset: number }>;
}

export async function getPublicProductVariants(token: string, productId: string) {
  const url = new URL(`${API_BASE}/public/orders/${token}/catalog/product/variants`);
  url.searchParams.set("product_id", productId);
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<{ items: HydratedSkuItem[] }>;
}

