export type StoreCode = "US" | "EU";

const dealerStoreMap: Record<string, StoreCode> = {
  "sas tactical equipements": "EU",
  "aalto group": "EU",
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

export function resolveStoreForDealer(dealerName?: string | null): StoreCode {
  if (!dealerName) return "US";
  const key = dealerName.trim().toLowerCase();
  return dealerStoreMap[key] ?? "US";
}
