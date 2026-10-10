import React from 'react';
import { X, Satellite, ShieldAlert, Activity, Calendar, Copy, Check } from './Icons';
import { AdaptedEncounter } from '../adapters/encounterAdapter';

interface EncounterDetailModalProps {
  encounter: AdaptedEncounter | null;
  onClose: () => void;
}

export default function EncounterDetailModal({ encounter, onClose }: EncounterDetailModalProps) {
  const [copied, setCopied] = React.useState(false);

  if (!encounter) return null;

  const handleCopy = () => {
    navigator.clipboard?.writeText(JSON.stringify(encounter, null, 2)).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const isCritical = encounter.missDistance < 5;
  const isWarning = encounter.missDistance >= 5 && encounter.missDistance <= 20;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl rounded-2xl border border-cyan-500/30 bg-slate-900/95 p-6 shadow-2xl text-slate-100 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl border ${isCritical ? 'bg-red-950/60 border-red-500/40 text-red-400' : isWarning ? 'bg-amber-950/60 border-amber-500/40 text-amber-300' : 'bg-emerald-950/60 border-emerald-500/40 text-emerald-400'}`}>
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-black text-white">Conjunction Event #{encounter.id}</h3>
                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${isCritical ? 'bg-red-500/20 text-red-300 border-red-500/40' : isWarning ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'}`}>
                  {isCritical ? 'Critical Collision Risk' : isWarning ? 'Close Approach Alert' : 'Nominal Separation'}
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono mt-0.5">Oracle Table: ENCOUNTER_PAIRS · Bind Param Query</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Spacecraft Comparison */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
            <div className="text-[11px] text-cyan-400 font-mono flex items-center gap-1.5">
              <Satellite className="w-3.5 h-3.5" />
              <span>PRIMARY VEHICLE (A)</span>
            </div>
            <div className="text-base font-bold text-white truncate" title={encounter.satA}>
              {encounter.satA}
            </div>
            <div className="text-[11px] text-slate-500 font-mono">Catalog Ref: NORAD Tracked</div>
          </div>

          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
            <div className="text-[11px] text-purple-400 font-mono flex items-center gap-1.5">
              <Satellite className="w-3.5 h-3.5" />
              <span>SECONDARY VEHICLE (B)</span>
            </div>
            <div className="text-base font-bold text-white truncate" title={encounter.satB}>
              {encounter.satB}
            </div>
            <div className="text-[11px] text-slate-500 font-mono">Catalog Ref: NORAD Tracked</div>
          </div>
        </div>

        {/* Telemetry Metrics Grid */}
        <div className="grid grid-cols-3 gap-3 font-mono">
          <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 text-center">
            <div className="text-[10px] text-slate-400 uppercase tracking-wider">Miss Distance</div>
            <div className={`text-xl font-black mt-1 ${isCritical ? 'text-red-400' : isWarning ? 'text-amber-300' : 'text-emerald-400'}`}>
              {encounter.missDistance.toFixed(2)} <span className="text-xs font-normal">km</span>
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">Closest Approach</div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 text-center">
            <div className="text-[10px] text-slate-400 uppercase tracking-wider">Rel Velocity</div>
            <div className="text-xl font-black text-cyan-300 mt-1">
              {encounter.relVelocity.toFixed(2)} <span className="text-xs font-normal">km/s</span>
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">Closing Speed</div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 text-center">
            <div className="text-[10px] text-slate-400 uppercase tracking-wider">Collision Prob</div>
            <div className={`text-xl font-black mt-1 ${isCritical ? 'text-red-400' : 'text-slate-200'}`}>
              {encounter.collisionProbPct}%
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">Monte Carlo Sim</div>
          </div>
        </div>

        {/* Timestamp */}
        <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 text-xs font-mono">
          <span className="text-slate-400 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-cyan-400" />
            Time of Closest Approach (TCA UTC):
          </span>
          <span className="text-white font-bold">{encounter.tcaFormatted}</span>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-2">
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-300 transition-colors"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Telemetry JSON Copied' : 'Copy Conjunction JSON'}</span>
          </button>

          <button
            onClick={onClose}
            className="px-5 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs tracking-wide transition-colors shadow-lg shadow-cyan-900/40"
          >
            Close Inspector
          </button>
        </div>
      </div>
    </div>
  );
}
