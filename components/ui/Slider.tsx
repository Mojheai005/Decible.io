import React, { useState, useCallback } from 'react';

interface SliderProps {
  label: string;
  value: number;
  onChange: (val: number) => void;
  min?: number;
  max?: number;
  step?: number;
  leftLabel?: string;
  rightLabel?: string;
  showValue?: boolean;
  valueFormatter?: (val: number) => string;
  color?: 'default' | 'purple' | 'blue' | 'green';
}

export const Slider: React.FC<SliderProps> = ({
  label,
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  leftLabel,
  rightLabel,
  showValue = true,
  valueFormatter,
  color = 'default',
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isHovering, setIsHovering] = useState(false);

  const percentage = ((value - min) / (max - min)) * 100;

  const formatValue = useCallback((val: number) => {
    if (valueFormatter) return valueFormatter(val);
    if (max <= 2) return val.toFixed(2);
    if (max <= 10) return val.toFixed(1);
    return Math.round(val).toString();
  }, [valueFormatter, max]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(parseFloat(e.target.value));
  }, [onChange]);

  const showTooltip = isDragging || isHovering;

  // Color configurations
  const trackColor = color === 'default' ? '#111827' :
                    color === 'purple' ? '#9333ea' :
                    color === 'blue' ? '#2563eb' : '#16a34a';

  return (
    <div className="mb-1">
      {/* Label */}
      <div className="flex justify-between items-center mb-3">
        <label className="text-sm font-semibold text-gray-900">{label}</label>
      </div>

      {/* Slider Container - increased height for better touch targets */}
      <div
        className="relative h-10 flex items-center"
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
      >
        {/* Background Track */}
        <div className="absolute w-full h-2 bg-gray-200 rounded-full pointer-events-none" />

        {/* Filled Track */}
        <div
          className="absolute h-2 rounded-full pointer-events-none"
          style={{
            width: `${percentage}%`,
            backgroundColor: trackColor,
          }}
        />

        {/* Native Range Input - handles all interaction smoothly, larger for touch */}
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={handleChange}
          onMouseDown={() => setIsDragging(true)}
          onMouseUp={() => setIsDragging(false)}
          onTouchStart={() => setIsDragging(true)}
          onTouchEnd={() => setIsDragging(false)}
          className="absolute w-full h-10 opacity-0 cursor-pointer z-10"
        />

        {/* Custom Thumb - larger for better visibility */}
        <div
          className="absolute w-5 h-5 rounded-full shadow-md border-2 border-white transform -translate-x-1/2 pointer-events-none transition-transform duration-100"
          style={{
            left: `${percentage}%`,
            backgroundColor: trackColor,
            transform: `translateX(-50%) scale(${isDragging ? 1.15 : isHovering ? 1.1 : 1})`,
          }}
        >
          {/* Value Tooltip */}
          {showValue && showTooltip && (
            <div
              className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 text-white text-xs font-bold rounded-md whitespace-nowrap shadow-lg"
              style={{ backgroundColor: trackColor }}
            >
              {formatValue(value)}
              {/* Arrow */}
              <div
                className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0"
                style={{
                  borderLeft: '4px solid transparent',
                  borderRight: '4px solid transparent',
                  borderTop: `4px solid ${trackColor}`,
                }}
              />
            </div>
          )}
        </div>
      </div>

      {/* Labels */}
      {(leftLabel || rightLabel) && (
        <div className="flex justify-between mt-2">
          <span className="text-[11px] font-medium text-gray-400">{leftLabel}</span>
          <span className="text-[11px] font-medium text-gray-400">{rightLabel}</span>
        </div>
      )}
    </div>
  );
};

// Pre-configured slider variants
export const SpeedSlider: React.FC<Omit<SliderProps, 'min' | 'max' | 'step' | 'valueFormatter'>> = (props) => (
  <Slider
    {...props}
    min={0.5}
    max={2.0}
    step={0.01}
    valueFormatter={(val) => val.toFixed(2)}
    leftLabel="Slower"
    rightLabel="Faster"
  />
);

export const StabilitySlider: React.FC<Omit<SliderProps, 'min' | 'max' | 'leftLabel' | 'rightLabel'>> = (props) => (
  <Slider
    {...props}
    min={0}
    max={100}
    step={1}
    leftLabel="More variable"
    rightLabel="More stable"
  />
);

export const SimilaritySlider: React.FC<Omit<SliderProps, 'min' | 'max' | 'leftLabel' | 'rightLabel'>> = (props) => (
  <Slider
    {...props}
    min={0}
    max={100}
    step={1}
    leftLabel="Low"
    rightLabel="High"
  />
);

export const StyleSlider: React.FC<Omit<SliderProps, 'min' | 'max' | 'leftLabel' | 'rightLabel'>> = (props) => (
  <Slider
    {...props}
    min={0}
    max={100}
    step={1}
    leftLabel="None"
    rightLabel="Exaggerated"
  />
);

export default Slider;
