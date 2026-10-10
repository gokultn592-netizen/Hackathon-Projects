import React from 'react';
import { Globe, AlertTriangle } from './Icons';

interface DatasetToggleProps {
  value: string;
  onChange: (value: string) => void;
}

export default function DatasetToggle({ value, onChange }: DatasetToggleProps) {
  const isRealtime = value === 'REALTIME';

  return (
    <div className="inline-flex p-1 rounded-xl bg-slate-900/90 border border-slate-700/80 backdrop-blur-md shadow-inner">
      <button
        type="button"
        onClick={() => onChange('REALTIME')}
        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs md:text-sm font-bold transition-all duration-200 ${
          isRealtime
            ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-lg shadow-cyan-900/40 border border-cyan-400/40'
            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
        }`}
      >
        <Globe className={`w-4 h-4 ${isRealtime ? 'text-cyan-200 animate-spin-slow' : 'text-slate-400'}`} />
        <span>Real-Time LEO</span>
        <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${isRealtime ? 'bg-cyan-900/80 text-cyan-200' : 'bg-slate-800 text-slate-500'}`}>
          ACTIVE
        </span>
      </button>

      <button
        type="button"
        onClick={() => onChange('ACCIDENT')}
        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs md:text-sm font-bold transition-all duration-200 ${
          !isRealtime
            ? 'bg-gradient-to-r from-amber-600 to-red-600 text-white shadow-lg shadow-amber-900/40 border border-amber-400/40'
            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
        }`}
      >
        <AlertTriangle className={`w-4 h-4 ${!isRealtime ? 'text-amber-200' : 'text-slate-400'}`} />
        <span>Historical Accident</span>
        <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${!isRealtime ? 'bg-amber-900/80 text-amber-200' : 'bg-slate-800 text-slate-500'}`}>
          2009 EVENT
        </span>
      </button>
    </div>
  );
}
