import type { DashboardDataRow, DashboardHeader } from "../types/dashboard.types";
import type { SkuAvailability } from "../api/catalogApi";
import { useCart } from '../contexts/CartContext';
import { getSelectionQty } from "../utils/selectionQty";

interface DashboardRowProps {
    row: DashboardDataRow;
    headers: DashboardHeader[];
    availabilityBySku: Record<string, SkuAvailability>;
    availabilityLoading: boolean;
    selectionDays: number;
}

function DashboardRow({ row, headers, availabilityBySku, availabilityLoading, selectionDays }: DashboardRowProps) {
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
            const initialQty = getSelectionQty(row, selectionDays);
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

    const getInStockStatus = () => {
        if (!sku) return { status: null as boolean | null, loading: false };
        const availability = availabilityBySku[sku];
        if (!availability) return { status: null as boolean | null, loading: availabilityLoading };
        const inventory = availability.inventory_quantity ?? 0;
        const status = availability.available_for_sale || inventory > 0;
        return { status, loading: false };
    };

    const productUrl = typeof row.url === 'string' ? row.url.trim() : '';

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
                    if (header.field === 'in_stock_shopify') {
                        const { status, loading } = getInStockStatus();
                        const label = status === null ? 'Unknown' : status ? 'In Stock' : 'Out of Stock';
                        const badgeStyle = {
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            minWidth: '70px',
                            padding: '4px 8px',
                            borderRadius: '999px',
                            fontSize: '0.75em',
                            fontWeight: 600,
                            color: status ? '#0f5132' : status === false ? '#842029' : '#4b5563',
                            backgroundColor: status ? '#d1e7dd' : status === false ? '#f8d7da' : '#e5e7eb'
                        } as const;

                        return (
                            <li key={header.id} title={label || undefined}>
                                {loading ? <span className="stock-spinner" /> : <span style={badgeStyle}>{label}</span>}
                            </li>
                        );
                    }

                    const fieldKey = header.field as keyof DashboardDataRow;
                    
                    // Check if field exists in the row object
                    const fieldExists = fieldKey in row;
                    const value = fieldExists ? row[fieldKey] : undefined;
                    
                    // Debug logging for problematic rows
                    if (row.product_sell_type === 'Problematic Product' && fieldKey === 'product_name') {
                        // console.log('Problematic Product row:', {
                        //     field: fieldKey,
                        //     value: value,
                        //     hasField: fieldKey in row,
                        //     rowKeys: Object.keys(row).slice(0, 10),
                        //     productName: row.product_name
                        // });
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
                    if (fieldKey === 'product_name' && productUrl) {
                        const label = displayValue && displayValue !== 'null' ? displayValue : 'View product';
                        return (
                            <li key={header.id} title={label}>
                                <a
                                    href={productUrl}
                                    className="product-link"
                                    target="_blank"
                                    rel="noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    {label}
                                </a>
                            </li>
                        );
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
