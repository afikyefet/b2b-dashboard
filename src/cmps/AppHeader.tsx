import { useState, useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { AppDispatch } from '../store';
import { selectDealerName, setDealerName, resetFilters } from '../store/slices/filterSlice';
import { useDrawer } from '../contexts/DrawerContext';
import { useCart } from '../contexts/CartContext';
import { getDashboardData } from '../services/dashboard.service';
import { getFilterOptions } from '../services/dashboard.service';
import '../styles/AppHeader.scss'

function AppHeader() {
    const dispatch = useDispatch<AppDispatch>();
    const dealerName = useSelector(selectDealerName);
    const { cart } = useCart();
    const { isOpen: isDrawerOpen, toggleDrawer } = useDrawer();
    const [dealerOptions, setDealerOptions] = useState<string[]>([]);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [isCartPage, setIsCartPage] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Check if we're on the cart page
    useEffect(() => {
        const handleHashChange = () => {
            setIsCartPage(window.location.hash === '#cart');
        };
        
        // Initial check
        handleHashChange();
        
        window.addEventListener('hashchange', handleHashChange);
        return () => window.removeEventListener('hashchange', handleHashChange);
    }, []);

    // Fetch dealer options
    useEffect(() => {
        getDashboardData().then((data) => {
            const options = getFilterOptions(data);
            setDealerOptions(options.dealerNames);
        });
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

    return (
        <header>
            <div className="header-container">
                <div className="header-logo">
                    <button
                        onClick={() => window.location.hash = ''}
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
            </div>
        </header>
    )
}
export default AppHeader;