import { useDispatch, useSelector } from "react-redux";
import type { AppDispatch } from "../store";
import {
    selectFilters,
    setGeneralSearch,
    setOutOfStockOnly,
    setRecentOrdersCount,
    setOpenOrdersCount
} from "../store/slices/filterSlice";
import type { DashboardDataResponse } from "../types/dashboard.types";
import SmartSelection from "./SmartSelection";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Checkbox } from "../components/ui/checkbox";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "../components/ui/select";

interface DashboardFilterProps {
    filteredData: DashboardDataResponse;
    onResetAll: () => void;
    hasActiveFilters: boolean;
    isRefreshing: boolean;
    smartSelectDays: number;
    onSmartSelectDaysChange: (days: number) => void;
}

function DashboardFilter({
    filteredData,
    onResetAll,
    hasActiveFilters,
    isRefreshing,
    smartSelectDays,
    onSmartSelectDaysChange,
}: DashboardFilterProps) {
    const dispatch = useDispatch<AppDispatch>();
    const filters = useSelector(selectFilters);
    const allRecentOrdersValue = '__all_recent_orders__';
    const allOpenOrdersValue = '__all_open_orders__';

    const handleGeneralSearchChange = (value: string) => {
        dispatch(setGeneralSearch(value));
    };

    return (
        <div className="rounded-lg border border-border bg-card p-4 shadow-sm max-md:p-3">
            <div className="mb-3 flex items-center gap-2">
                <h3 className="text-sm font-semibold text-foreground max-md:text-base">Controls</h3>
                {isRefreshing && (
                    <span className="text-xs text-muted-foreground max-md:text-sm">Refreshing...</span>
                )}
            </div>

            <div className="flex flex-wrap items-center gap-3 max-md:flex-col max-md:items-stretch max-md:gap-3">
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
                <div className="flex items-center gap-2 max-md:w-full max-md:flex-col max-md:items-stretch">
                    <Label className="text-xs font-semibold text-muted-foreground max-md:text-sm">
                        Last Orders
                    </Label>
                    <Select
                        value={filters.recentOrdersCount || allRecentOrdersValue}
                        onValueChange={(value) =>
                            dispatch(
                                setRecentOrdersCount(
                                    value === allRecentOrdersValue
                                        ? ''
                                        : (value as '0' | '1' | '2' | '1_or_2')
                                )
                            )
                        }
                    >
                        <SelectTrigger className="h-9 w-[150px] text-xs max-md:h-11 max-md:w-full max-md:text-sm">
                            <SelectValue placeholder="Any" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value={allRecentOrdersValue}>Any</SelectItem>
                            <SelectItem value="0">0 orders</SelectItem>
                            <SelectItem value="1">1 order</SelectItem>
                            <SelectItem value="2">2 orders</SelectItem>
                            <SelectItem value="1_or_2">1 or 2 orders</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div className="flex items-center gap-2 max-md:w-full max-md:flex-col max-md:items-stretch">
                    <Label className="text-xs font-semibold text-muted-foreground max-md:text-sm">
                        Open Orders
                    </Label>
                    <Select
                        value={filters.openOrdersCount || allOpenOrdersValue}
                        onValueChange={(value) =>
                            dispatch(
                                setOpenOrdersCount(
                                    value === allOpenOrdersValue ? '' : (value as '0' | '1' | '2')
                                )
                            )
                        }
                    >
                        <SelectTrigger className="h-9 w-[170px] text-xs max-md:h-11 max-md:w-full max-md:text-sm">
                            <SelectValue placeholder="Any open count" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value={allOpenOrdersValue}>Any open count</SelectItem>
                            <SelectItem value="0">0 open (orange)</SelectItem>
                            <SelectItem value="1">1 open (orange)</SelectItem>
                            <SelectItem value="2">2 open (orange)</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div className="flex items-center gap-2 max-md:w-full">
                    <Checkbox
                        id="outOfStockOnly"
                        checked={filters.outOfStockOnly || false}
                        onCheckedChange={(checked) => dispatch(setOutOfStockOnly(checked === true))}
                    />
                    <Label
                        htmlFor="outOfStockOnly"
                        className="cursor-pointer text-xs font-semibold text-muted-foreground max-md:text-sm"
                    >
                        In Stock Only
                    </Label>
                </div>
                <div className="flex flex-wrap items-center gap-2 max-md:w-full max-md:flex-col max-md:gap-2">
                    <div className="max-md:w-full">
                        <SmartSelection
                            filteredData={filteredData}
                            days={smartSelectDays}
                            onSmartSelectDaysChange={onSmartSelectDaysChange}
                        />
                    </div>
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
        </div>
    );
}

export default DashboardFilter;
