import { useState, useEffect, useRef } from "react";
import { useDispatch, useSelector } from 'react-redux';
import type { FilterConfig, FilterOptions } from "../types/dashboard.types";
import {
    selectFilters,
    setDealerName,
    setGeneralSearch,
    toggleProductCategory,
    toggleProductName,
    toggleVariantSku,
    toggleVariantSize,
    toggleVariantColor
} from '../store/slices/filterSlice';
import { saveSelectedDealer } from '../services/localStorage.service';
import "../styles/DashboardFilter.scss";

interface DashboardFilterProps {
    filterOptions: FilterOptions;
}

function DashboardFilter({ filterOptions }: DashboardFilterProps) {
    const dispatch = useDispatch();
    const filters = useSelector(selectFilters);
    const [openDropdowns, setOpenDropdowns] = useState<Record<string, boolean>>({});
    const dropdownRefs = useRef<Record<string, HTMLDivElement | null>>({});

    const handleCheckboxChange = (field: keyof FilterConfig, value: string) => {
        switch(field) {
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
        }
    };

    const handleGeneralSearchChange = (value: string) => {
        dispatch(setGeneralSearch(value));
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
        if (field === 'dealerName') {
            return filters.dealerName ? 1 : 0;
        }
        const values = filters[field] as string[] | undefined;
        return values?.length || 0;
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
                    <label htmlFor="dealerName">Dealer Name</label>
                    <div className="single-select-wrapper" ref={(el) => { dropdownRefs.current.dealerName = el; }}>
                        <button
                            className="single-select-button"
                            onClick={() => toggleDropdown('dealerName')}
                            type="button"
                        >
                            {filters.dealerName || 'Select dealer...'}
                            <span className="dropdown-arrow">▼</span>
                        </button>
                        {openDropdowns.dealerName && (
                            <div className="single-select-dropdown">
                                {filterOptions.dealerNames.map((option) => (
                                    <label key={option} className="radio-label">
                                        <input
                                            type="radio"
                                            name="dealerName"
                                            checked={filters.dealerName === option}
                                            onChange={() => {
                                                dispatch(setDealerName(option));
                                                saveSelectedDealer(option);
                                                setOpenDropdowns(prev => ({ ...prev, dealerName: false }));
                                            }}
                                        />
                                        <span>{option}</span>
                                    </label>
                                ))}
                                {filters.dealerName && (
                                    <div className="clear-selection">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                dispatch(setDealerName(null));
                                                saveSelectedDealer(null);
                                            }}
                                        >
                                            Clear Selection
                                        </button>
                                    </div>
                                )}
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
    );
}

export default DashboardFilter;
