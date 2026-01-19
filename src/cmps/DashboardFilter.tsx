import { useState, useEffect, useMemo } from "react";
import { ChevronRight } from "lucide-react";
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
import { Button } from "../components/ui/button";
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";

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

type MultiSelectProps = {
    label: string;
    placeholder: string;
    options: string[];
    selected: string[];
    onToggle: (value: string) => void;
};

function MultiSelect({ label, placeholder, options, selected, onToggle }: MultiSelectProps) {
    const count = selected.length;
    return (
        <div className="space-y-2">
            <div className="text-xs font-semibold text-muted-foreground max-md:text-sm">
                {label} {count > 0 && <span className="text-primary">({count})</span>}
            </div>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button
                        variant="outline"
                        className="h-9 w-full justify-between text-xs text-foreground max-md:h-11 max-md:min-h-[44px] max-md:text-sm"
                        type="button"
                    >
                        {count > 0 ? `${count} selected` : placeholder}
                        <ChevronRight className="h-4 w-4 rotate-90 text-muted-foreground max-md:h-5 max-md:w-5" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="max-h-56 w-64 overflow-y-auto p-1 max-md:w-[calc(100vw-2rem)] max-md:max-h-72">
                    {options.map((option) => (
                        <DropdownMenuCheckboxItem
                            key={option}
                            checked={selected.includes(option)}
                            onCheckedChange={() => onToggle(option)}
                            onSelect={(event) => event.preventDefault()}
                            className="text-xs max-md:text-sm max-md:min-h-[44px]"
                        >
                            {option}
                        </DropdownMenuCheckboxItem>
                    ))}
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    );
}

function DashboardFilter({
    filterOptions,
    originalData,
    filteredData,
    onResetAll,
    hasActiveFilters,
    isRefreshing,
    smartSelectDays,
    onSmartSelectDaysChange,
}: DashboardFilterProps) {
    const dispatch = useDispatch<AppDispatch>();
    const filters = useSelector(selectFilters);
    const { cart, removeSku } = useCart();
    const [filtersExpanded, setFiltersExpanded] = useState(false);

    // Calculate range bounds from original data
    const rangeBounds = useMemo(() => ({
        whenToSell: calculateRangeBounds(originalData, 'when_to_sell'),
        howMuchToSellNow: calculateRangeBounds(originalData, 'how_much_to_sell_now'),
        sellRate: calculateRangeBounds(originalData, 'sell_rate'),
        lastStock: calculateRangeBounds(originalData, 'last_stock'),
    }), [originalData]);

    const handleCheckboxChange = (
        field: 'productCategory' | 'productName' | 'variantSku' | 'variantSize' | 'variantColor' | 'productSellType',
        value: string
    ) => {
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

    useEffect(() => {
        if (!filtersExpanded && filteredData.length === 0) {
            setFiltersExpanded(false);
        }
    }, [filteredData.length, filtersExpanded]);

    return (
        <div className="rounded-lg border border-border bg-card p-4 shadow-sm max-md:p-3">
            <div className="flex items-center justify-between max-md:flex-col max-md:items-start max-md:gap-2">
                <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-foreground max-md:text-base">Filters</h3>
                    {isRefreshing && (
                        <span className="text-xs text-muted-foreground max-md:text-sm">Refreshing...</span>
                    )}
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1 text-xs max-md:h-11 max-md:min-h-[44px] max-md:w-full max-md:text-sm max-md:font-semibold"
                    onClick={() => setFiltersExpanded((prev) => !prev)}
                    type="button"
                >
                    {filtersExpanded ? 'Hide Filters' : 'Show Filters'}
                    <ChevronRight
                        className={`h-4 w-4 transition-transform max-md:h-5 max-md:w-5 ${filtersExpanded ? 'rotate-90' : ''}`}
                    />
                </Button>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3 border-b border-border pb-4 max-md:flex-col max-md:items-stretch max-md:gap-3 max-md:pb-3">
                <div className="flex flex-1 items-center gap-2 max-md:w-full max-md:flex-col max-md:items-stretch">
                    <Label htmlFor="generalSearch" className="text-xs font-semibold text-muted-foreground max-md:text-sm">
                        Search
                    </Label>
                    <Input
                        id="generalSearch"
                        type="text"
                        value={filters.generalSearch || ''}
                        onChange={(e) => handleGeneralSearchChange(e.target.value)}
                        placeholder="Search across all fields..."
                        className="h-9 max-w-xs text-xs max-md:w-full max-md:max-w-none max-md:h-11 max-md:text-sm"
                    />
                </div>
                <div className="flex flex-wrap items-center gap-2 max-md:w-full max-md:flex-col max-md:gap-2">
                    <div className="flex items-center gap-2 max-md:w-full max-md:justify-between">
                        <Label htmlFor="smartSelectDays" className="text-xs font-semibold text-muted-foreground max-md:text-sm">
                            Days of stock
                        </Label>
                        <Input
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
                            className="h-9 w-20 text-xs max-md:h-11 max-md:w-24 max-md:text-sm"
                        />
                    </div>
                    <div className="max-md:w-full">
                        <SmartSelection
                            filteredData={filteredData}
                            days={smartSelectDays}
                            onSmartSelectDaysChange={onSmartSelectDaysChange}
                        />
                    </div>
                    <Button
                        variant="secondary"
                        size="sm"
                        onClick={handleClearCart}
                        type="button"
                        disabled={cart.length === 0}
                        className="max-md:w-full max-md:h-11 max-md:min-h-[44px] max-md:text-sm"
                    >
                        Clear Cart
                    </Button>
                    <Button
                        size="sm"
                        onClick={onResetAll}
                        type="button"
                        disabled={!hasActiveFilters}
                        className="max-md:w-full max-md:h-11 max-md:min-h-[44px] max-md:text-sm"
                    >
                        Reset Filters
                    </Button>
                </div>
            </div>

            {filtersExpanded && (
                <div className="mt-4 space-y-4 max-md:space-y-3">
                    <div className="space-y-3 border-b border-border pb-4 max-md:pb-3">
                        <h4 className="text-sm font-semibold text-foreground max-md:text-base">Range Filters</h4>
                        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4 max-md:grid-cols-1 max-md:gap-3">
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

                    <div className="space-y-3">
                        <h4 className="text-sm font-semibold text-foreground max-md:text-base">Product Filters</h4>
                        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 max-md:grid-cols-1 max-md:gap-3">
                            <MultiSelect
                                label="Product Sell Type"
                                placeholder="Select types..."
                                options={filterOptions.productSellTypes}
                                selected={filters.productSellType || []}
                                onToggle={(value) => handleCheckboxChange('productSellType', value)}
                            />
                            <MultiSelect
                                label="Product Category"
                                placeholder="Select categories..."
                                options={filterOptions.productCategories}
                                selected={filters.productCategory || []}
                                onToggle={(value) => handleCheckboxChange('productCategory', value)}
                            />
                            <MultiSelect
                                label="Product Name"
                                placeholder="Select products..."
                                options={filterOptions.productNames}
                                selected={filters.productName || []}
                                onToggle={(value) => handleCheckboxChange('productName', value)}
                            />
                            <MultiSelect
                                label="Variant SKU"
                                placeholder="Select SKUs..."
                                options={filterOptions.variantSkus}
                                selected={filters.variantSku || []}
                                onToggle={(value) => handleCheckboxChange('variantSku', value)}
                            />
                            <MultiSelect
                                label="Variant Size"
                                placeholder="Select sizes..."
                                options={filterOptions.variantSizes}
                                selected={filters.variantSize || []}
                                onToggle={(value) => handleCheckboxChange('variantSize', value)}
                            />
                            <MultiSelect
                                label="Variant Color"
                                placeholder="Select colors..."
                                options={filterOptions.variantColors}
                                selected={filters.variantColor || []}
                                onToggle={(value) => handleCheckboxChange('variantColor', value)}
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default DashboardFilter;
