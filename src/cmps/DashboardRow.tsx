import { useDispatch, useSelector } from 'react-redux';
import type { DashboardDataRow, DashboardHeader } from "../types/dashboard.types";
import { toggleRowSelection, isRowSelected } from '../store/slices/selectionSlice';
import { getRowId } from '../utils/rowId';
import type { RootState } from '../store';

interface DashboardRowProps {
    row: DashboardDataRow;
    headers: DashboardHeader[];
}

function DashboardRow({ row, headers }: DashboardRowProps) {
    const dispatch = useDispatch();
    const rowId = getRowId(row);
    const selected = useSelector((state: RootState) => isRowSelected(rowId)(state));

    const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        e.stopPropagation();
        dispatch(toggleRowSelection(rowId));
    };

    const handleRowClick = () => {
        dispatch(toggleRowSelection(rowId));
    };

    return (
        <div className={`dashboard-row ${selected ? 'selected' : ''}`} onClick={handleRowClick}>
            <ul>
                <li className="checkbox-cell">
                    <input
                        type="checkbox"
                        checked={selected}
                        onChange={handleCheckboxChange}
                        onClick={(e) => e.stopPropagation()}
                    />
                </li>
                {headers.map((header: DashboardHeader) => {
                    const fieldKey = header.field as keyof DashboardDataRow;
                    
                    // Check if field exists in the row object
                    const fieldExists = fieldKey in row;
                    const value = fieldExists ? row[fieldKey] : undefined;
                    
                    // Debug logging for problematic rows
                    if (row.product_sell_type === 'Problematic Product' && fieldKey === 'product_name') {
                        console.log('Problematic Product row:', {
                            field: fieldKey,
                            value: value,
                            hasField: fieldKey in row,
                            rowKeys: Object.keys(row).slice(0, 10),
                            productName: row.product_name
                        });
                    }
                    
                    // Handle display values
                    // If field doesn't exist in data, show empty (field not in data)
                    // If field exists but is null, show "null" as text
                    // If field exists and is 0, show "0"
                    // Otherwise show the value
                    let displayValue = '';
                    if (!fieldExists) {
                        // Field doesn't exist in the row data - show empty
                        displayValue = '';
                    } else if (value === null) {
                        // Field exists but value is null - show "null" as text
                        displayValue = 'null';
                    } else if (value === undefined) {
                        // Field exists but value is undefined - show empty
                        displayValue = '';
                    } else if (value === 0 || value === '0' || value === '0.0') {
                        // Field exists and value is zero - show zero
                        displayValue = String(value);
                    } else {
                        // Field exists and has a value - show it
                        const stringValue = String(value).trim();
                        displayValue = stringValue || '';
                    }
                    return (
                        <li key={header.id} title={displayValue || undefined}>
                            {displayValue}
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}

export default DashboardRow;
