import { getStoreForDealer as getStoreForDealerFromService } from '../services/dealerConfig.service';

export type StoreCode = "US" | "EU";

// Cache for synchronous access (populated after first async load)
let storeCache: Map<string, StoreCode> | null = null;

/**
 * Initializes the store cache from the dealer config service.
 * This should be called after the dealer config is loaded.
 */
export async function initializeStoreCache(): Promise<void> {
  try {
    const { fetchDealerConfig } = await import('../services/dealerConfig.service');
    const config = await fetchDealerConfig();
    storeCache = new Map();
    config.dealers.forEach(dealer => {
      storeCache!.set(dealer.name, dealer.store);
    });
  } catch (error) {
    console.error('[storeRouting] Failed to initialize store cache:', error);
  }
}

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

/**
 * Matches a dealer name to a store code.
 * Uses cached config if available, otherwise returns null.
 * For async access, use getStoreForDealerFromService directly.
 */
export function matchStoreForDealer(dealerName?: string | null): StoreCode | null {
  if (!dealerName) return null;
  if (!storeCache) {
    // Config not loaded yet, try async lookup as fallback
    // This is a best-effort synchronous fallback
    return null;
  }
  const key = dealerName.trim().toLowerCase();
  return storeCache.get(key) ?? null;
}

/**
 * Resolves store code for a dealer, defaulting to "US" if not found.
 * Uses cached config if available.
 */
export function resolveStoreForDealer(dealerName?: string | null): StoreCode {
  return matchStoreForDealer(dealerName) ?? "US";
}

/**
 * Async version that fetches from service if cache is not available.
 * Use this when you need guaranteed accuracy and can handle async.
 */
export async function resolveStoreForDealerAsync(dealerName?: string | null): Promise<StoreCode> {
  if (!dealerName) return "US";
  try {
    const store = await getStoreForDealerFromService(dealerName);
    return store ?? "US";
  } catch (error) {
    console.error('[storeRouting] Failed to resolve store for dealer:', error);
    return "US";
  }
}
