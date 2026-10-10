import React, { useState, useEffect, useCallback } from 'react';
import { Sliders } from './Icons';

interface LimitControlProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
}

export default function LimitControl({ value, onChange, min = 1, max = 200 }: LimitControlProps) {
  const [localValue, setLocalValue] = useState(value);

  // Sync external changes
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  // Debounced change propagation
  useEffect(() => {
    const timer = setTimeout(() => {
      const clamped = Math.max(min, Math.min(max, localValue));
      onChange(clamped);
    }, 250);
    return () => clearTimeout(timer);
  }, [localValue, min, max, onChange]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const parsed = parseInt(e.target.value, 10);
    if (!isNaN(parsed)) {
      setLocalValue(Math.max(min, Math.min(max, parsed)));
    } else {
      setLocalValue(min);
    }
  }, [min, max]);

  const handleSliderChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const parsed = parseInt(e.target.value, 10);
    setLocalValue(Math.max(min, Math.min(max, parsed)));
  }, [min, max]);

  const presets = [25, 50, 100, 200];

  return (
    <div className="w-full space-y-2">
      <div className="flex items-center justify-between">
        <label htmlFor="limit-slider" className="flex items-center gap-1.5 text-xs font-mono font-bold uppercase tracking-wider text-slate-400">
          <Sliders className="w-3.5 h-3.5 text-cyan-400" />
          <span>Fetch Limit</span>
        </label>
        <div className="flex items-center gap-1 font-mono">
          {presets.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setLocalValue(p)}
              className={`px-2 py-0.5 rounded text-[10px] font-bold transition-colors ${
                localValue === p
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50'
                  : 'bg-slate-800/80 text-slate-400 hover:text-white border border-slate-700/60'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <input
          id="limit-slider"
          type="range"
          min={min}
          max={max}
          step={1}
          value={localValue}
          onChange={handleSliderChange}
          className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-400 hover:accent-cyan-300"
        />
        <input
          type="number"
          min={min}
          max={max}
          value={localValue}
          onChange={handleInputChange}
          className="w-16 rounded-lg border border-slate-700 bg-slate-900/90 px-2 py-1 text-center font-mono text-xs font-bold text-cyan-300 shadow-sm focus:outline-none focus:ring-1 focus:ring-cyan-500"
        />
      </div>
    </div>
  );
}
