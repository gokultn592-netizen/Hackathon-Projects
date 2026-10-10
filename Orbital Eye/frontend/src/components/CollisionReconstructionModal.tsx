import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Play, Pause, RotateCcw, AlertTriangle, ShieldAlert, Activity, ZoomIn } from './Icons';

interface CollisionReconstructionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// Deterministic pseudo-random generator for 60 debris fragments
function generateDebrisField() {
  const fragments = [];
  const count = 64;
  for (let i = 0; i < count; i++) {
    // 32 fragments from Cosmos 2251 (red/amber), 32 from Iridium 33 (cyan/blue)
    const isCosmos = i % 2 === 0;
    // Base trajectory angle with randomized spread
    const baseAngle = isCosmos ? 45 + (i * 7.5) : 225 + (i * 7.5);
    const angleRad = (baseAngle * Math.PI) / 180;
    // Radial dispersion speed (km/s scaled to SVG pixels)
    const speed = 0.8 + ((i * 13) % 17) * 0.18;
    const size = 1.5 + ((i * 7) % 5) * 0.6;
    const rotationSpeed = ((i % 5) - 2) * 8;
    fragments.push({
      id: i,
      source: isCosmos ? 'COSMOS 2251' : 'IRIDIUM 33',
      color: isCosmos ? '#ef4444' : '#06b6d4',
      glow: isCosmos ? 'rgba(239, 68, 68, 0.8)' : 'rgba(6, 182, 212, 0.8)',
      vx: Math.cos(angleRad) * speed * 3.8,
      vy: Math.sin(angleRad) * speed * 3.8,
      size,
      rotationSpeed,
      catalogId: isCosmos ? 33700 + i * 19 : 34100 + i * 23,
    });
  }
  return fragments;
}

const DEBRIS_FIELD = generateDebrisField();

export default function CollisionReconstructionModal({
  isOpen,
  onClose,
}: CollisionReconstructionModalProps) {
  // Timeline: T in seconds from -60.0 to +60.0 (0.0 is impact)
  const [time, setTime] = useState<number>(-45.0);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);
  const [cameraView, setCameraView] = useState<'TACTICAL' | 'CLOSEUP' | 'ALTITUDE'>('TACTICAL');
  const animFrameRef = useRef<number | null>(null);
  const lastTimestampRef = useRef<number | null>(null);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        setIsPlaying((prev) => !prev);
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Animation playback loop
  useEffect(() => {
    if (!isOpen || !isPlaying) {
      lastTimestampRef.current = null;
      return;
    }

    const loop = (timestamp: number) => {
      if (lastTimestampRef.current !== null) {
        const deltaSeconds = (timestamp - lastTimestampRef.current) / 1000;
        setTime((prev) => {
          const next = prev + deltaSeconds * playbackSpeed * 4.0;
          if (next >= 60.0) {
            setIsPlaying(false);
            return 60.0;
          }
          return next;
        });
      }
      lastTimestampRef.current = timestamp;
      animFrameRef.current = requestAnimationFrame(loop);
    };

    animFrameRef.current = requestAnimationFrame(loop);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isOpen, isPlaying, playbackSpeed]);

  if (!isOpen) return null;

  // Center coordinate of impact inside SVG viewport
  const CX = 500;
  const CY = 270;

  // Compute Positions based on time:
  // At T = 0, both are at (CX, CY).
  // At T < 0:
  // Iridium 33 arrives from bottom-left (angle 220 deg, inclination 86.4)
  // Cosmos 2251 arrives from top-right (angle 40 deg, inclination 74.0)
  const approachDistance = Math.max(0, -time); // distance scale before 0
  const iridiumApproachAngle = (215 * Math.PI) / 180;
  const cosmosApproachAngle = (35 * Math.PI) / 180;

  const iridiumX = time < 0 ? CX + Math.cos(iridiumApproachAngle) * approachDistance * 7.5 : CX;
  const iridiumY = time < 0 ? CY + Math.sin(iridiumApproachAngle) * approachDistance * 7.5 : CY;

  const cosmosX = time < 0 ? CX + Math.cos(cosmosApproachAngle) * approachDistance * 7.5 : CX;
  const cosmosY = time < 0 ? CY + Math.sin(cosmosApproachAngle) * approachDistance * 7.5 : CY;

  // Distance between objects (in km)
  const currentMissDistanceKm =
    time <= 0 ? Math.abs(time) * 11.65 : time * 11.65;

  // Phase indicator
  const isApproach = time < -2.0;
  const isImpact = time >= -2.0 && time <= 2.5;
  const isDispersion = time > 2.5;

  // Kinetic flash intensity
  const flashIntensity =
    time >= -0.8 && time <= 1.2
      ? Math.max(0, 1 - Math.abs(time) / 1.2)
      : 0;

  // Tracked fragments counter
  const fragmentCount =
    time <= 0
      ? 2
      : Math.min(2296, Math.floor(2 + (time / 45.0) * 2294));

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md select-none animate-fadeIn"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Modal Dialog Window */}
      <div className="relative w-full max-w-6xl h-[92vh] max-h-[820px] bg-[#030712] border border-cyan-500/40 shadow-[0_0_50px_rgba(6,182,212,0.15)] flex flex-col overflow-hidden font-mono text-slate-200">
        {/* Top Header Bar */}
        <div className="h-12 px-4 bg-[#050b17] border-b border-cyan-500/30 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
            <div className="flex flex-col">
              <span className="text-[12px] font-black text-white tracking-widest uppercase flex items-center gap-2">
                <span>TACTICAL TRAJECTORY RECONSTRUCTION // SIBERIA COLLISION</span>
                <span className="text-[10px] text-red-400 font-normal px-1.5 py-0.2 bg-red-950/70 border border-red-500/30 rounded">
                  HISTORICAL ACCIDENT
                </span>
              </span>
              <span className="text-[10px] text-slate-400">
                FEB 10, 2009 · 16:56 UTC · IRIDIUM 33 × COSMOS 2251 · 789.2 KM ALT
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 text-[11px] text-slate-400 bg-slate-900/60 px-2.5 py-1 border border-slate-700/50">
              <span className="text-slate-500">CLOSING SPEED:</span>
              <span className="text-cyan-300 font-bold">11.65 KM/S (41,940 KM/H)</span>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-white px-2.5 py-1 border border-slate-700/50 hover:border-slate-500 text-xs transition-colors"
            >
              ESC / CLOSE
            </button>
          </div>
        </div>

        {/* Center Main Stage (Simulation Canvas & Telemetry HUD) */}
        <div className="flex-1 relative flex flex-col md:flex-row min-h-0 overflow-hidden">
          {/* Main SVG Tactical Animation Canvas */}
          <div className="flex-1 relative bg-[#02050d] overflow-hidden flex items-center justify-center">
            {/* Background Radar Grid & Coordinates */}
            <svg
              viewBox="0 0 1000 540"
              className="w-full h-full object-contain pointer-events-none"
              style={{
                filter: flashIntensity > 0.4 ? 'brightness(1.4) contrast(1.2)' : 'none',
              }}
            >
              <defs>
                {/* Radial Glow Filters */}
                <radialGradient id="impactGlow" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#ffffff" stopOpacity="1" />
                  <stop offset="25%" stopColor="#fef08a" stopOpacity="0.9" />
                  <stop offset="55%" stopColor="#f97316" stopOpacity="0.6" />
                  <stop offset="85%" stopColor="#ef4444" stopOpacity="0.2" />
                  <stop offset="100%" stopColor="#000000" stopOpacity="0" />
                </radialGradient>
                <radialGradient id="radarRings" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.08" />
                  <stop offset="100%" stopColor="#06b6d4" stopOpacity="0" />
                </radialGradient>
              </defs>

              {/* Radar Coordinate Range Rings */}
              <circle cx={CX} cy={CY} r="240" fill="none" stroke="#0e2a47" strokeWidth="1" strokeDasharray="3 4" />
              <circle cx={CX} cy={CY} r="160" fill="none" stroke="#0e2a47" strokeWidth="1" strokeDasharray="3 4" />
              <circle cx={CX} cy={CY} r="80" fill="none" stroke="#0e2a47" strokeWidth="1" strokeDasharray="3 4" />
              <circle cx={CX} cy={CY} r="20" fill="none" stroke="#0e2a47" strokeWidth="1" />

              {/* Crosshair Axes */}
              <line x1="60" y1={CY} x2="940" y2={CY} stroke="#0e2a47" strokeWidth="1" strokeDasharray="2 4" />
              <line x1={CX} y1="40" x2={CX} y2="500" stroke="#0e2a47" strokeWidth="1" strokeDasharray="2 4" />

              {/* Azimuth / Range Labels */}
              <text x={CX + 85} y={CY - 6} fill="#0284c7" fontSize="9" opacity="0.6">RANGE 200 KM</text>
              <text x={CX + 165} y={CY - 6} fill="#0284c7" fontSize="9" opacity="0.6">RANGE 400 KM</text>
              <text x={CX + 245} y={CY - 6} fill="#0284c7" fontSize="9" opacity="0.6">RANGE 600 KM</text>
              <text x="80" y="55" fill="#0369a1" fontSize="10" opacity="0.7">COORD: 72.5° N, 97.9° E · SIBERIA INTERSECT</text>

              {/* Orbital Vectors (Approach Lines) */}
              {/* Iridium 33 Vector Line */}
              <line
                x1={CX + Math.cos(iridiumApproachAngle) * 450}
                y1={CY + Math.sin(iridiumApproachAngle) * 450}
                x2={CX}
                y2={CY}
                stroke="#06b6d4"
                strokeWidth="1.5"
                strokeDasharray="6 4"
                opacity={time < 0 ? 0.7 : 0.2}
              />
              {/* Cosmos 2251 Vector Line */}
              <line
                x1={CX + Math.cos(cosmosApproachAngle) * 450}
                y1={CY + Math.sin(cosmosApproachAngle) * 450}
                x2={CX}
                y2={CY}
                stroke="#ef4444"
                strokeWidth="1.5"
                strokeDasharray="6 4"
                opacity={time < 0 ? 0.7 : 0.2}
              />

              {/* --- BEFORE COLLISION (T <= 0): SATELLITE ICONS & TRACKS --- */}
              {time <= 0.2 && (
                <>
                  {/* IRIDIUM 33 Satellite Glyphs */}
                  <g transform={`translate(${iridiumX}, ${iridiumY})`}>
                    {/* Velocity vector line */}
                    <line x1="0" y1="0" x2={-Math.cos(iridiumApproachAngle) * 40} y2={-Math.sin(iridiumApproachAngle) * 40} stroke="#22d3ee" strokeWidth="2" />
                    {/* Target ring */}
                    <circle cx="0" cy="0" r="14" fill="none" stroke="#06b6d4" strokeWidth="1.5" className="animate-spin" style={{ animationDuration: '6s' }} />
                    {/* Satellite Body & Solar Arrays */}
                    <rect x="-8" y="-4" width="16" height="8" fill="#0284c7" stroke="#38bdf8" strokeWidth="1" />
                    <rect x="-18" y="-3" width="8" height="6" fill="#38bdf8" opacity="0.9" />
                    <rect x="10" y="-3" width="8" height="6" fill="#38bdf8" opacity="0.9" />
                    <circle cx="0" cy="0" r="3" fill="#ffffff" />
                    {/* HUD Label */}
                    <text x="-40" y="-18" fill="#38bdf8" fontSize="10" fontWeight="bold">IRIDIUM 33</text>
                    <text x="-40" y="-7" fill="#94a3b8" fontSize="8">86.4° INC · 7.47 KM/S</text>
                  </g>

                  {/* COSMOS 2251 Satellite Glyphs */}
                  <g transform={`translate(${cosmosX}, ${cosmosY})`}>
                    {/* Velocity vector line */}
                    <line x1="0" y1="0" x2={-Math.cos(cosmosApproachAngle) * 40} y2={-Math.sin(cosmosApproachAngle) * 40} stroke="#f87171" strokeWidth="2" />
                    {/* Military Crosshair Target */}
                    <circle cx="0" cy="0" r="14" fill="none" stroke="#ef4444" strokeWidth="1.5" strokeDasharray="3 3" />
                    <circle cx="0" cy="0" r="7" fill="none" stroke="#ef4444" strokeWidth="1" />
                    {/* Satellite Cylindrical Body */}
                    <circle cx="0" cy="0" r="6" fill="#b91c1c" stroke="#fca5a5" strokeWidth="1.2" />
                    <line x1="-12" y1="0" x2="12" y2="0" stroke="#f87171" strokeWidth="1.5" />
                    <line x1="0" y1="-12" x2="0" y2="12" stroke="#f87171" strokeWidth="1.5" />
                    {/* HUD Label */}
                    <text x="18" y="-18" fill="#f87171" fontSize="10" fontWeight="bold">COSMOS 2251</text>
                    <text x="18" y="-7" fill="#94a3b8" fontSize="8">74.0° INC · 900 KG (DERELICT)</text>
                  </g>
                </>
              )}

              {/* --- IMPACT MOMENT (T ≈ 0): FLASH & SHOCKWAVE RINGS --- */}
              {isImpact && (
                <g transform={`translate(${CX}, ${CY})`}>
                  {/* Expanding Shockwave Plasma Rings */}
                  <circle
                    cx="0"
                    cy="0"
                    r={Math.max(10, (time + 2.0) * 45)}
                    fill="none"
                    stroke="#f97316"
                    strokeWidth="3"
                    opacity={Math.max(0, 1 - (time + 2.0) / 4.5)}
                  />
                  <circle
                    cx="0"
                    cy="0"
                    r={Math.max(20, (time + 2.0) * 75)}
                    fill="none"
                    stroke="#fef08a"
                    strokeWidth="1.5"
                    strokeDasharray="4 4"
                    opacity={Math.max(0, 1 - (time + 2.0) / 4.5)}
                  />
                  {/* Core Kinetic Fireball Explosion */}
                  <circle
                    cx="0"
                    cy="0"
                    r={Math.max(8, 55 * flashIntensity)}
                    fill="url(#impactGlow)"
                  />
                </g>
              )}

              {/* --- POST-COLLISION (T > 0): KESSLER SYNDROME DEBRIS FIELD --- */}
              {time > 0 && (
                <g>
                  {/* Center Ground Zero Mark */}
                  <circle cx={CX} cy={CY} r="6" fill="none" stroke="#f97316" strokeWidth="1" strokeDasharray="2 2" />
                  <line x1={CX - 12} y1={CY} x2={CX + 12} y2={CY} stroke="#f97316" strokeWidth="1" />
                  <line x1={CX} y1={CY - 12} x2={CX} y2={CY + 12} stroke="#f97316" strokeWidth="1" />

                  {/* 64 Simulated Ballistic Fragments */}
                  {DEBRIS_FIELD.map((frag) => {
                    const posX = CX + frag.vx * time;
                    const posY = CY + frag.vy * time;
                    // Tail vector
                    const tailX = posX - frag.vx * Math.min(time, 1.8);
                    const tailY = posY - frag.vy * Math.min(time, 1.8);

                    return (
                      <g key={frag.id}>
                        {/* Fragment trailing spark */}
                        <line
                          x1={tailX}
                          y1={tailY}
                          x2={posX}
                          y2={posY}
                          stroke={frag.color}
                          strokeWidth={frag.size * 0.75}
                          opacity={0.4}
                        />
                        {/* Shard Particle */}
                        <circle
                          cx={posX}
                          cy={posY}
                          r={frag.size}
                          fill={frag.color}
                          style={{
                            filter: `drop-shadow(0 0 4px ${frag.glow})`,
                          }}
                        />
                      </g>
                    );
                  })}
                </g>
              )}

              {/* HUD Target Callout Overlay */}
              <g transform="translate(60, 480)">
                <rect x="0" y="0" width="310" height="42" fill="#030712" stroke="#0ea5e9" strokeWidth="0.8" opacity="0.85" />
                <text x="10" y="16" fill="#38bdf8" fontSize="9" fontWeight="bold">
                  STATUS: {isApproach ? 'CONVERGING ON INTERSECT' : isImpact ? 'KINETIC IMPACT IN PROGRESS' : 'KESSLER DEBRIS DISPERSION'}
                </text>
                <text x="10" y="32" fill="#94a3b8" fontSize="9">
                  {isApproach
                    ? `DISTANCE: ${currentMissDistanceKm.toFixed(1)} KM · TCA: T${time >= 0 ? '+' : ''}${time.toFixed(1)}S`
                    : `FRAGMENTATION FAN: ${fragmentCount} TRACKED DEBRIS SHARDS`}
                </text>
              </g>
            </svg>

            {/* Screen Shake & White Flash Overlay during Impact */}
            {flashIntensity > 0 && (
              <div
                className="absolute inset-0 pointer-events-none bg-white transition-opacity duration-150"
                style={{ opacity: flashIntensity * 0.65 }}
              />
            )}
          </div>

          {/* Right-Hand Tactical Telemetry HUD */}
          <div className="w-full md:w-80 bg-[#040814] border-t md:border-t-0 md:border-l border-cyan-500/30 p-4 flex flex-col justify-between shrink-0 overflow-y-auto">
            <div className="space-y-4">
              {/* Mission Phase Badge */}
              <div className="border border-cyan-500/30 bg-[#071022] p-3">
                <div className="text-[10px] text-slate-400 uppercase tracking-widest">COLLISION PHASE</div>
                <div className="text-sm font-bold mt-1 flex items-center gap-2">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      isApproach ? 'bg-cyan-400 animate-pulse' : isImpact ? 'bg-red-500 animate-ping' : 'bg-amber-400'
                    }`}
                  />
                  <span className={isImpact ? 'text-red-400 font-black' : isApproach ? 'text-cyan-300' : 'text-amber-300'}>
                    {isApproach
                      ? 'PHASE 1: HYPER-VELOCITY CONVERGENCE'
                      : isImpact
                      ? 'PHASE 2: KINETIC IMPACT & BREAKUP'
                      : 'PHASE 3: KESSLER DEBRIS FAN'}
                  </span>
                </div>
              </div>

              {/* Dynamic Telemetry Metrics */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                {/* Metric 1: Distance */}
                <div className="bg-[#030611] border border-slate-800 p-2.5">
                  <span className="text-[10px] text-slate-400 uppercase block">MISS DISTANCE</span>
                  <span className={`text-lg font-bold font-mono ${time <= 0 ? 'text-red-400' : 'text-amber-400'}`}>
                    {time <= 0 ? `${currentMissDistanceKm.toFixed(2)}` : `+${currentMissDistanceKm.toFixed(1)}`}
                  </span>
                  <span className="text-[10px] text-slate-500 ml-1">KM</span>
                </div>

                {/* Metric 2: Fragments */}
                <div className="bg-[#030611] border border-slate-800 p-2.5">
                  <span className="text-[10px] text-slate-400 uppercase block">FRAGMENTS</span>
                  <span className="text-lg font-bold font-mono text-cyan-300">
                    {fragmentCount.toLocaleString()}
                  </span>
                  <span className="text-[10px] text-slate-500 ml-1">SHARDS</span>
                </div>

                {/* Metric 3: Relative Velocity */}
                <div className="bg-[#030611] border border-slate-800 p-2.5">
                  <span className="text-[10px] text-slate-400 uppercase block">REL. VELOCITY</span>
                  <span className="text-base font-bold text-white">11.65</span>
                  <span className="text-[10px] text-slate-500 ml-1">KM/S</span>
                </div>

                {/* Metric 4: Kinetic Energy */}
                <div className="bg-[#030611] border border-slate-800 p-2.5">
                  <span className="text-[10px] text-slate-400 uppercase block">ENERGY RELEASE</span>
                  <span className="text-base font-bold text-red-400">32.4</span>
                  <span className="text-[10px] text-slate-500 ml-1">GJ</span>
                </div>
              </div>

              {/* Spacecraft Dossiers */}
              <div className="border border-slate-800 bg-[#02050f] p-3 space-y-2.5 text-[11px]">
                <div className="border-l-2 border-cyan-400 pl-2">
                  <div className="font-bold text-cyan-300">IRIDIUM 33 (USA)</div>
                  <div className="text-slate-400 text-[10px]">Commercial Comms Satellite · 560 kg · Active</div>
                  <div className="text-slate-500 text-[10px]">Orbit: 789 km · 86.4° Inclination</div>
                </div>

                <div className="border-l-2 border-red-500 pl-2">
                  <div className="font-bold text-red-400">COSMOS 2251 (RUSSIA)</div>
                  <div className="text-slate-400 text-[10px]">Military Strela-2M · 900 kg · Derelict / Inactive</div>
                  <div className="text-slate-500 text-[10px]">Orbit: 789 km · 74.0° Inclination</div>
                </div>
              </div>

              {/* Historical Fact Note */}
              <div className="bg-red-950/20 border border-red-500/20 p-2.5 text-[10px] text-slate-300 leading-relaxed">
                <span className="text-red-400 font-bold block mb-1">ACCIDENT DEBRIEF:</span>
                First catastrophic hypervelocity collision between two artificial satellites in Earth orbit. The resulting cloud created 2,000+ cataloged shards that still threaten active LEO missions today.
              </div>
            </div>

            {/* Quick Jump Buttons */}
            <div className="mt-4 pt-3 border-t border-slate-800 flex gap-2">
              <button
                type="button"
                onClick={() => setTime(-30.0)}
                className="flex-1 py-1.5 text-[10px] border border-cyan-500/30 hover:border-cyan-400 text-cyan-300 bg-cyan-950/20 uppercase"
              >
                Approach (T-30s)
              </button>
              <button
                type="button"
                onClick={() => setTime(-1.5)}
                className="flex-1 py-1.5 text-[10px] border border-red-500/40 hover:border-red-400 text-red-300 bg-red-950/30 uppercase font-bold"
              >
                Impact (T-0s)
              </button>
              <button
                type="button"
                onClick={() => setTime(25.0)}
                className="flex-1 py-1.5 text-[10px] border border-amber-500/30 hover:border-amber-400 text-amber-300 bg-amber-950/20 uppercase"
              >
                Debris (T+25s)
              </button>
            </div>
          </div>
        </div>

        {/* Bottom Interactive Timeline Scrubber & Playback Controls */}
        <div className="h-20 bg-[#050b17] border-t border-cyan-500/30 px-4 py-2.5 flex flex-col justify-between shrink-0">
          {/* Timeline Scrubber Slider */}
          <div className="flex items-center gap-3">
            <span className="text-[11px] font-mono font-bold text-cyan-300 w-24 shrink-0">
              {time >= 0 ? `T + ${time.toFixed(1)}s` : `T - ${Math.abs(time).toFixed(1)}s`}
            </span>

            <div className="relative flex-1 flex items-center">
              {/* Zero Marker Flag on Scrubber */}
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-10 pointer-events-none"
                style={{ left: '50%' }}
                title="T-0:00 Impact Moment"
              />
              <input
                type="range"
                min="-60"
                max="60"
                step="0.1"
                value={time}
                onChange={(e) => {
                  setTime(parseFloat(e.target.value));
                  setIsPlaying(false);
                }}
                className="w-full h-2 bg-slate-800 rounded-none appearance-none cursor-pointer accent-cyan-400 focus:outline-none"
              />
            </div>

            <span className="text-[10px] text-slate-500 w-16 text-right shrink-0">
              T+60.0s
            </span>
          </div>

          {/* Buttons: Play, Pause, Speeds, Reset */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsPlaying((prev) => !prev)}
                className="px-3 py-1 bg-cyan-600 hover:bg-cyan-500 text-black font-bold text-xs uppercase flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                {isPlaying ? <Pause className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                <span>{isPlaying ? 'PAUSE' : 'PLAY'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setTime(-60.0);
                  setIsPlaying(true);
                }}
                className="px-2.5 py-1 border border-slate-700 hover:border-slate-500 text-slate-300 text-xs uppercase flex items-center gap-1 transition-colors cursor-pointer"
                title="Reset to T-60s"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>REWIND</span>
              </button>
            </div>

            {/* Speed Multipliers */}
            <div className="flex items-center gap-1 text-[11px]">
              <span className="text-slate-500 text-[10px] mr-1 hidden sm:inline">SPEED:</span>
              {[0.25, 0.5, 1.0, 2.0].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setPlaybackSpeed(s)}
                  className={`px-2 py-0.5 border text-[10px] transition-colors ${
                    playbackSpeed === s
                      ? 'border-cyan-400 bg-cyan-500/20 text-cyan-300 font-bold'
                      : 'border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  {s}x
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
