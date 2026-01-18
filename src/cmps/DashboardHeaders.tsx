import type { DashboardHeader, SortConfig, DashboardDataRow } from "../types/dashboard.types";
import { useCart } from '../contexts/CartContext';
import { Checkbox } from "../components/ui/checkbox";
import { TableHead, TableRow } from "../components/ui/table";

interface DashboardHeadersProps {
    headers: DashboardHeader[];
    sortConfig: SortConfig;
    onSort: (field: string) => void;
    filteredData: DashboardDataRow[];
}

function DashboardHeaders({ headers, sortConfig, onSort, filteredData }: DashboardHeadersProps) {
    const { addSku, removeSku, isInCart } = useCart();

    if (!headers || headers.length === 0) return null;

    // Get all SKUs from filtered data (only rows with valid SKUs)
    const filteredSkus = filteredData
        .map(row => row.variant_sku_real)
        .filter((sku): sku is string => !!sku);
    
    // Check if all filtered rows with SKUs are in cart
    const allSelected = filteredSkus.length > 0 && filteredSkus.every(sku => isInCart(sku));
    const someSelected = filteredSkus.some(sku => isInCart(sku));

    const handleSelectAllClick = () => {
        if (allSelected) {
            // Remove all filtered SKUs from cart
            filteredSkus.forEach(sku => {
                if (isInCart(sku)) {
                    removeSku(sku);
                }
            });
        } else {
            // Add all filtered SKUs to cart with their "how_much_to_sell_now" quantities
            filteredData.forEach(row => {
                const sku = row.variant_sku_real;
                if (sku && !isInCart(sku)) {
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
            });
        }
    };

    const getSortIndicator = (field: string) => {
        if (sortConfig.field !== field) return null;
        if (sortConfig.direction === 'asc') return '^';
        if (sortConfig.direction === 'desc') return 'v';
        return null;
    };

    const handleHeaderClick = (field: string) => {
        onSort(field);
    };

    return (
        <TableRow className="bg-muted/50">
            <TableHead className="w-10">
                <div className="flex items-center justify-center">
                    <Checkbox
                        checked={allSelected ? true : someSelected ? "indeterminate" : false}
                        onCheckedChange={handleSelectAllClick}
                    />
                </div>
            </TableHead>
            {headers.map((header: DashboardHeader) => (
                <TableHead
                    key={header.id}
                    className="cursor-pointer text-xs font-semibold"
                    onClick={() => handleHeaderClick(header.field)}
                    title="Click to sort"
                >
                    <div className="flex items-center justify-between gap-2">
                        <span>{header.displayName}</span>
                        {getSortIndicator(header.field) && (
                            <span className="text-xs text-primary">{getSortIndicator(header.field)}</span>
                        )}
                    </div>
                </TableHead>
            ))}
        </TableRow>
    );
}

export default DashboardHeaders;
