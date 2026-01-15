import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import type { AppDispatch } from '../store';
import { selectDealerName, setDealerName, resetFilters } from '../store/slices/filterSlice';
import { useDrawer } from '../contexts/DrawerContext';
import { useCart } from '../contexts/CartContext';
import { useAuth } from '../contexts/AuthContext';
import { getDashboardData } from '../services/dashboard.service';
import { getFilterOptions } from '../services/dashboard.service';
import { resolveStoreForDealer } from '../utils/storeRouting';
import '../styles/AppHeader.scss'

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
    const dropdownRef = useRef<HTMLDivElement>(null);
    const dealerRegion = useMemo(() => (dealerName ? resolveStoreForDealer(dealerName) : null), [dealerName]);

    // Check if we're on the cart page
    const isCartPage = location.pathname === '/cart';

    // Fetch dealer options
    useEffect(() => {
        let cancelled = false;
        getDashboardData()
            .then((data) => {
                // console.log('[AppHeader] dashboard data', data);
                const options = getFilterOptions(data);
                // console.log('[AppHeader] dealer options', options.dealerNames);
                if (!cancelled) setDealerOptions(options.dealerNames);
            })
            .catch((error) => {
                console.error('[AppHeader] failed to load dashboard data', error);
            });

        return () => {
            cancelled = true;
        };
    }, []);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsDropdownOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
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
        <header>
            <div className="header-container">
                <div className="header-logo">
                    <button
                        onClick={() => navigate('/')}
                        type="button"
                        title="Go to dashboard"
                    >
                        <img src="/logo.png" alt="Logo" />
                    </button>
                </div>
                <div className="header-company" ref={dropdownRef}>
                    {dealerName ? (
                        <div className="dealer-selector">
                            <button
                                className="dealer-selector-button"
                                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                                type="button"
                            >
                                <span className="dealer-label">Viewing:</span>
                                <span className="dealer-name">{dealerName}</span>
                                {dealerRegion && <span className="dealer-region">{dealerRegion}</span>}
                                <span className="dropdown-arrow">▼</span>
                            </button>
                            {isDropdownOpen && dealerOptions.length > 0 && (
                                <div className="dealer-dropdown">
                                    {dealerOptions.map((dealer) => (
                                        <button
                                            key={dealer}
                                            className={`dealer-option ${dealer === dealerName ? 'active' : ''}`}
                                            onClick={() => handleDealerSelect(dealer)}
                                            type="button"
                                        >
                                            {dealer}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="dealer-selector">
                            <button
                                className="dealer-selector-button"
                                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                                type="button"
                            >
                                <span>Select Dealer</span>
                                <span className="dropdown-arrow">▼</span>
                            </button>
                            {isDropdownOpen && dealerOptions.length > 0 && (
                                <div className="dealer-dropdown">
                                    {dealerOptions.map((dealer) => (
                                        <button
                                            key={dealer}
                                            className="dealer-option"
                                            onClick={() => handleDealerSelect(dealer)}
                                            type="button"
                                        >
                                            {dealer}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
                {!isCartPage && (
                    <div className="header-nav">
                        <button
                            className="drawer-toggle-button-header"
                            onClick={toggleDrawer}
                            type="button"
                            title={isDrawerOpen ? 'Close cart drawer' : 'Open cart drawer'}
                        >
                            <span className="toggle-icon">☰</span>
                            {!isDrawerOpen && cart.length > 0 && (
                                <span className="sku-count-badge">{cart.length}</span>
                            )}
                        </button>
                    </div>
                )}
                <div className="header-nav">
                    <button
                        className="drawer-toggle-button-header"
                        onClick={() => navigate('/orders')}
                        type="button"
                        style={{ marginLeft: '10px' }}
                    >
                        Orders
                    </button>
                </div>
                {!authDisabled && (
                    <div className="header-auth">
                        <span className="auth-email" title={email || undefined}>
                            {email || 'Signed in'}
                        </span>
                        <button className="auth-signout" type="button" onClick={handleSignOut}>
                            Sign out
                        </button>
                    </div>
                )}
            </div>
        </header>
    )
}
export default AppHeader;
