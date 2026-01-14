import { useState, useRef, useEffect } from 'react';
import type { DashboardDataRow } from '../types/dashboard.types';
import { useCart } from '../contexts/CartContext';
import { getSelectionQty } from '../utils/selectionQty';
import '../styles/SmartSelection.scss';

interface SmartSelectionProps {
  filteredData: DashboardDataRow[];
  days: number;
  onSmartSelectDaysChange?: (days: number) => void;
}

const PRESET_RANGES = [
  { label: '0-30 days', min: 0, max: 30 },
  { label: '31-60 days', min: 31, max: 60 },
  { label: '61-90 days', min: 61, max: 90 },
  { label: '90+ days', min: 90, max: null },
];

function SmartSelection({ filteredData, days, onSmartSelectDaysChange }: SmartSelectionProps) {
  const { addSku, isInCart } = useCart();
  const [isOpen, setIsOpen] = useState(false);
  const [customMin, setCustomMin] = useState('0');
  const [customMax, setCustomMax] = useState('45');
  const [showCustomModal, setShowCustomModal] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectByRange = (min: number, max: number | null, selectionDays: number = days) => {
    let selectedCount = 0;

    filteredData.forEach(row => {
      const sku = row.variant_sku_real;
      if (!sku || isInCart(sku)) return;

      const whenToSell = parseFloat(String(row.when_to_sell ?? ''));
      if (isNaN(whenToSell)) return;

      const inRange = whenToSell >= min && (max === null || whenToSell <= max);

      if (inRange) {
        const initialQty = getSelectionQty(row, selectionDays);

        addSku(sku, initialQty);
        selectedCount++;
      }
    });

    return selectedCount;
  };

  const handlePresetClick = (min: number, max: number | null, label: string) => {
    const count = selectByRange(min, max);
    setIsOpen(false);
    if (count > 0) {
      console.log(`Selected ${count} items from ${label}`);
    }
  };

  const handleCustomSelect = () => {
    const min = parseFloat(customMin);
    const max = customMax.trim() ? parseFloat(customMax) : null;

    if (isNaN(min)) {
      alert('Please enter a valid minimum value');
      return;
    }

    if (customMax.trim() && (max === null || Number.isNaN(max))) {
      alert('Please enter a valid maximum value');
      return;
    }

    if (max !== null && min > max) {
      alert('Minimum cannot be greater than maximum');
      return;
    }

    const rangeDays = max !== null ? max - min : min;
    const nextDays = Math.max(1, Math.round(rangeDays));
    onSmartSelectDaysChange?.(nextDays);

    const count = selectByRange(min, max, nextDays);
    setShowCustomModal(false);
    setIsOpen(false);
    if (count > 0) {
      console.log(`Selected ${count} items from custom range`);
    }
  };

  const getCountForRange = (min: number, max: number | null): number => {
    return filteredData.filter(row => {
      const sku = row.variant_sku_real;
      if (!sku || isInCart(sku)) return false;

      const whenToSell = parseFloat(String(row.when_to_sell ?? ''));
      if (isNaN(whenToSell)) return false;

      return whenToSell >= min && (max === null || whenToSell <= max);
    }).length;
  };

  return (
    <div className="smart-selection" ref={dropdownRef}>
      <button
        className="smart-selection-button"
        onClick={() => setIsOpen(!isOpen)}
        type="button"
        title="Smart selection based on when_to_sell"
      >
        Smart Select ▼
      </button>

      {isOpen && (
        <div className="smart-selection-dropdown">
          {PRESET_RANGES.map((range) => {
            const count = getCountForRange(range.min, range.max);
            return (
              <button
                key={range.label}
                className="smart-selection-option"
                onClick={() => handlePresetClick(range.min, range.max, range.label)}
                type="button"
                disabled={count === 0}
              >
                {range.label}
                <span className="item-count">({count} items)</span>
              </button>
            );
          })}

          <button
            className="smart-selection-option custom"
            onClick={() => {
              setShowCustomModal(true);
              setIsOpen(false);
            }}
            type="button"
          >
            Custom range...
          </button>
        </div>
      )}

      {showCustomModal && (
        <div className="custom-range-modal-overlay" onClick={() => setShowCustomModal(false)}>
          <div className="custom-range-modal" onClick={(e) => e.stopPropagation()}>
            <h4>Custom Range Selection</h4>
            <div className="custom-inputs">
              <div>
                <label>Min (days):</label>
                <input
                  type="number"
                  value={customMin}
                  onChange={(e) => setCustomMin(e.target.value)}
                  placeholder="0"
                />
              </div>
              <div>
                <label>Max (days):</label>
                <input
                  type="number"
                  value={customMax}
                  onChange={(e) => setCustomMax(e.target.value)}
                  placeholder="No max"
                />
              </div>
            </div>
            <div className="modal-actions">
              <button onClick={handleCustomSelect} className="btn-select">Select</button>
              <button onClick={() => setShowCustomModal(false)} className="btn-cancel">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default SmartSelection;
