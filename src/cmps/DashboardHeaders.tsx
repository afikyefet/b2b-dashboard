import type { DashboardHeader, SortConfig } from "../types/dashboard.types";

interface DashboardHeadersProps {
    headers: DashboardHeader[];
    sortConfig: SortConfig;
    onSort: (field: string) => void;
}

function DashboardHeaders({ headers, sortConfig, onSort }: DashboardHeadersProps) {
    if (!headers || headers.length === 0) return null;

    const getSortIndicator = (field: string) => {
        if (sortConfig.field !== field) return null;
        if (sortConfig.direction === 'asc') return ' ↑';
        if (sortConfig.direction === 'desc') return ' ↓';
        return null;
    };

    const handleHeaderClick = (field: string) => {
        onSort(field);
    };

    return (
        <div className="dashboard-headers">
            <ul>
                {headers.map((header: DashboardHeader) => (
                    <li
                        key={header.id}
                        className="sortable-header"
                        onClick={() => handleHeaderClick(header.field)}
                        title="Click to sort"
                    >
                        {header.displayName}
                        <span className="sort-indicator">{getSortIndicator(header.field)}</span>
                    </li>
                ))}
            </ul>
        </div>
    );
}
export default DashboardHeaders;