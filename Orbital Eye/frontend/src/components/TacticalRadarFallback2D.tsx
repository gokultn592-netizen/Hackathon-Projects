import React, { useRef, useEffect, useState } from 'react';
import { SatelliteInfo } from './Globe3D';
import { AlertTriangle, ShieldCheck } from './Icons';

interface SatellitePosition {
  norad_id?: number;
  name?: string;
  lat_deg?: number;
  lon_deg?: number;
  alt_km?: number;
  velocity_kms?: number;
  risk_category?: 'CRITICAL' | 'CAUTION' | 'NOMINAL';
}

interface TacticalRadarFallback2DProps {
  satellitePositions?: SatellitePosition[];
  selectedSatName?: string | null;
  onSelectSat?: (sat: SatelliteInfo) => void;
  onUnfocus?: () => void;
}

export default function TacticalRadarFallback2D({
  satellitePositions = [],
  selectedSatName,
  onSelectSat,
  onUnfocus,
}: TacticalRadarFallback2DProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hoveredSat, setHoveredSat] = useState<SatellitePosition | null>(null);
  const [showGpuHelp, setShowGpuHelp] = useState<boolean>(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;

    const render = () => {
      const width = canvas.width;
      const height = canvas.height;

      // Deep space canvas
      ctx.fillStyle = '#06080e';
      ctx.fillRect(0, 0, width, height);

      // Grid Coordinate Lines
      ctx.strokeStyle = '#121826';
      ctx.lineWidth = 1;

      // Longitude lines (-180 to 180 every 30 deg)
      for (let lon = -180; lon <= 180; lon += 30) {
        const x = ((lon + 180) / 360) * width;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();

        // Label along bottom
        if (lon % 60 === 0) {
          ctx.fillStyle = '#334155';
          ctx.font = '9px "JetBrains Mono", monospace';
          ctx.fillText(`${lon}°`, x + 4, height - 6);
        }
      }

      // Latitude lines (-80 to 80 every 20 deg)
      for (let lat = -80; lat <= 80; lat += 20) {
        const y = ((90 - lat) / 180) * height;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();

        // Label along left
        ctx.fillStyle = '#334155';
        ctx.font = '9px "JetBrains Mono", monospace';
        ctx.fillText(`${lat}°`, 6, y - 4);
      }

      // Equator & Prime Meridian (High contrast C2 hairlines)
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 1.5;

      // Equator
      const equatorY = (90 / 180) * height;
      ctx.beginPath();
      ctx.moveTo(0, equatorY);
      ctx.lineTo(width, equatorY);
      ctx.stroke();

      // Prime Meridian
      const meridianX = (180 / 360) * width;
      ctx.beginPath();
      ctx.moveTo(meridianX, 0);
      ctx.lineTo(meridianX, height);
      ctx.stroke();

      // Axis Labels
      ctx.fillStyle = '#64748b';
      ctx.font = 'bold 9px "Space Grotesk", sans-serif';
      ctx.fillText('EQUATOR (0° LAT)', width - 110, equatorY - 4);
      ctx.fillText('PRIME MERIDIAN (0° LON)', meridianX + 6, 20);

      // Plot All Satellites from Oracle Telemetry
      satellitePositions.forEach((sat) => {
        if (sat.lat_deg === undefined || sat.lon_deg === undefined) return;

        const x = ((sat.lon_deg + 180) / 360) * width;
        const y = ((90 - sat.lat_deg) / 180) * height;

        const isSelected = selectedSatName === sat.name;
        const isCritical = sat.risk_category === 'CRITICAL';
        const isCaution = sat.risk_category === 'CAUTION';

        // Draw dot
        ctx.fillStyle = isSelected
          ? '#38bdf8'
          : isCritical
          ? '#ef4444'
          : isCaution
          ? '#f59e0b'
          : '#10b981';

        const radius = isSelected ? 5 : isCritical ? 4 : 3;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();

        // Pulsing ring for critical or selected
        if (isCritical || isSelected) {
          ctx.strokeStyle = isCritical ? 'rgba(239, 68, 68, 0.4)' : 'rgba(56, 189, 248, 0.4)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(x, y, radius + 4, 0, Math.PI * 2);
          ctx.stroke();
        }

        // Selected Spacecraft Reticle and Label
        if (isSelected) {
          ctx.strokeStyle = '#38bdf8';
          ctx.lineWidth = 1;
          ctx.strokeRect(x - 10, y - 10, 20, 20);

          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 10px "Space Grotesk", sans-serif';
          ctx.fillText(sat.name || 'UNKNOWN', x + 14, y - 4);

          ctx.fillStyle = '#94a3b8';
          ctx.font = '9px "JetBrains Mono", monospace';
          ctx.fillText(`${(sat.alt_km || 0).toFixed(1)} km · ${(sat.velocity_kms || 0).toFixed(2)} km/s`, x + 14, y + 8);
        }
      });

      animId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animId);
  }, [satellitePositions, selectedSatName]);

  // Handle Canvas Resize
  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      if (!canvas || !canvas.parentElement) return;
      canvas.width = canvas.parentElement.clientWidth;
      canvas.height = canvas.parentElement.clientHeight;
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Handle Clicking a Satellite on 2D Radar
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    let closest: SatellitePosition | null = null;
    let closestDist = 20; // 20px hit radius

    satellitePositions.forEach((sat) => {
      if (sat.lat_deg === undefined || sat.lon_deg === undefined) return;
      const x = ((sat.lon_deg + 180) / 360) * canvas.width;
      const y = ((90 - sat.lat_deg) / 180) * canvas.height;
      const dist = Math.hypot(clickX - x, clickY - y);
      if (dist < closestDist) {
        closestDist = dist;
        closest = sat;
      }
    });

    if (closest) {
      const selected: SatellitePosition = closest;
      if (onSelectSat) {
        onSelectSat({
          name: selected.name || 'UNKNOWN',
          noradId: selected.norad_id || 0,
          altitudeKm: selected.alt_km || 400,
          velocityKms: selected.velocity_kms || 7.6,
          inclinationDeg: 51.6,
          status: selected.risk_category || 'NOMINAL',
          latDeg: selected.lat_deg,
          lonDeg: selected.lon_deg,
        });
      }
    } else {
      if (onUnfocus) onUnfocus();
    }
  };

  return (
    <div className="relative w-full h-full bg-[#06080e] overflow-hidden select-none font-mono">
      {/* 2D Canvas Viewport */}
      <canvas
        ref={canvasRef}
        onClick={handleCanvasClick}
        className="w-full h-full block cursor-crosshair"
      />

      {/* Top Aerospace C2 Warning Banner */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-1.5 max-w-xl w-full px-4">
        <div className="w-full p-2.5 rounded-xl bg-[#090e1a]/95 border border-amber-500/40 shadow-xl backdrop-blur-xl flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-amber-300">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="font-bold tracking-wider">
              2D TACTICAL RADAR ACTIVE // WEBGL DISABLED IN BROWSER
            </span>
          </div>

          <button
            type="button"
            onClick={() => setShowGpuHelp(!showGpuHelp)}
            className="px-2.5 py-1 rounded-lg border border-amber-500/30 hover:border-amber-400 bg-amber-500/10 hover:bg-amber-500/20 text-[10px] font-bold text-amber-200 transition-colors cursor-pointer"
          >
            {showGpuHelp ? 'HIDE HELP ▲' : 'HOW TO ENABLE 3D ▼'}
          </button>
        </div>

        {/* Expandable GPU Hardware Acceleration Help Card */}
        {showGpuHelp && (
          <div className="w-full p-4 rounded-xl bg-[#0a0f1d] border border-[#1e293b] shadow-2xl text-left text-xs space-y-2.5 animate-fadeIn">
            <div className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider flex items-center justify-between">
              <span>HOW TO RE-ENABLE 3D HARDWARE ACCELERATION:</span>
              <span className="text-emerald-400 font-normal">Takes ~15 seconds</span>
            </div>
            <ol className="list-decimal list-inside space-y-1.5 text-zinc-300 text-[11px] leading-relaxed">
              <li>
                Open browser settings: <code className="text-white bg-black px-1.5 py-0.5 rounded border border-white/10">chrome://settings/system</code> or <code className="text-white bg-black px-1.5 py-0.5 rounded border border-white/10">edge://settings/system</code>
              </li>
              <li>
                Toggle <strong className="text-emerald-300">&quot;Use graphics acceleration when available&quot;</strong> to ON.
              </li>
              <li>
                Click <strong className="text-white">Relaunch</strong> on your browser.
              </li>
            </ol>
            <p className="text-[10px] text-zinc-500 border-t border-white/5 pt-2">
              All telemetry, satellite database queries, NASA B-plane radar, and conjunction solvers remain 100% active on this 2D radar view.
            </p>
          </div>
        )}
      </div>

      {/* Bottom Corner HUD Reticles */}
      <div className="absolute bottom-3 left-4 text-[10px] text-zinc-600 pointer-events-none">
        TACTICAL GROUND TRACK // 2D PROJECTION EQUIRECTANGULAR
      </div>
      <div className="absolute bottom-3 right-4 text-[10px] text-zinc-500 pointer-events-none">
        ACTIVE TRACKS: <strong className="text-zinc-200">{satellitePositions.length} OBJECTS</strong>
      </div>
    </div>
  );
}
