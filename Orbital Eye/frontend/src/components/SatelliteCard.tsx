import React from 'react';
import { Orbit, X, ExternalLink, ShieldCheck, AlertTriangle } from './Icons';
import { SatelliteInfo } from './Globe3D';

interface SatelliteCardProps {
  sat: SatelliteInfo;
  onClose: () => void;
  onOpenMathModal?: () => void;
}

function getRegime(altKm: number): { label: string; note: string; color: string } {
  if (altKm < 2000) return { label: 'LEO', note: 'Low Earth Orbit (160 - 2,000 km)', color: '#06b6d4' };
  if (altKm < 35000) return { label: 'MEO', note: 'Medium Earth Orbit (2,000 - 35,000 km)', color: '#3b82f6' };
  if (altKm <= 36500) return { label: 'GEO', note: 'Geostationary Belt (35,786 km)', color: '#a855f7' };
  return { label: 'HEO', note: 'High / Highly Elliptical Orbit', color: '#eab308' };
}

function calculatePeriodMinutes(altKm: number): number {
  const EARTH_RADIUS_KM = 6371.0;
  const MU = 398600.4418; // km^3 / s^2
  const a = EARTH_RADIUS_KM + altKm;
  const periodSeconds = 2 * Math.PI * Math.sqrt(Math.pow(a, 3) / MU);
  return periodSeconds / 60;
}

export default function SatelliteCard({ sat, onClose, onOpenMathModal }: SatelliteCardProps) {
  const alt = sat.altitudeKm || 420.0;
  const velKmS = sat.velocityKms || 7.66;
  const velKmH = Math.round(velKmS * 3600);
  const periodMin = calculatePeriodMinutes(alt);
  const regime = getRegime(alt);

  const isCritical = sat.status === 'CRITICAL';
  const isCaution = sat.status === 'CAUTION';
  const accentColor = isCritical ? '#ef4444' : isCaution ? '#f59e0b' : regime.color;

  return (
    <div
      className="absolute top-20 right-4 z-40 w-84 rounded-2xl border bg-black/85 backdrop-blur-2xl shadow-[0_12px_40px_rgba(0,0,0,0.75)] overflow-hidden transition-all duration-200"
      style={{ borderColor: `${accentColor}40` }}
      role="dialog"
      aria-label={`Satellite ${sat.name}`}
    >
      {/* Top Accent Color Line */}
      <div className="h-1 w-full" style={{ background: accentColor }} />

      {/* Header */}
      <div className="p-3.5 border-b border-white/[0.08] flex items-start gap-2.5">
        <div
          className="p-2 rounded-xl mt-0.5 flex-shrink-0"
          style={{ background: `${accentColor}18`, color: accentColor }}
        >
          <Orbit className="w-4 h-4" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-white truncate leading-snug" title={sat.name}>
              {sat.name}
            </h3>
            <span
              className="text-[9px] font-mono px-1.5 py-0.5 rounded font-bold uppercase tracking-wider"
              style={{ background: `${accentColor}20`, color: accentColor, border: `1px solid ${accentColor}40` }}
            >
              {regime.label}
            </span>
          </div>

          <div className="text-[10px] font-mono text-zinc-400 truncate mt-0.5">
            NORAD ID: <strong className="text-zinc-200">{sat.noradId || '—'}</strong>
            {sat.operator && <span> · {sat.operator}</span>}
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded-lg text-zinc-500 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          title="Close Card (Esc)"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Human-Readable Telemetry Grid */}
      <div className="p-3.5 space-y-3">
        {/* Status Callout Banner */}
        <div
          className="p-2.5 rounded-xl border flex items-center gap-2"
          style={{
            background: isCritical ? 'rgba(239,68,68,0.1)' : isCaution ? 'rgba(245,158,11,0.1)' : 'rgba(16,185,129,0.08)',
            borderColor: isCritical ? 'rgba(239,68,68,0.3)' : isCaution ? 'rgba(245,158,11,0.3)' : 'rgba(16,185,129,0.2)',
          }}
        >
          {isCritical || isCaution ? (
            <AlertTriangle className={`w-4 h-4 flex-shrink-0 ${isCritical ? 'text-red-400' : 'text-amber-400'}`} />
          ) : (
            <ShieldCheck className="w-4 h-4 flex-shrink-0 text-emerald-400" />
          )}

          <div className="min-w-0 text-[10px] font-mono">
            <div className={`font-bold uppercase tracking-wider ${isCritical ? 'text-red-300' : isCaution ? 'text-amber-300' : 'text-emerald-300'}`}>
              {isCritical ? 'CRITICAL CONJUNCTION HAZARD' : isCaution ? 'ELEVATED MONITORING' : 'FLIGHT PATH CLEAR (NOMINAL)'}
            </div>
            <div className="text-zinc-400 text-[9px] truncate">
              {isCritical
                ? `Closest passing target: ${sat.satBName || 'Cosmos Debris'} (Miss: ${sat.missDistanceKm?.toFixed(1) || '0.4'} km)`
                : 'No close orbital approaches detected within 24h'}
            </div>
          </div>
        </div>

        {/* 2x3 Metric Cards */}
        <div className="grid grid-cols-2 gap-2 text-left">
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-2.5">
            <div className="text-[9px] font-mono text-zinc-500 uppercase tracking-wider">ALTITUDE</div>
            <div className="text-sm font-mono font-bold text-white mt-0.5">
              {Math.round(alt).toLocaleString()} <span className="text-[10px] text-zinc-500 font-normal">km</span>
            </div>
            <div className="text-[9px] font-mono text-cyan-400/90 mt-0.5">Above ground</div>
          </div>

          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-2.5">
            <div className="text-[9px] font-mono text-zinc-500 uppercase tracking-wider">SPEED</div>
            <div className="text-sm font-mono font-bold text-white mt-0.5">
              {velKmS.toFixed(2)} <span className="text-[10px] text-zinc-500 font-normal">km/s</span>
            </div>
            <div className="text-[9px] font-mono text-emerald-400/90 mt-0.5">
              {velKmH.toLocaleString()} km/h
            </div>
          </div>

          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-2.5">
            <div className="text-[9px] font-mono text-zinc-500 uppercase tracking-wider">ORBIT LAP TIME</div>
            <div className="text-sm font-mono font-bold text-white mt-0.5">
              {periodMin.toFixed(1)} <span className="text-[10px] text-zinc-500 font-normal">min</span>
            </div>
            <div className="text-[9px] font-mono text-zinc-400 mt-0.5">
              {(1440 / periodMin).toFixed(1)} orbits / day
            </div>
          </div>

          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-2.5">
            <div className="text-[9px] font-mono text-zinc-500 uppercase tracking-wider">ORBITAL TILT</div>
            <div className="text-sm font-mono font-bold text-white mt-0.5">
              {(sat.inclinationDeg || 51.6).toFixed(1)}°
            </div>
            <div className="text-[9px] font-mono text-zinc-400 mt-0.5">Inclination angle</div>
          </div>

          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-2.5">
            <div className="text-[9px] font-mono text-zinc-500 uppercase tracking-wider">LATITUDE</div>
            <div className="text-xs font-mono font-bold text-zinc-200 mt-0.5">
              {Math.abs(sat.latDeg ?? 0).toFixed(2)}° {(sat.latDeg ?? 0) >= 0 ? 'N' : 'S'}
            </div>
          </div>

          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-2.5">
            <div className="text-[9px] font-mono text-zinc-500 uppercase tracking-wider">LONGITUDE</div>
            <div className="text-xs font-mono font-bold text-zinc-200 mt-0.5">
              {Math.abs(sat.lonDeg ?? 0).toFixed(2)}° {(sat.lonDeg ?? 0) >= 0 ? 'E' : 'W'}
            </div>
          </div>
        </div>

        {/* Orbit Regime Note */}
        <div className="text-[10px] font-mono text-zinc-400 bg-white/[0.02] border border-white/[0.04] p-2 rounded-lg flex items-center justify-between">
          <span>CLASSIFICATION:</span>
          <span className="text-zinc-300 font-semibold">{regime.note}</span>
        </div>

        {/* Dynamic JavaScript Math Animation Solver Trigger */}
        {onOpenMathModal && (
          <button
            type="button"
            onClick={onOpenMathModal}
            className="w-full py-2 px-3 rounded-xl border border-cyan-500/40 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 text-[10px] font-mono tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer font-bold shadow-[0_0_15px_rgba(6,182,212,0.15)]"
          >
            <span>∑</span> ANIMATED MATH DERIVATIONS →
          </button>
        )}

        {/* External Space-Track Link */}
        {sat.noradId && (
          <a
            href={`https://www.n2yo.com/satellite/?s=${sat.noradId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full py-2 px-3 rounded-xl border text-[10px] font-mono tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer font-bold"
            style={{
              borderColor: `${accentColor}50`,
              color: accentColor,
              background: `${accentColor}10`,
            }}
          >
            VERIFY ON N2YO / CELESTRAK <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>
    </div>
  );
}
