
const API_BASE = import.meta.env.VITE_API_BASE_URL;

export type OrderStatus =
  | "DRAFT"
  | "SENT"
  | "OPENED"
  | "CHECKOUT_CREATED"
  | "COMPLETED"
  | "CANCELLED";

export type OrderItem = {
  sku: string;
  variant_id: number;
  title: string;
  price: string; // decimal string
  qty: number;
  qty_recommended?: number | null;
  qty_sales?: number | null;
};

export type Order = {
  order_id: string;
  share_token?: string; // may be returned only in create endpoint
  status: OrderStatus;

  created_at: string;
  updated_at: string;
  created_by?: string;

  dealer_name: string;
  dealer_email: string;
  dealer_company: string;
  notes?: string;

  currency: string;
  items: OrderItem[];
  subtotal: string;

  shopify_checkout_url?: string;

  last_opened_at?: string | null;
  version: number;
};

export type CreateOrderPayload = {
  dealer_name: string;
  dealer_email: string;
  dealer_company?: string;
  notes?: string;
  currency?: string;
  items: { sku: string; qty: number; variant_id?: number; qty_recommended?: number | null; qty_sales?: number | null }[];
};

export type UpdateOrderPayload = {
  expected_version: number;
  dealer_name?: string;
  dealer_email?: string;
  dealer_company?: string;
  notes?: string;
  items?: { sku: string; qty: number; variant_id?: number; qty_recommended?: number | null; qty_sales?: number | null }[];
};

type OrderResponse = {
  order: Order;
  share_url: string;
};

export async function createOrder(payload: CreateOrderPayload): Promise<Order> {
  const res = await fetch(`${API_BASE}/api/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    credentials: "include",
  });
  if (!res.ok) throw new Error(await res.text());
  const data: OrderResponse = await res.json();
  return data.order;
}

export async function listOrders(params?: { status?: string; q?: string }): Promise<Order[]> {
  const url = new URL(`${API_BASE}/api/orders`);
  if (params?.status) url.searchParams.set("status", params.status);
  if (params?.q) url.searchParams.set("q", params.q);

  const res = await fetch(url.toString(), { credentials: "include" });
  if (!res.ok) throw new Error(await res.text());
  const data: { order: Order }[] = await res.json();
  return data.map(item => item.order);
}

export async function getOrder(id?: string): Promise<Order> {
  if (!id || id === 'undefined') throw new Error("Missing order id");
  const res = await fetch(`${API_BASE}/api/orders/${id}`, { credentials: "include" });
  if (!res.ok) throw new Error("order not found");
  const data: OrderResponse = await res.json();
  return data.order;
}

export async function patchOrder(id: string, payload: UpdateOrderPayload): Promise<Order> {
  const res = await fetch(`${API_BASE}/api/orders/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    credentials: "include",
  });
  if (!res.ok) throw new Error(await res.text());
  const data: OrderResponse = await res.json();
  return data.order;
}

export async function sendOrder(id: string): Promise<Order> {
  const res = await fetch(`${API_BASE}/api/orders/${id}/send`, {
    method: "POST",
    credentials: "include",
  });
  if (!res.ok) throw new Error(await res.text());
  const data: OrderResponse = await res.json();
  return data.order;
}

export async function deleteOrder(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/orders/${id}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!res.ok) throw new Error(await res.text());
}

