import { useState, useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { AppDispatch } from '../store';
import { selectDealerName, setDealerName, resetFilters } from '../store/slices/filterSlice';
import { selectSelectedRowIds } from '../store/slices/selectionSlice';
import { useDrawer } from '../contexts/DrawerContext';
import { getDashboardData } from '../services/dashboard.service';
import { getFilterOptions } from '../services/dashboard.service';
import '../styles/AppHeader.scss'

function AppHeader() {
    const dispatch = useDispatch<AppDispatch>();
    const dealerName = useSelector(selectDealerName);
    const selectedRowIds = useSelector(selectSelectedRowIds);
    const { isOpen: isDrawerOpen, toggleDrawer } = useDrawer();
    const [dealerOptions, setDealerOptions] = useState<string[]>([]);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

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
                    <img src="/logo.png" alt="Logo" />
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
                <div className="header-nav">
                    <button
                        className="drawer-toggle-button-header"
                        onClick={toggleDrawer}
                        type="button"
                        title={isDrawerOpen ? 'Close SKU drawer' : 'Open SKU drawer'}
                    >
                        <span className="toggle-icon">☰</span>
                        {!isDrawerOpen && selectedRowIds.length > 0 && (
                            <span className="sku-count-badge">{selectedRowIds.length}</span>
                        )}
                    </button>
                </div>
            </div>
        </header>
    )
}
export default AppHeader;