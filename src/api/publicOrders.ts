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

