import DashboardHeaders from "./DashboardHeaders";
import DashboardRow from "./DashboardRow";
import DashboardFilter from "./DashboardFilter";
import SelectedSkusSidebar from "./SelectedSkusSidebar";
import type { DashboardDataResponse, DashboardDataRow, DashboardHeader, SortConfig } from "../types/dashboard.types";
import { useState, useEffect, useMemo, useRef } from "react";
import { useSelector, useDispatch } from "react-redux";
import type { AppDispatch } from "../store";
import { selectFilters, setDealerName, resetFilters } from "../store/slices/filterSlice";
import { getDashboardData, getDashboardHeaders, applyFiltersAndSort, getFilterOptions } from "../services/dashboard.service";
import { fetchSkuAvailability, type SkuAvailability } from "../api/catalogApi";
import { getRowId } from "../utils/rowId";
import { resolveStoreForDealer } from "../utils/storeRouting";
import { Table, TableBody, TableHeader } from "../components/ui/table";

function DashboardTable() {
    const dispatch = useDispatch<AppDispatch>();
    const filters = useSelector(selectFilters);
    const [originalData, setOriginalData] = useState<DashboardDataResponse>([]);
    const [headers, setHeaders] = useState<DashboardHeader[]>([]);
    const [sortConfig, setSortConfig] = useState<SortConfig>({ field: '', direction: null });
    const [loadingData, setLoadingData] = useState(false);
    const [loadingHeaders, setLoadingHeaders] = useState(false);
    const [availabilityLoading, setAvailabilityLoading] = useState(false);
    const [availabilityBySku, setAvailabilityBySku] = useState<Record<string, SkuAvailability>>({});
    const [smartSelectDays, setSmartSelectDays] = useState(30);
    const dashboardCacheKey = 'dashboard_table_cache_v1';
    const dataRef = useRef<DashboardDataResponse>([]);
    const headersRef = useRef<DashboardHeader[]>([]);
    const availabilityRequestId = useRef(0);

    const injectInStockHeader = (baseHeaders: DashboardHeader[]): DashboardHeader[] => {
        const alreadyExists = baseHeaders.some(header => header.field === 'in_stock_shopify');
        if (alreadyExists) return baseHeaders;

        const insertAfterIndex = baseHeaders.findIndex(header => header.field === 'variant_sku_real');
        const inStockHeader: DashboardHeader = {
            id: 'in_stock_shopify',
            field: 'in_stock_shopify',
            displayName: 'In Stock',
            category: 'inventory'
        };

        if (insertAfterIndex === -1) {
            return [...baseHeaders, inStockHeader];
        }

        const nextHeaders = [...baseHeaders];
        nextHeaders.splice(insertAfterIndex + 1, 0, inStockHeader);
        return nextHeaders;
    };

    useEffect(() => {
        dataRef.current = originalData;
    }, [originalData]);

    useEffect(() => {
        headersRef.current = headers;
    }, [headers]);

    useEffect(() => {
        const readCache = () => {
            try {
                const raw = localStorage.getItem(dashboardCacheKey);
                if (!raw) return null;
                const parsed = JSON.parse(raw) as { data: DashboardDataResponse; headers: DashboardHeader[] };
                if (!parsed || !Array.isArray(parsed.data) || !Array.isArray(parsed.headers)) return null;
                return parsed;
            } catch {
                return null;
            }
        };

        const writeCache = (data: DashboardDataResponse, nextHeaders: DashboardHeader[]) => {
            try {
                localStorage.setItem(dashboardCacheKey, JSON.stringify({ data, headers: nextHeaders }));
            } catch {
                // Ignore cache write failures (e.g. quota).
            }
        };

        const cached = readCache();
        if (cached) {
            const cachedHeaders = injectInStockHeader(cached.headers);
            setOriginalData(cached.data);
            setHeaders(cachedHeaders);
        }

        setLoadingData(true);
        getDashboardData()
            .then((data) => {
                setOriginalData(data);
                writeCache(data, headersRef.current);
            })
            .finally(() => setLoadingData(false));

        setLoadingHeaders(true);
        getDashboardHeaders()
            .then((nextHeaders) => {
                const enrichedHeaders = injectInStockHeader(nextHeaders);
                setHeaders(enrichedHeaders);
                writeCache(dataRef.current, enrichedHeaders);
            })
            .finally(() => setLoadingHeaders(false));
    }, []);

    // Get filter options from original data
    const filterOptions = useMemo(() => {
        return getFilterOptions(originalData);
    }, [originalData]);

    // Initialize default dealer selection if none is set
    useEffect(() => {
        if (!filters.dealerName && filterOptions.dealerNames.length > 0) {
            const firstDealer = filterOptions.dealerNames[0];
            dispatch(setDealerName(firstDealer));
        }
    }, [filterOptions.dealerNames, filters.dealerName, dispatch]);

    // Apply filters and sorting using useMemo
    const filteredData = useMemo(() => {
        return applyFiltersAndSort(originalData, filters, sortConfig);
    }, [originalData, filters, sortConfig]);

    const storeCode = useMemo(() => resolveStoreForDealer(filters.dealerName), [filters.dealerName]);

    const filteredSkus = useMemo(() => {
        const set = new Set<string>();
        filteredData.forEach(row => {
            const sku = row.variant_sku_real;
            if (sku) set.add(String(sku));
        });
        return Array.from(set);
    }, [filteredData]);

    useEffect(() => {
        if (filteredSkus.length === 0) {
            setAvailabilityBySku({});
            setAvailabilityLoading(false);
            return;
        }

        const requestId = ++availabilityRequestId.current;
        setAvailabilityLoading(true);

        fetchSkuAvailability(filteredSkus, storeCode)
            .then(({ items }) => {
                if (availabilityRequestId.current !== requestId) return;
                const next: Record<string, SkuAvailability> = {};
                items.forEach(item => {
                    next[item.sku] = item;
                });
                setAvailabilityBySku(next);
            })
            .catch((err) => {
                console.error(err);
                if (availabilityRequestId.current !== requestId) return;
                setAvailabilityBySku({});
            })
            .finally(() => {
                if (availabilityRequestId.current !== requestId) return;
                setAvailabilityLoading(false);
            });
    }, [filteredSkus, storeCode]);

    const handleSort = (field: string) => {
        setSortConfig((prev) => {
            // If clicking the same field, cycle through: none -> asc -> desc -> none
            if (prev.field === field) {
                if (prev.direction === null) {
                    return { field, direction: 'asc' };
                } else if (prev.direction === 'asc') {
                    return { field, direction: 'desc' };
                } else {
                    return { field: '', direction: null };
                }
            }
            // If clicking a different field, start with asc
            return { field, direction: 'asc' };
        });
    };

    const handleResetSort = () => {
        setSortConfig({ field: '', direction: null });
    };

    const handleResetAll = () => {
        dispatch(resetFilters());
        setSmartSelectDays(30);
        handleResetSort();
    };

    const hasActiveFilters = () => {
        if (smartSelectDays !== 30) return true;
        if (filters.generalSearch && filters.generalSearch.trim()) return true;
        // Dealer name is always set (required), so ignore it for "Reset All"
        const { dealerName: _dealerName, ...otherFilters } = filters;
        return Object.values(otherFilters).some(value => {
            if (Array.isArray(value)) {
                return value.length > 0;
            }
            return !!value;
        });
    };
    const hasActiveSort = sortConfig.field && sortConfig.direction;

    if (!headers || headers.length === 0) {
        return <div className="py-10 text-center text-sm text-muted-foreground">Loading...</div>;
    }

    return (
        <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-4 px-4 pb-10 pt-6">
            <DashboardFilter
                filterOptions={filterOptions}
                originalData={originalData}
                filteredData={filteredData}
                onResetAll={handleResetAll}
                hasActiveFilters={!!(hasActiveFilters() || hasActiveSort)}
                isRefreshing={(loadingData || loadingHeaders) && originalData.length > 0 && headers.length > 0}
                smartSelectDays={smartSelectDays}
                onSmartSelectDaysChange={setSmartSelectDays}
            />
            <div className="rounded-lg border border-border bg-card p-2 shadow-sm">
                <Table className="min-w-[1200px]">
                    <TableHeader>
                        <DashboardHeaders
                            headers={headers}
                            sortConfig={sortConfig}
                            onSort={handleSort}
                            filteredData={filteredData}
                        />
                    </TableHeader>
                    <TableBody>
                        {filteredData.map((row: DashboardDataRow) => {
                            const rowId = getRowId(row);
                            return (
                                <DashboardRow
                                    key={rowId}
                                    row={row}
                                    headers={headers}
                                    availabilityBySku={availabilityBySku}
                                    availabilityLoading={availabilityLoading}
                                    selectionDays={smartSelectDays}
                                />
                            );
                        })}
                    </TableBody>
                </Table>
            </div>
            <SelectedSkusSidebar filteredData={filteredData} />
        </div>
    );
}

export default DashboardTable;
