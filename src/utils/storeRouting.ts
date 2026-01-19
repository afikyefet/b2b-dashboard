export type StoreCode = "US" | "EU";

const dealerStoreMap: Record<string, StoreCode> = {
  "sas tactical equipements": "EU",
  "aalto group": "EU",
  "best protection": "EU",
  "steinadler": "EU",
  "safety agency, s.r.o.": "EU",
  "primary arms": "US",
  "hydrocore concepts llc": "US",
};

export function normalizeStore(input?: string | null): StoreCode | null {
  if (!input) return null;
  const value = input.trim().toUpperCase();
  if (value === "US" || value === "USA" || value === "UNITED STATES" || value === "UNITED_STATES") {
    return "US";
  }
  if (value === "EU" || value === "EUR" || value === "EUROPE") {
    return "EU";
  }
  return null;
}

export function matchStoreForDealer(dealerName?: string | null): StoreCode | null {
  if (!dealerName) return null;
  const key = dealerName.trim().toLowerCase();
  return dealerStoreMap[key] ?? null;
}

export function resolveStoreForDealer(dealerName?: string | null): StoreCode {
  return matchStoreForDealer(dealerName) ?? "US";
}
