import { useState, useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { AppDispatch } from '../store';
import { selectDealerName, setDealerName } from '../store/slices/filterSlice';
import { getDashboardData } from '../services/dashboard.service';
import { getFilterOptions } from '../services/dashboard.service';
import '../styles/AppHeader.scss'

function AppHeader() {
    const dispatch = useDispatch<AppDispatch>();
    const dealerName = useSelector(selectDealerName);
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
        setIsDropdownOpen(false);
    };

    return (
        <header>
            <div className="header-container">
                <div className="header-logo">
                    <span>Logo</span>
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
                    <ul>
                        <li><a href="#">Home</a></li>
                    </ul>
                </div>
            </div>
        </header>
    )
}
export default AppHeader;