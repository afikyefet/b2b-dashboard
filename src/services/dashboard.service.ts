import type { DashboardDataResponse, DashboardHeadersDataResponse, DashboardHeadersResponse, FilterConfig, SortConfig } from '../types/dashboard.types';

function getDashboardData(): Promise<DashboardDataResponse> {
    return fetch('BigQueryDashboardData.json')
        .then(response => response.json())
        .then(data => {
            return data as DashboardDataResponse;
        })
        .catch(error => {
            console.error('Error fetching dashboard data:', error);
            return [];
        });
}
export { getDashboardData };

function getDashboardHeaders(): Promise<DashboardHeadersDataResponse> {
    return fetch('BigQueryDashboardHeaders.json')
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

        // Product Category filter (multi-select - exact match)
        if (filters.productCategory && filters.productCategory.length > 0) {
            const category = String(row.product_category_name || '').trim();
            if (!filters.productCategory.includes(category)) {
                return false;
            }
        }

        // Product Name filter (multi-select - exact match)
        if (filters.productName && filters.productName.length > 0) {
            const productName = String(row.product_name || '').trim();
            if (!filters.productName.includes(productName)) {
                return false;
            }
        }

        // Variant SKU filter (multi-select - exact match)
        if (filters.variantSku && filters.variantSku.length > 0) {
            const sku = String(row.variant_sku_real || '').trim();
            if (!filters.variantSku.includes(sku)) {
                return false;
            }
        }

        // Variant Size filter (multi-select - exact match)
        if (filters.variantSize && filters.variantSize.length > 0) {
            const size = String(row.variant_size || '').trim();
            if (!filters.variantSize.includes(size)) {
                return false;
            }
        }

        // Variant Color filter (multi-select - exact match)
        if (filters.variantColor && filters.variantColor.length > 0) {
            const color = String(row.variant_color || '').trim();
            if (!filters.variantColor.includes(color)) {
                return false;
            }
        }

        return true;
    });
}

// Helper to parse string numbers to numbers for sorting
function parseNumericValue(value: unknown): number | null {
    if (value === null || value === undefined) return null;
    if (typeof value === 'number') return value;
    const num = parseFloat(String(value));
    return isNaN(num) ? null : num;
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

// Apply default sort: when_to_sell ASC, then sell_rate DESC
function applyDefaultSort(data: DashboardDataResponse): DashboardDataResponse {
    if (!data || data.length === 0) return data;

    return [...data].sort((a, b) => {
        // Primary sort: when_to_sell ascending
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
                return whenToSellComparison; // Primary sort determines order
            }
        }

        // Secondary sort: sell_rate descending (only if when_to_sell is equal or both null)
        const aSellRate = parseNumericValue(a.sell_rate);
        const bSellRate = parseNumericValue(b.sell_rate);

        // Handle nulls in sell_rate (put at start for descending)
        if (aSellRate === null && bSellRate === null) {
            return 0; // Both null, equal
        } else if (aSellRate === null) {
            return -1; // a (null) goes to start for descending
        } else if (bSellRate === null) {
            return 1; // b (null) goes to start for descending
        } else {
            const sellRateComparison = bSellRate - aSellRate; // Descending (b - a)
            return sellRateComparison;
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
} {
    if (!data || data.length === 0) {
        return {
            dealerNames: [],
            productCategories: [],
            productNames: [],
            variantSkus: [],
            variantSizes: [],
            variantColors: [],
        };
    }

    const dealerNames = new Set<string>();
    const productCategories = new Set<string>();
    const productNames = new Set<string>();
    const variantSkus = new Set<string>();
    const variantSizes = new Set<string>();
    const variantColors = new Set<string>();

    data.forEach((row) => {
        if (row.customer_company) dealerNames.add(String(row.customer_company));
        if (row.product_category_name) productCategories.add(String(row.product_category_name));
        if (row.product_name) productNames.add(String(row.product_name));
        if (row.variant_sku_real) variantSkus.add(String(row.variant_sku_real));
        if (row.variant_size) variantSizes.add(String(row.variant_size));
        if (row.variant_color) variantColors.add(String(row.variant_color));
    });

    return {
        dealerNames: Array.from(dealerNames).sort(),
        productCategories: Array.from(productCategories).sort(),
        productNames: Array.from(productNames).sort(),
        variantSkus: Array.from(variantSkus).sort(),
        variantSizes: Array.from(variantSizes).sort(),
        variantColors: Array.from(variantColors).sort(),
    };
}

export { filterDashboardData, sortDashboardData, applyFiltersAndSort, getFilterOptions };