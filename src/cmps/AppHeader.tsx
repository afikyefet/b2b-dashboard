import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { ChevronDown, ShoppingCart } from 'lucide-react';
import type { AppDispatch } from '../store';
import { selectDealerName, setDealerName, resetFilters } from '../store/slices/filterSlice';
import { useDrawer } from '../contexts/DrawerContext';
import { useCart } from '../contexts/CartContext';
import { useAuth } from '../contexts/AuthContext';
import { getDashboardData } from '../services/dashboard.service';
import { getFilterOptions } from '../services/dashboard.service';
import { resolveStoreForDealer } from '../utils/storeRouting';
import { cn } from '../lib/utils';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';

function AppHeader() {
    const navigate = useNavigate();
    const location = useLocation();
    const dispatch = useDispatch<AppDispatch>();
    const dealerName = useSelector(selectDealerName);
    const { cart } = useCart();
    const { isOpen: isDrawerOpen, toggleDrawer } = useDrawer();
    const { email, authDisabled, signOut } = useAuth();
    const [dealerOptions, setDealerOptions] = useState<string[]>([]);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const dealerRegion = useMemo(() => (dealerName ? resolveStoreForDealer(dealerName) : null), [dealerName]);

    // Check if we're on the cart page
    const isCartPage = location.pathname === '/cart';

    // Fetch dealer options
    useEffect(() => {
        let cancelled = false;
        getDashboardData()
            .then((data) => {
                const options = getFilterOptions(data);
                if (!cancelled) setDealerOptions(options.dealerNames);
            })
            .catch((error) => {
                console.error('[AppHeader] failed to load dashboard data', error);
            });

        return () => {
            cancelled = true;
        };
    }, []);

    const handleDealerSelect = (dealer: string) => {
        dispatch(setDealerName(dealer));
        dispatch(resetFilters()); // Reset all filters except dealer name when changing dealer
        setIsDropdownOpen(false);
    };

    const handleSignOut = () => {
        signOut();
        navigate('/login');
    };

    return (
        <header className="sticky top-0 z-50 border-b bg-background shadow-sm">
            <div className="mx-auto flex w-full max-w-[1200px] items-center gap-4 px-4 py-3">
                <Button
                    variant="ghost"
                    className="h-auto p-0 hover:bg-transparent"
                    onClick={() => navigate('/')}
                    type="button"
                    title="Go to dashboard"
                >
                    <img src="/logo.png" alt="Logo" className="h-10 w-auto" />
                </Button>

                <div className="flex flex-1 justify-center">
                    <DropdownMenu open={isDropdownOpen} onOpenChange={setIsDropdownOpen}>
                        <DropdownMenuTrigger asChild>
                            <Button
                                variant="outline"
                                className="h-11 gap-2 rounded-md border-border bg-transparent text-base font-semibold text-foreground hover:bg-muted"
                            >
                                <span className="text-xs font-medium text-muted-foreground">Viewing:</span>
                                <span className="text-primary">
                                    {dealerName || 'Select Dealer'}
                                </span>
                                {dealerRegion && (
                                    <Badge
                                        variant="secondary"
                                        className="rounded-full px-2 py-0 text-[0.65rem] uppercase tracking-[0.12em]"
                                    >
                                        {dealerRegion}
                                    </Badge>
                                )}
                                <ChevronDown
                                    className={cn(
                                        'h-4 w-4 text-muted-foreground transition-transform',
                                        isDropdownOpen ? 'rotate-180' : ''
                                    )}
                                />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                            align="center"
                            className="max-h-96 w-64 overflow-y-auto p-1"
                        >
                            {dealerOptions.map((dealer) => (
                                <DropdownMenuItem
                                    key={dealer}
                                    onSelect={() => handleDealerSelect(dealer)}
                                    className={cn(
                                        'cursor-pointer text-sm',
                                        dealer === dealerName
                                            ? 'bg-primary text-primary-foreground focus:bg-primary'
                                            : 'focus:bg-muted'
                                    )}
                                >
                                    {dealer}
                                </DropdownMenuItem>
                            ))}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>

                {!isCartPage && (
                    <Button
                        className="relative h-11 w-11 rounded-md p-0"
                        onClick={toggleDrawer}
                        type="button"
                        title={isDrawerOpen ? 'Close cart drawer' : 'Open cart drawer'}
                    >
                        <ShoppingCart className="h-5 w-5" />
                        {!isDrawerOpen && cart.length > 0 && (
                            <span className="absolute -right-2 -top-2 rounded-full bg-background px-2 py-0.5 text-xs font-semibold text-primary shadow">
                                {cart.length}
                            </span>
                        )}
                    </Button>
                )}

                <Button
                    variant="outline"
                    className="h-11"
                    onClick={() => navigate('/orders')}
                    type="button"
                >
                    Orders
                </Button>

                {!authDisabled && (
                    <div className="flex items-center gap-3">
                        <span className="max-w-[180px] truncate text-sm text-muted-foreground" title={email || undefined}>
                            {email || 'Signed in'}
                        </span>
                        <Button variant="secondary" size="sm" type="button" onClick={handleSignOut}>
                            Sign out
                        </Button>
                    </div>
                )}
            </div>
        </header>
    );
}

export default AppHeader;
