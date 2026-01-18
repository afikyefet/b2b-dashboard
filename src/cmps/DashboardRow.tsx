import type { DashboardDataRow, DashboardHeader } from "../types/dashboard.types";
import type { SkuAvailability } from "../api/catalogApi";
import { useCart } from '../contexts/CartContext';
import { getSelectionQty } from "../utils/selectionQty";
import { Badge } from "../components/ui/badge";
import { Checkbox } from "../components/ui/checkbox";
import { TableCell, TableRow } from "../components/ui/table";
import { cn } from "../lib/utils";

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

    const handleRowClick = () => {
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
        <TableRow
            className={cn(selected ? "bg-primary/5" : "")}
            onClick={handleRowClick}
        >
            <TableCell className="w-10">
                <div className="flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                        checked={selected}
                        onCheckedChange={toggleSelection}
                        disabled={!hasSku}
                    />
                </div>
            </TableCell>
            {headers.map((header: DashboardHeader) => {
                if (header.field === 'in_stock_shopify') {
                    const { status, loading } = getInStockStatus();
                    const label = status === null ? 'Unknown' : status ? 'In Stock' : 'Out of Stock';
                    return (
                        <TableCell key={header.id} title={label || undefined}>
                            {loading ? (
                                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-muted-foreground border-t-primary" />
                            ) : (
                                <Badge
                                    className={cn(
                                        "rounded-full px-2 text-[10px] uppercase tracking-wide",
                                        status === null
                                            ? "bg-muted text-muted-foreground"
                                            : status
                                                ? "bg-[#d1e7dd] text-[#0f5132]"
                                                : "bg-[#f8d7da] text-[#842029]"
                                    )}
                                >
                                    {label}
                                </Badge>
                            )}
                        </TableCell>
                    );
                }

                const fieldKey = header.field as keyof DashboardDataRow;
                const fieldExists = fieldKey in row;
                const value = fieldExists ? row[fieldKey] : undefined;
                
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
                        <TableCell key={header.id} title={label}>
                            <a
                                href={productUrl}
                                className="text-foreground hover:underline"
                                target="_blank"
                                rel="noreferrer"
                                onClick={(e) => e.stopPropagation()}
                            >
                                {label}
                            </a>
                        </TableCell>
                    );
                }
                return (
                    <TableCell key={header.id} title={displayValue || undefined}>
                        {displayValue}
                    </TableCell>
                );
            })}
        </TableRow>
    );
}

export default DashboardRow;
