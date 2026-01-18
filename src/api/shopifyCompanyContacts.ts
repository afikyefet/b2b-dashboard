import { authFetch } from "./client";
import type { StoreCode } from "../utils/storeRouting";

const API_BASE = import.meta.env.VITE_API_BASE_URL;

export type CompanyContact = {
  id: string;
  customer_id: string;
  name: string;
  email: string;
};

export type CompanyContactsResponse = {
  company_id: string;
  company_name: string;
  items: CompanyContact[];
};

export async function getCompanyContacts(
  dealer: string,
  options?: { store?: StoreCode; query?: string; limit?: number }
): Promise<CompanyContactsResponse> {
  const trimmedDealer = dealer.trim();
  if (!trimmedDealer) {
    throw new Error("dealer is required");
  }

  const url = new URL(`${API_BASE}/api/shopify/company-contacts`);
  url.searchParams.set("dealer", trimmedDealer);
  if (options?.store) url.searchParams.set("store", options.store);
  if (options?.query && options.query.trim()) url.searchParams.set("q", options.query.trim());
  if (options?.limit && options.limit > 0) url.searchParams.set("limit", String(options.limit));

  const res = await authFetch(url.toString(), { credentials: "include" });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
