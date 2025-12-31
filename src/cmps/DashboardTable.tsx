import DashboardHeaders from "./DashboardHeaders";
import DashboardRow from "./DashboardRow";
import DashboardFilter from "./DashboardFilter";
import type { DashboardDataResponse, DashboardDataRow, DashboardHeader, FilterConfig, SortConfig } from "../types/dashboard.types";
import { useState, useEffect, useMemo } from "react";
import { getDashboardData, getDashboardHeaders, applyFiltersAndSort, getFilterOptions } from "../services/dashboard.service";
import "../styles/DashboardTable.scss";

function DashboardTable() {
    const [originalData, setOriginalData] = useState<DashboardDataResponse>([]);
    const [headers, setHeaders] = useState<DashboardHeader[]>([]);
    const [filters, setFilters] = useState<FilterConfig>({});
    const [sortConfig, setSortConfig] = useState<SortConfig>({ field: '', direction: null });

    useEffect(() => {
        getDashboardData().then((data) => setOriginalData(data));
        getDashboardHeaders().then((headers) => setHeaders(headers));
    }, []);

    // Get filter options from original data
    const filterOptions = useMemo(() => {
        return getFilterOptions(originalData);
    }, [originalData]);

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

    const handleFilterChange = (newFilters: FilterConfig) => {
        setFilters(newFilters);
    };

    const handleResetFilters = () => {
        setFilters({});
    };

    const handleResetSort = () => {
        setSortConfig({ field: '', direction: null });
    };

    const handleResetAll = () => {
        handleResetFilters();
        handleResetSort();
    };

    const hasActiveFilters = Object.values(filters).some(value => value && value.trim() !== '');
    const hasActiveSort = sortConfig.field && sortConfig.direction;

    if (!headers || headers.length === 0) {
        return <div>Loading...</div>;
    }

    return (
        <div className="dashboard-container">
            <DashboardFilter
                filters={filters}
                onFilterChange={handleFilterChange}
                onReset={handleResetFilters}
                filterOptions={filterOptions}
            />
            <div className="dashboard-controls">
                {(hasActiveFilters || hasActiveSort) && (
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
                />
                <div className="dashboard-rows">
                    {filteredData.map((row: DashboardDataRow, index: number) => (
                        <DashboardRow key={index} row={row} headers={headers} />
                    ))}
                </div>
            </div>
        </div>
    );
}
export default DashboardTable;
