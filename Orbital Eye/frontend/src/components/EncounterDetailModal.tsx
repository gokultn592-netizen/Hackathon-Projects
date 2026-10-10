import React, { useEffect, useRef, useState } from 'react';
import { X, Copy, Check, Satellite, ShieldAlert } from './Icons';
import { AdaptedEncounter } from '../adapters/encounterAdapter';

interface EncounterDetailModalProps {
  encounter: AdaptedEncounter | null;
  onClose: () => void;
}

export default function EncounterDetailModal({ encounter, onClose }: EncounterDetailModalProps) {
  const [copied, setCopied] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!encounter || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Conjunction 2D Geometry Visualizer
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    // Deep space background
    ctx.fillStyle = '#02050b';
    ctx.fillRect(0, 0, w, h);

    // Subtle tactical grid
    ctx.strokeStyle = 'rgba(0, 229, 255, 0.08)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= w; x += 30) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y <= h; y += 30) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // Trajectory A (Primary)
    ctx.strokeStyle = '#00e5ff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(25, h - 35);
    ctx.lineTo(w / 2, h / 2);
    ctx.lineTo(w - 25, 35);
    ctx.stroke();

    // Trajectory B (Secondary)
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(25, 35);
    ctx.lineTo(w / 2, h / 2 + (encounter.missDistance > 5 ? 12 : 3));
    ctx.lineTo(w - 25, h - 35);
    ctx.stroke();

    // Closest Approach Point Marker
    const cx = w / 2;
    const cy = h / 2;
    ctx.strokeStyle = '#ef4444';
    ctx.fillStyle = 'rgba(239, 68, 68, 0.25)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy, 14, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fill();

    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(cx, cy, 3, 0, Math.PI * 2);
    ctx.fill();

    // Target Text
    ctx.fillStyle = '#ffffff';
    ctx.font = '10px "JetBrains Mono", monospace';
    const missText = (Number(encounter.missDistance) || 0).toFixed(2);
    ctx.fillText(`TCA MISS: ${missText} KM`, cx - 55, cy - 20);

    // Legend
    ctx.fillStyle = '#00e5ff';
    ctx.fillText(`PRIMARY: ${encounter.satAName}`, 15, h - 12);
    ctx.fillStyle = '#f59e0b';
    ctx.fillText(`SECONDARY: ${encounter.satBName}`, w - 160, h - 12);
  }, [encounter]);

  if (!encounter) return null;

  const handleCopy = () => {
    navigator.clipboard?.writeText(JSON.stringify(encounter, null, 2)).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const probNum = typeof encounter.collisionProbPct === 'number'
    ? encounter.collisionProbPct
    : Number(encounter.collisionProbPct) || (encounter.collisionProb ? encounter.collisionProb * 100 : 0);
  const missDistNum = typeof encounter.missDistance === 'number' ? encounter.missDistance : Number(encounter.missDistance) || 0;
  const relVelNum = typeof encounter.relVelocity === 'number' ? encounter.relVelocity : Number(encounter.relVelocity) || 0;

  const isCritical = missDistNum < 2.0 || probNum > 25;
  const isCaution = !isCritical && (missDistNum < 10.0 || probNum > 5);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 backdrop-blur-sm animate-fadeIn">
      {/* Backdrop click to close */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Bottom-Sheet (600px max height) */}
      <div className="relative w-full max-w-5xl max-h-[600px] bg-[#05080f] border-t border-cyan-500/40 shadow-[0_-12px_40px_rgba(0,0,0,0.9)] flex flex-col font-mono z-10 overflow-hidden">
        {/* Header */}
        <div className="h-14 px-6 flex items-center justify-between border-b border-cyan-500/20 bg-[#02050b] shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-base font-bold text-white tracking-wide">
              {encounter.satAName}
            </span>
            <span className="text-base font-black text-red-500">×</span>
            <span className="text-base font-bold text-slate-300 tracking-wide">
              {encounter.satBName}
            </span>

            <span
              className={`text-[9px] font-bold px-2 py-0.5 uppercase tracking-wider ${
                isCritical
                  ? 'bg-red-500/20 text-red-400 border border-red-500/40'
                  : isCaution
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                  : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
              }`}
            >
              {isCritical ? 'CRITICAL RISK' : isCaution ? 'CAUTION ALERT' : 'NOMINAL CLEARANCE'}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-cyan-400 border border-cyan-500/30 hover:bg-cyan-500/10 hover:border-cyan-500/60 transition-all uppercase tracking-wider"
              title="Copy telemetry JSON to clipboard"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'COPIED' : 'COPY JSON'}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-cyan-500/10 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body: Two-Column Layout */}
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6 overflow-y-auto">
          {/* Left Column: Orbital Telemetry Parameters */}
          <div className="space-y-4">
            <div className="text-[10px] text-cyan-400 uppercase tracking-widest border-b border-cyan-500/20 pb-1">
              CONJUNCTION EVENT TELEMETRY #{encounter.id}
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="border-l-2 border-cyan-500/40 pl-2.5 py-1">
                <div className="text-[10px] text-slate-500 uppercase">MISS DISTANCE</div>
                <div className="text-lg font-bold text-white mt-0.5">
                  {missDistNum.toFixed(3)} <span className="text-[10px] text-slate-500">KM</span>
                </div>
              </div>

              <div className="border-l-2 border-cyan-500/40 pl-2.5 py-1">
                <div className="text-[10px] text-slate-500 uppercase">RELATIVE VELOCITY</div>
                <div className="text-lg font-bold text-cyan-300 mt-0.5">
                  {relVelNum.toFixed(2)} <span className="text-[10px] text-slate-500">KM/S</span>
                </div>
              </div>

              <div className="border-l-2 border-cyan-500/40 pl-2.5 py-1">
                <div className="text-[10px] text-slate-500 uppercase">COLLISION PROBABILITY</div>
                <div className="text-base font-bold text-white mt-0.5">
                  {probNum.toFixed(2)}%
                </div>
              </div>

              <div className="border-l-2 border-cyan-500/40 pl-2.5 py-1">
                <div className="text-[10px] text-slate-500 uppercase">TCA TIMESTAMP</div>
                <div className="text-xs font-mono text-slate-300 mt-0.5">
                  {encounter.tca ? new Date(encounter.tca).toISOString().replace('T', ' ').slice(0, 19) : 'LIVE SIMULATED'}
                </div>
              </div>

              <div className="border-l-2 border-cyan-500/40 pl-2.5 py-1">
                <div className="text-[10px] text-slate-500 uppercase">PRIMARY NORAD ID</div>
                <div className="text-sm font-mono text-cyan-400 mt-0.5">
                  {encounter.satANorad || encounter.satAId || 'N/A'}
                </div>
              </div>

              <div className="border-l-2 border-cyan-500/40 pl-2.5 py-1">
                <div className="text-[10px] text-slate-500 uppercase">SECONDARY NORAD ID</div>
                <div className="text-sm font-mono text-amber-400 mt-0.5">
                  {encounter.satBNorad || encounter.satBId || 'N/A'}
                </div>
              </div>
            </div>

            <div className="p-3 bg-[#02050b] border border-cyan-500/20 text-[11px] text-slate-400 space-y-1">
              <div><span className="text-slate-600">ORACLE TABLE:</span> ENCOUNTER_PAIRS</div>
              <div><span className="text-slate-600">SOLVER:</span> ORBITALEYE PL/SQL RISK CLASSIFIER</div>
            </div>
          </div>

          {/* Right Column: Conjunction Geometry 2D Canvas */}
          <div className="flex flex-col space-y-2">
            <div className="text-[10px] text-cyan-400 uppercase tracking-widest border-b border-cyan-500/20 pb-1">
              APPROACH GEOMETRY (B-PLANE PROJECTION)
            </div>
            <div className="border border-cyan-500/30 overflow-hidden bg-black flex-1 min-h-[220px]">
              <canvas
                ref={canvasRef}
                width={440}
                height={220}
                className="w-full h-full block"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
