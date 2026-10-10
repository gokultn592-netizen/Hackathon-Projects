import React, { useState } from 'react';
import { AlertTriangle, ShieldCheck, ChevronDown, ChevronUp, Terminal, Play } from './Icons';

interface AccidentReportBannerProps {
  avoidanceActive: boolean;
  onToggleAvoidance: () => void;
  onOpenReconstruction?: () => void;
}

export default function AccidentReportBanner({
  avoidanceActive,
  onToggleAvoidance,
  onOpenReconstruction,
}: AccidentReportBannerProps) {
  const [detailsOpen, setDetailsOpen] = useState(false);

  return (
    <div className="w-full z-40 bg-[#02050b] border-b border-cyan-500/30">
      {/* Pinned 36px Thin Status Bar */}
      <div className="h-9 px-4 flex items-center justify-between gap-4 font-mono select-none">
        {/* Left: Status Indicator & Text */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative flex items-center justify-center w-2.5 h-2.5">
            <span
              className={`absolute inline-flex h-full w-full rounded-full animate-ping opacity-75 ${
                avoidanceActive ? 'bg-emerald-400' : 'bg-red-500'
              }`}
            />
            <span
              className={`relative inline-flex rounded-full h-2 w-2 ${
                avoidanceActive ? 'bg-emerald-400' : 'bg-red-500'
              }`}
            />
          </div>

          <span
            className={`text-[11px] font-bold tracking-widest uppercase truncate ${
              avoidanceActive ? 'text-emerald-400' : 'text-red-400'
            }`}
          >
            {avoidanceActive
              ? 'AVOIDANCE MANEUVER COMPLETE — MISS DISTANCE +24.85 KM'
              : 'COLLISION IMMINENT — T-120:00 (IRIDIUM 33 × COSMOS 2251)'}
          </span>

          <span className="hidden md:inline-block text-[10px] text-slate-500 border-l border-slate-700/60 pl-3">
            789.2 KM ALT · SIBERIA INTERSECT
          </span>
        </div>

        {/* Center/Right: Details Toggle + Action Button */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => setDetailsOpen((prev) => !prev)}
            className="flex items-center gap-1.5 text-[10px] text-cyan-400/90 hover:text-cyan-300 transition-colors uppercase tracking-wider py-1 px-2 border border-cyan-500/20 hover:border-cyan-500/40"
          >
            <span>{detailsOpen ? 'HIDE METRICS' : 'TELEMETRY METRICS'}</span>
            {detailsOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>

          {onOpenReconstruction && (
            <button
              type="button"
              onClick={onOpenReconstruction}
              className="h-9 px-3 text-[10px] font-mono font-bold uppercase tracking-wider bg-purple-600/25 hover:bg-purple-600/40 text-purple-200 border border-purple-500/40 hover:border-purple-300 shadow-[0_0_12px_rgba(168,85,247,0.25)] transition-all flex items-center gap-1.5 cursor-pointer"
              title="Watch animated hyper-velocity collision reconstruction"
            >
              <Play className="w-3 h-3 fill-current text-purple-400" />
              <span>RECONSTRUCT COLLISION</span>
            </button>
          )}

          <button
            type="button"
            onClick={onToggleAvoidance}
            className={`w-[130px] h-9 text-[10px] font-mono font-black uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center ${
              avoidanceActive
                ? 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border-l border-emerald-500/40'
                : 'bg-red-500 hover:bg-red-600 text-white font-bold shadow-[0_0_12px_rgba(239,68,68,0.35)]'
            }`}
          >
            {avoidanceActive ? 'RESET SIMULATION' : 'ENGAGE AVOIDANCE'}
          </button>
        </div>
      </div>

      {/* Collapsible Details Panel Sliding Down */}
      {detailsOpen && (
        <div className="bg-[#05080f] border-t border-cyan-500/20 p-4 font-mono animate-fadeIn">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-6xl mx-auto">
            {/* Metric 1 */}
            <div className="border-l-2 border-cyan-500/40 pl-3 py-1">
              <div className="text-[10px] uppercase text-slate-400">MISS DISTANCE</div>
              <div className="text-xl font-bold text-white mt-0.5">
                {avoidanceActive ? '+24.85' : '0.012'} <span className="text-xs text-slate-500">KM</span>
              </div>
              <div className={`text-[10px] mt-0.5 ${avoidanceActive ? 'text-emerald-400' : 'text-red-400'}`}>
                {avoidanceActive ? 'SAFE SEPARATION' : 'LETHAL IMPACT ZONE'}
              </div>
            </div>

            {/* Metric 2 */}
            <div className="border-l-2 border-cyan-500/40 pl-3 py-1">
              <div className="text-[10px] uppercase text-slate-400">COLLISION PROBABILITY (Pc)</div>
              <div className="text-xl font-bold text-white mt-0.5">
                {avoidanceActive ? '1.4 × 10⁻⁷' : '1.000'}
              </div>
              <div className={`text-[10px] mt-0.5 ${avoidanceActive ? 'text-emerald-400' : 'text-red-400'}`}>
                {avoidanceActive ? 'NOMINAL SAFE' : 'CRITICAL THRESHOLD'}
              </div>
            </div>

            {/* Metric 3 */}
            <div className="border-l-2 border-cyan-500/40 pl-3 py-1">
              <div className="text-[10px] uppercase text-slate-400">DELTA-V EXPENDITURE</div>
              <div className="text-xl font-bold text-cyan-400 mt-0.5">
                {avoidanceActive ? '12.50' : '0.00'} <span className="text-xs text-slate-500">M/S</span>
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">
                {avoidanceActive ? 'PYOMO L1-NORM SOLVER' : 'UNMITIGATED DRIFT'}
              </div>
            </div>

            {/* Metric 4 */}
            <div className="border-l-2 border-cyan-500/40 pl-3 py-1">
              <div className="text-[10px] uppercase text-slate-400">HYDRAZINE CONSUMED</div>
              <div className="text-xl font-bold text-white mt-0.5">
                {avoidanceActive ? '0.42' : '0.00'} <span className="text-xs text-slate-500">KG</span>
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">
                {avoidanceActive ? '98.3% FUEL REMAINING' : 'FULL TANKS (DERELICT)'}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
