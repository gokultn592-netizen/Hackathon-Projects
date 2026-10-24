import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Maximize, X, ChevronDown, ChevronUp } from './Icons';

interface SpaceFeed {
  id: string;
  label: string;
  detail: string;
  videoSrc: string;
}

const FEEDS: SpaceFeed[] = [
  {
    id: 'sen-4k',
    label: '4K EARTH',
    detail: 'Sen 4K UHD Optical Array · Columbus External Payload',
    videoSrc: '/videos/space_earth_view.mp4',
  },
  {
    id: 'iss-nadir',
    label: 'NADIR VIEW',
    detail: 'ISS High Definition Earth-Viewing (HDEV) Sensor · Nadir Optical Port',
    videoSrc: '/videos/space_nadir_view.mp4',
  },
  {
    id: 'iss-station',
    label: 'STATION VIEW',
    detail: 'Destiny Laboratory Wide-Angle Cam · Solar Array Telemetry',
    videoSrc: '/videos/space_station_view.mp4',
  },
];

export default function SpaceCam() {
  const [activeFeed, setActiveFeed] = useState<SpaceFeed>(FEEDS[0]);
  const [expanded, setExpanded] = useState(false);
  const [collapsed, setCollapsed] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);
  const expandedVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setExpanded(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [expanded]);

  // Ensure video always plays without controls only when actually mounted
  useEffect(() => {
    if (!collapsed && videoRef.current) {
      videoRef.current.play().catch(() => {});
    }
    if (expanded && expandedVideoRef.current) {
      expandedVideoRef.current.play().catch(() => {});
    }
  }, [activeFeed, expanded, collapsed]);

  return (
    <>
      {/* Docked HUD Widget (Floating on bottom-right) */}
      <div className="rounded-2xl border border-cyan-500/30 bg-black/85 backdrop-blur-2xl shadow-[0_8px_32px_rgba(0,0,0,0.75)] overflow-hidden transition-all duration-300 w-84 select-none">
        {/* Header */}
        <div className="flex items-center gap-2 px-3 py-2 border-b border-white/[0.08] bg-white/[0.03]">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[10px] font-mono font-bold tracking-widest text-cyan-400 uppercase">
              LEO OPTICAL DOWNLINK
            </span>
          </div>

          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-bold ml-auto flex items-center gap-1">
            <span className="w-1 h-1 rounded-full bg-emerald-400" />
            LIVE
          </span>

          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="p-1 rounded hover:bg-white/10 text-zinc-400 hover:text-cyan-300 transition-colors cursor-pointer"
            title="Expand to Fullscreen"
          >
            <Maximize className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => setCollapsed(!collapsed)}
            className="p-1 rounded hover:bg-white/10 text-zinc-400 hover:text-white transition-colors cursor-pointer"
            title={collapsed ? 'Expand camera' : 'Collapse camera'}
          >
            {collapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* Video Container (Clean Video - Zero YouTube UI, Zero In-Video Overlays) */}
        {!collapsed && (
          <>
            <div className="relative w-full aspect-video bg-black overflow-hidden group/player">
              <video
                ref={videoRef}
                key={activeFeed.videoSrc}
                src={activeFeed.videoSrc}
                autoPlay
                loop
                muted
                playsInline
                className="w-full h-full object-cover pointer-events-none select-none"
              />

              {/* Click to expand overlay */}
              <div
                className="absolute inset-0 cursor-pointer flex items-center justify-center opacity-0 group-hover/player:opacity-100 transition-opacity bg-black/25"
                onClick={() => setExpanded(true)}
                title="Click to expand"
              >
                <span className="px-2.5 py-1 rounded-full bg-black/85 backdrop-blur-md text-[10px] font-mono text-cyan-300 border border-cyan-500/40 shadow-lg">
                  EXPAND SENSOR FEED ↗
                </span>
              </div>
            </div>

            {/* Camera Channel Selector Buttons */}
            <div className="flex gap-1 p-2 bg-black/50 border-b border-white/[0.06]">
              {FEEDS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setActiveFeed(f)}
                  className={`flex-1 py-1 px-1.5 rounded text-[9px] font-mono tracking-wider transition-all border cursor-pointer ${
                    activeFeed.id === f.id
                      ? 'border-cyan-400/60 bg-cyan-500/20 text-cyan-300 font-bold shadow-[0_0_12px_rgba(6,182,212,0.2)]'
                      : 'border-white/[0.05] text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.05]'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Clean Detail Subtext */}
            <div className="px-3 py-2 bg-black/70 text-left">
              <div className="text-[10px] font-mono text-zinc-300 truncate" title={activeFeed.detail}>
                {activeFeed.detail}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Fullscreen Expanded Optical Clean Modal */}
      {expanded && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-[9000] bg-black/95 backdrop-blur-2xl flex flex-col items-center justify-center p-4 md:p-8 select-none"
          onClick={() => setExpanded(false)}
        >
          <div className="w-full max-w-6xl space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-sm font-mono font-bold tracking-widest text-cyan-400 uppercase">
                ISS LEO OPTICAL SENSOR ARRAY // LIVE DOWNLINK
              </span>
              <span className="text-xs font-mono text-zinc-400 hidden sm:inline">· {activeFeed.detail}</span>

              <button
                type="button"
                onClick={() => setExpanded(false)}
                className="ml-auto p-2 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-colors cursor-pointer"
                title="Close (Esc)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Video container (Clean Video - Zero YouTube UI, Zero In-Video Overlays) */}
            <div className="relative w-full aspect-video rounded-2xl overflow-hidden border border-cyan-500/40 shadow-[0_0_60px_rgba(6,182,212,0.3)] bg-black">
              <video
                ref={expandedVideoRef}
                key={`expanded-${activeFeed.videoSrc}`}
                src={activeFeed.videoSrc}
                autoPlay
                loop
                muted
                playsInline
                className="w-full h-full object-cover pointer-events-none select-none"
              />

              {/* Minimal Corner Framing Brackets Only (No badges, no pause UI, no speed/alt, no timestamps) */}
              <div className="absolute top-4 left-4 text-xs font-mono text-cyan-400/50 leading-none pointer-events-none">┌</div>
              <div className="absolute top-4 right-4 text-xs font-mono text-cyan-400/50 leading-none pointer-events-none">┐</div>
              <div className="absolute bottom-4 left-4 text-xs font-mono text-cyan-400/50 leading-none pointer-events-none">└</div>
              <div className="absolute bottom-4 right-4 text-xs font-mono text-cyan-400/50 leading-none pointer-events-none">┘</div>
            </div>

            {/* Bottom Controls Strip (Cleanly Outside the Video) */}
            <div className="flex items-center justify-between gap-4 pt-1">
              <div className="flex gap-2">
                {FEEDS.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setActiveFeed(f)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-mono tracking-wider transition-all border cursor-pointer ${
                      activeFeed.id === f.id
                        ? 'border-cyan-400/60 bg-cyan-500/20 text-cyan-300 font-bold shadow-[0_0_12px_rgba(6,182,212,0.2)]'
                        : 'border-white/10 text-zinc-400 hover:text-zinc-200 hover:bg-white/5'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              <div className="text-xs font-mono text-zinc-400 flex items-center gap-4">
                <span>ORBIT: <strong className="text-cyan-300">LEO (420 KM)</strong></span>
                <span>PERIOD: <strong className="text-zinc-200">92.8 MIN</strong></span>
                <span className="text-zinc-500 border-l border-white/10 pl-4">ESC TO CLOSE</span>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
