import React, { useState, useEffect } from 'react';
import { Orbit, Clock } from './Icons';
import { useSatellitePositions } from '../hooks/useSatellitePositions';

interface GlobalStatusBarProps {
  criticalEncounters?: number;
  isDbConnected?: boolean;
  fps?: number;
  datasetTag?: string;
  trackedCount?: number;
}

function readQueryLimit(): number {
  if (typeof window === 'undefined') return 100;
  const limitParam = new URLSearchParams(window.location.search).get('limit');
  return limitParam
    ? Math.max(10, Math.min(1000, parseInt(limitParam, 10) || 100))
    : 100;
}

export default function GlobalStatusBar({
  datasetTag = 'REALTIME',
  trackedCount: propTrackedCount,
}: GlobalStatusBarProps) {
  // If trackedCount is supplied by parent, disable duplicate polling loop (refreshIntervalMs = 0)
  const { positions } = useSatellitePositions(
    datasetTag,
    readQueryLimit(),
    propTrackedCount !== undefined ? 0 : 30000
  );
  const trackedCount = propTrackedCount !== undefined ? propTrackedCount : (Array.isArray(positions) ? positions.length : 0);
  const [istTime, setIstTime] = useState<string>('');

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      const istDate = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
      const y = istDate.getFullYear();
      const m = String(istDate.getMonth() + 1).padStart(2, '0');
      const d = String(istDate.getDate()).padStart(2, '0');
      const hh = String(istDate.getHours()).padStart(2, '0');
      const mm = String(istDate.getMinutes()).padStart(2, '0');
      const ss = String(istDate.getSeconds()).padStart(2, '0');
      setIstTime(`${y}-${m}-${d} ${hh}:${mm}:${ss} IST`);
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

        {/* ── LEFT: Tracking Satellite Count Only ── */}
        <div className="flex items-center gap-2">
          <Orbit className="w-3.5 h-3.5 text-cyan-400" />
          <span className="text-zinc-400">TRACKING LEO SATELLITES:</span>
          <span className="text-cyan-300 font-bold">{trackedCount}</span>
        </div>

        {/* ── RIGHT: Indian Standard Time (IST) ── */}
        <div className="flex items-center gap-1.5 text-cyan-300 font-bold">
          <Clock className="w-3 h-3 text-cyan-400" />
          <span>{istTime}</span>
        </div>
      </div>
    </div>
  );
}
