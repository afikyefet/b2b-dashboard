import { useState, useEffect, useRef, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import type { AppDispatch } from "../store";
import {
    selectFilters,
    setGeneralSearch,
    toggleProductCategory,
    toggleProductName,
    toggleVariantSku,
    toggleVariantSize,
    toggleVariantColor,
    toggleProductSellType,
    setWhenToSellRange,
    setHowMuchToSellNowRange,
    setSellRateRange,
    setLastStockRange
} from "../store/slices/filterSlice";
import type { FilterOptions, DashboardDataResponse, RangeFilter } from "../types/dashboard.types";
import { calculateRangeBounds } from "../services/dashboard.service";
import RangeSlider from "./RangeSlider";
import SmartSelection from "./SmartSelection";
import { useCart } from "../contexts/CartContext";
import "../styles/DashboardFilter.scss";

interface DashboardFilterProps {
    filterOptions: FilterOptions;
    originalData: DashboardDataResponse;
    filteredData: DashboardDataResponse;
    onResetAll: () => void;
    hasActiveFilters: boolean;
    isRefreshing: boolean;
    smartSelectDays: number;
    onSmartSelectDaysChange: (days: number) => void;
}

function DashboardFilter({ filterOptions, originalData, filteredData, onResetAll, hasActiveFilters, isRefreshing, smartSelectDays, onSmartSelectDaysChange }: DashboardFilterProps) {
    const dispatch = useDispatch<AppDispatch>();
    const filters = useSelector(selectFilters);
    const { cart, removeSku } = useCart();
    const [openDropdowns, setOpenDropdowns] = useState<Record<string, boolean>>({});
    const [filtersExpanded, setFiltersExpanded] = useState(false);
    const dropdownRefs = useRef<Record<string, HTMLDivElement | null>>({});

    // Calculate range bounds from original data
    const rangeBounds = useMemo(() => ({
        whenToSell: calculateRangeBounds(originalData, 'when_to_sell'),
        howMuchToSellNow: calculateRangeBounds(originalData, 'how_much_to_sell_now'),
        sellRate: calculateRangeBounds(originalData, 'sell_rate'),
        lastStock: calculateRangeBounds(originalData, 'last_stock'),
    }), [originalData]);

    const handleCheckboxChange = (field: 'productCategory' | 'productName' | 'variantSku' | 'variantSize' | 'variantColor' | 'productSellType', value: string) => {
        switch (field) {
            case 'productCategory':
                dispatch(toggleProductCategory(value));
                break;
            case 'productName':
                dispatch(toggleProductName(value));
                break;
            case 'variantSku':
                dispatch(toggleVariantSku(value));
                break;
            case 'variantSize':
                dispatch(toggleVariantSize(value));
                break;
            case 'variantColor':
                dispatch(toggleVariantColor(value));
                break;
            case 'productSellType':
                dispatch(toggleProductSellType(value));
                break;
        }
    };

    const handleRangeChange = (field: 'whenToSell' | 'howMuchToSellNow' | 'sellRate' | 'lastStock', value: RangeFilter) => {
        switch (field) {
            case 'whenToSell':
                dispatch(setWhenToSellRange(value));
                break;
            case 'howMuchToSellNow':
                dispatch(setHowMuchToSellNowRange(value));
                break;
            case 'sellRate':
                dispatch(setSellRateRange(value));
                break;
            case 'lastStock':
                dispatch(setLastStockRange(value));
                break;
        }
    };

    const handleGeneralSearchChange = (value: string) => {
        dispatch(setGeneralSearch(value));
    };

    const handleClearCart = () => {
        if (cart.length === 0) return;
        cart.forEach(item => removeSku(item.sku));
    };

    const toggleDropdown = (field: string) => {
        setOpenDropdowns(prev => ({
            ...prev,
            [field]: !prev[field]
        }));
    };

    // Close dropdowns when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            Object.keys(dropdownRefs.current).forEach((field) => {
                const ref = dropdownRefs.current[field];
                if (ref && !ref.contains(event.target as Node)) {
                    setOpenDropdowns(prev => ({ ...prev, [field]: false }));
                }
            });
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const getSelectedCount = (field: 'productCategory' | 'productName' | 'variantSku' | 'variantSize' | 'variantColor' | 'productSellType'): number => {
        const values = filters[field] as string[] | undefined;
        return values ? values.length : 0;
    };

    return (
        <div className="dashboard-filter">
            <div className="filter-header">
                <div className="filter-title">
                    <h3>Filters</h3>
                    {isRefreshing && <span className="filter-refreshing">Refreshing…</span>}
                </div>
            </div>
            
            <div className="filter-toolbar">
                <div className="filter-search">
                    <label htmlFor="generalSearch">Search</label>
                    <input
                        id="generalSearch"
                        type="text"
                        value={filters.generalSearch || ''}
                        onChange={(e) => handleGeneralSearchChange(e.target.value)}
                        placeholder="Search across all fields..."
                    />
                </div>
                <div className="filter-actions">
                    <div className="smart-select-days">
                        <label htmlFor="smartSelectDays">Days of stock</label>
                        <input
                            id="smartSelectDays"
                            type="number"
                            min={1}
                            step={1}
                            value={smartSelectDays}
                            onChange={(e) => {
                                const next = parseInt(e.target.value, 10);
                                if (Number.isNaN(next)) {
                                    return;
                                }
                                onSmartSelectDaysChange(Math.max(1, next));
                            }}
                        />
                    </div>
                    <SmartSelection filteredData={filteredData} days={smartSelectDays} />
                    <button
                        className="filter-action-btn secondary"
                        onClick={handleClearCart}
                        type="button"
                        disabled={cart.length === 0}
                    >
                        Clear Cart
                    </button>
                    <button
                        className="filter-action-btn primary"
                        onClick={onResetAll}
                        type="button"
                        disabled={!hasActiveFilters}
                    >
                        Reset Filters
                    </button>
                </div>
                <button
                    className="filter-toggle"
                    type="button"
                    onClick={() => setFiltersExpanded((prev) => !prev)}
                    aria-expanded={filtersExpanded}
                >
                    <span className="filter-toggle-label">
                        {filtersExpanded ? 'Hide Filters' : 'Show Filters'}
                    </span>
                    <span className={`filter-toggle-chevron${filtersExpanded ? ' open' : ''}`} aria-hidden="true">
                        {'>'}
                    </span>
                </button>
            </div>

            <div className={`filter-advanced${filtersExpanded ? ' open' : ' collapsed'}`}>
            {/* Range Filters Section */}
            <div className="range-filters-section">
                <h4>Range Filters</h4>
                <div className="range-filters-grid">
                    <RangeSlider
                        label="When to Sell (Days)"
                        field="when_to_sell"
                        min={rangeBounds.whenToSell.min}
                        max={rangeBounds.whenToSell.max}
                        value={filters.whenToSellRange || { min: null, max: null }}
                        onChange={(value) => handleRangeChange('whenToSell', value)}
                        step={1}
                    />
                    <RangeSlider
                        label="Recommended Quantity"
                        field="how_much_to_sell_now"
                        min={rangeBounds.howMuchToSellNow.min}
                        max={rangeBounds.howMuchToSellNow.max}
                        value={filters.howMuchToSellNowRange || { min: null, max: null }}
                        onChange={(value) => handleRangeChange('howMuchToSellNow', value)}
                        step={1}
                    />
                    <RangeSlider
                        label="Sell Rate (Daily)"
                        field="sell_rate"
                        min={rangeBounds.sellRate.min}
                        max={rangeBounds.sellRate.max}
                        value={filters.sellRateRange || { min: null, max: null }}
                        onChange={(value) => handleRangeChange('sellRate', value)}
                        step={0.1}
                        formatValue={(v) => v.toFixed(1)}
                    />
                    <RangeSlider
                        label="Current Stock"
                        field="last_stock"
                        min={rangeBounds.lastStock.min}
                        max={rangeBounds.lastStock.max}
                        value={filters.lastStockRange || { min: null, max: null }}
                        onChange={(value) => handleRangeChange('lastStock', value)}
                        step={1}
                    />
                </div>
            </div>

            {/* Product Filters Section */}
            <div className="categorical-filters-section">
                <h4>Product Filters</h4>
                <div className="filter-inputs">
                <div className="filter-group">
                    <label htmlFor="productSellType">
                        Product Sell Type
                        {getSelectedCount('productSellType') > 0 && (
                            <span className="selection-count">({getSelectedCount('productSellType')})</span>
                        )}
                    </label>
                    <div className="multi-select-wrapper" ref={(el) => { dropdownRefs.current.productSellType = el; }}>
                        <button
                            className="multi-select-button"
                            onClick={() => toggleDropdown('productSellType')}
                            type="button"
                        >
                            {getSelectedCount('productSellType') > 0
                                ? `${getSelectedCount('productSellType')} selected`
                                : 'Select types...'}
                            <span className="dropdown-arrow">▼</span>
                        </button>
                        {openDropdowns.productSellType && (
                            <div className="multi-select-dropdown">
                                {filterOptions.productSellTypes.map((option) => {
                                    const isChecked = (filters.productSellType || []).includes(option);
                                    return (
                                        <label key={option} className="checkbox-label">
                                            <input
                                                type="checkbox"
                                                checked={isChecked}
                                                onChange={() => handleCheckboxChange('productSellType', option)}
                                            />
                                            <span>{option}</span>
                                        </label>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>

                <div className="filter-group">
                    <label htmlFor="productCategory">
                        Product Category
                        {getSelectedCount('productCategory') > 0 && (
                            <span className="selection-count">({getSelectedCount('productCategory')})</span>
                        )}
                    </label>
                    <div className="multi-select-wrapper" ref={(el) => { dropdownRefs.current.productCategory = el; }}>
                        <button
                            className="multi-select-button"
                            onClick={() => toggleDropdown('productCategory')}
                            type="button"
                        >
                            {getSelectedCount('productCategory') > 0
                                ? `${getSelectedCount('productCategory')} selected`
                                : 'Select categories...'}
                            <span className="dropdown-arrow">▼</span>
                        </button>
                        {openDropdowns.productCategory && (
                            <div className="multi-select-dropdown">
                                {filterOptions.productCategories.map((option) => {
                                    const isChecked = (filters.productCategory || []).includes(option);
                                    return (
                                        <label key={option} className="checkbox-label">
                                            <input
                                                type="checkbox"
                                                checked={isChecked}
                                                onChange={() => handleCheckboxChange('productCategory', option)}
                                            />
                                            <span>{option}</span>
                                        </label>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>

                <div className="filter-group">
                    <label htmlFor="productName">
                        Product Name
                        {getSelectedCount('productName') > 0 && (
                            <span className="selection-count">({getSelectedCount('productName')})</span>
                        )}
                    </label>
                    <div className="multi-select-wrapper" ref={(el) => { dropdownRefs.current.productName = el; }}>
                        <button
                            className="multi-select-button"
                            onClick={() => toggleDropdown('productName')}
                            type="button"
                        >
                            {getSelectedCount('productName') > 0
                                ? `${getSelectedCount('productName')} selected`
                                : 'Select products...'}
                            <span className="dropdown-arrow">▼</span>
                        </button>
                        {openDropdowns.productName && (
                            <div className="multi-select-dropdown">
                                {filterOptions.productNames.map((option) => {
                                    const isChecked = (filters.productName || []).includes(option);
                                    return (
                                        <label key={option} className="checkbox-label">
                                            <input
                                                type="checkbox"
                                                checked={isChecked}
                                                onChange={() => handleCheckboxChange('productName', option)}
                                            />
                                            <span>{option}</span>
                                        </label>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>

                <div className="filter-group">
                    <label htmlFor="variantSku">
                        Variant SKU
                        {getSelectedCount('variantSku') > 0 && (
                            <span className="selection-count">({getSelectedCount('variantSku')})</span>
                        )}
                    </label>
                    <div className="multi-select-wrapper" ref={(el) => { dropdownRefs.current.variantSku = el; }}>
                        <button
                            className="multi-select-button"
                            onClick={() => toggleDropdown('variantSku')}
                            type="button"
                        >
                            {getSelectedCount('variantSku') > 0
                                ? `${getSelectedCount('variantSku')} selected`
                                : 'Select SKUs...'}
                            <span className="dropdown-arrow">▼</span>
                        </button>
                        {openDropdowns.variantSku && (
                            <div className="multi-select-dropdown">
                                {filterOptions.variantSkus.map((option) => {
                                    const isChecked = (filters.variantSku || []).includes(option);
                                    return (
                                        <label key={option} className="checkbox-label">
                                            <input
                                                type="checkbox"
                                                checked={isChecked}
                                                onChange={() => handleCheckboxChange('variantSku', option)}
                                            />
                                            <span>{option}</span>
                                        </label>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>

                <div className="filter-group">
                    <label htmlFor="variantSize">
                        Variant Size
                        {getSelectedCount('variantSize') > 0 && (
                            <span className="selection-count">({getSelectedCount('variantSize')})</span>
                        )}
                    </label>
                    <div className="multi-select-wrapper" ref={(el) => { dropdownRefs.current.variantSize = el; }}>
                        <button
                            className="multi-select-button"
                            onClick={() => toggleDropdown('variantSize')}
                            type="button"
                        >
                            {getSelectedCount('variantSize') > 0
                                ? `${getSelectedCount('variantSize')} selected`
                                : 'Select sizes...'}
                            <span className="dropdown-arrow">▼</span>
                        </button>
                        {openDropdowns.variantSize && (
                            <div className="multi-select-dropdown">
                                {filterOptions.variantSizes.map((option) => {
                                    const isChecked = (filters.variantSize || []).includes(option);
                                    return (
                                        <label key={option} className="checkbox-label">
                                            <input
                                                type="checkbox"
                                                checked={isChecked}
                                                onChange={() => handleCheckboxChange('variantSize', option)}
                                            />
                                            <span>{option}</span>
                                        </label>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>

                <div className="filter-group">
                    <label htmlFor="variantColor">
                        Variant Color
                        {getSelectedCount('variantColor') > 0 && (
                            <span className="selection-count">({getSelectedCount('variantColor')})</span>
                        )}
                    </label>
                    <div className="multi-select-wrapper" ref={(el) => { dropdownRefs.current.variantColor = el; }}>
                        <button
                            className="multi-select-button"
                            onClick={() => toggleDropdown('variantColor')}
                            type="button"
                        >
                            {getSelectedCount('variantColor') > 0
                                ? `${getSelectedCount('variantColor')} selected`
                                : 'Select colors...'}
                            <span className="dropdown-arrow">▼</span>
                        </button>
                        {openDropdowns.variantColor && (
                            <div className="multi-select-dropdown">
                                {filterOptions.variantColors.map((option) => {
                                    const isChecked = (filters.variantColor || []).includes(option);
                                    return (
                                        <label key={option} className="checkbox-label">
                                            <input
                                                type="checkbox"
                                                checked={isChecked}
                                                onChange={() => handleCheckboxChange('variantColor', option)}
                                            />
                                            <span>{option}</span>
                                        </label>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </div>
            </div>
            </div>
        </div>
    );
}

export default DashboardFilter;
