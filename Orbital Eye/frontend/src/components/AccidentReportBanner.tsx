import React from 'react';
import { AlertTriangle, Orbit, Activity, Database, Rocket, ShieldCheck, Check } from './Icons';

interface AccidentReportBannerProps {
  avoidanceActive: boolean;
  onToggleAvoidance: () => void;
}

export default function AccidentReportBanner({
  avoidanceActive,
  onToggleAvoidance,
}: AccidentReportBannerProps) {
  return (
    <div
      className={`relative overflow-hidden rounded-2xl border transition-all duration-500 p-6 md:p-8 shadow-2xl backdrop-blur-xl ${
        avoidanceActive
          ? 'border-emerald-500/50 bg-gradient-to-br from-emerald-950/40 via-slate-900/95 to-cyan-950/30'
          : 'border-amber-500/40 bg-gradient-to-br from-amber-950/50 via-slate-900/95 to-red-950/40'
      }`}
    >
      {/* Background radial glow */}
      <div
        className={`absolute top-0 right-0 w-96 h-96 rounded-full blur-3xl pointer-events-none transition-colors duration-700 ${
          avoidanceActive ? 'bg-emerald-500/15' : 'bg-red-500/15'
        }`}
      />

      {/* Main Header + Avoidance Mode Toggle Bar */}
      <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-slate-800">
        <div className="space-y-2 max-w-2xl">
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${
                avoidanceActive
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                  : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
              }`}
            >
              {avoidanceActive ? (
                <>
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span>OrbitalEye Autonomous Avoidance · Active</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                  <span>Historical Incident Benchmark · Feb 10, 2009</span>
                </>
              )}
            </span>

            <span className="text-xs font-mono text-slate-400">
              Iridium 33 (USA) × Cosmos 2251 (RUS)
            </span>
          </div>

          <h2 className="text-2xl md:text-3xl font-black text-white tracking-tight flex items-center gap-3">
            <span>
              {avoidanceActive
                ? 'Collision Averted: Autonomous Escape Maneuver'
                : 'Iridium 33 × Cosmos 2251 Catastrophic Collision'}
            </span>
          </h2>

          <p className="text-sm text-slate-300 leading-relaxed">
            {avoidanceActive
              ? 'OrbitalEye autonomous collision mitigation executed an optimal along-track burn on active spacecraft Iridium 33. The planned trajectory safely cleared the defunct Cosmos 2251 with 24.85 km miss distance, preventing catastrophic Kessler syndrome.'
              : 'On February 10, 2009, active satellite Iridium 33 collided at 11.00 km/s with defunct Russian satellite Cosmos 2251 at 790 km altitude over northern Siberia, producing over 2,000 pieces of trackable debris.'}
          </p>
        </div>

        {/* Action Toggle Button */}
        <div className="flex flex-col sm:flex-row lg:flex-col items-start lg:items-end gap-3">
          <div className="text-xs font-mono text-slate-400 uppercase tracking-wider">
            Collision Avoidance System:
          </div>
          <button
            onClick={onToggleAvoidance}
            className={`flex items-center gap-2.5 px-5 py-3 rounded-xl font-bold font-mono text-sm tracking-wide transition-all duration-300 shadow-lg ${
              avoidanceActive
                ? 'bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white shadow-emerald-950/50 border border-emerald-400/40'
                : 'bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white shadow-red-950/50 border border-red-400/40'
            }`}
          >
            <Rocket className="w-4 h-4 animate-bounce" />
            <span>
              {avoidanceActive ? 'RESET TO 2009 COLLISION' : 'ENGAGE AVOIDANCE ESCAPE'}
            </span>
          </button>
          <span className="text-[11px] font-mono text-slate-400">
            {avoidanceActive
              ? '● Showing escaped trajectory'
              : '● Click to simulate thruster burn'}
          </span>
        </div>
      </div>

      {/* Comparison Grid: Unmitigated vs Avoidance Escape */}
      <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
        {/* Metric 1: Miss Distance */}
        <div
          className={`p-4 rounded-xl border backdrop-blur-md transition-all ${
            avoidanceActive
              ? 'bg-emerald-950/30 border-emerald-500/30'
              : 'bg-red-950/30 border-red-500/30'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-mono uppercase text-slate-400">
            <span>Miss Distance</span>
            <Orbit className={`w-4 h-4 ${avoidanceActive ? 'text-emerald-400' : 'text-red-400'}`} />
          </div>
          <div
            className={`text-2xl font-black font-mono mt-2 ${
              avoidanceActive ? 'text-emerald-300' : 'text-red-400'
            }`}
          >
            {avoidanceActive ? '24.85 km' : '0.58 km'}
          </div>
          <div className="text-[11px] font-mono text-slate-400 mt-1">
            {avoidanceActive ? 'Safety margin > 5.0 km' : 'Zero clearance · Direct impact'}
          </div>
        </div>

        {/* Metric 2: Collision Probability */}
        <div
          className={`p-4 rounded-xl border backdrop-blur-md transition-all ${
            avoidanceActive
              ? 'bg-emerald-950/30 border-emerald-500/30'
              : 'bg-red-950/30 border-red-500/30'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-mono uppercase text-slate-400">
            <span>Collision Prob (Pc)</span>
            <Activity className={`w-4 h-4 ${avoidanceActive ? 'text-emerald-400' : 'text-red-400'}`} />
          </div>
          <div
            className={`text-2xl font-black font-mono mt-2 ${
              avoidanceActive ? 'text-emerald-300' : 'text-red-400'
            }`}
          >
            {avoidanceActive ? '0.000000' : '1.000000'}
          </div>
          <div className="text-[11px] font-mono text-slate-400 mt-1">
            {avoidanceActive ? '100% Collision Averted' : '100% Catastrophic Event'}
          </div>
        </div>

        {/* Metric 3: Thruster Burn Optimization */}
        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-700/60 backdrop-blur-md">
          <div className="flex items-center justify-between text-xs font-mono uppercase text-slate-400">
            <span>Pyomo Optimal Δv</span>
            <Rocket className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-black font-mono text-cyan-300 mt-2">
            {avoidanceActive ? '12.50 m/s' : '0.00 m/s'}
          </div>
          <div className="text-[11px] font-mono text-slate-400 mt-1">
            {avoidanceActive ? 'Δv vector: [0.0125, 0, 0] km/s' : 'No burn executed'}
          </div>
        </div>

        {/* Metric 4: Fuel Cost & Lead Time */}
        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-700/60 backdrop-blur-md">
          <div className="flex items-center justify-between text-xs font-mono uppercase text-slate-400">
            <span>Fuel &amp; Lead Time</span>
            <Database className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-black font-mono text-amber-300 mt-2">
            {avoidanceActive ? '1.2 kg N₂H₄' : '2,000+ Debris'}
          </div>
          <div className="text-[11px] font-mono text-slate-400 mt-1">
            {avoidanceActive ? 'T - 120 min before TCA' : 'Table: 20 Debris in Oracle'}
          </div>
        </div>
      </div>

      {/* Avoidance Telemetry Cockpit Details */}
      {avoidanceActive && (
        <div className="relative z-10 mt-6 p-5 rounded-xl bg-slate-950/80 border border-emerald-500/30 font-mono space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2 text-emerald-300 font-bold text-sm">
              <Check className="w-4 h-4 text-emerald-400" />
              <span>PYOMO L1-NORM MINIMUM-ENERGY ESCAPE SOLUTION</span>
            </div>
            <div className="text-xs text-slate-400">
              SOLVER: <span className="text-emerald-400 font-bold">OPTIMAL CONVERGENCE</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div className="space-y-1 bg-slate-900/60 p-3 rounded-lg border border-slate-800">
              <div className="text-slate-400 uppercase tracking-wider text-[10px]">Active Maneuver Vehicle</div>
              <div className="text-slate-200 font-bold">IRIDIUM 33 (NORAD 24946)</div>
              <div className="text-slate-400">Thruster: Hydrazine Monopropellant</div>
              <div className="text-slate-400">Delta-V Budget Remaining: 96.6%</div>
            </div>

            <div className="space-y-1 bg-slate-900/60 p-3 rounded-lg border border-slate-800">
              <div className="text-slate-400 uppercase tracking-wider text-[10px]">Uncooperative Target</div>
              <div className="text-slate-200 font-bold">COSMOS 2251 (NORAD 22675)</div>
              <div className="text-slate-400">Status: Inactive / Non-maneuvering</div>
              <div className="text-slate-400">Orbit: 74.0° Inclination Polar Track</div>
            </div>

            <div className="space-y-1 bg-slate-900/60 p-3 rounded-lg border border-slate-800">
              <div className="text-slate-400 uppercase tracking-wider text-[10px]">B-Plane Escape Geometry</div>
              <div className="text-slate-200 font-bold">Shift: +18.2 km B_T / +16.9 km B_R</div>
              <div className="text-slate-400">Safety Radius: 5.0 km</div>
              <div className="text-emerald-400 font-bold">Clearance: 497% of threshold</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
