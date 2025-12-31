import { useDispatch, useSelector } from 'react-redux';
import type { DashboardHeader, SortConfig, DashboardDataRow } from "../types/dashboard.types";
import { selectAllRows, deselectAllRows, selectSelectedRowIds } from '../store/slices/selectionSlice';
import { getRowId } from '../utils/rowId';

interface DashboardHeadersProps {
    headers: DashboardHeader[];
    sortConfig: SortConfig;
    onSort: (field: string) => void;
    filteredData: DashboardDataRow[];
}

function DashboardHeaders({ headers, sortConfig, onSort, filteredData }: DashboardHeadersProps) {
    const dispatch = useDispatch();
    const selectedRowIds = useSelector(selectSelectedRowIds);

    if (!headers || headers.length === 0) return null;

    // Get all row IDs from filtered data
    const filteredRowIds = filteredData.map(row => getRowId(row));
    
    // Check if all filtered rows are selected
    const allSelected = filteredRowIds.length > 0 && filteredRowIds.every(id => selectedRowIds.includes(id));
    const someSelected = filteredRowIds.some(id => selectedRowIds.includes(id));

    const handleSelectAllClick = (e: React.ChangeEvent<HTMLInputElement>) => {
        e.stopPropagation();
        if (allSelected) {
            dispatch(deselectAllRows());
        } else {
            dispatch(selectAllRows(filteredRowIds));
        }
    };

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
                <li className="checkbox-cell">
                    <input
                        type="checkbox"
                        checked={allSelected}
                        ref={(input) => {
                            if (input) input.indeterminate = someSelected && !allSelected;
                        }}
                        onChange={handleSelectAllClick}
                        onClick={(e) => e.stopPropagation()}
                        title={allSelected ? 'Deselect all' : 'Select all'}
                    />
                </li>
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
