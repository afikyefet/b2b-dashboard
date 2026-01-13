import { useCart } from "../contexts/CartContext";
import DashboardFilter from "./DashboardFilter";
import SelectedSkusSidebar from "./SelectedSkusSidebar";
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
import "../styles/DashboardCards.scss";

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
    const dataRef = useRef<DashboardDataResponse>([]);
    const headersRef = useRef<DashboardHeader[]>([]);
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

    // const handleFilterChange = (_newFilters: FilterConfig) => {
        // Filters are now managed by Redux, this is kept for compatibility
    // };

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
        return <div>Loading...</div>;
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
        <div className="dashboard-container">
            <div className="dashboard-main">
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
                <div className="cards-actions">
                    <button
                        type="button"
                        className="cards-action-btn"
                        onClick={handleSelectAll}
                        disabled={filteredSkus.length === 0}
                    >
                        Select All
                    </button>
                    <button
                        type="button"
                        className="cards-action-btn ghost"
                        onClick={handleDeselectAll}
                        disabled={filteredSkus.length === 0}
                    >
                        Deselect All
                    </button>
                </div>
                <div className="dashboard-cards-grid">
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
                                className={`dashboard-card ${selected ? "selected" : ""}`}
                                onClick={() => toggleSelection(row)}
                            >
                                <div className="card-media" onClick={(e) => e.stopPropagation()}>
                                    {imagesLoading && sku && imageUrl === null ? (
                                        <span className="image-spinner" />
                                    ) : imageUrl ? (
                                        <img src={imageUrl} alt={row.product_name || "Product"} />
                                    ) : (
                                        <div className="image-placeholder">No Image</div>
                                    )}
                                </div>
                                <div className="card-body">
                                <div className="card-header">
                                    <div className="card-title">
                                        <span>
                                            {productUrl ? (
                                                <a
                                                    href={productUrl}
                                                    className="product-name"
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    onClick={(e) => e.stopPropagation()}
                                                >
                                                    {row.product_name || "Unnamed Product"}
                                                </a>
                                            ) : (
                                                <span className="product-name">{row.product_name || "Unnamed Product"}</span>
                                            )}
                                            <span className="product-company">{row.customer_company || ""}</span>
                                        </span>
                                    </div>
                                    <div className="card-badges">
                                        {availabilityLoading && sku && !availability && <span className="stock-spinner" />}
                                        {!availabilityLoading && sku && isAvailable !== null && (
                                            <span className={`stock-pill ${isAvailable ? "in" : "out"}`}>
                                                {isAvailable ? "In Stock" : "Out of Stock"}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                <div className="card-section">
                                    <div className="section-title">Product Info</div>
                                    <div className="card-fields">
                                        <Field label="Category" value={row.product_category_name} />
                                        <Field label="Variant SKU" value={row.variant_sku_real} />
                                        <Field label="In Stock" value={isAvailable === null ? null : isAvailable ? "Yes" : "No"} />
                                        <Field label="Color" value={row.variant_color} />
                                        <Field label="Size" value={row.variant_size} />
                                    </div>
                                </div>

                                <div className="card-section">
                                    <div className="section-title">Stock & Sales</div>
                                    <div className="card-fields">
                                        <Field label="Current Stock" value={row.last_stock} />
                                        <Field label="Sell Now" value={sellNowValue} />
                                        <Field label="When to Sell" value={row.when_to_sell} />
                                        <Field label="Sell on Schedule" value={row.how_much_to_sell_on_schedule} />
                                        <Field label="Sell Rate" value={row.sell_rate} />
                                        <Field label="Sell Type" value={row.product_sell_type} />
                                    </div>
                                </div>

                                <div className="card-section orders">
                                    <div className="section-title">Orders</div>
                                    <div className="order-icons">
                                        {orders.length === 0 && (
                                            <span className="empty-orders">No recent orders</span>
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
                        );
                    })}
                </div>
            </div>
            <SelectedSkusSidebar filteredData={filteredData} />
        </div>
    );
}
export default DashboardCards;

function Field({ label, value }: { label: string; value: DashboardDataRow[keyof DashboardDataRow] }) {
    const displayValue = value === null || value === undefined || String(value).trim() === "" ? "—" : String(value).trim();
    return (
        <div className="card-field">
            <div className="field-label">{label}</div>
            <div className="field-value">{displayValue}</div>
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
        <div className={`order-badge ${isClosed ? "closed" : "open"}`} title={tooltip}>
            <span className="order-id">{orderValue}</span>
            <span className="order-days">{daysValue || "—"}</span>
        </div>
    );
}
