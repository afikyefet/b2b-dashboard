import type { DashboardDataResponse, DashboardDataRow, DashboardHeadersDataResponse, DashboardHeadersResponse, FilterConfig, SortConfig } from '../types/dashboard.types';
import { authFetch } from '../api/client';

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '';

// function getDashboardData(): Promise<DashboardDataResponse> {
//     return fetch('BigQueryDashboardData.json')
//         .then(response => response.json())
//         .then(data => {
//             return data as DashboardDataResponse;
//         })
//         .catch(error => {
//             console.error('Error fetching dashboard data:', error);
//             return [];
//         });
// }
// export { getDashboardData };

// export async function getDashboardData(
//   pageSize = 200,
//   pageToken?: string
// ): Promise<DistributionInsightsResponse> {
//   const params = new URLSearchParams();
//   params.set("pageSize", String(pageSize));
//   if (pageToken) params.set("pageToken", pageToken);

//   const res = await fetch(`/api/distribution-insights?${params.toString()}`, {
//     credentials: "include",
//   });

//   const text = await res.text();

//   if (!res.ok) {
//     throw new Error(`API ${res.status}: ${text.slice(0, 200)}`);
//   }

//   try {
//     return JSON.parse(text) as DistributionInsightsResponse;
//   } catch {
//     console.error("Expected JSON, got:", text.slice(0, 200));
//     throw new Error("API did not return JSON");
//   }
// }

export async function getDashboardData(): Promise<DashboardDataResponse> {
  const res = await authFetch(`${API_BASE}/api/distribution-insights?pageSize=500`, {
    credentials: "include",
  });

  const text = await res.text();
//   console.log('[dashboard.service] /api/distribution-insights status', res.status, 'content-type', res.headers.get('content-type'));
//   console.log('[dashboard.service] response text (slice)', text.slice(0, 300));
  if (!res.ok) throw new Error(text);

  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch (error) {
    console.error('[dashboard.service] JSON parse failed', error);
    throw error;
  }

  // normalize: endpoint returns { rows, nextPageToken }
  if (Array.isArray(json)) {
    // console.log('[dashboard.service] normalized rows from array', json.length);
    return json;
  }
  if (json && typeof json === 'object' && Array.isArray((json as { rows?: unknown }).rows)) {
    const rows = (json as { rows: DashboardDataResponse }).rows;
    // console.log('[dashboard.service] normalized rows from object', rows.length);
    return rows;
  }

  console.error("[dashboard.service] unexpected response shape", json);
  return [];
}


function getDashboardHeaders(): Promise<DashboardHeadersDataResponse> {
    return fetch('/BigQueryDashboardHeaders.json')
        .then(response => response.json())
        .then((data: DashboardHeadersResponse) => {
            return data.headers || [];
        })
        .catch(error => {
            console.error('Error fetching dashboard headers:', error);
            return [];
        });
}
export { getDashboardHeaders };

function filterDashboardData(data: DashboardDataResponse, filters: FilterConfig): DashboardDataResponse {
    if (!data || data.length === 0) return data;

    return data.filter((row) => {
        // General search - searches across all relevant fields
        if (filters.generalSearch && filters.generalSearch.trim()) {
            const searchTerm = filters.generalSearch.toLowerCase().trim();
            const searchableFields = [
                String(row.customer_company || ''),
                String(row.product_category_name || ''),
                String(row.product_name || ''),
                String(row.variant_sku_real || ''),
                String(row.variant_color || ''),
                String(row.variant_size || ''),
            ];
            
            const matches = searchableFields.some(field => 
                field.toLowerCase().includes(searchTerm)
            );
            
            if (!matches) {
                return false;
            }
        }

        // Dealer Name filter (single-select - exact match)
        if (filters.dealerName) {
            const dealerName = String(row.customer_company || '').trim();
            if (filters.dealerName !== dealerName) {
                return false;
            }
        }

        // Count of last orders available in row (based on slots 1/2)
        if (filters.recentOrdersCount) {
            const count = getRecentOrdersCount(row);
            if (filters.recentOrdersCount === '1_or_2') {
                if (count !== 1 && count !== 2) {
                    return false;
                }
            } else {
                if (count !== Number(filters.recentOrdersCount)) {
                    return false;
                }
            }
        }

        // Count of open/orange orders in slots 1/2
        if (filters.openOrdersCount) {
            const openCount = getOpenRecentOrdersCount(row);
            if (openCount !== Number(filters.openOrdersCount)) {
                return false;
            }
        }

        return true;
    });
}

const CLOSED_SALE_STATUSES = new Set([
    'DELIVERED',
    'FULFILLED',
    'CLOSED',
    'COMPLETE',
    'COMPLETED',
    'CANCELLED',
    'CANCELED',
]);

function hasRecentOrderInSlot(row: DashboardDataRow, slot: 1 | 2): boolean {
    const date = String(row[`${slot}_last_sale_created_at`] || '').trim();
    if (date) return true;
    const orderNo = String(row[`${slot}_last_sale_order_no`] || '').trim();
    if (orderNo) return true;
    const status = String(row[`${slot}_last_status`] || '').trim();
    return !!status;
}

function getRecentOrdersCount(row: DashboardDataRow): number {
    let count = 0;
    if (hasRecentOrderInSlot(row, 1)) count += 1;
    if (hasRecentOrderInSlot(row, 2)) count += 1;
    return count;
}

function isOpenSaleStatus(status: string): boolean {
    const normalized = status.trim().toUpperCase();
    if (!normalized) return false;
    return !CLOSED_SALE_STATUSES.has(normalized);
}

function getOpenRecentOrdersCount(row: DashboardDataRow): number {
    let openCount = 0;
    ([1, 2] as const).forEach((slot) => {
        if (!hasRecentOrderInSlot(row, slot)) return;
        const status = String(row[`${slot}_last_status`] || '');
        if (isOpenSaleStatus(status)) {
            openCount += 1;
        }
    });
    return openCount;
}

// Helper to parse string numbers to numbers for sorting
function parseNumericValue(value: unknown): number | null {
    if (value === null || value === undefined) return null;
    if (typeof value === 'number') return value;
    const num = parseFloat(String(value));
    return isNaN(num) ? null : num;
}

// Helper to calculate range bounds from data
function calculateRangeBounds(
    data: DashboardDataResponse,
    field: keyof DashboardDataRow
): { min: number; max: number } {
    const values = data
        .map(row => parseNumericValue(row[field]))
        .filter((v): v is number => v !== null);

    if (values.length === 0) return { min: 0, max: 100 };

    return {
        min: Math.floor(Math.min(...values)),
        max: Math.ceil(Math.max(...values)),
    };
}

function sortDashboardData(data: DashboardDataResponse, sortConfig: SortConfig): DashboardDataResponse {
    if (!data || data.length === 0) return data;
    if (!sortConfig.field || !sortConfig.direction) return [...data];

    return [...data].sort((a, b) => {
        const aValue = a[sortConfig.field as keyof typeof a];
        const bValue = b[sortConfig.field as keyof typeof b];

        // Try to parse as numbers first for numeric comparison
        const aNum = parseNumericValue(aValue);
        const bNum = parseNumericValue(bValue);

        // Handle null/undefined values
        if (aNum === null && bNum === null) return 0;
        if (aNum === null) return sortConfig.direction === 'asc' ? 1 : -1; // nulls at end for asc, start for desc
        if (bNum === null) return sortConfig.direction === 'asc' ? -1 : 1;

        let comparison = 0;

        // If both can be parsed as numbers, compare numerically
        if (aNum !== null && bNum !== null) {
            comparison = aNum - bNum;
        }
        // Handle string comparisons
        else if (typeof aValue === 'string' && typeof bValue === 'string') {
            comparison = aValue.localeCompare(bValue, undefined, { sensitivity: 'base' });
        }
        // Handle number comparisons (if not already handled)
        else if (typeof aValue === 'number' && typeof bValue === 'number') {
            comparison = aValue - bValue;
        }
        // Handle mixed types - convert to string
        else {
            const aStr = String(aValue);
            const bStr = String(bValue);
            comparison = aStr.localeCompare(bStr, undefined, { sensitivity: 'base' });
        }

        // Apply sort direction
        return sortConfig.direction === 'asc' ? comparison : -comparison;
    });
}

// Apply default sort: when_to_sell ASC (0 up), then sell_rate DESC (high to low)
function applyDefaultSort(data: DashboardDataResponse): DashboardDataResponse {
    if (!data || data.length === 0) return data;

    return [...data].sort((a, b) => {
        // Primary sort: when_to_sell ascending (0, 1, 2, ...)
        const aWhenToSell = parseNumericValue(a.when_to_sell);
        const bWhenToSell = parseNumericValue(b.when_to_sell);

        // Handle nulls in when_to_sell (put at end for ascending)
        if (aWhenToSell === null && bWhenToSell === null) {
            // Both null, proceed to secondary sort
        } else if (aWhenToSell === null) {
            return 1; // a goes to end
        } else if (bWhenToSell === null) {
            return -1; // b goes to end
        } else {
            const whenToSellComparison = aWhenToSell - bWhenToSell;
            if (whenToSellComparison !== 0) {
                return whenToSellComparison; // Primary sort: 0 up (ascending)
            }
        }

        // Secondary sort: sell_rate descending (high to low)
        const aSellRate = parseNumericValue(a.sell_rate);
        const bSellRate = parseNumericValue(b.sell_rate);

        // Handle nulls in sell_rate (put at end for descending)
        if (aSellRate === null && bSellRate === null) {
            // Both null, proceed to tertiary sort
        } else if (aSellRate === null) {
            return 1; // a (null) goes to end for descending
        } else if (bSellRate === null) {
            return -1; // b (null) goes to end for descending
        } else {
            const sellRateComparison = bSellRate - aSellRate; // Descending (high to low)
            if (sellRateComparison !== 0) {
                return sellRateComparison;
            }
        }

        // Tertiary sort: how_much_to_sell_now ascending (put nulls at end)
        const aHowMuchToSell = parseNumericValue(a.how_much_to_sell_now);
        const bHowMuchToSell = parseNumericValue(b.how_much_to_sell_now);

        // Handle nulls in how_much_to_sell_now (put at end for ascending)
        if (aHowMuchToSell === null && bHowMuchToSell === null) {
            return 0; // Both null, equal
        } else if (aHowMuchToSell === null) {
            return 1; // a (null) goes to end
        } else if (bHowMuchToSell === null) {
            return -1; // b (null) goes to end
        } else {
            return aHowMuchToSell - bHowMuchToSell; // Ascending
        }
    });
}

function applyFiltersAndSort(
    data: DashboardDataResponse,
    filters: FilterConfig,
    sortConfig: SortConfig
): DashboardDataResponse {
    let result = [...data];
    
    // Apply filters first
    result = filterDashboardData(result, filters);
    
    // Always apply default sort first (when_to_sell ASC, sell_rate DESC)
    result = applyDefaultSort(result);
    
    // Then apply user's sort on top if they have selected one
    if (sortConfig.field && sortConfig.direction) {
        result = sortDashboardData(result, sortConfig);
    }
    
    return result;
}

function getFilterOptions(data: DashboardDataResponse): {
    dealerNames: string[];
    productCategories: string[];
    productNames: string[];
    variantSkus: string[];
    variantSizes: string[];
    variantColors: string[];
    productSellTypes: string[];
} {
    if (!data || data.length === 0) {
        return {
            dealerNames: [],
            productCategories: [],
            productNames: [],
            variantSkus: [],
            variantSizes: [],
            variantColors: [],
            productSellTypes: [],
        };
    }

    const dealerNames = new Set<string>();
    const productCategories = new Set<string>();
    const productNames = new Set<string>();
    const variantSkus = new Set<string>();
    const variantSizes = new Set<string>();
    const variantColors = new Set<string>();
    const productSellTypes = new Set<string>();

    data.forEach((row) => {
        if (row.customer_company) dealerNames.add(String(row.customer_company));
        if (row.product_category_name) productCategories.add(String(row.product_category_name));
        if (row.product_name) productNames.add(String(row.product_name));
        if (row.variant_sku_real) variantSkus.add(String(row.variant_sku_real));
        if (row.variant_size) variantSizes.add(String(row.variant_size));
        if (row.variant_color) variantColors.add(String(row.variant_color));
        if (row.product_sell_type) productSellTypes.add(String(row.product_sell_type));
    });

    return {
        dealerNames: Array.from(dealerNames).sort(),
        productCategories: Array.from(productCategories).sort(),
        productNames: Array.from(productNames).sort(),
        variantSkus: Array.from(variantSkus).sort(),
        variantSizes: Array.from(variantSizes).sort(),
        variantColors: Array.from(variantColors).sort(),
        productSellTypes: Array.from(productSellTypes).sort(),
    };
}

export { filterDashboardData, sortDashboardData, applyFiltersAndSort, getFilterOptions, calculateRangeBounds };
