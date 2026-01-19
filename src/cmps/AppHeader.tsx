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
import { applyDealerTheme, getDealerTheme } from '../utils/dealerTheme';
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

    useEffect(() => {
        applyDealerTheme(getDealerTheme(dealerName));
    }, [dealerName]);

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
            <div className="mx-auto flex w-full max-w-[1200px] flex-wrap items-center gap-2 px-4 py-3 max-md:px-2 max-md:gap-2">
                <Button
                    variant="ghost"
                    className="h-auto p-0 hover:bg-transparent max-md:h-8"
                    onClick={() => navigate('/')}
                    type="button"
                    title="Go to dashboard"
                >
                    <img src="/logo.png" alt="Logo" className="h-10 w-auto max-md:h-8" />
                </Button>

                <div className="flex flex-1 justify-center max-md:min-w-0 max-md:flex-1">
                    <DropdownMenu open={isDropdownOpen} onOpenChange={setIsDropdownOpen}>
                        <DropdownMenuTrigger asChild>
                            <Button
                                variant="outline"
                                className="h-11 gap-2 rounded-md border-border bg-transparent text-base font-semibold text-foreground hover:bg-muted max-md:h-11 max-md:min-h-[44px] max-md:text-sm max-md:px-2"
                            >
                                <span className="text-xs font-medium text-muted-foreground max-md:hidden">Viewing:</span>
                                <span className="text-primary max-md:text-xs max-md:truncate">
                                    {dealerName || 'Select Dealer'}
                                </span>
                                {dealerRegion && (
                                    <Badge
                                        variant="secondary"
                                        className="rounded-full px-2 py-0 text-[0.65rem] uppercase tracking-[0.12em] max-md:text-[0.6rem] max-md:px-1.5"
                                    >
                                        {dealerRegion}
                                    </Badge>
                                )}
                                <ChevronDown
                                    className={cn(
                                        'h-4 w-4 text-muted-foreground transition-transform max-md:h-3.5 max-md:w-3.5',
                                        isDropdownOpen ? 'rotate-180' : ''
                                    )}
                                />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                            align="center"
                            className="max-h-96 w-64 overflow-y-auto p-1 max-md:w-[calc(100vw-2rem)]"
                        >
                            {dealerOptions.map((dealer) => (
                                <DropdownMenuItem
                                    key={dealer}
                                    onSelect={() => handleDealerSelect(dealer)}
                                    className={cn(
                                        'cursor-pointer text-sm max-md:min-h-[44px] max-md:text-base',
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

                <div className="flex items-center gap-2 max-md:gap-1.5">
                    {!isCartPage && (
                        <Button
                            className="relative h-11 w-11 rounded-md p-0 max-md:min-h-[44px] max-md:min-w-[44px]"
                            onClick={toggleDrawer}
                            type="button"
                            title={isDrawerOpen ? 'Close cart drawer' : 'Open cart drawer'}
                        >
                            <ShoppingCart className="h-5 w-5 max-md:h-4 max-md:w-4" />
                            {!isDrawerOpen && cart.length > 0 && (
                                <span className="absolute -right-2 -top-2 rounded-full bg-background px-2 py-0.5 text-xs font-semibold text-primary shadow max-md:-right-1 max-md:-top-1 max-md:px-1.5 max-md:text-[10px]">
                                    {cart.length}
                                </span>
                            )}
                        </Button>
                    )}

                    <Button
                        variant="outline"
                        className="h-11 max-md:min-h-[44px] max-md:px-3 max-md:text-sm"
                        onClick={() => navigate('/orders')}
                        type="button"
                    >
                        <span className="max-md:hidden">Orders</span>
                        <span className="hidden max-md:inline">Orders</span>
                    </Button>
                </div>

                {!authDisabled && (
                    <div className="flex items-center gap-3 max-md:gap-2 max-md:ml-auto">
                        <span className="max-w-[180px] truncate text-sm text-muted-foreground max-md:hidden" title={email || undefined}>
                            {email || 'Signed in'}
                        </span>
                        <Button variant="secondary" size="sm" type="button" onClick={handleSignOut} className="max-md:min-h-[44px] max-md:px-3">
                            <span className="max-md:hidden">Sign out</span>
                            <span className="hidden max-md:inline">Out</span>
                        </Button>
                    </div>
                )}
            </div>
        </header>
    );
}

export default AppHeader;
