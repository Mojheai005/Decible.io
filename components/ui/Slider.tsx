import React, { useCallback, useId, useRef, useState, useEffect } from 'react';

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

// Clamp + snap to step
const snap = (val: number, min: number, max: number, step: number) => {
  const clamped = Math.min(max, Math.max(min, val));
  return Math.round(clamped / step) * step;
};

// Color configs (static, outside component to avoid re-creation)
const FILLS: Record<string, string> = {
  default: '#111827', purple: '#9333ea', blue: '#2563eb', green: '#16a34a',
};
const SHADOWS: Record<string, string> = {
  default: '0 1px 6px rgba(17,24,39,0.35)',
  purple: '0 1px 6px rgba(147,51,234,0.35)',
  blue: '0 1px 6px rgba(37,99,235,0.35)',
  green: '0 1px 6px rgba(22,163,74,0.35)',
};

export const Slider: React.FC<SliderProps> = React.memo(({
  label,
  value,
  onChange,
  min = 0,
  max = 100,
  step = 0.01,
  leftLabel,
  rightLabel,
  showValue = true,
  valueFormatter,
  color = 'default',
}) => {
  const sliderId = useId();
  const trackRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  // Local value for instant visual feedback during drag — no parent re-render
  const [localValue, setLocalValue] = useState(value);
  const [isDragging, setIsDragging] = useState(false);

  // Sync external value when not dragging
  useEffect(() => {
    if (!draggingRef.current) {
      setLocalValue(value);
    }
  }, [value]);

  const formatValue = useCallback((val: number) => {
    if (valueFormatter) return valueFormatter(val);
    if (max <= 2) return val.toFixed(2);
    if (max <= 10) return val.toFixed(1);
    return Math.round(val).toString();
  }, [valueFormatter, max]);

  // Convert pointer x → value (uses refs to avoid stale closures)
  const posToValue = useCallback((clientX: number) => {
    const track = trackRef.current;
    if (!track) return localValue;
    const rect = track.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    return snap(min + pct * (max - min), min, max, step);
  }, [min, max, step, localValue]);

  const startDrag = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const el = e.currentTarget as HTMLElement;
    el.setPointerCapture(e.pointerId);
    draggingRef.current = true;
    setIsDragging(true);

    const newVal = posToValue(e.clientX);
    setLocalValue(newVal);

    const onMove = (ev: PointerEvent) => {
      const track = trackRef.current;
      if (!track) return;
      const rect = track.getBoundingClientRect();
      const pct = Math.max(0, Math.min(1, (ev.clientX - rect.left) / rect.width));
      const v = snap(min + pct * (max - min), min, max, step);
      setLocalValue(v);
    };

    const onUp = (ev: PointerEvent) => {
      el.releasePointerCapture(ev.pointerId);
      draggingRef.current = false;
      setIsDragging(false);
      // Commit final value to parent
      const track = trackRef.current;
      if (track) {
        const rect = track.getBoundingClientRect();
        const pct = Math.max(0, Math.min(1, (ev.clientX - rect.left) / rect.width));
        const finalVal = snap(min + pct * (max - min), min, max, step);
        setLocalValue(finalVal);
        onChange(finalVal);
      }
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onUp);
    };

    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onUp);
  }, [posToValue, min, max, step, onChange]);

  // Use localValue for display — instant, no parent re-render needed
  const displayValue = localValue;
  const pct = max > min ? ((displayValue - min) / (max - min)) * 100 : 0;
  const fillColor = FILLS[color] || FILLS.default;
  const thumbShadow = SHADOWS[color] || SHADOWS.default;

  return (
    <div className="mb-1">
      {/* Label Row */}
      <div className="flex justify-between items-center mb-3">
        <label htmlFor={sliderId} className="text-sm font-semibold text-gray-900">
          {label}
        </label>
        {showValue && (
          <span className="text-xs font-semibold text-gray-400 bg-gray-50 px-2 py-0.5 rounded-md tabular-nums">
            {formatValue(displayValue)}
          </span>
        )}
      </div>

      {/* Slider track — zero transitions, pure pointer tracking */}
      <div
        ref={trackRef}
        id={sliderId}
        role="slider"
        aria-label={label}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={displayValue}
        tabIndex={0}
        className="relative w-full h-5 flex items-center select-none cursor-pointer"
        style={{ touchAction: 'none' }}
        onPointerDown={startDrag}
        onKeyDown={(e) => {
          let newVal = displayValue;
          if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
            e.preventDefault();
            newVal = snap(displayValue + step, min, max, step);
          } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
            e.preventDefault();
            newVal = snap(displayValue - step, min, max, step);
          } else if (e.key === 'Home') {
            e.preventDefault();
            newVal = min;
          } else if (e.key === 'End') {
            e.preventDefault();
            newVal = max;
          } else {
            return;
          }
          setLocalValue(newVal);
          onChange(newVal);
        }}
      >
        {/* Track bg */}
        <div className="absolute left-0 right-0 h-[5px] rounded-full bg-gray-200/80" />
        {/* Fill */}
        <div
          className="absolute left-0 h-[5px] rounded-full"
          style={{ width: `${pct}%`, backgroundColor: fillColor }}
        />
        {/* Thumb */}
        <div
          className="absolute"
          style={{
            left: `${pct}%`,
            top: '50%',
            width: 18,
            height: 18,
            borderRadius: '50%',
            backgroundColor: fillColor,
            border: '2.5px solid white',
            boxShadow: thumbShadow,
            transform: `translate(-50%, -50%) scale(${isDragging ? 1.15 : 1})`,
            willChange: isDragging ? 'left, transform' : 'auto',
          }}
        />
      </div>

      {/* Sub-labels */}
      {(leftLabel || rightLabel) && (
        <div className="flex justify-between mt-1.5">
          <span className="text-[10px] font-medium text-gray-400">{leftLabel}</span>
          <span className="text-[10px] font-medium text-gray-400">{rightLabel}</span>
        </div>
      )}
    </div>
  );
});

Slider.displayName = 'Slider';

// Pre-configured slider variants
export const SpeedSlider: React.FC<Omit<SliderProps, 'min' | 'max' | 'step' | 'valueFormatter'>> = (props) => (
  <Slider
    {...props}
    min={0.5}
    max={2.0}
    step={0.01}
    valueFormatter={(val) => `${val.toFixed(2)}x`}
    leftLabel="Slower"
    rightLabel="Faster"
  />
);

export const StabilitySlider: React.FC<Omit<SliderProps, 'min' | 'max' | 'leftLabel' | 'rightLabel'>> = (props) => (
  <Slider {...props} min={0} max={100} step={0.1} leftLabel="Variable" rightLabel="Stable" />
);

export const SimilaritySlider: React.FC<Omit<SliderProps, 'min' | 'max' | 'leftLabel' | 'rightLabel'>> = (props) => (
  <Slider {...props} min={0} max={100} step={0.1} leftLabel="Low" rightLabel="High" />
);

export const StyleSlider: React.FC<Omit<SliderProps, 'min' | 'max' | 'leftLabel' | 'rightLabel'>> = (props) => (
  <Slider {...props} min={0} max={100} step={0.1} leftLabel="None" rightLabel="Exaggerated" />
);

export default Slider;
