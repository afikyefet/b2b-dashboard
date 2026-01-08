import { useState } from 'react';
import Slider from 'rc-slider';
import 'rc-slider/assets/index.css';
import type { RangeFilter } from '../types/dashboard.types';
import '../styles/RangeSlider.scss';

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
  formatValue = (v) => v.toString()
}: RangeSliderProps) {
  const [localMin, setLocalMin] = useState<string>(value.min?.toString() ?? '');
  const [localMax, setLocalMax] = useState<string>(value.max?.toString() ?? '');

  const currentMin = value.min ?? min;
  const currentMax = value.max ?? max;

  const handleSliderChange = (values: number | number[]) => {
    if (Array.isArray(values)) {
      const [newMin, newMax] = values;
      onChange({ min: newMin, max: newMax });
      setLocalMin(newMin.toString());
      setLocalMax(newMax.toString());
    }
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
    <div className="range-slider">
      <div className="range-slider-header">
        <label>{label}</label>
        {isActive && (
          <button
            className="btn-reset-range"
            onClick={handleReset}
            type="button"
          >
            Reset
          </button>
        )}
      </div>

      <div className="range-inputs">
        <div className="range-input-group">
          <label htmlFor={`${field}-min`}>Min</label>
          <input
            id={`${field}-min`}
            type="number"
            value={localMin}
            onChange={handleMinInputChange}
            placeholder={min.toString()}
            min={min}
            max={max}
          />
        </div>

        <div className="range-input-group">
          <label htmlFor={`${field}-max`}>Max</label>
          <input
            id={`${field}-max`}
            type="number"
            value={localMax}
            onChange={handleMaxInputChange}
            placeholder={max.toString()}
            min={min}
            max={max}
          />
        </div>
      </div>

      <div className="range-slider-track">
        <Slider
          range
          min={min}
          max={max}
          value={[currentMin, currentMax]}
          onChange={handleSliderChange}
          step={step}
          allowCross={false}
        />
      </div>

      <div className="range-labels">
        <span>{formatValue(min)}</span>
        <span>{formatValue(max)}</span>
      </div>
    </div>
  );
}

export default RangeSlider;
