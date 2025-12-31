import { useState, useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { setDealerName, selectDealerName } from '../store/slices/filterSlice';
import { saveSelectedDealer } from '../services/localStorage.service';
import '../styles/DealerSelector.scss';

interface DealerSelectorProps {
    dealerNames: string[];
}

function DealerSelector({ dealerNames }: DealerSelectorProps) {
    const dispatch = useDispatch();
    const selectedDealer = useSelector(selectDealerName);
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement | null>(null);

    const handleDealerSelect = (dealerName: string) => {
        dispatch(setDealerName(dealerName));
        saveSelectedDealer(dealerName);
        setIsOpen(false);
    };

    const handleClear = () => {
        dispatch(setDealerName(null));
        saveSelectedDealer(null);
        setIsOpen(false);
    };

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    if (dealerNames.length === 0) {
        return null;
    }

    return (
        <div className="dealer-selector" ref={dropdownRef}>
            <button
                className="dealer-selector-button"
                onClick={() => setIsOpen(!isOpen)}
                type="button"
            >
                <span className="dealer-label">Dealer:</span>
                <span className="dealer-name">
                    {selectedDealer || 'Select Dealer'}
                </span>
                <span className="dropdown-arrow">▼</span>
            </button>
            {isOpen && (
                <div className="dealer-dropdown">
                    {dealerNames.map((dealer) => (
                        <button
                            key={dealer}
                            className={`dealer-option ${selectedDealer === dealer ? 'selected' : ''}`}
                            onClick={() => handleDealerSelect(dealer)}
                            type="button"
                        >
                            {dealer}
                        </button>
                    ))}
                    {selectedDealer && (
                        <button
                            className="dealer-clear"
                            onClick={handleClear}
                            type="button"
                        >
                            Clear Selection
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}

export default DealerSelector;

