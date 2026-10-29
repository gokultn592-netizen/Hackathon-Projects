import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import Hls from 'hls.js';
import { Maximize, X, ChevronDown, ChevronUp, Radio, ExternalLink } from './Icons';

interface SpaceFeed {
  id: string;
  label: string;
  shortLabel: string;
  tag: string;
  detail: string;
  type: 'hls' | 'video' | 'embed';
  src: string;
  externalUrl?: string;
  fallbackVideoSrc?: string;
  resolution: string;
}

const FEEDS: SpaceFeed[] = [
  {
    id: 'nasa-hd',
    label: 'NASA ISS HD',
    shortLabel: 'NASA HD',
    tag: 'ISS HD LIVE',
    detail: 'NASA Official Live HD Views from the International Space Station · Harmony Port',
    type: 'embed',
    src: 'https://www.youtube-nocookie.com/embed/ROboUHfPUrU?autoplay=1&mute=1&playsinline=1&rel=0&modestbranding=1&controls=0&disablekb=1&fs=0&iv_load_policy=3&cc_load_policy=0&cc_lang_pref=none',
    externalUrl: 'https://www.youtube.com/watch?v=ROboUHfPUrU',
    fallbackVideoSrc: '/videos/space_earth_view.mp4',
    resolution: '1080P // NASA LIVE',
  },
  {
    id: 'nasa-cam',
    label: 'NASA ISS 2',
    shortLabel: 'NASA 2',
    tag: 'ISS CAM 2',
    detail: 'NASA Official Live Video from the International Space Station · Exterior Array',
    type: 'embed',
    src: 'https://www.youtube-nocookie.com/embed/M3HKLzjvKPc?autoplay=1&mute=1&playsinline=1&rel=0&modestbranding=1&controls=0&disablekb=1&fs=0&iv_load_policy=3&cc_load_policy=0&cc_lang_pref=none',
    externalUrl: 'https://www.youtube.com/watch?v=M3HKLzjvKPc',
    fallbackVideoSrc: '/videos/space_station_view.mp4',
    resolution: '1080P // NASA CAM 2',
  },
  {
    id: 'sen-hls',
    label: 'SEN HLS LIVE',
    shortLabel: 'SEN HLS',
    tag: 'HLS 24/7',
    detail: 'Sen Space 24/7 Earth & Space Live Broadcast · Columbus External Optical Array (AWS HLS)',
    type: 'hls',
    src: 'https://linear-1224.frequency.stream/dist/lg-uk/1224/hls/master/playlist.m3u8',
    fallbackVideoSrc: '/videos/space_earth_view.mp4',
    resolution: '1080P // HLS LIVE',
  },
];

export default function SpaceCam() {
  const [activeFeed, setActiveFeed] = useState<SpaceFeed>(FEEDS[0]);
  const [expanded, setExpanded] = useState(false);
  const [collapsed, setCollapsed] = useState(true);
  const [streamStatus, setStreamStatus] = useState<'CONNECTING' | 'LIVE' | 'FALLBACK'>('CONNECTING');
  const videoRef = useRef<HTMLVideoElement>(null);
  const expandedVideoRef = useRef<HTMLVideoElement>(null);

  // Close fullscreen on Escape key
  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setExpanded(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [expanded]);

  // Handle HLS stream initialization and playback management
  useEffect(() => {
    if (collapsed && !expanded) {
      setStreamStatus('CONNECTING');
      return;
    }

    const targetVideos: HTMLVideoElement[] = [];
    if (!collapsed && videoRef.current) targetVideos.push(videoRef.current);
    if (expanded && expandedVideoRef.current) targetVideos.push(expandedVideoRef.current);

    if (targetVideos.length === 0) return;

    if (activeFeed.type === 'hls') {
      const hlsInstances: Hls[] = [];
      setStreamStatus('CONNECTING');

      targetVideos.forEach((video) => {
        if (Hls.isSupported()) {
          const hls = new Hls({
            enableWorker: true,
            lowLatencyMode: true,
            backBufferLength: 30,
            maxBufferLength: 30,
          });

          hls.loadSource(activeFeed.src);
          hls.attachMedia(video);

          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            setStreamStatus('LIVE');
            video.play().catch(() => {});
          });

          hls.on(Hls.Events.ERROR, (_event, data) => {
            if (data.fatal) {
              console.warn('[SpaceCam] HLS fatal error, recovering or falling back:', data.type);
              switch (data.type) {
                case Hls.ErrorTypes.NETWORK_ERROR:
                  hls.startLoad();
                  break;
                case Hls.ErrorTypes.MEDIA_ERROR:
                  hls.recoverMediaError();
                  break;
                default:
                  hls.destroy();
                  setStreamStatus('FALLBACK');
                  if (activeFeed.fallbackVideoSrc) {
                    video.src = activeFeed.fallbackVideoSrc;
                    video.play().catch(() => {});
                  }
                  break;
              }
            }
          });

          hlsInstances.push(hls);
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
          // Safari native HLS without auto-fullscreen
          video.src = activeFeed.src;
          setStreamStatus('LIVE');
          video.addEventListener('loadedmetadata', () => {
            video.play().catch(() => {});
          });
        } else if (activeFeed.fallbackVideoSrc) {
          // Browser does not support HLS
          video.src = activeFeed.fallbackVideoSrc;
          setStreamStatus('FALLBACK');
          video.play().catch(() => {});
        }
      });

      return () => {
        hlsInstances.forEach((hls) => hls.destroy());
      };
    } else if (activeFeed.type === 'video') {
      setStreamStatus('LIVE');
      targetVideos.forEach((video) => {
        video.src = activeFeed.src;
        video.play().catch(() => {});
      });
    } else if (activeFeed.type === 'embed') {
      setStreamStatus('LIVE');
    }
  }, [activeFeed, collapsed, expanded]);

  return (
    <>
      {/* Docked HUD Widget (Floating on bottom-right) */}
      <div className="rounded-2xl border border-cyan-500/30 bg-black/85 backdrop-blur-2xl shadow-[0_8px_32px_rgba(0,0,0,0.75)] overflow-hidden transition-all duration-300 w-84 select-none">
        {/* Header */}
        <div className="flex items-center gap-2 px-3 py-2 border-b border-white/[0.08] bg-white/[0.03]">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[10px] font-mono font-bold tracking-widest text-cyan-400 uppercase flex items-center gap-1">
              <Radio className="w-3 h-3 text-cyan-400" />
              LEO OPTICAL DOWNLINK
            </span>
          </div>

          <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded font-bold ml-auto flex items-center gap-1 border ${
            activeFeed.type === 'hls'
              ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
              : activeFeed.type === 'embed'
              ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30'
              : 'bg-blue-500/15 text-blue-300 border-blue-500/30'
          }`}>
            <span className={`w-1 h-1 rounded-full ${
              streamStatus === 'CONNECTING' ? 'bg-amber-400 animate-ping' : 'bg-emerald-400'
            }`} />
            {activeFeed.tag}
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

        {/* Video Container (Zero YouTube UI, Zero In-Video Overlays) */}
        {!collapsed && (
          <>
            <div className="relative w-full aspect-video bg-black overflow-hidden select-none">
              {activeFeed.type === 'embed' ? (
                <div className="w-full h-full overflow-hidden relative pointer-events-none select-none">
                  <iframe
                    src={activeFeed.src}
                    title={activeFeed.label}
                    className="absolute w-[124%] h-[124%] -top-[12%] -left-[12%] border-0 pointer-events-none select-none"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  />
                </div>
              ) : (
                <video
                  ref={videoRef}
                  key={`docked-${activeFeed.id}`}
                  autoPlay
                  loop
                  muted
                  playsInline
                  disablePictureInPicture
                  controls={false}
                  className="w-full h-full object-cover pointer-events-none select-none"
                />
              )}

              {/* Minimalist framing brackets */}
              <div className="absolute top-2 left-2 text-[10px] font-mono text-cyan-400/40 pointer-events-none">┌</div>
              <div className="absolute top-2 right-2 text-[10px] font-mono text-cyan-400/40 pointer-events-none">┐</div>
              <div className="absolute bottom-2 left-2 text-[10px] font-mono text-cyan-400/40 pointer-events-none">└</div>
              <div className="absolute bottom-2 right-2 text-[10px] font-mono text-cyan-400/40 pointer-events-none">┘</div>
            </div>

            {/* Camera Channel Selector Buttons (3 Clean Feeds) */}
            <div className="grid grid-cols-3 gap-1 p-1.5 bg-black/50 border-b border-white/[0.06]">
              {FEEDS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setActiveFeed(f)}
                  className={`py-1.5 px-1 rounded-lg text-[9px] font-mono tracking-wider transition-all border text-center truncate cursor-pointer ${
                    activeFeed.id === f.id
                      ? 'border-cyan-400/60 bg-cyan-500/20 text-cyan-300 font-bold shadow-[0_0_12px_rgba(6,182,212,0.2)]'
                      : 'border-white/[0.05] text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.05]'
                  }`}
                  title={`${f.label} (${f.tag})`}
                >
                  {f.shortLabel}
                </button>
              ))}
            </div>

            {/* Clean Detail Subtext */}
            <div className="px-3 py-2 bg-black/70 text-left flex items-center justify-between gap-2">
              <div className="text-[10px] font-mono text-zinc-300 truncate" title={activeFeed.detail}>
                {activeFeed.detail}
              </div>
              <div className="flex items-center gap-2 whitespace-nowrap">
                {activeFeed.externalUrl && (
                  <a
                    href={activeFeed.externalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[9px] font-mono text-cyan-400 hover:text-cyan-200 flex items-center gap-0.5 underline"
                    title="Open official NASA stream in new tab"
                  >
                    <span>OPEN</span>
                    <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                )}
                <span className="text-[9px] font-mono text-cyan-400/80">
                  {activeFeed.resolution}
                </span>
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
              <span className="text-sm font-mono font-bold tracking-widest text-cyan-400 uppercase flex items-center gap-2">
                <Radio className="w-4 h-4 text-cyan-400" />
                ISS LEO OPTICAL SENSOR ARRAY // LIVE DOWNLINK
              </span>
              <span className="text-xs font-mono text-zinc-400 hidden sm:inline">· {activeFeed.detail}</span>

              {activeFeed.externalUrl && (
                <a
                  href={activeFeed.externalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2.5 py-1 rounded-lg text-xs font-mono text-cyan-400 hover:text-cyan-200 border border-cyan-500/30 hover:bg-cyan-500/10 transition-colors flex items-center gap-1.5 ml-auto"
                  title="Open live broadcast on YouTube"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  OFFICIAL BROADCAST ↗
                </a>
              )}

              <button
                type="button"
                onClick={() => setExpanded(false)}
                className={`p-2 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-colors cursor-pointer ${
                  activeFeed.externalUrl ? '' : 'ml-auto'
                }`}
                title="Close (Esc)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Video container (Zero YouTube UI, Zero In-Video Overlays) */}
            <div className="relative w-full aspect-video rounded-2xl overflow-hidden border border-cyan-500/40 shadow-[0_0_60px_rgba(6,182,212,0.3)] bg-black">
              {activeFeed.type === 'embed' ? (
                <div className="w-full h-full overflow-hidden relative pointer-events-none select-none">
                  <iframe
                    src={activeFeed.src}
                    title={activeFeed.label}
                    className="absolute w-[124%] h-[124%] -top-[12%] -left-[12%] border-0 pointer-events-none select-none"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  />
                </div>
              ) : (
                <video
                  ref={expandedVideoRef}
                  key={`expanded-${activeFeed.id}`}
                  autoPlay
                  loop
                  muted
                  playsInline
                  disablePictureInPicture
                  controls={false}
                  className="w-full h-full object-cover pointer-events-none select-none"
                />
              )}

              {/* Minimal Corner Framing Brackets */}
              <div className="absolute top-4 left-4 text-xs font-mono text-cyan-400/50 leading-none pointer-events-none">┌</div>
              <div className="absolute top-4 right-4 text-xs font-mono text-cyan-400/50 leading-none pointer-events-none">┐</div>
              <div className="absolute bottom-4 left-4 text-xs font-mono text-cyan-400/50 leading-none pointer-events-none">└</div>
              <div className="absolute bottom-4 right-4 text-xs font-mono text-cyan-400/50 leading-none pointer-events-none">┘</div>
            </div>

            {/* Bottom Controls Strip */}
            <div className="flex items-center justify-between gap-4 pt-1 flex-wrap">
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
                <span>DOWNLINK: <strong className="text-emerald-400">{activeFeed.resolution}</strong></span>
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
