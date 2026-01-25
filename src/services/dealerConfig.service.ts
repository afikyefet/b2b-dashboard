import { authFetch } from '../api/client';

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '';

export type DealerTheme = {
    primary: string;
    primaryHover: string;
};

export type DealerConfig = {
    name: string;
    store: 'US' | 'EU';
    companyId: string;
    theme: DealerTheme;
};

export type DealerConfigResponse = {
    dealers: DealerConfig[];
    defaultTheme: DealerTheme;
};

let cachedConfig: DealerConfigResponse | null = null;
let configLoadPromise: Promise<DealerConfigResponse> | null = null;

/**
 * Fetches dealer configuration from the backend API.
 * Results are cached after the first successful load.
 */
export async function fetchDealerConfig(): Promise<DealerConfigResponse> {
    // Return cached config if available
    if (cachedConfig) {
        return cachedConfig;
    }

    // Return existing promise if load is in progress
    if (configLoadPromise) {
        return configLoadPromise;
    }

    // Start loading config
    configLoadPromise = (async () => {
        try {
            const res = await authFetch(`${API_BASE}/api/dealers/config`, {
                credentials: 'include',
            });

            if (!res.ok) {
                const text = await res.text();
                throw new Error(`Failed to fetch dealer config: ${res.status} ${text}`);
            }

            const config = await res.json() as DealerConfigResponse;
            
            // Normalize dealer names to lowercase for consistent lookups
            config.dealers = config.dealers.map(dealer => ({
                ...dealer,
                name: dealer.name.toLowerCase().trim(),
            }));

            cachedConfig = config;
            return config;
        } catch (error) {
            configLoadPromise = null; // Reset promise on error so we can retry
            throw error;
        }
    })();

    return configLoadPromise;
}

/**
 * Normalizes a dealer name for lookup (lowercase, trimmed).
 */
function normalizeDealerKey(value: string): string {
    return value.trim().toLowerCase();
}

/**
 * Gets the theme configuration for a dealer.
 * Returns the default theme if dealer is not found or name is not provided.
 */
export async function getDealerTheme(dealerName?: string | null): Promise<DealerTheme> {
    if (!dealerName) {
        const config = await fetchDealerConfig();
        return config.defaultTheme;
    }

    const config = await fetchDealerConfig();
    const dealerKey = normalizeDealerKey(dealerName);
    
    const dealer = config.dealers.find(d => d.name === dealerKey);
    return dealer?.theme ?? config.defaultTheme;
}

/**
 * Gets the store code for a dealer.
 * Returns null if dealer is not found.
 */
export async function getStoreForDealer(dealerName?: string | null): Promise<'US' | 'EU' | null> {
    if (!dealerName) {
        return null;
    }

    const config = await fetchDealerConfig();
    const dealerKey = normalizeDealerKey(dealerName);
    
    const dealer = config.dealers.find(d => d.name === dealerKey);
    return dealer?.store ?? null;
}

/**
 * Gets all dealer names.
 */
export async function getAllDealers(): Promise<string[]> {
    const config = await fetchDealerConfig();
    return config.dealers.map(d => d.name);
}

/**
 * Gets the full dealer configuration for a dealer.
 * Returns null if dealer is not found.
 */
export async function getDealerConfig(dealerName?: string | null): Promise<DealerConfig | null> {
    if (!dealerName) {
        return null;
    }

    const config = await fetchDealerConfig();
    const dealerKey = normalizeDealerKey(dealerName);
    
    return config.dealers.find(d => d.name === dealerKey) ?? null;
}

/**
 * Gets the default theme.
 */
export async function getDefaultTheme(): Promise<DealerTheme> {
    const config = await fetchDealerConfig();
    return config.defaultTheme;
}

/**
 * Initializes the dealer config by fetching it from the API.
 * This should be called early in the app lifecycle.
 */
export async function initializeDealerConfig(): Promise<void> {
    try {
        await fetchDealerConfig();
    } catch (error) {
        console.error('[dealerConfig] Failed to initialize dealer config:', error);
        // Don't throw - allow app to continue with default theme
    }
}
