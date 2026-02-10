import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { DashboardDataRow } from '../types/dashboard.types';
import { useCart } from '../contexts/CartContext';
import { getSelectionQty } from '../utils/selectionQty';
import { Button } from '../components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';

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

    const handleDefaultSelect = () => {
        const defaultDays = 30;
        onSmartSelectDaysChange?.(defaultDays);
        const count = selectByRange(0, 30, defaultDays);
        if (count > 0) {
            console.log('Selected items from 0-30 days');
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
            console.log('Selected items from custom range');
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
        <>
            <div className="flex items-center gap-1">
                <Button
                    size="sm"
                    className="h-9"
                    onClick={handleDefaultSelect}
                    type="button"
                >
                    Smart Select (30d)
                </Button>
                <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
                    <DropdownMenuTrigger asChild>
                        <Button
                            size="sm"
                            variant="outline"
                            className="h-9 px-2"
                            aria-label="Smart select options"
                            type="button"
                        >
                            <ChevronDown className="h-4 w-4" />
                        </Button>
                    </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-56">
                    {PRESET_RANGES.map((range) => {
                        const count = getCountForRange(range.min, range.max);
                        return (
                            <DropdownMenuItem
                                key={range.label}
                                onSelect={() => handlePresetClick(range.min, range.max, range.label)}
                                disabled={count === 0}
                                className="flex items-center justify-between"
                            >
                                <span>{range.label}</span>
                                <span className="text-xs text-muted-foreground">({count} items)</span>
                            </DropdownMenuItem>
                        );
                    })}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                        onSelect={() => {
                            setShowCustomModal(true);
                            setIsOpen(false);
                        }}
                        className="font-medium text-primary"
                    >
                        Custom range...
                    </DropdownMenuItem>
                </DropdownMenuContent>
                </DropdownMenu>
            </div>

            <Dialog open={showCustomModal} onOpenChange={setShowCustomModal}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Custom Range Selection</DialogTitle>
                        <DialogDescription>Choose a min and max day range to select items.</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="grid gap-2">
                            <Label htmlFor="custom-min">Min (days)</Label>
                            <Input
                                id="custom-min"
                                type="number"
                                value={customMin}
                                onChange={(e) => setCustomMin(e.target.value)}
                                placeholder="0"
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="custom-max">Max (days)</Label>
                            <Input
                                id="custom-max"
                                type="number"
                                value={customMax}
                                onChange={(e) => setCustomMax(e.target.value)}
                                placeholder="No max"
                            />
                        </div>
                    </div>
                    <DialogFooter className="gap-2">
                        <Button variant="outline" onClick={() => setShowCustomModal(false)}>
                            Cancel
                        </Button>
                        <Button onClick={handleCustomSelect}>Select</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}

export default SmartSelection;
