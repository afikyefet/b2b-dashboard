import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { X } from 'lucide-react';
import { useDrawer } from '../contexts/DrawerContext';
import { useCart } from '../contexts/CartContext';
import { selectDealerName } from '../store/slices/filterSlice';
import { getNoOrderNoteBySku } from '../utils/cartOrderNotes';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { ScrollArea } from '../components/ui/scroll-area';
import { Separator } from '../components/ui/separator';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '../components/ui/sheet';

// Prop interface kept for compatibility if needed, but props are unused
// eslint-disable-next-line @typescript-eslint/no-unused-vars
interface SelectedSkusSidebarProps {
    filteredData?: unknown[];
}

function SelectedSkusSidebar({}: SelectedSkusSidebarProps) {
    const navigate = useNavigate();
    const { isOpen, toggleDrawer, setIsOpen } = useDrawer();
    const { cart, hydrated, setQty, removeSku } = useCart();
    const dealerName = useSelector(selectDealerName);
    const noOrderNoteBySku = useMemo(() => getNoOrderNoteBySku(dealerName), [dealerName]);

    const sortedCart = useMemo(() => {
        const items = [...cart];
        items.sort((a, b) => {
            const aTitle = (hydrated[a.sku]?.product_title || '').trim();
            const bTitle = (hydrated[b.sku]?.product_title || '').trim();
            const aKey = aTitle || a.sku;
            const bKey = bTitle || b.sku;
            const primary = aKey.localeCompare(bKey, undefined, { sensitivity: 'base' });
            if (primary !== 0) return primary;
            return a.sku.localeCompare(b.sku, undefined, { sensitivity: 'base' });
        });
        return items;
    }, [cart, hydrated]);

    const handleGoToCart = () => {
        navigate('/cart');
        if (isOpen) toggleDrawer();
    };

    return (
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetContent side="right" className="flex h-full flex-col gap-4 pt-[104px]">
                <SheetHeader className="space-y-0">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <SheetTitle>Cart</SheetTitle>
                            <Badge variant="secondary" className="px-2 text-xs font-semibold">
                                {cart.length}
                            </Badge>
                        </div>
                    </div>
                </SheetHeader>

                <Separator />

                <Button onClick={handleGoToCart} className="w-full">
                    View Full Cart
                </Button>

                {cart.length > 0 ? (
                    <ScrollArea className="flex-1 pr-2">
                        <div className="space-y-3">
                            {sortedCart.map((item) => {
                                const details = hydrated[item.sku];
                                const showNoOrderNote = noOrderNoteBySku[item.sku];
                                return (
                                    <div
                                        key={item.sku}
                                        className="rounded-md border bg-muted/40 p-3 text-sm"
                                    >
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="min-w-0">
                                                <div className="truncate font-semibold text-foreground">
                                                    {details ? details.product_title : item.sku}
                                                </div>
                                                {details && (
                                                    <div className="truncate text-xs text-muted-foreground">
                                                        {details.variant_title}
                                                    </div>
                                                )}
                                            </div>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-7 w-7"
                                                onClick={() => removeSku(item.sku)}
                                                type="button"
                                            >
                                                <X className="h-4 w-4" />
                                            </Button>
                                        </div>

                                        <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                                            <span>SKU: {item.sku}</span>
                                            <div className="flex items-center gap-2">
                                                <span>Qty</span>
                                                <Input
                                                    type="number"
                                                    min="1"
                                                    value={item.qty}
                                                    onChange={(e) => setQty(item.sku, Number(e.target.value))}
                                                    className="h-8 w-16 text-center text-sm"
                                                />
                                            </div>
                                        </div>
                                        {showNoOrderNote && (
                                            <div className="mt-2 text-xs text-warning">
                                                wasnt ordered in the past year
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </ScrollArea>
                ) : (
                    <div className="flex flex-1 flex-col items-center justify-center text-center text-muted-foreground">
                        <p className="text-sm font-medium">Your cart is empty</p>
                        <p className="text-xs">Select items from the dashboard to add them.</p>
                    </div>
                )}
            </SheetContent>
        </Sheet>
    );
}

export default SelectedSkusSidebar;
