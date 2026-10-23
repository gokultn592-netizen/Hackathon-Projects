import React, { useState } from 'react';
import { AlertTriangle, ShieldCheck, ChevronDown, ChevronUp, Play } from './Icons';
import { LiveAccidentTelemetry } from './Globe3D';

interface AccidentReportBannerProps {
  avoidanceActive: boolean;
  onToggleAvoidance: () => void;
  onOpenReconstruction?: () => void;
  onSelectSat?: (satName: 'IRIDIUM 33' | 'COSMOS 2251') => void;
  selectedSatName?: string;
  liveTelemetry?: LiveAccidentTelemetry | null;
}

export default function AccidentReportBanner({
  avoidanceActive,
  onToggleAvoidance,
  onOpenReconstruction,
  onSelectSat,
  selectedSatName,
  liveTelemetry,
}: AccidentReportBannerProps) {
  const [detailsOpen, setDetailsOpen] = useState(false);

  // Dynamic status text matching real incident phase.
  // Split into a compact `primary` label (always visible, never truncated)
  // and a `detail` fragment that is dropped below the xl breakpoint. Keeping
  // the whole sentence in one `truncate` span cut off "MISS DIST" on laptop
  // viewports between 1152px and 1366px.
  const getStatusText = (): { primary: string; detail: string } => {
    if (avoidanceActive) {
      if (liveTelemetry?.phase === 'BURNING') {
        return {
          primary: 'THRUSTERS FIRING',
          detail: `+${liveTelemetry.iridiumDeltaV.toFixed(1)} m/s ΔV — ORBIT RAISING ${liveTelemetry.iridiumAltitudeKm.toFixed(1)} KM`,
        };
      }
      return {
        primary: 'AVOIDANCE COMPLETE',
        detail: `MISS DISTANCE +${liveTelemetry ? liveTelemetry.missDistanceKm.toFixed(2) : '24.85'} KM`,
      };
    }
    if (liveTelemetry?.phase === 'APPROACH') {
      return {
        primary: 'CONJUNCTION APPROACH',
        detail: `T-${liveTelemetry.timeToTcaSec.toFixed(1)}s · MISS DIST ${liveTelemetry.missDistanceKm.toFixed(1)} KM`,
      };
    }
    if (liveTelemetry?.phase === 'IMPACT') {
      return {
        primary: 'HYPERVELOCITY COLLISION',
        detail: '11.65 KM/S — LETHAL IMPACT',
      };
    }
    if (liveTelemetry?.phase === 'DEBRIS') {
      return {
        primary: 'DEBRIS FIELD ACTIVE',
        detail: '2,296 PCS CATALOGED OVER SIBERIA',
      };
    }
    return {
      primary: 'COLLISION IMMINENT',
      detail: 'T-120:00 · IRIDIUM 33 × COSMOS 2251',
    };
  };

  const getStatusColor = () => {
    if (avoidanceActive) {
      return liveTelemetry?.phase === 'BURNING' ? 'text-cyan-300' : 'text-emerald-400';
    }
    if (liveTelemetry?.phase === 'IMPACT') return 'text-red-400 animate-pulse font-black';
    if (liveTelemetry?.phase === 'DEBRIS') return 'text-amber-400';
    return 'text-red-400';
  };

  const getDotColor = () => {
    if (avoidanceActive) {
      return liveTelemetry?.phase === 'BURNING' ? 'bg-cyan-400' : 'bg-emerald-400';
    }
    if (liveTelemetry?.phase === 'DEBRIS') return 'bg-amber-400';
    return 'bg-red-500';
  };

  return (
    <div className="w-full z-40 bg-[#02050b] border-b border-cyan-500/30">
      {/* Pinned 36px Thin Status Bar */}
      <div className="h-9 px-4 flex items-center justify-between gap-4 font-mono select-none">
        {/* Left: Status Indicator & Text */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="relative flex items-center justify-center w-2.5 h-2.5 shrink-0">
            <span
              className={`absolute inline-flex h-full w-full rounded-full animate-ping opacity-75 ${getDotColor()}`}
            />
            <span
              className={`relative inline-flex rounded-full h-2 w-2 ${getDotColor()}`}
            />
          </div>

          <span className={`text-[11px] font-bold tracking-wider uppercase shrink-0 ${getStatusColor()}`}>
            {getStatusText().primary}
          </span>

          <span className="hidden lg:inline text-[10px] text-slate-500 border-l border-slate-700/60 pl-2.5 truncate">
            {getStatusText().detail}
          </span>

          <span className="hidden xl:inline-block text-[10px] text-slate-500 border-l border-slate-700/60 pl-2.5 shrink-0">
            SIBERIA INTERSECT (72.5° N)
          </span>
        </div>

        {/* Center: Per-Satellite Live Telemetry Pills */}
        {onSelectSat && (
          <div className="hidden md:flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-white/[0.03] border border-white/[0.06] shrink-0">
            <span className="text-[9px] text-slate-400 uppercase tracking-widest font-bold">TELEMETRY:</span>
            <button
              type="button"
              onClick={() => onSelectSat('IRIDIUM 33')}
              className={`text-[10px] px-2 py-0.5 rounded transition-all flex items-center gap-1.5 cursor-pointer ${
                selectedSatName === 'IRIDIUM 33'
                  ? 'bg-cyan-500/25 border border-cyan-500/60 text-cyan-200 font-bold shadow-[0_0_8px_rgba(6,182,212,0.3)]'
                  : 'bg-black/40 border border-white/10 text-slate-300 hover:text-white hover:border-cyan-500/40'
              }`}
              title="Track Iridium 33 active maneuver telemetry"
            >
              <span className={`w-1.5 h-1.5 rounded-full ${avoidanceActive ? 'bg-emerald-400' : 'bg-cyan-400'}`} />
              <span>IRIDIUM 33</span>
              <span className={`text-[9px] font-bold px-1 rounded ${
                !avoidanceActive && (liveTelemetry?.phase === 'IMPACT' || liveTelemetry?.phase === 'DEBRIS')
                  ? 'bg-red-950/80 text-red-300 font-black'
                  : avoidanceActive
                  ? 'bg-emerald-950 text-emerald-300'
                  : 'bg-black text-slate-400'
              }`}>
                {!avoidanceActive && (liveTelemetry?.phase === 'IMPACT' || liveTelemetry?.phase === 'DEBRIS')
                  ? 'DESTROYED'
                  : liveTelemetry
                  ? `${liveTelemetry.iridiumAltitudeKm.toFixed(1)} km`
                  : avoidanceActive
                  ? '814.1 km'
                  : '789.2 km'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => onSelectSat('COSMOS 2251')}
              className={`text-[10px] px-2 py-0.5 rounded transition-all flex items-center gap-1.5 cursor-pointer ${
                selectedSatName === 'COSMOS 2251'
                  ? 'bg-red-500/25 border border-red-500/60 text-red-200 font-bold shadow-[0_0_8px_rgba(239,68,68,0.3)]'
                  : 'bg-black/40 border border-white/10 text-slate-300 hover:text-white hover:border-red-500/40'
              }`}
              title="Track Cosmos 2251 derelict ballistic telemetry"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
              <span>COSMOS 2251</span>
              <span className={`text-[9px] font-bold px-1 rounded ${
                !avoidanceActive && (liveTelemetry?.phase === 'IMPACT' || liveTelemetry?.phase === 'DEBRIS')
                  ? 'bg-red-950/80 text-red-300 font-black'
                  : 'bg-black text-slate-400'
              }`}>
                {!avoidanceActive && (liveTelemetry?.phase === 'IMPACT' || liveTelemetry?.phase === 'DEBRIS')
                  ? 'SHATTERED'
                  : liveTelemetry
                  ? `${liveTelemetry.cosmosAltitudeKm.toFixed(1)} km`
                  : '786.5 km'}
              </span>
            </button>
          </div>
        )}

        {/* Right: Details Toggle + Action Button */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setDetailsOpen((prev) => !prev)}
            className="flex items-center gap-1 text-[10px] text-cyan-400/90 hover:text-cyan-300 transition-colors uppercase tracking-wider py-1 px-2 border border-cyan-500/20 hover:border-cyan-500/40 cursor-pointer"
          >
            <span>{detailsOpen ? 'HIDE METRICS' : 'TELEMETRY METRICS'}</span>
            {detailsOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>

          {onOpenReconstruction && (
            <button
              type="button"
              onClick={onOpenReconstruction}
              className="h-8 px-2.5 text-[10px] font-mono font-bold uppercase tracking-wider bg-purple-600/25 hover:bg-purple-600/40 text-purple-200 border border-purple-500/40 hover:border-purple-300 shadow-[0_0_10px_rgba(168,85,247,0.2)] transition-all flex items-center gap-1.5 cursor-pointer"
              title="Watch animated hyper-velocity collision reconstruction"
            >
              <Play className="w-3 h-3 fill-current text-purple-400" />
              <span>RECONSTRUCT COLLISION</span>
            </button>
          )}

          <button
            type="button"
            onClick={onToggleAvoidance}
            className={`w-[125px] h-8 text-[10px] font-mono font-black uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center ${
              avoidanceActive
                ? 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 shadow-[0_0_12px_rgba(16,185,129,0.2)]'
                : 'bg-red-500 hover:bg-red-600 text-white font-bold shadow-[0_0_12px_rgba(239,68,68,0.35)]'
            }`}
          >
            {avoidanceActive ? 'RESET SIMULATION' : 'ENGAGE AVOIDANCE'}
          </button>
        </div>
      </div>

      {/* Ultra-Compact Single-Row HUD Strip (~46px tall, non-intrusive) */}
      {detailsOpen && (
        <div className="bg-[#05080f]/95 backdrop-blur-2xl border-t border-cyan-500/20 px-4 py-2 font-mono shadow-2xl animate-fadeIn">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 max-w-6xl mx-auto text-[10px]">
            {/* Metric 1: Miss Distance / Range */}
            <div className="border-l-2 border-cyan-500/50 pl-2.5 py-0.5">
              <div className="text-[9px] uppercase text-zinc-500">
                {avoidanceActive ? 'MISS DISTANCE' : (liveTelemetry?.phase === 'IMPACT' || liveTelemetry?.phase === 'DEBRIS') ? 'SEPARATION' : 'RANGE (CLOSING)'}
              </div>
              <div className="text-sm font-bold text-white mt-0.5">
                {liveTelemetry ? (
                  avoidanceActive ? (
                    `+${liveTelemetry.missDistanceKm.toFixed(2)}`
                  ) : liveTelemetry.phase === 'IMPACT' || liveTelemetry.phase === 'DEBRIS' ? (
                    '0.00'
                  ) : (
                    `${liveTelemetry.missDistanceKm.toFixed(2)}`
                  )
                ) : (
                  avoidanceActive ? '+24.85' : '0.012'
                )}{' '}
                <span className="text-[10px] text-zinc-500 font-normal">KM</span>
              </div>
              <div className={`text-[9px] font-bold mt-0.5 ${
                avoidanceActive
                  ? 'text-emerald-400'
                  : liveTelemetry?.phase === 'IMPACT'
                  ? 'text-red-400 animate-pulse'
                  : liveTelemetry?.phase === 'DEBRIS'
                  ? 'text-amber-400'
                  : 'text-red-400'
              }`}>
                {avoidanceActive
                  ? 'SAFE CLEARANCE'
                  : liveTelemetry?.phase === 'IMPACT'
                  ? 'HYPERVELOCITY IMPACT'
                  : liveTelemetry?.phase === 'DEBRIS'
                  ? 'DEBRIS CLOUD DISPERSED'
                  : 'LETHAL CONJUNCTION'}
              </div>
            </div>

            {/* Metric 2: Pc */}
            <div className="border-l-2 border-cyan-500/50 pl-2.5 py-0.5">
              <div className="text-[9px] uppercase text-zinc-500">COLLISION PROB (Pc)</div>
              <div className="text-sm font-bold text-white mt-0.5">
                {avoidanceActive
                  ? '1.4 × 10⁻⁷'
                  : liveTelemetry?.phase === 'IMPACT'
                  ? '1.000 (100%)'
                  : liveTelemetry?.phase === 'DEBRIS'
                  ? '100% COLLIDED'
                  : '1.000'}
              </div>
              <div className={`text-[9px] mt-0.5 font-bold ${
                avoidanceActive
                  ? 'text-emerald-400'
                  : liveTelemetry?.phase === 'IMPACT'
                  ? 'text-red-400 animate-pulse'
                  : liveTelemetry?.phase === 'DEBRIS'
                  ? 'text-amber-400'
                  : 'text-red-400'
              }`}>
                {avoidanceActive
                  ? 'NOMINAL SAFE'
                  : liveTelemetry?.phase === 'IMPACT'
                  ? 'CATASTROPHIC IMPACT'
                  : liveTelemetry?.phase === 'DEBRIS'
                  ? 'TOTAL HULL LOSS'
                  : 'CRITICAL PREDICTION'}
              </div>
            </div>

            {/* Metric 3: Iridium Delta-V */}
            <div className="border-l-2 border-cyan-500/50 pl-2.5 py-0.5">
              <div className="text-[9px] uppercase text-zinc-500">
                {avoidanceActive ? 'IRIDIUM 33 ΔV' : (liveTelemetry?.phase === 'IMPACT' || liveTelemetry?.phase === 'DEBRIS') ? 'IRIDIUM 33 STATUS' : 'IRIDIUM 33 ΔV'}
              </div>
              <div className="text-sm font-bold mt-0.5">
                {avoidanceActive ? (
                  <span className="text-cyan-300">
                    {liveTelemetry ? (liveTelemetry.iridiumDeltaV > 0 ? `+${liveTelemetry.iridiumDeltaV.toFixed(2)}` : '0.00') : '+12.50'}{' '}
                    <span className="text-[10px] text-zinc-500 font-normal">M/S</span>
                  </span>
                ) : liveTelemetry?.phase === 'IMPACT' ? (
                  <span className="text-red-400 animate-pulse font-black">11.65 KM/S HIT</span>
                ) : liveTelemetry?.phase === 'DEBRIS' ? (
                  <span className="text-red-400 font-black">DISINTEGRATED</span>
                ) : (
                  <span className="text-zinc-300">
                    0.00 <span className="text-[10px] text-zinc-500 font-normal">M/S</span>
                  </span>
                )}
              </div>
              <div className="text-[9px] text-zinc-400 mt-0.5">
                {avoidanceActive
                  ? (liveTelemetry?.phase === 'BURNING' ? 'FIRING THRUSTERS' : 'BURN EXECUTED')
                  : liveTelemetry?.phase === 'IMPACT'
                  ? 'STRUCTURAL FAILURE'
                  : liveTelemetry?.phase === 'DEBRIS'
                  ? '628 PIECES CATALOGED'
                  : 'UNEVADED (NO BURN)'}
              </div>
            </div>

            {/* Metric 4: Hydrazine Spent */}
            <div className="border-l-2 border-cyan-500/50 pl-2.5 py-0.5">
              <div className="text-[9px] uppercase text-zinc-500">
                {avoidanceActive ? 'HYDRAZINE SPENT' : (liveTelemetry?.phase === 'IMPACT' || liveTelemetry?.phase === 'DEBRIS') ? 'PROPELLANT TANKS' : 'HYDRAZINE SPENT'}
              </div>
              <div className="text-sm font-bold mt-0.5">
                {avoidanceActive ? (
                  <span className="text-white">
                    {liveTelemetry ? liveTelemetry.fuelSpentKg.toFixed(2) : '0.42'}{' '}
                    <span className="text-[10px] text-zinc-500 font-normal">KG</span>
                  </span>
                ) : liveTelemetry?.phase === 'IMPACT' ? (
                  <span className="text-red-400 animate-pulse font-black">DETONATED</span>
                ) : liveTelemetry?.phase === 'DEBRIS' ? (
                  <span className="text-amber-300 font-black">RUPTURED (0 KG)</span>
                ) : (
                  <span className="text-white">
                    0.00 <span className="text-[10px] text-zinc-500 font-normal">KG</span>
                  </span>
                )}
              </div>
              <div className="text-[9px] text-zinc-400 mt-0.5">
                {avoidanceActive
                  ? `${(100 - (liveTelemetry?.fuelSpentKg || 0.42) / 25.0 * 100).toFixed(1)}% REMAINING`
                  : liveTelemetry?.phase === 'IMPACT'
                  ? 'KINETIC DETONATION'
                  : liveTelemetry?.phase === 'DEBRIS'
                  ? 'LOSS OF PRESSURE'
                  : '100% UNUSED (25 KG)'}
              </div>
            </div>

            {/* Metric 5: Cosmos 2251 Status */}
            <div className="border-l-2 border-red-500/40 pl-2.5 py-0.5">
              <div className="text-[9px] uppercase text-zinc-500">COSMOS 2251</div>
              <div className="text-sm font-bold mt-0.5">
                {liveTelemetry?.phase === 'IMPACT' ? (
                  <span className="text-red-400 animate-pulse font-black">SHATTERED</span>
                ) : liveTelemetry?.phase === 'DEBRIS' ? (
                  <span className="text-amber-300 font-black">1,668 DEBRIS PCS</span>
                ) : (
                  <span className="text-amber-300">
                    {liveTelemetry ? `${liveTelemetry.cosmosAltitudeKm.toFixed(1)}` : '786.5'}{' '}
                    <span className="text-[10px] text-zinc-500 font-normal">KM</span>
                  </span>
                )}
              </div>
              <div className="text-[9px] text-zinc-400 mt-0.5">
                {liveTelemetry?.phase === 'IMPACT'
                  ? 'LETHAL FRAGMENTATION'
                  : liveTelemetry?.phase === 'DEBRIS'
                  ? 'ALT 500-1400 KM SCATTER'
                  : 'DERELICT / 0.0 M/S'}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
