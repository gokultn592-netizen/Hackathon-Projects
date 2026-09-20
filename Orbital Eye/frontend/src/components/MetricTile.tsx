import React from 'react';

interface MetricProps {
  label: string;
  value: string | number;
  unit?: string;
  accent?: boolean;
}

export default function MetricTile({ label, value, unit, accent }: MetricProps) {
  const isString = typeof value === 'string';
  const display = isString ? value : value.toLocaleString();
  return (
    <div className={`bg-slate-900/80 border rounded-xl px-5 py-4 shadow-lg transition-transform hover:-translate-y-0.5 ${accent ? 'border-rose-900/50 bg-gradient-to-br from-rose-950/20 to-slate-950' : 'border-slate-800'}`}>
      <div className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">{label}</div>
      <div className={`text-2xl font-mono font-bold mt-1 ${accent ? 'text-rose-300' : 'text-slate-100'}`}>
        {display} <span className="text-sm text-slate-500 font-normal">{unit}</span>
      </div>
    </div>
  );
}
