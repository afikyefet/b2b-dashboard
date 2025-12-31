import type { DashboardDataRow, DashboardHeader } from "../types/dashboard.types";

interface DashboardRowProps {
    row: DashboardDataRow;
    headers: DashboardHeader[];
}

function DashboardRow({ row, headers }: DashboardRowProps) {
    return (
        <div className="dashboard-row">
            <ul>
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

