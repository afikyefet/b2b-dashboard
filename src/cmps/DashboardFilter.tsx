import { useState, useEffect, useRef } from "react";
import type { FilterConfig, FilterOptions } from "../types/dashboard.types";
import "../styles/DashboardFilter.scss";

interface DashboardFilterProps {
    filters: FilterConfig;
    onFilterChange: (filters: FilterConfig) => void;
    onReset: () => void;
    filterOptions: FilterOptions;
}

function DashboardFilter({ filters, onFilterChange, filterOptions }: DashboardFilterProps) {
    const [openDropdowns, setOpenDropdowns] = useState<Record<string, boolean>>({});
    const dropdownRefs = useRef<Record<string, HTMLDivElement | null>>({});

    const handleCheckboxChange = (field: keyof FilterConfig, value: string, checked: boolean) => {
        const currentValues = (filters[field] as string[]) || [];
        let newValues: string[];

        if (checked) {
            newValues = [...currentValues, value];
        } else {
            newValues = currentValues.filter(v => v !== value);
        }

        onFilterChange({
            ...filters,
            [field]: newValues.length > 0 ? newValues : undefined,
        });
    };

    const handleGeneralSearchChange = (value: string) => {
        onFilterChange({
            ...filters,
            generalSearch: value || undefined,
        });
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

    const getSelectedCount = (field: keyof FilterConfig): number => {
        const values = filters[field] as string[] | undefined;
        return values ? values.length : 0;
    };

    return (
        <div className="dashboard-filter">
            <div className="filter-header">
                <h3>Filters</h3>
            </div>
            
            {/* General Search */}
            <div className="filter-group general-search">
                <label htmlFor="generalSearch">General Search</label>
                <input
                    id="generalSearch"
                    type="text"
                    value={filters.generalSearch || ''}
                    onChange={(e) => handleGeneralSearchChange(e.target.value)}
                    placeholder="Search across all fields..."
                />
            </div>

            <div className="filter-inputs">
                <div className="filter-group">
                    <label htmlFor="dealerName">
                        Dealer Name
                        {getSelectedCount('dealerName') > 0 && (
                            <span className="selection-count">({getSelectedCount('dealerName')})</span>
                        )}
                    </label>
                    <div className="multi-select-wrapper" ref={(el) => { dropdownRefs.current.dealerName = el; }}>
                        <button
                            className="multi-select-button"
                            onClick={() => toggleDropdown('dealerName')}
                            type="button"
                        >
                            {getSelectedCount('dealerName') > 0
                                ? `${getSelectedCount('dealerName')} selected`
                                : 'Select dealers...'}
                            <span className="dropdown-arrow">▼</span>
                        </button>
                        {openDropdowns.dealerName && (
                            <div className="multi-select-dropdown">
                                {filterOptions.dealerNames.map((option) => {
                                    const isChecked = (filters.dealerName || []).includes(option);
                                    return (
                                        <label key={option} className="checkbox-label">
                                            <input
                                                type="checkbox"
                                                checked={isChecked}
                                                onChange={(e) => handleCheckboxChange('dealerName', option, e.target.checked)}
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
                                                onChange={(e) => handleCheckboxChange('productCategory', option, e.target.checked)}
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
                                                onChange={(e) => handleCheckboxChange('productName', option, e.target.checked)}
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
                                                onChange={(e) => handleCheckboxChange('variantSku', option, e.target.checked)}
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
                                                onChange={(e) => handleCheckboxChange('variantSize', option, e.target.checked)}
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
                                                onChange={(e) => handleCheckboxChange('variantColor', option, e.target.checked)}
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
    );
}

export default DashboardFilter;
