import { authFetch } from './client';
import type { CartItem } from '../contexts/CartContext';

const API_BASE = import.meta.env.VITE_API_BASE_URL;

// Cart Cache API

export type CartByDealer = Record<string, CartItem[]>;

export async function getCartCache(): Promise<CartByDealer> {
  const res = await authFetch(`${API_BASE}/api/cache/cart`);
  if (!res.ok) {
    if (res.status === 404) return {};
    throw new Error(await res.text());
  }
  return res.json();
}

export async function getCartCacheByDealer(dealer: string): Promise<CartItem[]> {
  const res = await authFetch(`${API_BASE}/api/cache/cart/${encodeURIComponent(dealer)}`);
  if (!res.ok) {
    if (res.status === 404) return [];
    throw new Error(await res.text());
  }
  return res.json();
}

export async function updateCartCache(dealer: string, items: CartItem[]): Promise<void> {
  const res = await authFetch(`${API_BASE}/api/cache/cart/${encodeURIComponent(dealer)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items }),
  });
  if (!res.ok) {
    throw new Error(await res.text());
  }
}

export async function deleteCartCache(dealer: string): Promise<void> {
  const res = await authFetch(`${API_BASE}/api/cache/cart/${encodeURIComponent(dealer)}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    throw new Error(await res.text());
  }
}

// Filters Cache API

export type FiltersCache = {
  dealerName: string | null;
};

export async function getFiltersCache(): Promise<FiltersCache> {
  const res = await authFetch(`${API_BASE}/api/cache/filters`);
  if (!res.ok) {
    if (res.status === 404) return { dealerName: null };
    throw new Error(await res.text());
  }
  return res.json();
}

export async function updateFiltersCache(filters: FiltersCache): Promise<void> {
  const res = await authFetch(`${API_BASE}/api/cache/filters`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(filters),
  });
  if (!res.ok) {
    throw new Error(await res.text());
  }
}

// Dashboard Cache API

export type DashboardCacheData = {
  data: unknown[];
  headers: unknown[];
};

export async function getDashboardCache(dealer: string): Promise<DashboardCacheData | null> {
  const res = await authFetch(`${API_BASE}/api/cache/dashboard/${encodeURIComponent(dealer)}`);
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(await res.text());
  }
  return res.json();
}

export async function setDashboardCache(dealer: string, data: DashboardCacheData): Promise<void> {
  const res = await authFetch(`${API_BASE}/api/cache/dashboard/${encodeURIComponent(dealer)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    throw new Error(await res.text());
  }
}

// Products Cache API

export async function getProductsCache<T = unknown>(store: string, query?: string): Promise<T[] | null> {
  const url = new URL(`${API_BASE}/api/cache/products`);
  url.searchParams.set('store', store);
  if (query) url.searchParams.set('q', query);

  const res = await authFetch(url.toString());
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(await res.text());
  }
  return res.json();
}

export async function setProductsCache<T = unknown>(store: string, query: string, items: T[]): Promise<void> {
  const url = new URL(`${API_BASE}/api/cache/products`);
  url.searchParams.set('store', store);
  url.searchParams.set('q', query);

  const res = await authFetch(url.toString(), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(items),
  });
  if (!res.ok) {
    throw new Error(await res.text());
  }
}

// Variants Cache API

export type ProductWithVariants<T = unknown, V = unknown, O = unknown> = {
  product: T;
  variants: V[];
  options: O[];
};

export async function getVariantsCache<T = unknown, V = unknown, O = unknown>(
  store: string,
  productId: string
): Promise<ProductWithVariants<T, V, O> | null> {
  const url = new URL(`${API_BASE}/api/cache/variants/${encodeURIComponent(productId)}`);
  url.searchParams.set('store', store);

  const res = await authFetch(url.toString());
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(await res.text());
  }
  return res.json();
}

export async function setVariantsCache<T = unknown, V = unknown, O = unknown>(
  store: string,
  productId: string,
  data: ProductWithVariants<T, V, O>
): Promise<void> {
  const url = new URL(`${API_BASE}/api/cache/variants/${encodeURIComponent(productId)}`);
  url.searchParams.set('store', store);

  const res = await authFetch(url.toString(), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    throw new Error(await res.text());
  }
}

// Orders Cache API

export async function getOrdersCache<T = unknown>(): Promise<T[] | null> {
  const res = await authFetch(`${API_BASE}/api/cache/orders`);
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(await res.text());
  }
  return res.json();
}

export async function setOrdersCache<T = unknown>(orders: T[]): Promise<void> {
  const res = await authFetch(`${API_BASE}/api/cache/orders`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(orders),
  });
  if (!res.ok) {
    throw new Error(await res.text());
  }
}
