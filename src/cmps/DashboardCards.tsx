import { useCart } from "../contexts/CartContext";
import DashboardFilter from "./DashboardFilter";
import type { DashboardDataResponse, DashboardDataRow, DashboardHeader, SortConfig } from "../types/dashboard.types";
import { useState, useEffect, useMemo, useRef } from "react";
import { useSelector, useDispatch } from "react-redux";
import type { AppDispatch } from "../store";
import { selectFilters, setDealerName, resetFilters } from "../store/slices/filterSlice";
import { getDashboardData, getDashboardHeaders, applyFiltersAndSort, getFilterOptions } from "../services/dashboard.service";
import { fetchSkuAvailability, fetchSkuImages, type SkuAvailability, type SkuImage } from "../api/catalogApi";
import { getRowId } from "../utils/rowId";
import { resolveStoreForDealer } from "../utils/storeRouting";
import { getSelectionQty } from "../utils/selectionQty";
import { cn } from "../lib/utils";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";

type OrderInfo = {
    status?: string | null;
    days?: string | number | null;
    date?: string | null;
    orderNo?: string | null;
};

function DashboardCards() {
    const dispatch = useDispatch<AppDispatch>();
    const filters = useSelector(selectFilters);
    const { isInCart, addSku, removeSku } = useCart();
    const [originalData, setOriginalData] = useState<DashboardDataResponse>([]);
    const [headers, setHeaders] = useState<DashboardHeader[]>([]);
    const [sortConfig, setSortConfig] = useState<SortConfig>({ field: '', direction: null });
    const [loadingData, setLoadingData] = useState(false);
    const [loadingHeaders, setLoadingHeaders] = useState(false);
    const [availabilityLoading, setAvailabilityLoading] = useState(false);
    const [availabilityBySku, setAvailabilityBySku] = useState<Record<string, SkuAvailability>>({});
    const [imagesLoading, setImagesLoading] = useState(false);
    const [imagesBySku, setImagesBySku] = useState<Record<string, string | null>>({});
    const [smartSelectDays, setSmartSelectDays] = useState(30);
    const dashboardCacheKey = 'dashboard_table_cache_v1';
    const availabilityRequestId = useRef(0);
    const imagesRequestId = useRef(0);

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

        let cancelled = false;

        const refresh = async () => {
            setLoadingData(true);
            setLoadingHeaders(true);
            try {
                const [data, nextHeaders] = await Promise.all([
                    getDashboardData(),
                    getDashboardHeaders()
                ]);
                if (cancelled) return;
                const enrichedHeaders = injectInStockHeader(nextHeaders);
                setOriginalData(data);
                setHeaders(enrichedHeaders);
                writeCache(data, enrichedHeaders);
            } catch (err) {
                console.error(err);
            } finally {
                if (cancelled) return;
                setLoadingData(false);
                setLoadingHeaders(false);
            }
        };

        refresh();

        return () => {
            cancelled = true;
        };
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

    useEffect(() => {
        if (filteredSkus.length === 0) {
            setImagesBySku({});
            setImagesLoading(false);
            return;
        }

        const requestId = ++imagesRequestId.current;
        setImagesLoading(true);

        fetchSkuImages(filteredSkus, storeCode)
            .then(({ items }) => {
                if (imagesRequestId.current !== requestId) return;
                const next: Record<string, string | null> = {};
                items.forEach((item: SkuImage) => {
                    next[item.sku] = item.image_url ?? null;
                });
                setImagesBySku(next);
            })
            .catch((err) => {
                console.error(err);
                if (imagesRequestId.current !== requestId) return;
                setImagesBySku({});
            })
            .finally(() => {
                if (imagesRequestId.current !== requestId) return;
                setImagesLoading(false);
            });
    }, [filteredSkus, storeCode]);

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

    const toggleSelection = (row: DashboardDataRow) => {
        const sku = row.variant_sku_real;
        if (!sku) return;

        if (isInCart(sku)) {
            removeSku(sku);
            return;
        }

        const initialQty = getSelectionQty(row, smartSelectDays);
        addSku(sku, initialQty);
    };

    const handleSelectAll = () => {
        filteredData.forEach(row => {
            const sku = row.variant_sku_real;
            if (!sku || isInCart(sku)) return;

            const initialQty = getSelectionQty(row, smartSelectDays);
            addSku(sku, initialQty);
        });
    };

    const handleDeselectAll = () => {
        filteredSkus.forEach(sku => {
            if (isInCart(sku)) {
                removeSku(sku);
            }
        });
    };

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
            <div className="flex flex-wrap items-center gap-2">
                <Button
                    type="button"
                    className="h-9 bg-primary px-4 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
                    onClick={handleSelectAll}
                    disabled={filteredSkus.length === 0}
                >
                    Select All
                </Button>
                <Button
                    type="button"
                    variant="outline"
                    className="h-9 border-primary/20 px-4 text-xs font-semibold text-primary hover:bg-primary/10"
                    onClick={handleDeselectAll}
                    disabled={filteredSkus.length === 0}
                >
                    Deselect All
                </Button>
            </div>
            <div className="grid gap-3">
                {filteredData.map((row: DashboardDataRow) => {
                    const rowId = getRowId(row);
                    const sku = row.variant_sku_real;
                    const selected = sku ? isInCart(sku) : false;
                    const availability = sku ? availabilityBySku[sku] : undefined;
                    const inventory = availability?.inventory_quantity ?? 0;
                    const isAvailable = availability ? (availability.available_for_sale || inventory > 0) : null;
                    const imageUrl = sku ? imagesBySku[sku] : null;

                    const orders: OrderInfo[] = [
                        {
                            status: row["1_last_status"] as string | null | undefined,
                            days: row["1_last_days_from_last_sale_created_at"] as string | number | null | undefined,
                            date: row["1_last_sale_created_at"] as string | null | undefined,
                            orderNo: row["1_last_sale_order_no"] as string | null | undefined
                        },
                        {
                            status: row["2_last_status"] as string | null | undefined,
                            days: row["2_last_days_from_last_sale_created_at"] as string | number | null | undefined,
                            date: row["2_last_sale_created_at"] as string | null | undefined,
                            orderNo: row["2_last_sale_order_no"] as string | null | undefined
                        }
                    ].filter(order => order.date);
                    const productUrl = typeof row.url === "string" ? row.url.trim() : "";
                    const sellNowValue = smartSelectDays !== 30
                        ? getSelectionQty(row, smartSelectDays)
                        : row.how_much_to_sell_now;

                    return (
                        <div
                            key={rowId}
                            className={cn(
                                "rounded-lg border bg-card p-4 shadow-sm transition",
                                selected ? "border-primary ring-1 ring-primary/20" : "border-border hover:border-primary/40"
                            )}
                            onClick={() => toggleSelection(row)}
                            role="button"
                            tabIndex={0}
                        >
                            <div className="flex flex-col gap-4 md:flex-row">
                                <div
                                    className="flex h-[72px] w-[72px] flex-shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-muted"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    {imagesLoading && sku && imageUrl === null ? (
                                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-muted-foreground border-t-primary" />
                                    ) : imageUrl ? (
                                        <img src={imageUrl} alt={row.product_name || "Product"} className="h-full w-full object-cover" />
                                    ) : (
                                        <div className="text-[10px] uppercase text-muted-foreground">No Image</div>
                                    )}
                                </div>
                                <div className="grid flex-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                                    <div className="space-y-2">
                                        <div className="space-y-1">
                                            {productUrl ? (
                                                <a
                                                    href={productUrl}
                                                    className="text-sm font-semibold text-foreground hover:underline"
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    onClick={(e) => e.stopPropagation()}
                                                >
                                                    {row.product_name || "Unnamed Product"}
                                                </a>
                                            ) : (
                                                <div className="text-sm font-semibold text-foreground">
                                                    {row.product_name || "Unnamed Product"}
                                                </div>
                                            )}
                                            <div className="text-xs text-muted-foreground">
                                                {row.customer_company || ""}
                                            </div>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-2">
                                            {availabilityLoading && sku && !availability && (
                                                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-muted-foreground border-t-primary" />
                                            )}
                                            {!availabilityLoading && sku && isAvailable !== null && (
                                                <Badge
                                                    className={cn(
                                                        "rounded-full px-2 text-[10px] uppercase tracking-wide",
                                                        isAvailable
                                                            ? "bg-success/10 text-success"
                                                            : "bg-destructive/10 text-destructive"
                                                    )}
                                                >
                                                    {isAvailable ? "In Stock" : "Out of Stock"}
                                                </Badge>
                                            )}
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                                            Product Info
                                        </div>
                                        <div className="grid grid-cols-2 gap-2">
                                            <Field label="Category" value={row.product_category_name} />
                                            <Field label="Variant SKU" value={row.variant_sku_real} />
                                            <Field label="Color" value={row.variant_color} />
                                            <Field label="Size" value={row.variant_size} />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                                            Sales
                                        </div>
                                        <div className="grid grid-cols-2 gap-2">
                                            <Field label="Sell Now" value={sellNowValue} />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                                            Orders
                                        </div>
                                        <div className="flex flex-wrap items-center gap-2">
                                            {orders.length === 0 && (
                                                <span className="text-xs text-muted-foreground">No recent orders</span>
                                            )}
                                            {orders.map((order, index) => (
                                                <OrderBadge
                                                    key={`${rowId}-order-${index}`}
                                                    status={order.status}
                                                    days={order.days}
                                                    date={order.date}
                                                    orderNo={order.orderNo}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
export default DashboardCards;

function Field({ label, value }: { label: string; value: DashboardDataRow[keyof DashboardDataRow] }) {
    const displayValue =
        value === null || value === undefined || String(value).trim() === "" ? "--" : String(value).trim();
    return (
        <div className="flex min-w-0 items-baseline gap-2">
            <span className="text-[10px] text-muted-foreground">{label}</span>
            <span className="truncate text-xs font-medium text-foreground">{displayValue}</span>
        </div>
    );
}

function OrderBadge({ status, days, date, orderNo }: OrderInfo) {
    const normalizedStatus = (status || "").toString().trim().toUpperCase();
    const isClosed = ["DELIVERED", "FULFILLED", "CLOSED", "COMPLETE", "COMPLETED"].includes(normalizedStatus);
    const daysValue = days === null || days === undefined || String(days).trim() === "" ? "" : `${String(days).trim()}d`;
    const orderValue = orderNo && String(orderNo).trim() ? String(orderNo).trim() : "Order";
    const tooltip = date ? `Order date: ${date}` : undefined;

    return (
        <Badge
            className={cn(
                "rounded-full px-3 text-[11px] font-semibold",
                isClosed ? "bg-success/10 text-success" : "bg-warning/15 text-warning"
            )}
            title={tooltip}
        >
            <span className="mr-1">{orderValue}</span>
            <span className="text-[10px]">{daysValue || "--"}</span>
        </Badge>
    );
}
