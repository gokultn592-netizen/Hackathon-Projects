import React, { useState, useEffect } from 'react';
import { Database, ShieldCheck, Orbit, Clock } from './Icons';

interface GlobalStatusBarProps {
  totalSatellites?: number;
  criticalEncounters?: number;
  isDbConnected?: boolean;
  fps?: number;
  datasetTag?: string;
}

export default function GlobalStatusBar({
  totalSatellites = 348,
  criticalEncounters = 4,
  isDbConnected = true,
  fps = 60,
  datasetTag = 'REALTIME',
}: GlobalStatusBarProps) {
  const [utcTime, setUtcTime] = useState<string>('');

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setUtcTime(now.toISOString().replace('T', ' ').substring(0, 19) + ' UTC');
    };
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 pointer-events-none select-none">
      <div className="h-[28px] bg-black/90 border-t border-white/[0.08] backdrop-blur-xl flex items-center justify-between px-4 text-[10px] font-mono tracking-wider relative overflow-hidden pointer-events-auto">
        {/* Animated Cyber Scanline */}
        <div
          className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-cyan-400/50 to-transparent"
          style={{
            animation: 'scanline 3s linear infinite',
          }}
        />

        {/* ── LEFT: Database & Connection Health ── */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span
              className={`w-2 h-2 rounded-full ${
                isDbConnected ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'
              }`}
            />
            <span className="text-zinc-400">ORACLE 21C XE:</span>
            <span
              className={`font-bold ${
                isDbConnected ? 'text-emerald-400' : 'text-red-400'
              }`}
            >
              {isDbConnected ? 'ONLINE [XEPDB1]' : 'DISCONNECTED'}
            </span>
          </div>

          <span className="text-white/15">│</span>

          <div className="flex items-center gap-1.5 text-zinc-400">
            <Orbit className="w-3 h-3 text-cyan-400" />
            <span>PROPAGATION ENGINE:</span>
            <span className="text-cyan-300 font-bold">SGP4 / SKYFIELD</span>
          </div>

          <span className="text-white/15 hidden md:inline">│</span>

          <div className="hidden md:flex items-center gap-1.5 text-zinc-400">
            <span className="px-1.5 py-0.2 rounded bg-white/5 border border-white/10 text-zinc-300 text-[9px]">
              DATASET: {datasetTag}
            </span>
          </div>
        </div>

        {/* ── CENTER: Ticker / Alert Summary ── */}
        <div className="hidden lg:flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="text-zinc-400">TRACKED LEO OBJECTS:</span>
            <span className="text-white font-bold">{totalSatellites}</span>
          </div>

          <span className="text-white/15">│</span>

          <div className="flex items-center gap-1.5">
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                criticalEncounters > 0 ? 'bg-amber-400 animate-ping' : 'bg-emerald-400'
              }`}
            />
            <span className="text-zinc-400">ENCOUNTERS (TCA &lt; 24H):</span>
            <span
              className={`font-bold ${
                criticalEncounters > 0 ? 'text-amber-400' : 'text-emerald-400'
              }`}
            >
              {criticalEncounters} HIGH-RISK
            </span>
          </div>
        </div>

        {/* ── RIGHT: Clock & Performance ── */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-zinc-400">
            <span>RENDER:</span>
            <span className="text-emerald-400 font-bold">{fps} FPS</span>
          </div>

          <span className="text-white/15">│</span>

          <div className="flex items-center gap-1.5 text-cyan-300 font-bold">
            <Clock className="w-3 h-3 text-cyan-400" />
            <span>{utcTime}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
