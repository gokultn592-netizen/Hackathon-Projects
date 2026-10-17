import React from 'react';
import { CelestialBodyData, AU_SCALE } from '../utils/solarSystem';
import { X, Compass, Activity, ShieldCheck, Sun } from './Icons';

interface PlanetaryTelemetryCardProps {
  body: CelestialBodyData;
  onClose: () => void;
  onFocus: () => void;
}

export const PlanetaryTelemetryCard: React.FC<PlanetaryTelemetryCardProps> = ({
  body,
  onClose,
  onFocus,
}) => {
  const isStar = body.type === 'STAR';
  const isLagrange = body.type === 'LAGRANGE';

  const typeLabel =
    body.type === 'STAR'
      ? 'CENTRAL STAR · G2V'
      : body.type === 'PLANET'
      ? body.radiusUnits > 3.0
        ? 'GAS / ICE GIANT'
        : 'TERRESTRIAL PLANET'
      : body.type === 'MOON'
      ? 'NATURAL SATELLITE'
      : 'DEEP SPACE OBSERVATORY';

  return (
    <div
      role="region"
      aria-label={`${body.name} Telemetry Dossier`}
      className="w-[360px] bg-[#070b13]/90 backdrop-blur-2xl border border-white/[0.12] rounded-2xl p-4 shadow-2xl space-y-3 font-sans select-none text-zinc-100 animate-in fade-in zoom-in-95 duration-200"
    >
      {/* Header Bar */}
      <div className="flex items-center justify-between pb-2 border-b border-white/[0.08]">
        <div className="flex items-center gap-2">
          <span
            className="w-3.5 h-3.5 rounded-full shrink-0 shadow-lg animate-pulse"
            style={{
              backgroundColor: body.color,
              boxShadow: `0 0 12px ${body.color}`,
            }}
          />
          <span className="text-[10px] font-mono font-bold tracking-widest uppercase text-zinc-400">
            {typeLabel}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onFocus}
            className="px-2 py-0.5 text-[10px] font-mono rounded bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.1] text-teal-300 hover:text-white transition-all flex items-center gap-1 cursor-pointer"
            title="Center Camera on Target"
          >
            <Compass className="w-3 h-3 text-teal-400" />
            <span>FOCUS</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="p-1 hover:text-white text-zinc-400 transition-colors"
            title="Close Dossier"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Title & Subtitle */}
      <div>
        <h2 className="text-xl font-black text-white tracking-tight flex items-center justify-between">
          <span>{body.name}</span>
          {body.hasRings && (
            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-amber-500/20 border border-amber-500/30 text-amber-300">
              RING SYSTEM
            </span>
          )}
        </h2>
        <div className="text-xs text-zinc-400 mt-0.5">{body.subtitle}</div>
      </div>

      {/* 2x2 Metric Tiles */}
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-2.5">
          <div className="text-[9px] font-mono text-zinc-400 uppercase tracking-wider">
            {body.id === 'moon' ? 'CISLUNAR ORBIT' : body.id === 'jwst-l2' ? 'L2 LAGRANGE POINT' : 'SEMI-MAJOR AXIS'}
          </div>
          <div className="text-sm font-mono font-bold text-white mt-0.5">
            {body.id === 'moon' ? (
              <>
                <span>384,400</span>
                <span className="text-[10px] text-zinc-400 font-normal ml-1">km</span>
              </>
            ) : body.id === 'jwst-l2' ? (
              <>
                <span>1.5M</span>
                <span className="text-[10px] text-zinc-400 font-normal ml-1">km (L2)</span>
              </>
            ) : body.semiMajorAxisAU > 0 ? (
              <>
                <span>{body.semiMajorAxisAU.toFixed(3)}</span>
                <span className="text-[10px] text-zinc-400 font-normal ml-1">AU</span>
              </>
            ) : (
              <span className="text-amber-400 text-xs">SOLAR ORIGIN (0,0,0)</span>
            )}
          </div>
          <div className="text-[9px] font-mono text-zinc-500 mt-0.5">
            {body.id === 'moon'
              ? 'Earth Natural Satellite'
              : body.id === 'jwst-l2'
              ? 'Anti-Sun Lagrange Halo'
              : body.semiMajorAxisAU > 0
              ? `~${(body.semiMajorAxisAU * 149.6).toFixed(1)}M km`
              : 'Gravitational Center'}
          </div>
        </div>

        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-2.5">
          <div className="text-[9px] font-mono text-zinc-400 uppercase tracking-wider">
            ORBITAL VELOCITY
          </div>
          <div className="text-sm font-mono font-bold text-cyan-300 mt-0.5">
            {body.meanVelocityKms > 0 ? (
              <>
                <span>{body.meanVelocityKms.toFixed(1)}</span>
                <span className="text-[10px] text-zinc-400 font-normal ml-1">km/s</span>
              </>
            ) : (
              <span className="text-zinc-400 text-xs">Anchor Frame</span>
            )}
          </div>
          <div className="text-[9px] font-mono text-zinc-500 mt-0.5">
            {body.orbitalPeriodDays > 0
              ? `${body.orbitalPeriodDays.toFixed(1)} days / orbit`
              : 'Sidereal: 25.4d'}
          </div>
        </div>

        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-2.5">
          <div className="text-[9px] font-mono text-zinc-400 uppercase tracking-wider">
            SURFACE GRAVITY
          </div>
          <div className="text-xs font-mono font-bold text-white mt-0.5 truncate">
            {body.scientificFacts.surfaceGravity}
          </div>
          <div className="text-[9px] font-mono text-zinc-500 mt-0.5">
            Radius: {body.actualRadiusKm.toLocaleString()} km
          </div>
        </div>

        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-2.5">
          <div className="text-[9px] font-mono text-zinc-400 uppercase tracking-wider">
            ROTATION PERIOD
          </div>
          <div className="text-xs font-mono font-bold text-amber-300 mt-0.5">
            {body.rotationPeriodHours === 0
              ? 'Stationary'
              : `${Math.abs(body.rotationPeriodHours).toFixed(1)}h ${
                  body.rotationPeriodHours < 0 ? '(Retrograde)' : ''
                }`}
          </div>
          <div className="text-[9px] font-mono text-zinc-500 mt-0.5">
            Moons: {body.moonsCount}
          </div>
        </div>
      </div>

      {/* Atmospheric / Environmental Profile */}
      <div className="bg-black/40 border border-white/[0.06] rounded-xl p-2.5 space-y-1.5 text-xs">
        <div className="flex items-center justify-between text-[10px] font-mono">
          <span className="text-zinc-400 uppercase tracking-wider">TEMPERATURE RANGE</span>
          <span className="text-zinc-200 font-bold">{body.scientificFacts.temperatureRange}</span>
        </div>
        <div className="text-[10px] font-mono text-zinc-400 pt-1 border-t border-white/[0.04]">
          <span className="text-zinc-500">ATMOSPHERE: </span>
          <span className="text-zinc-300">{body.scientificFacts.atmosphere}</span>
        </div>
      </div>

      {/* Scientific Overview */}
      <p className="text-[11px] text-zinc-300 leading-relaxed pt-1 border-t border-white/[0.06]">
        {body.description}
      </p>

      {/* Notable Missions Pill Cloud */}
      {body.missions.length > 0 && (
        <div className="pt-1 border-t border-white/[0.06]">
          <div className="text-[9px] font-mono text-zinc-500 uppercase tracking-wider mb-1.5">
            EXPLORATION MISSIONS & ASSETS
          </div>
          <div className="flex flex-wrap gap-1">
            {body.missions.map((m) => (
              <span
                key={m}
                className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-white/[0.05] border border-white/[0.08] text-zinc-300"
              >
                {m}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
