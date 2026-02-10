import { useCart } from "../contexts/CartContext";
import DashboardFilter from "./DashboardFilter";
import SelectedSkusSidebar from "./SelectedSkusSidebar";
import type { DashboardDataResponse, DashboardDataRow, DashboardHeader, SortConfig } from "../types/dashboard.types";
import { useState, useEffect, useMemo, useRef } from "react";
import { AlertTriangle, BarChart3, ClipboardList, Search, Sparkles } from "lucide-react";
import { useSelector, useDispatch } from "react-redux";
import type { AppDispatch } from "../store";
import { selectFilters, setDealerName, resetFilters } from "../store/slices/filterSlice";
import { getDashboardData, getDashboardHeaders, applyFiltersAndSort, getFilterOptions } from "../services/dashboard.service";
import { fetchSkuAvailability, fetchSkuImages, type SkuAvailability, type SkuImage } from "../api/catalogApi";
import { getRowId } from "../utils/rowId";
import { resolveStoreForDealer } from "../utils/storeRouting";
import { getSelectionQty } from "../utils/selectionQty";
import { exportSkuQtyCsv } from "../utils/csvExport";
import { cn } from "../lib/utils";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { ScrollArea } from "../components/ui/scroll-area";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "../components/ui/table";

type OrderInfo = {
    status?: string | null;
    days?: string | number | null;
    date?: string | null;
    orderNo?: string | null;
    qty?: number | null;
};

type SellTypeTab = 'restock' | 'problematic' | 'awaiting';

type HistoricalOrderItem = {
    sku: string;
    productName: string;
    variant: string;
    customerCompany: string;
    qty: number | null;
    sellNowQty: number;
};

type HistoricalOrderGroup = {
    orderNo: string;
    status: string;
    date: string;
    items: HistoricalOrderItem[];
};

const CLOSED_STATUSES = new Set(["DELIVERED", "FULFILLED", "CLOSED", "COMPLETE", "COMPLETED", "CANCELLED", "CANCELED"]);

function isClosedStatus(status: string) {
    return CLOSED_STATUSES.has(status.trim().toUpperCase());
}

function parseQty(value: unknown): number | null {
    if (value === null || value === undefined) return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}

function normalizeSku(value: unknown): string {
    return String(value ?? '').trim();
}

function getVariantLabel(row: DashboardDataRow): string {
    const color = String(row.variant_color || '').trim();
    const size = String(row.variant_size || '').trim();
    if (color && size) return `${color} / ${size}`;
    if (color) return color;
    if (size) return size;
    return '';
}

function matchesGeneralSearch(row: DashboardDataRow, searchTerm: string): boolean {
    const normalized = searchTerm.trim().toLowerCase();
    if (!normalized) return true;
    const searchableFields = [
        String(row.customer_company || ''),
        String(row.product_category_name || ''),
        String(row.product_name || ''),
        String(row.variant_sku_real || ''),
        String(row.variant_color || ''),
        String(row.variant_size || ''),
    ];
    return searchableFields.some(field => field.toLowerCase().includes(normalized));
}

function aggregateHistoricalOrders(rows: DashboardDataRow[]): HistoricalOrderGroup[] {
    const map = new Map<string, HistoricalOrderGroup>();

    rows.forEach((row) => {
        ([1, 2] as const).forEach((slot) => {
            const orderNo = String(row[`${slot}_last_sale_order_no`] || '').trim();
            if (!orderNo) return;

            const status = String(row[`${slot}_last_status`] || '').trim();
            const date = String(row[`${slot}_last_sale_created_at`] || '').trim();
            const itemKey = `${String(row.variant_sku_real || '').trim()}|${String(row.customer_company || '').trim()}`;
            const sku = String(row.variant_sku_real || '').trim();
            if (!sku) return;

            const nextItem: HistoricalOrderItem = {
                sku,
                productName: String(row.product_name || '').trim() || sku,
                variant: getVariantLabel(row),
                customerCompany: String(row.customer_company || '').trim(),
                qty: parseQty(row[`${slot}_last_quantity`]),
                sellNowQty: parseQty(row.how_much_to_sell_now) ?? 0,
            };

            const existing = map.get(orderNo);
            if (!existing) {
                map.set(orderNo, {
                    orderNo,
                    status,
                    date,
                    items: [nextItem],
                });
                return;
            }

            const existingDateMs = existing.date ? new Date(existing.date).getTime() : 0;
            const incomingDateMs = date ? new Date(date).getTime() : 0;
            if (incomingDateMs > existingDateMs) {
                existing.date = date;
                existing.status = status;
            } else if (!existing.status && status) {
                existing.status = status;
            }

            const existingItem = existing.items.find(
                item => `${item.sku}|${item.customerCompany}` === itemKey
            );
            if (!existingItem) {
                existing.items.push(nextItem);
            } else if (existingItem.qty !== null && nextItem.qty !== null) {
                existingItem.qty += nextItem.qty;
            }
        });
    });

    const groups = Array.from(map.values());
    groups.forEach((group) => {
        group.items.sort((a, b) => a.productName.localeCompare(b.productName, undefined, { sensitivity: 'base' }));
    });

    groups.sort((a, b) => {
        const aMs = a.date ? new Date(a.date).getTime() : 0;
        const bMs = b.date ? new Date(b.date).getTime() : 0;
        if (aMs !== bMs) return bMs - aMs;
        return a.orderNo.localeCompare(b.orderNo, undefined, { sensitivity: 'base' });
    });

    return groups;
}

function DashboardCards() {
    const dispatch = useDispatch<AppDispatch>();
    const filters = useSelector(selectFilters);
    const { cart, hydrated, isInCart, addSku, removeSku } = useCart();
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
    const [sellTypeTab, setSellTypeTab] = useState<SellTypeTab>('restock');
    const [orderManagerOpen, setOrderManagerOpen] = useState(false);
    const [focusedOrderNo, setFocusedOrderNo] = useState<string | null>(null);
    const [orderManagerSearch, setOrderManagerSearch] = useState('');
    const dashboardCacheKey = 'dashboard_table_cache_v1';
    const availabilityRequestId = useRef(0);
    const imagesRequestId = useRef(0);

    const injectInStockHeader = (baseHeaders: DashboardHeader[]): DashboardHeader[] => {
        const alreadyExists = baseHeaders.some(header => header.field === 'in_stock_shopify');
        if (alreadyExists) {
            return baseHeaders;
        }

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
                if (cancelled) {
                    return;
                }
                const enrichedHeaders = injectInStockHeader(nextHeaders);
                setOriginalData(data);
                setHeaders(enrichedHeaders);
                writeCache(data, enrichedHeaders);
            } catch (err) {
                console.error(err);
            } finally {
                if (!cancelled) {
                    setLoadingData(false);
                    setLoadingHeaders(false);
                }
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
    const filteredDataBeforeStock = useMemo(() => {
        return applyFiltersAndSort(originalData, filters, sortConfig);
    }, [originalData, filters, sortConfig]);

    // Apply in-stock filter after availability data is loaded
    const filteredData = useMemo(() => {
        if (!filters.outOfStockOnly) {
            return filteredDataBeforeStock;
        }
        
        return filteredDataBeforeStock.filter((row) => {
            const sku = row.variant_sku_real;
            if (!sku) return false;
            
            const availability = availabilityBySku[sku];
            if (!availability) {
                // If availability is still loading, exclude it (will be included when loaded if in stock)
                // If availability failed to load, exclude it
                return false;
            }
            
            const inventory = availability.inventory_quantity ?? 0;
            const isAvailable = availability.available_for_sale || inventory > 0;
            return isAvailable; // Only show in stock items
        });
    }, [filteredDataBeforeStock, filters.outOfStockOnly, availabilityBySku]);

    const searchedData = useMemo(() => {
        const searchTerm = String(filters.generalSearch || '').trim();
        if (!searchTerm) return filteredData;
        return filteredData.filter((row) => matchesGeneralSearch(row, searchTerm));
    }, [filteredData, filters.generalSearch]);

    const tabCounts = useMemo(() => {
        let restock = 0;
        let problematic = 0;
        let awaiting = 0;
        searchedData.forEach((row) => {
            const sellType = String(row.product_sell_type || '').trim().toLowerCase();
            if (sellType === 'plan restock' || sellType === 'restock required') {
                restock += 1;
            } else if (sellType === 'problematic product') {
                problematic += 1;
            } else if (sellType === 'awaiting further data' || sellType === 'awaiting furthur data') {
                awaiting += 1;
            }
        });
        return { restock, problematic, awaiting };
    }, [searchedData]);

    const tabFilteredData = useMemo(() => {
        return searchedData.filter((row) => {
            const sellType = String(row.product_sell_type || '').trim().toLowerCase();
            if (sellTypeTab === 'restock') {
                return sellType === 'plan restock' || sellType === 'restock required';
            }
            if (sellTypeTab === 'problematic') {
                return sellType === 'problematic product';
            }
            return sellType === 'awaiting further data' || sellType === 'awaiting furthur data';
        });
    }, [searchedData, sellTypeTab]);

    const companyRowsForOrderManager = useMemo(() => {
        const dealerName = String(filters.dealerName || '').trim();
        if (!dealerName) return originalData;
        return originalData.filter(
            (row) => String(row.customer_company || '').trim() === dealerName
        );
    }, [originalData, filters.dealerName]);

    const sellTypeConfigs = useMemo(() => ([
        {
            id: 'restock' as const,
            title: 'Restock Queue',
            subtitle: 'Plan Restock + Restock Required',
            count: tabCounts.restock,
            icon: Sparkles,
        },
        {
            id: 'problematic' as const,
            title: 'Problematic',
            subtitle: 'Needs manual review',
            count: tabCounts.problematic,
            icon: AlertTriangle,
        },
        {
            id: 'awaiting' as const,
            title: 'Awaiting Data',
            subtitle: 'Needs more data signals',
            count: tabCounts.awaiting,
            icon: BarChart3,
        },
    ]), [tabCounts]);

    const orderManagerSourceRows = companyRowsForOrderManager;

    const aggregatedHistoricalOrders = useMemo(
        () => aggregateHistoricalOrders(orderManagerSourceRows),
        [orderManagerSourceRows]
    );

    const visibleHistoricalOrders = useMemo(() => {
        const query = orderManagerSearch.trim().toLowerCase();
        if (!query) return aggregatedHistoricalOrders;

        return aggregatedHistoricalOrders.filter((group) => {
            if (group.orderNo.toLowerCase().includes(query)) return true;
            if (group.status.toLowerCase().includes(query)) return true;
            return group.items.some((item) => {
                const haystack = [
                    item.sku,
                    item.productName,
                    item.variant,
                    item.customerCompany,
                ]
                    .filter(Boolean)
                    .join(' ')
                    .toLowerCase();
                return haystack.includes(query);
            });
        });
    }, [aggregatedHistoricalOrders, orderManagerSearch]);

    const focusedHistoricalOrder = useMemo(() => {
        if (!focusedOrderNo) return null;
        return aggregatedHistoricalOrders.find((order) => order.orderNo === focusedOrderNo) ?? null;
    }, [aggregatedHistoricalOrders, focusedOrderNo]);

    const storeCode = useMemo(() => resolveStoreForDealer(filters.dealerName), [filters.dealerName]);

    // Compute SKUs from filteredDataBeforeStock to avoid refetching when stock filter is applied
    // This way we fetch availability for all filtered SKUs, then filter the display based on stock status
    const filteredSkus = useMemo(() => {
        const set = new Set<string>();
        filteredDataBeforeStock.forEach(row => {
            const sku = row.variant_sku_real;
            if (sku) set.add(String(sku));
        });
        return Array.from(set);
    }, [filteredDataBeforeStock]);

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
        if (filters.recentOrdersCount) return true;
        if (filters.openOrdersCount) return true;
        if (filters.outOfStockOnly === false) return true;
        return false;
    };
    const hasActiveSort = sortConfig.field && sortConfig.direction;

    const visibleSelectedItems = useMemo(() => {
        if (tabFilteredData.length === 0 || cart.length === 0) return [];
        const cartBySku = new Map(cart.map(item => [item.sku, item]));

        return tabFilteredData.flatMap((row) => {
            const sku = row.variant_sku_real;
            if (!sku) return [];
            const selectedItem = cartBySku.get(String(sku));
            if (!selectedItem) return [];
            return [{
                sku: selectedItem.sku,
                qty: selectedItem.qty,
                qty_recommended: selectedItem.qty_recommended,
                title: row.product_name || hydrated[selectedItem.sku]?.product_title || selectedItem.sku,
            }];
        });
    }, [tabFilteredData, cart, hydrated]);

    const tabFilteredSkus = useMemo(() => {
        const skus = new Set<string>();
        tabFilteredData.forEach((row) => {
            const sku = row.variant_sku_real;
            if (sku) skus.add(String(sku));
        });
        return Array.from(skus);
    }, [tabFilteredData]);

    if (!headers || headers.length === 0) {
        return <div className="py-10 text-center text-sm text-muted-foreground">Loading...</div>;
    }

    const toggleSelection = (row: DashboardDataRow) => {
        const sku = normalizeSku(row.variant_sku_real);
        if (!sku) return;

        if (isInCart(sku)) {
            removeSku(sku);
            return;
        }

        const initialQty = getSelectionQty(row, smartSelectDays);
        addSku(sku, initialQty);
    };

    const handleSelectAll = () => {
        tabFilteredData.forEach(row => {
            const sku = normalizeSku(row.variant_sku_real);
            if (!sku || isInCart(sku)) return;

            const initialQty = getSelectionQty(row, smartSelectDays);
            addSku(sku, initialQty);
        });
    };

    const handleDeselectAll = () => {
        tabFilteredSkus.forEach(sku => {
            if (isInCart(sku)) {
                removeSku(sku);
            }
        });
    };

    const handleExportCsv = () => {
        exportSkuQtyCsv(visibleSelectedItems, hydrated, filters.dealerName || undefined);
    };

    const handleOpenOrderDetails = (orderNo?: string | null) => {
        const normalized = String(orderNo || '').trim();
        if (!normalized) return;
        setFocusedOrderNo(normalized);
    };

    const handleFocusedOrderDialogChange = (open: boolean) => {
        if (!open) {
            setFocusedOrderNo(null);
        }
    };

    return (
        <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-4 px-4 pb-10 pt-6 max-md:px-2 max-md:gap-3 max-md:pb-6 max-md:pt-4">
            <DashboardFilter
                filteredData={tabFilteredData}
                onResetAll={handleResetAll}
                hasActiveFilters={!!(hasActiveFilters() || hasActiveSort)}
                isRefreshing={(loadingData || loadingHeaders) && originalData.length > 0 && headers.length > 0}
                smartSelectDays={smartSelectDays}
                onSmartSelectDaysChange={setSmartSelectDays}
            />
            <div className="rounded-xl border border-border bg-card/60 p-3 shadow-sm">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                            Order Config
                        </div>
                        <div className="text-sm font-semibold text-foreground">
                            Choose your decision lane
                        </div>
                    </div>
                    <Button
                        type="button"
                        variant="outline"
                        className="gap-2"
                        onClick={() => setOrderManagerOpen(true)}
                    >
                        <ClipboardList className="h-4 w-4" />
                        Order Manager
                    </Button>
                </div>
                <div className="grid gap-2 md:grid-cols-3">
                    {sellTypeConfigs.map((config) => {
                        const Icon = config.icon;
                        const isActive = sellTypeTab === config.id;
                        return (
                            <button
                                key={config.id}
                                type="button"
                                onClick={() => setSellTypeTab(config.id)}
                                className={cn(
                                    "rounded-lg border px-3 py-3 text-left transition",
                                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                                    isActive
                                        ? "border-primary bg-primary/10 shadow-sm"
                                        : "border-border bg-background hover:border-primary/40 hover:bg-primary/5"
                                )}
                            >
                                <div className="mb-2 flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                                        <Icon className="h-4 w-4 text-primary" />
                                        <span>{config.title}</span>
                                    </div>
                                    <Badge variant="secondary" className="text-[10px]">
                                        {config.count}
                                    </Badge>
                                </div>
                                <div className="text-xs text-muted-foreground">{config.subtitle}</div>
                            </button>
                        );
                    })}
                </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 max-md:flex-col max-md:gap-2">
                <Button
                    type="button"
                    className="h-9 bg-primary px-4 text-xs font-semibold text-primary-foreground hover:bg-primary/90 max-md:w-full max-md:h-11 max-md:min-h-[44px] max-md:text-sm"
                    onClick={handleSelectAll}
                    disabled={tabFilteredSkus.length === 0}
                >
                    Select All
                </Button>
                <Button
                    type="button"
                    variant="outline"
                    className="h-9 border-primary/20 px-4 text-xs font-semibold text-primary hover:bg-primary/10 max-md:w-full max-md:h-11 max-md:min-h-[44px] max-md:text-sm"
                    onClick={handleDeselectAll}
                    disabled={tabFilteredSkus.length === 0}
                >
                    Deselect All
                </Button>
                <Button
                    type="button"
                    variant="outline"
                    className="h-9 border-primary/20 px-4 text-xs font-semibold text-primary hover:bg-primary/10 max-md:w-full max-md:h-11 max-md:min-h-[44px] max-md:text-sm"
                    onClick={handleExportCsv}
                    disabled={visibleSelectedItems.length === 0}
                >
                    Export CSV
                </Button>
            </div>
            <div className="grid gap-3">
                {tabFilteredData.map((row: DashboardDataRow) => {
                    const rowId = getRowId(row);
                    const sku = normalizeSku(row.variant_sku_real);
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
                            orderNo: row["1_last_sale_order_no"] as string | null | undefined,
                            qty: parseQty(row["1_last_quantity"]),
                        },
                        {
                            status: row["2_last_status"] as string | null | undefined,
                            days: row["2_last_days_from_last_sale_created_at"] as string | number | null | undefined,
                            date: row["2_last_sale_created_at"] as string | null | undefined,
                            orderNo: row["2_last_sale_order_no"] as string | null | undefined,
                            qty: parseQty(row["2_last_quantity"]),
                        }
                    ].filter(order => {
                        const orderNo = String(order.orderNo || '').trim();
                        const hasDate = String(order.date || '').trim().length > 0;
                        return !!orderNo || hasDate;
                    });
                    const productUrl = typeof row.url === "string" ? row.url.trim() : "";
                    const sellNowValue = smartSelectDays !== 30
                        ? getSelectionQty(row, smartSelectDays)
                        : row.how_much_to_sell_now;

                    return (
                        <div
                            key={rowId}
                            className={cn(
                                "rounded-lg border bg-card p-4 shadow-sm transition max-md:p-3",
                                selected ? "border-primary ring-1 ring-primary/20" : "border-border hover:border-primary/40"
                            )}
                            onClick={() => toggleSelection(row)}
                            role="button"
                            tabIndex={0}
                        >
                            <div className="flex flex-col gap-4 md:flex-row max-md:gap-3">
                                <div
                                    className="flex h-[72px] w-[72px] flex-shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-muted max-md:h-16 max-md:w-16"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    {imagesLoading && sku && imageUrl === null ? (
                                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-muted-foreground border-t-primary max-md:h-3 max-md:w-3" />
                                    ) : imageUrl ? (
                                        <img src={imageUrl} alt={row.product_name || "Product"} className="h-full w-full object-cover" />
                                    ) : (
                                        <div className="text-[10px] uppercase text-muted-foreground max-md:text-[9px]">No Image</div>
                                    )}
                                </div>
                                <div className="grid flex-1 gap-4 md:grid-cols-2 xl:grid-cols-4 max-md:grid-cols-1 max-md:gap-3">
                                    <div className="space-y-2 max-md:space-y-1.5">
                                        <div className="space-y-1">
                                            {productUrl ? (
                                                <a
                                                    href={productUrl}
                                                    className="text-sm font-semibold text-foreground hover:underline max-md:text-base"
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    onClick={(e) => e.stopPropagation()}
                                                >
                                                    {row.product_name || "Unnamed Product"}
                                                </a>
                                            ) : (
                                                <div className="text-sm font-semibold text-foreground max-md:text-base">
                                                    {row.product_name || "Unnamed Product"}
                                                </div>
                                            )}
                                            <div className="text-xs text-muted-foreground max-md:text-sm">
                                                {row.customer_company || ""}
                                            </div>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-2 max-md:gap-1.5">
                                            {availabilityLoading && sku && !availability && (
                                                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-muted-foreground border-t-primary max-md:h-4 max-md:w-4" />
                                            )}
                                            {!availabilityLoading && sku && isAvailable !== null && (
                                                <Badge
                                                    className={cn(
                                                        "rounded-full px-2 text-[10px] uppercase tracking-wide max-md:text-xs max-md:px-2.5 max-md:py-0.5",
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

                                    <div className="space-y-2 max-md:space-y-1.5">
                                        <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground max-md:text-xs">
                                            Product Info
                                        </div>
                                        <div className="grid grid-cols-2 gap-2 max-md:grid-cols-1 max-md:gap-1.5">
                                            <Field label="Category" value={row.product_category_name} />
                                            <Field label="Variant SKU" value={row.variant_sku_real} />
                                            <Field label="Color" value={row.variant_color} />
                                            <Field label="Size" value={row.variant_size} />
                                        </div>
                                    </div>

                                    <div className="space-y-2 max-md:space-y-1.5">
                                        <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground max-md:text-xs">
                                            Sales
                                        </div>
                                        <div className="grid grid-cols-2 gap-2 max-md:grid-cols-1 max-md:gap-1.5">
                                            <Field label="Sell Now" value={sellNowValue} />
                                            <Field label="Last Stock" value={row.last_stock} />
                                            <Field label="Sell on Schedule" value={row.how_much_to_sell_on_schedule} />
                                            <Field label="When to Sell" value={row.when_to_sell} />
                                            <Field label="Sell rate" value={row.sell_rate} />
                                        </div>
                                    </div>

                                    <div className="space-y-2 max-md:space-y-1.5">
                                        <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground max-md:text-xs">
                                            Orders
                                        </div>
                                        <div className="flex flex-wrap items-center gap-2 max-md:gap-1.5">
                                            {orders.length === 0 && (
                                                <span className="text-xs text-muted-foreground max-md:text-sm">No recent orders</span>
                                            )}
                                            {orders.map((order, index) => (
                                                <OrderBadge
                                                    key={`${rowId}-order-${index}`}
                                                    status={order.status}
                                                    days={order.days}
                                                    date={order.date}
                                                    orderNo={order.orderNo}
                                                    qty={order.qty}
                                                    onOpen={() => handleOpenOrderDetails(order.orderNo)}
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
            <Dialog open={focusedOrderNo !== null} onOpenChange={handleFocusedOrderDialogChange}>
                <DialogContent className="max-h-[85vh] max-w-5xl p-0">
                    <div className="border-b border-border p-5">
                        <DialogHeader>
                            <DialogTitle>Order Details</DialogTitle>
                            <DialogDescription>
                                Focused view of the selected historical order with all related dashboard items.
                            </DialogDescription>
                        </DialogHeader>
                        {focusedHistoricalOrder ? (
                            <div className="mt-4 flex flex-wrap items-center gap-2">
                                <span className="rounded-md bg-muted px-2 py-1 font-mono text-xs text-foreground">
                                    {focusedHistoricalOrder.orderNo}
                                </span>
                                <Badge
                                    className={cn(
                                        "text-[10px] uppercase tracking-wide",
                                        isClosedStatus(focusedHistoricalOrder.status || '')
                                            ? "bg-success/10 text-success"
                                            : "bg-warning/15 text-warning"
                                    )}
                                >
                                    {(focusedHistoricalOrder.status || 'UNKNOWN').toUpperCase()}
                                </Badge>
                                <Badge variant="secondary" className="text-[10px]">
                                    {focusedHistoricalOrder.items.length} related items
                                </Badge>
                                <div className="ml-auto text-xs text-muted-foreground">
                                    {focusedHistoricalOrder.date ? new Date(focusedHistoricalOrder.date).toLocaleString() : 'No date'}
                                </div>
                            </div>
                        ) : (
                            <div className="mt-4 text-xs text-muted-foreground">
                                Order data is not available in the selected company scope.
                            </div>
                        )}
                    </div>

                    <ScrollArea className="max-h-[62vh] p-5">
                        {!focusedHistoricalOrder ? (
                            <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                                Could not load this order from the current data.
                            </div>
                        ) : (
                            <OrderItemsTable order={focusedHistoricalOrder} />
                        )}
                    </ScrollArea>
                </DialogContent>
            </Dialog>
            <Dialog open={orderManagerOpen} onOpenChange={setOrderManagerOpen}>
                <DialogContent className="max-h-[85vh] max-w-5xl p-0">
                    <div className="border-b border-border p-5">
                        <DialogHeader>
                            <DialogTitle>Order Manager</DialogTitle>
                            <DialogDescription>
                                Dashboard historical sales orders grouped with related items from all rows in the selected company.
                                Recommended is the row Sell Now value.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="mt-4 flex flex-wrap items-center gap-2">
                            <Badge variant="secondary" className="text-[10px] uppercase tracking-wide">
                                {filters.dealerName || "All companies"}
                            </Badge>
                            <div className="relative ml-auto w-full max-w-xs">
                                <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    value={orderManagerSearch}
                                    onChange={(e) => setOrderManagerSearch(e.target.value)}
                                    placeholder="Search order, sku, product..."
                                    className="h-9 pl-8"
                                />
                            </div>
                        </div>
                    </div>

                    <ScrollArea className="max-h-[62vh] p-5">
                        <div className="space-y-3">
                            {visibleHistoricalOrders.length === 0 ? (
                                <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                                    No sales orders found for this view.
                                </div>
                            ) : (
                                visibleHistoricalOrders.map((order) => {
                                    const open = !isClosedStatus(order.status || '');
                                    return (
                                        <div key={order.orderNo} className="rounded-lg border border-border bg-card p-4 shadow-sm">
                                            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <span className="rounded-md bg-muted px-2 py-1 font-mono text-xs text-foreground">
                                                        {order.orderNo}
                                                    </span>
                                                    <Badge
                                                        className={cn(
                                                            "text-[10px] uppercase tracking-wide",
                                                            open
                                                                ? "bg-warning/15 text-warning"
                                                                : "bg-success/10 text-success"
                                                        )}
                                                    >
                                                        {(order.status || 'UNKNOWN').toUpperCase()}
                                                    </Badge>
                                                    <Badge variant="secondary" className="text-[10px]">
                                                        {order.items.length} related items
                                                    </Badge>
                                                </div>
                                                <div className="text-xs text-muted-foreground">
                                                    {order.date ? new Date(order.date).toLocaleString() : 'No date'}
                                                </div>
                                            </div>
                                            <OrderItemsTable order={order} />
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </ScrollArea>
                </DialogContent>
            </Dialog>
            <SelectedSkusSidebar filteredData={tabFilteredData} />
        </div>
    );
}
export default DashboardCards;

function Field({ label, value }: { label: string; value: DashboardDataRow[keyof DashboardDataRow] }) {
    const displayValue =
        value === null || value === undefined || String(value).trim() === "" ? "--" : String(value).trim();
    return (
        <div className="flex min-w-0 items-baseline gap-2 max-md:flex-col max-md:items-start max-md:gap-1">
            <span className="text-[10px] text-muted-foreground max-md:text-xs max-md:font-semibold">{label}</span>
            <span className="truncate text-xs font-medium text-foreground max-md:text-sm max-md:font-normal">{displayValue}</span>
        </div>
    );
}

function OrderItemsTable({ order }: { order: HistoricalOrderGroup }) {
    return (
        <div className="overflow-hidden rounded-md border border-border/80">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Item</TableHead>
                        <TableHead>SKU / Variant</TableHead>
                        <TableHead>Company</TableHead>
                        <TableHead className="text-right">Ordered</TableHead>
                        <TableHead className="text-right">Recommended (Sell now)</TableHead>
                        <TableHead>Comparison</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {order.items.map((item, idx) => {
                        const orderedQty = item.qty;
                        const recommendedValue = item.sellNowQty;
                        const comparisonLabel =
                            recommendedValue > 0 ? 'Need to buy more' :
                            recommendedValue === 0 ? 'Spot on' :
                            'Oversold';
                        const recommendedLabel =
                            recommendedValue > 0 ? `+${recommendedValue}` : String(recommendedValue);

                        return (
                            <TableRow key={`${order.orderNo}-${item.sku}-${idx}`}>
                                <TableCell className="font-medium text-foreground">
                                    {item.productName}
                                </TableCell>
                                <TableCell className="text-xs text-muted-foreground">
                                    <div>{item.sku}</div>
                                    {item.variant && <div>{item.variant}</div>}
                                </TableCell>
                                <TableCell className="text-xs text-muted-foreground">
                                    {item.customerCompany || 'Unknown company'}
                                </TableCell>
                                <TableCell className="text-right font-semibold">
                                    {orderedQty ?? '--'}
                                </TableCell>
                                <TableCell className="text-right font-semibold">
                                    {recommendedLabel}
                                </TableCell>
                                <TableCell>
                                    <Badge
                                        className={cn(
                                            "text-[10px]",
                                            recommendedValue === 0
                                                ? "bg-success/10 text-success"
                                                : recommendedValue > 0
                                                ? "bg-warning/15 text-warning"
                                                : "bg-destructive/10 text-destructive"
                                        )}
                                    >
                                        {comparisonLabel}
                                    </Badge>
                                </TableCell>
                            </TableRow>
                        );
                    })}
                </TableBody>
            </Table>
        </div>
    );
}

function OrderBadge({ status, days, date, orderNo, qty, onOpen }: OrderInfo & { onOpen?: () => void }) {
    const normalizedStatus = (status || "").toString().trim().toUpperCase();
    const isClosed = ["DELIVERED", "FULFILLED", "CLOSED", "COMPLETE", "COMPLETED"].includes(normalizedStatus);
    const normalizedOrderNo = String(orderNo || "").trim();
    const daysValue = days === null || days === undefined || String(days).trim() === "" ? "" : `${String(days).trim()}d`;
    const orderValue = normalizedOrderNo || "Order";
    const orderedQtyValue = qty === null || qty === undefined ? "--" : String(qty);
    const tooltip = date ? `Order date: ${date}` : undefined;
    const isInteractive = !!onOpen && !!normalizedOrderNo;
    const toneClass = isClosed ? "border-success/30 bg-success/10 text-success" : "border-warning/40 bg-warning/15 text-warning";
    const baseClass = cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold max-md:text-xs",
        toneClass
    );

    if (isInteractive) {
        return (
            <button
                type="button"
                className={cn(
                    baseClass,
                    "cursor-pointer transition hover:brightness-95 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                )}
                title={tooltip}
                onClick={(event) => {
                    event.stopPropagation();
                    onOpen();
                }}
            >
                <span className="font-mono text-[10px]">{orderValue}</span>
                <span className="rounded bg-background/70 px-1.5 py-0.5 text-[10px] font-semibold text-foreground">
                    Qty {orderedQtyValue}
                </span>
                <span className="text-[10px]">{daysValue || "--"}</span>
            </button>
        );
    }

    return (
        <span className={baseClass} title={tooltip}>
            <span className="font-mono text-[10px]">{orderValue}</span>
            <span className="rounded bg-background/70 px-1.5 py-0.5 text-[10px] font-semibold text-foreground">
                Qty {orderedQtyValue}
            </span>
            <span className="text-[10px]">{daysValue || "--"}</span>
        </span>
    );
}
