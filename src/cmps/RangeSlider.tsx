import { useState } from 'react';
import type { RangeFilter } from '../types/dashboard.types';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Slider } from '../components/ui/slider';

interface RangeSliderProps {
  label: string;
  field: string;
  min: number;
  max: number;
  value: RangeFilter;
  onChange: (value: RangeFilter) => void;
  step?: number;
  formatValue?: (value: number) => string;
}

function RangeSlider({
  label,
  field,
  min,
  max,
  value,
  onChange,
  step = 1,
  formatValue = (v) => v.toString(),
}: RangeSliderProps) {
  const [localMin, setLocalMin] = useState<string>(value.min?.toString() ?? '');
  const [localMax, setLocalMax] = useState<string>(value.max?.toString() ?? '');

  const currentMin = value.min ?? min;
  const currentMax = value.max ?? max;

  const handleSliderChange = (values: number[]) => {
    if (values.length < 2) return;
    const [newMin, newMax] = values;
    const nextMin = Math.min(newMin, newMax);
    const nextMax = Math.max(newMin, newMax);
    onChange({ min: nextMin, max: nextMax });
    setLocalMin(nextMin.toString());
    setLocalMax(nextMax.toString());
  };

  const handleMinInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setLocalMin(val);
    const num = parseFloat(val);
    if (!isNaN(num)) {
      onChange({ min: num, max: value.max });
    }
  };

  const handleMaxInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setLocalMax(val);
    const num = parseFloat(val);
    if (!isNaN(num)) {
      onChange({ min: value.min, max: num });
    }
  };

  const handleReset = () => {
    onChange({ min: null, max: null });
    setLocalMin('');
    setLocalMax('');
  };

  const isActive = value.min !== null || value.max !== null;

  return (
    <div className="space-y-2 border-b border-border pb-3 last:border-none last:pb-0">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-semibold text-foreground">{label}</Label>
        {isActive && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleReset}
            type="button"
            className="h-7 px-2 text-xs text-primary"
          >
            Reset
          </Button>
        )}
      </div>

      <div className="flex gap-2">
        <div className="flex flex-1 flex-col gap-1">
          <Label htmlFor={`${field}-min`} className="text-[11px] text-muted-foreground">
            Min
          </Label>
          <Input
            id={`${field}-min`}
            type="number"
            value={localMin}
            onChange={handleMinInputChange}
            placeholder={min.toString()}
            min={min}
            max={max}
            className="h-8 text-xs"
          />
        </div>
        <div className="flex flex-1 flex-col gap-1">
          <Label htmlFor={`${field}-max`} className="text-[11px] text-muted-foreground">
            Max
          </Label>
          <Input
            id={`${field}-max`}
            type="number"
            value={localMax}
            onChange={handleMaxInputChange}
            placeholder={max.toString()}
            min={min}
            max={max}
            className="h-8 text-xs"
          />
        </div>
      </div>

      <div className="px-2">
        <Slider
          min={min}
          max={max}
          step={step}
          value={[currentMin, currentMax]}
          onValueChange={handleSliderChange}
        />
      </div>

      <div className="flex justify-between px-2 text-[11px] text-muted-foreground">
        <span>{formatValue(min)}</span>
        <span>{formatValue(max)}</span>
      </div>
    </div>
  );
}

export default RangeSlider;
