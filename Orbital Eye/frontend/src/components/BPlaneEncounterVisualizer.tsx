import React, { useState, useEffect, useRef, useId } from 'react';
import { createPortal } from 'react-dom';
import { X, Play, RotateCcw, ShieldCheck, AlertTriangle } from './Icons';

interface ConjunctionPair {
  id: string;
  primaryName: string;
  primaryNorad: number;
  secondaryName: string;
  secondaryNorad: number;
  missDistanceKm: number;
  relativeVelocityKms: number;
  hbrMeters: number;
  sigmaXKm: number;
  sigmaYKm: number;
  ellipseAngleDeg: number;
  nominalPc: number;
  altitudeKm: number;
}

const CONJUNCTION_PAIRS: ConjunctionPair[] = [
  {
    id: 'iss-debris',
    primaryName: 'ISS (ZARYA)',
    primaryNorad: 25544,
    secondaryName: 'FENGYUN 1C DEBRIS',
    secondaryNorad: 31113,
    missDistanceKm: 0.38,
    relativeVelocityKms: 14.32,
    hbrMeters: 20.0,
    sigmaXKm: 1.15,
    sigmaYKm: 0.72,
    ellipseAngleDeg: 28.5,
    nominalPc: 4.85e-4,
    altitudeKm: 421.5,
  },
  {
    id: 'noaa-cosmos',
    primaryName: 'NOAA 20 (JPSS-1)',
    primaryNorad: 43013,
    secondaryName: 'COSMOS 2251 DEBRIS',
    secondaryNorad: 34114,
    missDistanceKm: 0.42,
    relativeVelocityKms: 11.85,
    hbrMeters: 15.0,
    sigmaXKm: 0.95,
    sigmaYKm: 0.65,
    ellipseAngleDeg: -35.2,
    nominalPc: 3.42e-4,
    altitudeKm: 824.6,
  },
  {
    id: 'starlink-cz4b',
    primaryName: 'STARLINK-1008',
    primaryNorad: 44714,
    secondaryName: 'CZ-4B DEBRIS',
    secondaryNorad: 26042,
    missDistanceKm: 0.85,
    relativeVelocityKms: 9.45,
    hbrMeters: 12.0,
    sigmaXKm: 1.40,
    sigmaYKm: 0.80,
    ellipseAngleDeg: 42.0,
    nominalPc: 8.92e-5,
    altitudeKm: 550.0,
  },
  {
    id: 'tianhe-sl16',
    primaryName: 'CSS (TIANHE)',
    primaryNorad: 48274,
    secondaryName: 'SL-16 R/B DEBRIS',
    secondaryNorad: 22803,
    missDistanceKm: 1.15,
    relativeVelocityKms: 13.10,
    hbrMeters: 18.0,
    sigmaXKm: 1.30,
    sigmaYKm: 0.90,
    ellipseAngleDeg: 15.0,
    nominalPc: 3.20e-5,
    altitudeKm: 388.2,
  },
];

interface BPlaneEncounterVisualizerProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function BPlaneEncounterVisualizer({
  isOpen,
  onClose,
}: BPlaneEncounterVisualizerProps) {
  const [selectedPairId, setSelectedPairId] = useState<string>('iss-debris');
  const activePair = CONJUNCTION_PAIRS.find((p) => p.id === selectedPairId) || CONJUNCTION_PAIRS[0];

  // TCA Time delta (in seconds: -1800s [-30m] to +1800s [+30m])
  const [deltaTSec, setDeltaTSec] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playSpeed, setPlaySpeed] = useState<number>(10); // multiplier

  // Avoidance maneuver simulation toggle
  const [maneuverApplied, setManeuverApplied] = useState<boolean>(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number | null>(null);

  const scrubInputId = useId();

  // Close on Escape key press
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Simulation playback loop
  useEffect(() => {
    if (!isPlaying) return;
    let lastTime = performance.now();

    const loop = (currentTime: number) => {
      const dt = (currentTime - lastTime) / 1000.0;
      lastTime = currentTime;

      setDeltaTSec((prev) => {
        let next = prev + dt * playSpeed;
        if (next > 1800) next = -1800;
        return next;
      });

      animFrameRef.current = requestAnimationFrame(loop);
    };

    animFrameRef.current = requestAnimationFrame(loop);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isPlaying, playSpeed]);

  // Derived encounter dynamics
  const effectiveMissDistanceKm = maneuverApplied
    ? activePair.missDistanceKm + 1.85 // clearance displacement
    : activePair.missDistanceKm;

  // Instantaneous 3D separation: d(t) = sqrt(d_min^2 + (v_rel * t)^2)
  const currentSeparationKm = Math.sqrt(
    Math.pow(effectiveMissDistanceKm, 2) + Math.pow(activePair.relativeVelocityKms * (deltaTSec / 3600.0), 2)
  );

  // Range rate (closing speed if t < 0, 0 at TCA, opening speed if t > 0)
  const rangeRateKms =
    currentSeparationKm > 0
      ? (Math.pow(activePair.relativeVelocityKms, 2) * (deltaTSec / 3600.0)) / currentSeparationKm
      : 0;

  // Foster 2D B-Plane Probability Calculation
  const rHbrKm = activePair.hbrMeters / 1000.0;
  const covArea = 2 * activePair.sigmaXKm * activePair.sigmaYKm;
  const exponent = -0.5 * (Math.pow(effectiveMissDistanceKm, 2) / (activePair.sigmaXKm * activePair.sigmaYKm));
  const currentPc = (Math.pow(rHbrKm, 2) / covArea) * Math.exp(exponent);
  const pcFormatted = currentPc.toExponential(3);

  // Draw NASA B-Plane Radar Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const centerX = width / 2;
    const centerY = height / 2;

    // Scale: 1 km = 110 pixels
    const pxPerKm = 110;

    // Clear background (Deep Obsidian Slate)
    ctx.fillStyle = '#060911';
    ctx.fillRect(0, 0, width, height);

    // Subtle Grid Lines
    ctx.strokeStyle = '#131b2e';
    ctx.lineWidth = 1;
    const gridSpacing = pxPerKm * 0.5; // Every 0.5 km

    for (let x = centerX % gridSpacing; x < width; x += gridSpacing) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = centerY % gridSpacing; y < height; y += gridSpacing) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Range Distance Rings (0.5 km, 1.0 km, 1.5 km, 2.0 km)
    [0.5, 1.0, 1.5, 2.0].forEach((km) => {
      ctx.beginPath();
      ctx.arc(centerX, centerY, km * pxPerKm, 0, Math.PI * 2);
      ctx.strokeStyle = km === 1.0 ? '#1e293b' : '#0f172a';
      ctx.setLineDash(km === 1.0 ? [4, 4] : []);
      ctx.stroke();
      ctx.setLineDash([]);

      // Range labels
      ctx.fillStyle = '#475569';
      ctx.font = '9px "JetBrains Mono", monospace';
      ctx.fillText(`${km.toFixed(1)} km`, centerX + km * pxPerKm + 4, centerY - 4);
    });

    // Coordinate Axes (ξ horizontal, ζ vertical)
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1.5;

    // Horizontal ξ axis
    ctx.beginPath();
    ctx.moveTo(20, centerY);
    ctx.lineTo(width - 20, centerY);
    ctx.stroke();

    // Vertical ζ axis
    ctx.beginPath();
    ctx.moveTo(centerX, 20);
    ctx.lineTo(centerX, height - 20);
    ctx.stroke();

    // Axis Labels
    ctx.fillStyle = '#94a3b8';
    ctx.font = '10px "Space Grotesk", sans-serif';
    ctx.fillText('ENCOUNTER AXIS (ξ) →', width - 140, centerY - 8);
    ctx.fillText('CROSS AXIS (ζ) ↑', centerX + 8, 30);

    // Primary Satellite at Origin (0,0)
    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.arc(centerX, centerY, 4, 0, Math.PI * 2);
    ctx.fill();

    // Combined Hard-Body Radius (HBR) Zone (exaggerated for visibility: 15m magnified x10 in visualizer)
    const visualHbrPx = Math.max(8, rHbrKm * pxPerKm * 15);
    ctx.beginPath();
    ctx.arc(centerX, centerY, visualHbrPx, 0, Math.PI * 2);
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([3, 3]);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(239, 68, 68, 0.12)';
    ctx.fill();

    ctx.fillStyle = '#f87171';
    ctx.font = '9px "JetBrains Mono", monospace';
    ctx.fillText(`HBR (${activePair.hbrMeters}m)`, centerX + visualHbrPx + 4, centerY + visualHbrPx);

    // Conjunction Intruder Position in B-Plane
    const thetaRad = (activePair.ellipseAngleDeg * Math.PI) / 180;
    // Intruder nominal position at TCA
    const intruderX = centerX + Math.cos(thetaRad) * effectiveMissDistanceKm * pxPerKm;
    const intruderY = centerY - Math.sin(thetaRad) * effectiveMissDistanceKm * pxPerKm;

    // Miss Distance Vector Arrow (Origin -> Intruder)
    ctx.strokeStyle = maneuverApplied ? '#34d399' : '#f59e0b';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.lineTo(intruderX, intruderY);
    ctx.stroke();

    // Draw Covariance Ellipse (1σ, 2σ, 3σ) around Intruder
    const sigXPx = activePair.sigmaXKm * pxPerKm * 0.35;
    const sigYPx = activePair.sigmaYKm * pxPerKm * 0.35;

    ctx.save();
    ctx.translate(intruderX, intruderY);
    ctx.rotate(thetaRad);

    // 3σ Ellipse (Outer probability boundary)
    ctx.beginPath();
    ctx.ellipse(0, 0, sigXPx * 3, sigYPx * 3, 0, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(245, 158, 11, 0.18)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // 2σ Ellipse
    ctx.beginPath();
    ctx.ellipse(0, 0, sigXPx * 2, sigYPx * 2, 0, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(245, 158, 11, 0.35)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // 1σ Ellipse (Core 39.3% uncertainty density)
    ctx.beginPath();
    ctx.ellipse(0, 0, sigXPx, sigYPx, 0, 0, Math.PI * 2);
    ctx.strokeStyle = maneuverApplied ? '#10b981' : '#f59e0b';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = maneuverApplied ? 'rgba(16, 185, 129, 0.12)' : 'rgba(245, 158, 11, 0.12)';
    ctx.fill();

    ctx.restore();

    // Secondary Spacecraft Marker at Encounter Point
    ctx.fillStyle = maneuverApplied ? '#34d399' : '#f59e0b';
    ctx.beginPath();
    ctx.arc(intruderX, intruderY, 5, 0, Math.PI * 2);
    ctx.fill();

    // Label on Intruder
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 10px "Space Grotesk", sans-serif';
    ctx.fillText(activePair.secondaryName, intruderX + 8, intruderY - 8);

    ctx.fillStyle = maneuverApplied ? '#34d399' : '#fbbf24';
    ctx.font = '9px "JetBrains Mono", monospace';
    ctx.fillText(`d_min = ${effectiveMissDistanceKm.toFixed(3)} km`, intruderX + 8, intruderY + 6);

    // Dynamic Flyby Intruder Movement based on TCA Scrubber
    // Trajectory direction vector (perpendicular to miss vector)
    const trajAngle = thetaRad + Math.PI / 2;
    const progressOffsetPx = (deltaTSec / 60.0) * 18; // 18px per minute of encounter flight
    const currentIntruderX = intruderX + Math.cos(trajAngle) * progressOffsetPx;
    const currentIntruderY = intruderY - Math.sin(trajAngle) * progressOffsetPx;

    // Draw flyby path line
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.3)';
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 4]);
    ctx.beginPath();
    ctx.moveTo(intruderX - Math.cos(trajAngle) * 220, intruderY + Math.sin(trajAngle) * 220);
    ctx.lineTo(intruderX + Math.cos(trajAngle) * 220, intruderY - Math.sin(trajAngle) * 220);
    ctx.stroke();
    ctx.setLineDash([]);

    // Live Moving Satellite Orbiter along Flyby Path
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(currentIntruderX, currentIntruderY, 4, 0, Math.PI * 2);
    ctx.fill();

    // Pulse effect if close to TCA (|deltaTSec| < 120s)
    if (Math.abs(deltaTSec) < 120) {
      ctx.beginPath();
      ctx.arc(currentIntruderX, currentIntruderY, 10, 0, Math.PI * 2);
      ctx.strokeStyle = currentPc > 1e-4 ? '#ef4444' : '#10b981';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // Reticle Crosshairs at Canvas Center (Aerospace HUD)
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(centerX - 10, centerY);
    ctx.lineTo(centerX + 10, centerY);
    ctx.moveTo(centerX, centerY - 10);
    ctx.lineTo(centerX, centerY + 10);
    ctx.stroke();
  }, [activePair, effectiveMissDistanceKm, deltaTSec, maneuverApplied]);

  if (!isOpen) return null;

  const formatDeltaT = (sec: number) => {
    const sign = sec < 0 ? '-' : '+';
    const abs = Math.abs(sec);
    const m = Math.floor(abs / 60);
    const s = Math.floor(abs % 60);
    return `${sign}${m.toString().padStart(2, '0')}m ${s.toString().padStart(2, '0')}s`;
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[9500] bg-black/90 backdrop-blur-2xl flex items-center justify-center p-2 sm:p-4 md:p-6 select-none animate-fadeIn font-sans"
      onClick={onClose}
    >
      <div
        className="w-full max-w-6xl max-h-[94vh] bg-[#070b14] border border-[#1e293b] rounded-2xl shadow-[0_20px_70px_rgba(0,0,0,0.85)] flex flex-col overflow-hidden text-left"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── TOP AEROSPACE C2 HEADER ── */}
        <div className="flex flex-wrap items-center justify-between px-5 py-3.5 border-b border-[#1e293b] bg-[#0c1220]">
          <div className="flex items-center gap-3">
            <div className="w-2.5 h-2.5 rounded-sm bg-emerald-400 animate-pulse" />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold tracking-widest text-zinc-200 uppercase">
                  NASA CARA // CONJUNCTION ASSESSMENT ENCOUNTER B-PLANE
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/30 font-bold">
                  2D COVARIANCE RADAR
                </span>
              </div>
              <p className="text-[11px] text-zinc-500 font-mono mt-0.5">
                Relative encounter plane normal to relative velocity vector at TCA · Analytical Foster probability integral.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg border border-[#1e293b] text-zinc-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
            title="Close (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── PAIR SELECTOR BAR ── */}
        <div className="flex gap-2 px-5 py-2.5 bg-[#090e1a] border-b border-[#1e293b] overflow-x-auto text-xs font-mono">
          <span className="text-zinc-500 text-[10px] self-center mr-1 uppercase font-bold tracking-wider">
            CONJUNCTION PAIR:
          </span>
          {CONJUNCTION_PAIRS.map((pair) => {
            const isSelected = pair.id === selectedPairId;
            return (
              <button
                key={pair.id}
                type="button"
                onClick={() => {
                  setSelectedPairId(pair.id);
                  setManeuverApplied(false);
                  setDeltaTSec(0);
                }}
                className={`px-3 py-1.5 rounded-lg border text-left transition-all cursor-pointer whitespace-nowrap flex items-center gap-2 ${
                  isSelected
                    ? 'border-emerald-500/60 bg-emerald-950/30 text-emerald-300 font-bold'
                    : 'border-[#1e293b] bg-[#060911] text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
                }`}
              >
                <span>{pair.primaryName} vs {pair.secondaryName}</span>
                <span className={`text-[10px] ${pair.missDistanceKm < 0.5 ? 'text-red-400' : 'text-amber-400'}`}>
                  ({pair.missDistanceKm} km)
                </span>
              </button>
            );
          })}
        </div>

        {/* ── MAIN WORKSPACE: B-PLANE RADAR + TELEMETRY PANEL ── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 flex-1 overflow-hidden">
          {/* Radar Canvas (Center-Left 7 cols) */}
          <div className="lg:col-span-7 bg-[#060911] p-4 flex flex-col items-center justify-center relative border-b lg:border-b-0 lg:border-r border-[#1e293b]">
            {/* Corner Framing Brackets (Aerospace C2 aesthetic) */}
            <div className="absolute top-2 left-2 text-xs font-mono text-zinc-600 pointer-events-none">┌</div>
            <div className="absolute top-2 right-2 text-xs font-mono text-zinc-600 pointer-events-none">┐</div>
            <div className="absolute bottom-2 left-2 text-xs font-mono text-zinc-600 pointer-events-none">└</div>
            <div className="absolute bottom-2 right-2 text-xs font-mono text-zinc-600 pointer-events-none">┘</div>

            {/* Radar View Badge */}
            <div className="absolute top-3 left-4 text-[10px] font-mono text-zinc-500 bg-[#090e1a] px-2 py-0.5 rounded border border-[#1e293b]">
              ORTHOGRAPHIC B-PLANE PROJECTION (NORMAL TO v_rel)
            </div>

            <canvas
              ref={canvasRef}
              width={540}
              height={440}
              className="max-w-full h-auto rounded border border-[#131b2e] bg-[#060911]"
            />

            <div className="w-full flex items-center justify-between text-[10px] font-mono text-zinc-500 mt-2 px-2">
              <span>PRIMARY AT (0,0) · HBR = {activePair.hbrMeters}m</span>
              <span>1σ / 2σ / 3σ COVARIANCE CONTOURS (NASA CARA)</span>
            </div>
          </div>

          {/* Telemetry & Flight Dynamics Feed (Right 5 cols) */}
          <div className="lg:col-span-5 p-5 bg-[#090e1a] space-y-4 overflow-y-auto max-h-[500px] text-xs font-mono">
            {/* Conjunction Encounter Card */}
            <div className="p-3.5 rounded-xl bg-[#060911] border border-[#1e293b] space-y-2">
              <div className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">
                ENCOUNTER EPHEMERIS GEOMETRY
              </div>
              <div className="grid grid-cols-2 gap-2 text-zinc-300">
                <div>
                  <span className="text-zinc-500 block text-[9px]">PRIMARY ASSET:</span>
                  <span className="text-white font-bold">{activePair.primaryName}</span>
                </div>
                <div>
                  <span className="text-zinc-500 block text-[9px]">CONJUNCTION INTRUDER:</span>
                  <span className="text-amber-300 font-bold">{activePair.secondaryName}</span>
                </div>
                <div>
                  <span className="text-zinc-500 block text-[9px]">RELATIVE VELOCITY:</span>
                  <span className="text-white font-bold">{activePair.relativeVelocityKms.toFixed(2)} km/s</span>
                  <span className="text-zinc-500 text-[9px]"> (~{Math.round(activePair.relativeVelocityKms * 3600).toLocaleString()} km/h)</span>
                </div>
                <div>
                  <span className="text-zinc-500 block text-[9px]">ORBITAL ALTITUDE:</span>
                  <span className="text-white font-bold">{activePair.altitudeKm.toFixed(1)} km LEO</span>
                </div>
              </div>
            </div>

            {/* Dynamic Real-Time Flight Dynamics Card */}
            <div className="p-3.5 rounded-xl bg-[#060911] border border-[#1e293b] space-y-3">
              <div className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold flex items-center justify-between">
                <span>INSTANTANEOUS FLIGHT METRICS</span>
                <span className="text-emerald-400 font-bold">{formatDeltaT(deltaTSec)} TO TCA</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-[9px] text-zinc-500 uppercase">3D SEPARATION (d):</div>
                  <div className="text-lg font-bold text-white tabular-nums">
                    {currentSeparationKm.toFixed(3)} <span className="text-xs text-zinc-400">km</span>
                  </div>
                  <div className="text-[9px] text-zinc-500">
                    {Math.round(currentSeparationKm * 1000).toLocaleString()} meters
                  </div>
                </div>

                <div>
                  <div className="text-[9px] text-zinc-500 uppercase">RANGE RATE (ḋ):</div>
                  <div className={`text-lg font-bold tabular-nums ${rangeRateKms < 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                    {rangeRateKms.toFixed(2)} <span className="text-xs text-zinc-400">km/s</span>
                  </div>
                  <div className="text-[9px] text-zinc-500">
                    {deltaTSec < 0 ? 'CLOSING (APPROACH)' : deltaTSec === 0 ? 'PERIGEE (TCA)' : 'DIVERGING (DEPARTING)'}
                  </div>
                </div>
              </div>

              {/* Collision Risk Indicator */}
              <div className={`p-3 rounded-lg border flex items-center justify-between ${
                currentPc > 1e-4
                  ? 'bg-red-950/30 border-red-500/40 text-red-300'
                  : 'bg-emerald-950/30 border-emerald-500/40 text-emerald-300'
              }`}>
                <div>
                  <div className="text-[9px] uppercase font-bold tracking-wider">COLLISION PROBABILITY (P_c):</div>
                  <div className="text-base font-extrabold tabular-nums mt-0.5">{pcFormatted}</div>
                </div>
                <div className="text-right text-[10px] font-bold">
                  {currentPc > 1e-4 ? 'CRITICAL RISK (ACTION MANDATED)' : 'NOMINAL (RISK CLEARED)'}
                </div>
              </div>
            </div>

            {/* Avoidance Maneuver What-If Simulator */}
            <div className="p-3.5 rounded-xl bg-[#060911] border border-[#1e293b] space-y-2.5">
              <div className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold flex items-center justify-between">
                <span>AVOIDANCE MANEUVER PLANNER (WHAT-IF)</span>
                <span className="text-xs font-bold text-emerald-400">+0.35 m/s Δv</span>
              </div>

              <p className="text-[11px] text-zinc-400 font-sans leading-relaxed">
                Applies an impulsive along-track burn 45 minutes prior to encounter, raising perigee by +0.72 km and clearing the 1σ covariance ellipse.
              </p>

              <button
                type="button"
                onClick={() => setManeuverApplied(!maneuverApplied)}
                className={`w-full py-2 px-3 rounded-lg text-xs font-bold tracking-wider transition-all border cursor-pointer flex items-center justify-center gap-2 ${
                  maneuverApplied
                    ? 'border-emerald-500 bg-emerald-500/20 text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.2)]'
                    : 'border-[#1e293b] bg-white/5 text-zinc-300 hover:border-zinc-500 hover:text-white'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>{maneuverApplied ? 'MANEUVER ACTIVE (DISPLACEMENT APPLIED)' : 'SIMULATE THRUSTER BURN (+0.35 m/s)'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* ── BOTTOM TIMELINE FLIGHT SCRUBBER (t - TCA from -30m to +30m) ── */}
        <div className="p-4 bg-[#0c1220] border-t border-[#1e293b] space-y-2 text-xs font-mono">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsPlaying(!isPlaying)}
                className="px-2.5 py-1 rounded-lg border border-[#1e293b] bg-[#060911] hover:bg-white/5 text-zinc-300 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Play className="w-3 h-3 text-emerald-400" />
                <span>{isPlaying ? 'PAUSE' : 'PLAY'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setDeltaTSec(0);
                  setIsPlaying(false);
                }}
                className="p-1 rounded-lg border border-[#1e293b] bg-[#060911] hover:bg-white/5 text-zinc-400 hover:text-white cursor-pointer"
                title="Reset to TCA (t=0)"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>

              <div className="flex gap-1 ml-2">
                {[1, 5, 20].map((spd) => (
                  <button
                    key={spd}
                    type="button"
                    onClick={() => setPlaySpeed(spd)}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold border cursor-pointer ${
                      playSpeed === spd
                        ? 'border-emerald-500/50 bg-emerald-950/40 text-emerald-300'
                        : 'border-[#1e293b] text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    {spd}x
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-zinc-500 text-[10px]">CURRENT TIME OFFSET:</span>
              <span className="text-sm font-bold text-white tabular-nums bg-[#060911] px-2.5 py-0.5 rounded border border-[#1e293b]">
                {formatDeltaT(deltaTSec)}
              </span>
              <span className="text-[10px] text-zinc-500">
                (TCA = 00m 00s)
              </span>
            </div>
          </div>

          {/* Scrubber Range Slider */}
          <div className="flex items-center gap-3 pt-1">
            <span className="text-[10px] text-zinc-500">-30 MIN</span>
            <input
              id={scrubInputId}
              type="range"
              min="-1800"
              max="1800"
              step="5"
              value={deltaTSec}
              onChange={(e) => {
                setDeltaTSec(parseFloat(e.target.value));
                setIsPlaying(false);
              }}
              className="flex-1 accent-emerald-400 cursor-pointer h-1.5 bg-[#1e293b] rounded-lg"
            />
            <span className="text-[10px] text-zinc-500">+30 MIN</span>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
