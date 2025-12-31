import type { FilterConfig, FilterOptions } from "../types/dashboard.types";
import "../styles/DashboardFilter.scss";

interface DashboardFilterProps {
    filters: FilterConfig;
    onFilterChange: (filters: FilterConfig) => void;
    onReset: () => void;
    filterOptions: FilterOptions;
}

function DashboardFilter({ filters, onFilterChange, onReset, filterOptions }: DashboardFilterProps) {
    const handleSelectChange = (field: keyof FilterConfig, value: string) => {
        onFilterChange({
            ...filters,
            [field]: value === '' ? undefined : value,
        });
    };

    const handleGeneralSearchChange = (value: string) => {
        onFilterChange({
            ...filters,
            generalSearch: value || undefined,
        });
    };

    const hasActiveFilters = Object.values(filters).some(value => value && value.trim() !== '');

    return (
        <div className="dashboard-filter">
            <div className="filter-header">
                <h3>Filters</h3>
                {hasActiveFilters && (
                    <button className="btn-reset" onClick={onReset}>
                        Reset Filters
                    </button>
                )}
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
                    <select
                        id="dealerName"
                        value={filters.dealerName || ''}
                        onChange={(e) => handleSelectChange('dealerName', e.target.value)}
                    >
                        <option value="">All Dealers</option>
                        {filterOptions.dealerNames.map((option) => (
                            <option key={option} value={option}>
                                {option}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="filter-group">
                    <label htmlFor="productCategory">Product Category</label>
                    <select
                        id="productCategory"
                        value={filters.productCategory || ''}
                        onChange={(e) => handleSelectChange('productCategory', e.target.value)}
                    >
                        <option value="">All Categories</option>
                        {filterOptions.productCategories.map((option) => (
                            <option key={option} value={option}>
                                {option}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="filter-group">
                    <label htmlFor="productName">Product Name</label>
                    <select
                        id="productName"
                        value={filters.productName || ''}
                        onChange={(e) => handleSelectChange('productName', e.target.value)}
                    >
                        <option value="">All Products</option>
                        {filterOptions.productNames.map((option) => (
                            <option key={option} value={option}>
                                {option}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="filter-group">
                    <label htmlFor="variantSku">Variant SKU</label>
                    <select
                        id="variantSku"
                        value={filters.variantSku || ''}
                        onChange={(e) => handleSelectChange('variantSku', e.target.value)}
                    >
                        <option value="">All SKUs</option>
                        {filterOptions.variantSkus.map((option) => (
                            <option key={option} value={option}>
                                {option}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="filter-group">
                    <label htmlFor="variantSize">Variant Size</label>
                    <select
                        id="variantSize"
                        value={filters.variantSize || ''}
                        onChange={(e) => handleSelectChange('variantSize', e.target.value)}
                    >
                        <option value="">All Sizes</option>
                        {filterOptions.variantSizes.map((option) => (
                            <option key={option} value={option}>
                                {option}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="filter-group">
                    <label htmlFor="variantColor">Variant Color</label>
                    <select
                        id="variantColor"
                        value={filters.variantColor || ''}
                        onChange={(e) => handleSelectChange('variantColor', e.target.value)}
                    >
                        <option value="">All Colors</option>
                        {filterOptions.variantColors.map((option) => (
                            <option key={option} value={option}>
                                {option}
                            </option>
                        ))}
                    </select>
                </div>
            </div>
        </div>
    );
}

export default DashboardFilter;
