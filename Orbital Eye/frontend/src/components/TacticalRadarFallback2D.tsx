import React, { useRef, useEffect, useState } from 'react';
import { SatelliteInfo } from './Globe3D';

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
  onFpsUpdate?: (fps: number) => void;
}

export default function TacticalRadarFallback2D({
  satellitePositions = [],
  selectedSatName,
  onSelectSat,
  onUnfocus,
  onFpsUpdate,
}: TacticalRadarFallback2DProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hoveredSat, setHoveredSat] = useState<SatellitePosition | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let fpsFrameCount = 0;
    let fpsWindowStart = performance.now();

    const render = (currentTime: number) => {
      fpsFrameCount++;
      const elapsed = currentTime - fpsWindowStart;
      if (elapsed >= 1000) {
        const measuredFps = Math.round((fpsFrameCount * 1000) / elapsed);
        fpsFrameCount = 0;
        fpsWindowStart = currentTime;
        if (onFpsUpdate) {
          onFpsUpdate(measuredFps);
        }
      }
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

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [satellitePositions, selectedSatName, onFpsUpdate]);

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
