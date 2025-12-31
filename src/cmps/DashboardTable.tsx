import DashboardHeaders from "./DashboardHeaders";
import DashboardRow from "./DashboardRow";
import DashboardFilter from "./DashboardFilter";
import AppHeader from "./AppHeader";
import type { DashboardDataResponse, DashboardDataRow, DashboardHeader, SortConfig } from "../types/dashboard.types";
import { useState, useEffect, useMemo } from "react";
import { useDispatch, useSelector } from 'react-redux';
import { getDashboardData, getDashboardHeaders, applyFiltersAndSort, getFilterOptions } from "../services/dashboard.service";
import { getRowId } from "../utils/rowId";
import { selectFilters, initializeFilters, resetAllFilters } from '../store/slices/filterSlice';
import { loadSelectedDealer, validateDealerExists, saveSelectedDealer } from '../services/localStorage.service';
import "../styles/DashboardTable.scss";

function DashboardTable() {
    const dispatch = useDispatch();
    const filters = useSelector(selectFilters);

    const [originalData, setOriginalData] = useState<DashboardDataResponse>([]);
    const [headers, setHeaders] = useState<DashboardHeader[]>([]);
    const [sortConfig, setSortConfig] = useState<SortConfig>({ field: '', direction: null });

    useEffect(() => {
        getDashboardData().then((data) => setOriginalData(data));
        getDashboardHeaders().then((headers) => setHeaders(headers));
    }, []);

    // Get filter options from original data
    const filterOptions = useMemo(() => {
        return getFilterOptions(originalData);
    }, [originalData]);

    // Initialize dealer filter from localStorage on mount
    useEffect(() => {
        if (filterOptions.dealerNames.length > 0) {
            const savedDealer = loadSelectedDealer();
            const validatedDealer = validateDealerExists(savedDealer, filterOptions.dealerNames);

            if (validatedDealer) {
                dispatch(initializeFilters({ dealerName: validatedDealer }));
            } else if (filterOptions.dealerNames.length === 1) {
                // Auto-select if only one dealer
                const dealer = filterOptions.dealerNames[0];
                dispatch(initializeFilters({ dealerName: dealer }));
                saveSelectedDealer(dealer);
            }
        }
    }, [filterOptions.dealerNames, dispatch]);

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

    const handleResetSort = () => {
        setSortConfig({ field: '', direction: null });
    };

    const handleResetAll = () => {
        dispatch(resetAllFilters());
        saveSelectedDealer(null);
        handleResetSort();
    };

    const hasActiveFilters = () => {
        if (filters.generalSearch?.trim()) return true;
        if (filters.dealerName) return true;
        return Object.entries(filters).some(([key, value]) => {
            if (key === 'dealerName' || key === 'generalSearch') return false;
            if (Array.isArray(value)) {
                return value.length > 0;
            }
            return false;
        });
    };
    const hasActiveSort = sortConfig.field && sortConfig.direction;

    if (!headers || headers.length === 0) {
        return <div>Loading...</div>;
    }

    return (
        <>
            <AppHeader filterOptions={filterOptions} />
            <div className="dashboard-container">
                <DashboardFilter
                    filterOptions={filterOptions}
                />
                <div className="dashboard-controls">
                    {(hasActiveFilters() || hasActiveSort) && (
                        <button className="btn-reset-all" onClick={handleResetAll}>
                            Reset All
                        </button>
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
        </>
    );
}
export default DashboardTable;
