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
import { getRowId } from "../utils/rowId";
import "../styles/DashboardTable.scss";

function DashboardTable() {
    const dispatch = useDispatch<AppDispatch>();
    const filters = useSelector(selectFilters);
    const [originalData, setOriginalData] = useState<DashboardDataResponse>([]);
    const [headers, setHeaders] = useState<DashboardHeader[]>([]);
    const [sortConfig, setSortConfig] = useState<SortConfig>({ field: '', direction: null });
    const [loadingData, setLoadingData] = useState(false);
    const [loadingHeaders, setLoadingHeaders] = useState(false);
    const dashboardCacheKey = 'dashboard_table_cache_v1';
    const dataRef = useRef<DashboardDataResponse>([]);
    const headersRef = useRef<DashboardHeader[]>([]);

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
            setOriginalData(cached.data);
            setHeaders(cached.headers);
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
                setHeaders(nextHeaders);
                writeCache(dataRef.current, nextHeaders);
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

    // const handleFilterChange = (_newFilters: FilterConfig) => {
        // Filters are now managed by Redux, this is kept for compatibility
    // };

    const handleResetSort = () => {
        setSortConfig({ field: '', direction: null });
    };

    const handleResetAll = () => {
        dispatch(resetFilters());
        handleResetSort();
    };

    const hasActiveFilters = () => {
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

    return (
        <div className="dashboard-container">
            <div className="dashboard-main">
                <DashboardFilter
                    filterOptions={filterOptions}
                />
                <div className="dashboard-controls">
                    {(hasActiveFilters() || hasActiveSort) && (
                        <button className="btn-reset-all" onClick={handleResetAll}>
                            Reset All
                        </button>
                    )}
                    {(loadingData || loadingHeaders) && originalData.length > 0 && headers.length > 0 && (
                        <div style={{ marginLeft: 'auto', fontSize: '0.85em', color: '#6b7280' }}>
                            Refreshing...
                        </div>
                    )}
                </div>
                <div className="dashboard-table">
                    <DashboardHeaders
                        headers={headers}
                        sortConfig={sortConfig}
                        onSort={handleSort}
                        filteredData={filteredData}
                    />
                    <div className="dashboard-rows">
                        {filteredData.map((row: DashboardDataRow) => {
                            const rowId = getRowId(row);
                            return (
                                <DashboardRow key={rowId} row={row} headers={headers} />
                            );
                        })}
                    </div>
                </div>
            </div>
            <SelectedSkusSidebar filteredData={filteredData} />
        </div>
    );
}
export default DashboardTable;
