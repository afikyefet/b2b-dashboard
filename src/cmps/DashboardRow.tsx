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

    return (
        <div className="dashboard-row">
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
                    const value = row[header.field as keyof DashboardDataRow];
                    return (
                        <li key={header.id}>
                            {value !== null && value !== undefined ? String(value) : ''}
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}

export default DashboardRow;
