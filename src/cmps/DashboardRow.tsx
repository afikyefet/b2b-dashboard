import type { DashboardDataRow, DashboardHeader } from "../types/dashboard.types";
import { useCart } from '../contexts/CartContext';

interface DashboardRowProps {
    row: DashboardDataRow;
    headers: DashboardHeader[];
}

function DashboardRow({ row, headers }: DashboardRowProps) {
    const { isInCart, addSku, removeSku } = useCart();
    
    // Get SKU for cart operations
    const sku = row.variant_sku_real;
    const hasSku = !!sku;
    
    const selected = hasSku ? isInCart(sku) : false;

    const toggleSelection = () => {
        if (!hasSku) return;

        if (selected) {
            removeSku(sku);
        } else {
            // Get initial quantity from "how_much_to_sell_now"
            let initialQty = 1;
            const sellNow = row.how_much_to_sell_now;
            
            if (sellNow !== null && sellNow !== undefined) {
                const parsed = parseFloat(String(sellNow));
                if (!isNaN(parsed) && parsed > 0) {
                    initialQty = Math.round(parsed);
                }
            }
            
            addSku(sku, initialQty);
        }
    };

    const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        e.stopPropagation();
        toggleSelection();
    };

    const handleRowClick = () => {
        // Optional: Only toggle if clicking the row background, not specific interactive elements
        // But for now, match previous behavior
        toggleSelection();
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
                        disabled={!hasSku}
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
                    let displayValue = '';
                    if (!fieldExists) {
                        displayValue = '';
                    } else if (value === null) {
                        displayValue = 'null';
                    } else if (value === undefined) {
                        displayValue = '';
                    } else {
                        const isHowMuchToSellField = fieldKey === 'how_much_to_sell_now' || fieldKey === 'how_much_to_sell_on_schedule';
                        
                        if (isHowMuchToSellField) {
                            const numValue = parseFloat(String(value));
                            if (isNaN(numValue)) {
                                displayValue = String(value).trim();
                            } else {
                                displayValue = Math.round(numValue).toString();
                            }
                        } else if (value === 0 || value === '0' || value === '0.0') {
                            displayValue = String(value);
                        } else {
                            const stringValue = String(value).trim();
                            displayValue = stringValue || '';
                        }
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
