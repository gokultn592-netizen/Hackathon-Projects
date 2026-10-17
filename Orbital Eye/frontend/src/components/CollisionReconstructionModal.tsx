import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Play, Pause, RotateCcw, Volume2, VolumeX, Eye, Maximize2 } from './Icons';

interface CollisionReconstructionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// 128 Deterministic Ballistic Debris Fragments for Kessler Syndrome simulation
interface DebrisParticle {
  id: number;
  source: 'IRIDIUM 33' | 'COSMOS 2251';
  color: string;
  glow: string;
  vx: number; // km/s in tactical plane
  vy: number;
  vz: number; // altitude offset
  size: number;
  altOffsetKm: number;
  catalogId: number;
}

function generateDebrisField(): DebrisParticle[] {
  const particles: DebrisParticle[] = [];
  const count = 128;
  for (let i = 0; i < count; i++) {
    const isCosmos = i % 2 === 0;
    // Spread angle with realistic dispersion along velocity vectors
    const baseAngle = isCosmos ? 35 + ((i * 17) % 60) - 30 : 215 + ((i * 17) % 60) - 30;
    const angleRad = (baseAngle * Math.PI) / 180;
    const speed = 0.6 + ((i * 13) % 19) * 0.22;
    const size = 1.2 + ((i * 7) % 5) * 0.7;
    const altOffset = ((i % 11) - 5) * 28; // km altitude scatter (500 km - 1400 km)

    particles.push({
      id: i,
      source: isCosmos ? 'COSMOS 2251' : 'IRIDIUM 33',
      color: isCosmos ? '#f87171' : '#38bdf8',
      glow: isCosmos ? 'rgba(239, 68, 68, 0.75)' : 'rgba(56, 189, 248, 0.75)',
      vx: Math.cos(angleRad) * speed,
      vy: Math.sin(angleRad) * speed,
      vz: (i % 7 - 3) * 0.4,
      size,
      altOffsetKm: altOffset,
      catalogId: isCosmos ? 33700 + i * 19 : 34100 + i * 23,
    });
  }
  return particles;
}

const DEBRIS_FIELD = generateDebrisField();

export default function CollisionReconstructionModal({
  isOpen,
  onClose,
}: CollisionReconstructionModalProps) {
  // Timeline: T in seconds from -60.0 to +60.0 (0.0 is exact hypervelocity impact)
  const [time, setTime] = useState<number>(-35.0);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);
  const [cameraView, setCameraView] = useState<'TACTICAL' | 'CLOSEUP' | 'GABBARD'>('TACTICAL');
  const [audioEnabled, setAudioEnabled] = useState<boolean>(true);
  const [showVectors, setShowVectors] = useState<boolean>(true);
  const [showEquations, setShowEquations] = useState<boolean>(true);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const lastTimestampRef = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const prevTimeRef = useRef<number>(-35.0);

  // High-fidelity multi-layer hypervelocity kinetic blast synthesis
  const playSynthesizedBlast = useCallback(() => {
    if (!audioEnabled) return;
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') ctx.resume();

      const now = ctx.currentTime;

      // Master Dynamics Compressor: prevents digital clipping and glues blast layers into a thunderous acoustic punch
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.setValueAtTime(-14, now);
      comp.knee.setValueAtTime(24, now);
      comp.ratio.setValueAtTime(10, now);
      comp.attack.setValueAtTime(0.002, now);
      comp.release.setValueAtTime(0.3, now);
      comp.connect(ctx.destination);

      // Layer 1: Sub-bass kinetic detonation (deep visceral 43.2 GJ gut-punch)
      const subOsc = ctx.createOscillator();
      const subGain = ctx.createGain();
      subOsc.type = 'sine';
      subOsc.frequency.setValueAtTime(145, now);
      subOsc.frequency.exponentialRampToValueAtTime(32, now + 0.35);
      subOsc.frequency.exponentialRampToValueAtTime(18, now + 1.4);

      subGain.gain.setValueAtTime(0.7, now);
      subGain.gain.exponentialRampToValueAtTime(0.001, now + 1.8);

      subOsc.connect(subGain);
      subGain.connect(comp);
      subOsc.start(now);
      subOsc.stop(now + 1.8);

      // Layer 2: Hypervelocity kinetic impact snap (instantaneous supersonic hull fracture)
      const snapFilter = ctx.createBiquadFilter();
      snapFilter.type = 'bandpass';
      snapFilter.frequency.setValueAtTime(1800, now);
      snapFilter.Q.setValueAtTime(3.0, now);

      const snapGain = ctx.createGain();
      snapGain.gain.setValueAtTime(0.6, now);
      snapGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.06);

      const snapBuf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.08), ctx.sampleRate);
      const snapData = snapBuf.getChannelData(0);
      for (let i = 0; i < snapData.length; i++) {
        snapData[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.012));
      }
      const snapSource = ctx.createBufferSource();
      snapSource.buffer = snapBuf;
      snapSource.connect(snapFilter);
      snapFilter.connect(snapGain);
      snapGain.connect(comp);
      snapSource.start(now);
      snapSource.stop(now + 0.08);

      // Layer 3: Rolling blast roar & fireball rumble (Brownian/Pink-filtered acoustic roar)
      const bufferDuration = 2.2;
      const bufferSize = Math.floor(ctx.sampleRate * bufferDuration);
      const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      let b0 = 0.0, b1 = 0.0, b2 = 0.0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99 * b0 + white * 0.05;
        b1 = 0.95 * b1 + white * 0.08;
        b2 = 0.85 * b2 + white * 0.12;
        output[i] = (b0 + b1 + b2) * 1.8;
      }

      const noiseSource = ctx.createBufferSource();
      noiseSource.buffer = noiseBuffer;

      const lowpass = ctx.createBiquadFilter();
      lowpass.type = 'lowpass';
      lowpass.frequency.setValueAtTime(1600, now);
      lowpass.frequency.exponentialRampToValueAtTime(65, now + 2.0);
      lowpass.Q.setValueAtTime(3.2, now);

      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.85, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 2.1);

      noiseSource.connect(lowpass);
      lowpass.connect(noiseGain);
      noiseGain.connect(comp);
      noiseSource.start(now);
      noiseSource.stop(now + 2.2);

      // Layer 4: Hull shrapnel metallic resonance (structural fragmentation ringing)
      [420, 710, 1140].forEach((freq, idx) => {
        const ringOsc = ctx.createOscillator();
        const ringGain = ctx.createGain();
        ringOsc.type = 'sine';
        ringOsc.frequency.setValueAtTime(freq, now + idx * 0.015);
        ringGain.gain.setValueAtTime(0.12 / (idx + 1), now + idx * 0.015);
        ringGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.6 + idx * 0.25);
        ringOsc.connect(ringGain);
        ringGain.connect(comp);
        ringOsc.start(now + idx * 0.015);
        ringOsc.stop(now + 0.7 + idx * 0.25);
      });
    } catch {
      // Audio autoplay policy catch
    }
  }, [audioEnabled]);

  // Proximity warning radar chime (dual harmonic avionics tone)
  const playSynthesizedPing = useCallback((progress: number) => {
    if (!audioEnabled) return;
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') ctx.resume();

      const now = ctx.currentTime;
      const baseFreq = 520 + progress * 340;

      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(baseFreq, now);

      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(baseFreq * 1.5, now);

      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(0.065, now + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 0.18);
      osc2.stop(now + 0.18);
    } catch {
      // Audio autoplay policy catch
    }
  }, [audioEnabled]);

  // Keyboard accessibility
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        setTime((curTime) => {
          if (curTime >= 59.9) {
            setIsPlaying(true);
            return -60.0;
          }
          setIsPlaying((prev) => !prev);
          return curTime;
        });
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Immediate audio cut-off / suspend when simulation is paused, muted, or closed
  useEffect(() => {
    if (!audioCtxRef.current) return;
    if (!isPlaying || !audioEnabled || !isOpen) {
      if (audioCtxRef.current.state === 'running') {
        audioCtxRef.current.suspend().catch(() => {});
      }
    } else {
      if (audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume().catch(() => {});
      }
    }
  }, [isPlaying, audioEnabled, isOpen]);

  // Clean up audio on unmount
  useEffect(() => {
    return () => {
      if (audioCtxRef.current && audioCtxRef.current.state === 'running') {
        audioCtxRef.current.suspend().catch(() => {});
      }
    };
  }, []);

  // Main high-precision animation loop
  useEffect(() => {
    if (!isOpen || !isPlaying) {
      lastTimestampRef.current = null;
      return;
    }

    const loop = (timestamp: number) => {
      if (lastTimestampRef.current !== null) {
        const deltaSeconds = (timestamp - lastTimestampRef.current) / 1000;
        setTime((prev) => {
          const next = prev + deltaSeconds * playbackSpeed * 3.5;
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

  // Audio trigger synchronized with timeline progression
  useEffect(() => {
    if (!isPlaying) {
      prevTimeRef.current = time;
      return;
    }

    const prev = prevTimeRef.current;
    const next = time;
    prevTimeRef.current = next;

    // Ignore when scrubbing backward or jumping back
    if (next < prev) return;

    // 1. Precise Hypervelocity Kinetic Impact Blast Trigger at T = 0.0s
    if (prev < 0.0 && next >= 0.0) {
      playSynthesizedBlast();
    }

    // 2. Proximity Radar Chimes Countdown Milestones:
    const milestones = [-20.0, -14.0, -9.0, -5.5, -3.5, -2.0, -1.0, -0.4];
    for (let i = 0; i < milestones.length; i++) {
      const m = milestones[i];
      if (prev < m && next >= m) {
        const progress = (m - (-20.0)) / (-0.4 - (-20.0));
        playSynthesizedPing(progress);
        break;
      }
    }
  }, [time, isPlaying, playSynthesizedBlast, playSynthesizedPing]);

  // Astrodynamics parameters
  const relVelKms = 11.65;
  const currentRangeKm = time <= 0 ? Math.abs(time) * relVelKms : time * relVelKms;
  const kineticEnergyGJ = 43.2; // 0.5 * mu * v_rel^2
  const isApproach = time < 0;
  const isImpact = time >= 0 && time <= 2.8;
  const isDispersion = time > 2.8;

  // Dynamic screen shake transform for the entire modal window (peaks violently at T=0 and decays smoothly)
  const modalShakeStyle = useMemo(() => {
    if (time < 0 || time > 1.8) return undefined;
    const progress = time / 1.8;
    const decay = Math.pow(1 - progress, 2.2);
    const freq = 45; // Hz
    const amp = decay * 14; // pixels
    const x = Math.sin(time * freq * Math.PI * 2) * amp;
    const y = Math.cos(time * freq * 0.85 * Math.PI * 2) * (amp * 0.7);
    const rot = Math.sin(time * freq * 0.4 * Math.PI * 2) * (decay * 0.8);
    return {
      transform: `translate(${x.toFixed(2)}px, ${y.toFixed(2)}px) rotate(${rot.toFixed(2)}deg)`,
      transition: 'none',
    };
  }, [time]);

  const fragmentCount = useMemo(() => {
    if (time <= 0) return 2;
    return Math.min(2296, Math.floor(2 + (time / 50.0) * 2294));
  }, [time]);

  // Manim-Style 2D Canvas Procedural Renderer
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Handle High-DPI screens (Retina, 4K, 125% scaling)
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;

    if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr)) {
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
    }

    ctx.save();
    ctx.scale(dpr, dpr);

    // Screen Shake at Impact (Internal Canvas Jitter)
    if (isImpact) {
      const shakeDecay = Math.max(0, (2.8 - time) / 2.8);
      const shakeAmt = shakeDecay * shakeDecay * 14;
      ctx.translate((Math.random() - 0.5) * shakeAmt, (Math.random() - 0.5) * shakeAmt);
    }

    // 1. Deep Space Stage Background
    ctx.fillStyle = '#02050e';
    ctx.fillRect(0, 0, w, h);

    const cx = w * 0.5;
    const cy = h * 0.5;

    // Camera scale factor based on cameraView mode
    const zoom = cameraView === 'CLOSEUP' ? 1.85 : cameraView === 'GABBARD' ? 0.95 : 1.25;

    // 2. Technical Manim Polar Coordinate Grid
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(14, 42, 71, 0.45)';
    ctx.setLineDash([3, 4]);

    const ringRadii = [60 * zoom, 120 * zoom, 180 * zoom, 240 * zoom];
    ringRadii.forEach((r, idx) => {
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();

      // Range markers
      ctx.fillStyle = 'rgba(2, 132, 199, 0.5)';
      ctx.font = '9px monospace';
      ctx.fillText(`${(idx + 1) * 150} KM`, cx + r + 4, cy - 4);
    });

    // Crosshairs
    ctx.beginPath();
    ctx.moveTo(30, cy);
    ctx.lineTo(w - 30, cy);
    ctx.moveTo(cx, 30);
    ctx.lineTo(cx, h - 30);
    ctx.stroke();
    ctx.setLineDash([]);

    // 3. Orbital Invariant Trajectories (86.4 deg vs 74.0 deg)
    const iridAngle = (215 * Math.PI) / 180;
    const cosmosAngle = (35 * Math.PI) / 180;
    const approachDist = Math.max(0, -time) * 5.5 * zoom;

    const iridX = time < 0 ? cx + Math.cos(iridAngle) * approachDist : cx;
    const iridY = time < 0 ? cy + Math.sin(iridAngle) * approachDist : cy;

    const cosmosX = time < 0 ? cx + Math.cos(cosmosAngle) * approachDist : cx;
    const cosmosY = time < 0 ? cy + Math.sin(cosmosAngle) * approachDist : cy;

    // Draw Orbit Guideways (Faint Dashed Lines)
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 5]);

    // Iridium Track (Cyan)
    ctx.strokeStyle = time < 0 ? 'rgba(56, 189, 248, 0.4)' : 'rgba(56, 189, 248, 0.15)';
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(iridAngle) * 600 * zoom, cy + Math.sin(iridAngle) * 600 * zoom);
    ctx.lineTo(cx, cy);
    ctx.stroke();

    // Cosmos Track (Red)
    ctx.strokeStyle = time < 0 ? 'rgba(248, 113, 113, 0.4)' : 'rgba(248, 113, 113, 0.15)';
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(cosmosAngle) * 600 * zoom, cy + Math.sin(cosmosAngle) * 600 * zoom);
    ctx.lineTo(cx, cy);
    ctx.stroke();
    ctx.setLineDash([]);

    // 4. PRE-COLLISION STATE (T < 0): Draw Satellites & Vector Triangles
    if (time < 0) {
      // Relative Distance Bracket Line
      if (time < 0 && showVectors) {
        ctx.strokeStyle = 'rgba(245, 158, 11, 0.6)';
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 3]);
        ctx.beginPath();
        ctx.moveTo(iridX, iridY);
        ctx.lineTo(cosmosX, cosmosY);
        ctx.stroke();
        ctx.setLineDash([]);

        // Live Distance Callout at midpoint
        const midX = (iridX + cosmosX) * 0.5;
        const midY = (iridY + cosmosY) * 0.5;
        ctx.fillStyle = '#050b14';
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 1;
        ctx.fillRect(midX - 44, midY - 10, 88, 20);
        ctx.strokeRect(midX - 44, midY - 10, 88, 20);

        ctx.fillStyle = '#f59e0b';
        ctx.font = 'bold 9px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`ΔR: ${currentRangeKm.toFixed(1)} km`, midX, midY);
      }

      // Draw IRIDIUM 33 Satellite (Cyan)
      ctx.save();
      ctx.translate(iridX, iridY);

      // Velocity Vector Arrow
      if (showVectors) {
        const arrowLen = 50 * (cameraView === 'CLOSEUP' ? 1.4 : 1.0);
        const vxDir = -Math.cos(iridAngle);
        const vyDir = -Math.sin(iridAngle);

        ctx.strokeStyle = '#38bdf8';
        ctx.fillStyle = '#38bdf8';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(vxDir * arrowLen, vyDir * arrowLen);
        ctx.stroke();

        // Arrowhead
        ctx.beginPath();
        ctx.arc(vxDir * arrowLen, vyDir * arrowLen, 3, 0, Math.PI * 2);
        ctx.fill();

        ctx.font = '9px monospace';
        ctx.fillStyle = '#38bdf8';
        ctx.textAlign = 'left';
        ctx.fillText('v₁ = 7.47 km/s (86.4°)', vxDir * arrowLen + 6, vyDir * arrowLen);
      }

      // Spacecraft Chassis & Panels
      ctx.fillStyle = '#0284c7';
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1.5;
      ctx.fillRect(-10, -5, 20, 10);
      ctx.strokeRect(-10, -5, 20, 10);

      // Solar Arrays
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(-22, -3, 10, 6);
      ctx.fillRect(12, -3, 10, 6);

      // Status Ring
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.6)';
      ctx.beginPath();
      ctx.arc(0, 0, 18, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 10px monospace';
      ctx.fillText('IRIDIUM 33', -28, -22);
      ctx.fillStyle = '#94a3b8';
      ctx.font = '8px monospace';
      ctx.fillText('USA · 560 kg', -28, -12);
      ctx.restore();

      // Draw COSMOS 2251 Satellite (Red)
      ctx.save();
      ctx.translate(cosmosX, cosmosY);

      // Velocity Vector Arrow
      if (showVectors) {
        const arrowLen = 50 * (cameraView === 'CLOSEUP' ? 1.4 : 1.0);
        const vxDir = -Math.cos(cosmosAngle);
        const vyDir = -Math.sin(cosmosAngle);

        ctx.strokeStyle = '#f87171';
        ctx.fillStyle = '#f87171';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(vxDir * arrowLen, vyDir * arrowLen);
        ctx.stroke();

        // Arrowhead
        ctx.beginPath();
        ctx.arc(vxDir * arrowLen, vyDir * arrowLen, 3, 0, Math.PI * 2);
        ctx.fill();

        ctx.font = '9px monospace';
        ctx.fillStyle = '#f87171';
        ctx.textAlign = 'left';
        ctx.fillText('v₂ = 7.47 km/s (74.0°)', vxDir * arrowLen + 6, vyDir * arrowLen);
      }

      // Spacecraft Cylindrical Chassis (Strela-2M)
      ctx.fillStyle = '#b91c1c';
      ctx.strokeStyle = '#f87171';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(0, 0, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Crossed Antennas
      ctx.strokeStyle = '#fca5a5';
      ctx.beginPath();
      ctx.moveTo(-12, 0);
      ctx.lineTo(12, 0);
      ctx.moveTo(0, -12);
      ctx.lineTo(0, 12);
      ctx.stroke();

      // Crosshair Ring
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.6)';
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.arc(0, 0, 18, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 10px monospace';
      ctx.fillText('COSMOS 2251', 20, -22);
      ctx.fillStyle = '#94a3b8';
      ctx.font = '8px monospace';
      ctx.fillText('RUS · 900 kg · DERELICT', 20, -12);
      ctx.restore();
    }

    // 5. HYPERVELOCITY KINETIC COLLISION (T = 0)
    if (isImpact) {
      const impactAge = time; // 0.0 to 2.8s
      const flashAlpha = Math.max(0, 1.0 - impactAge * 0.7);

      // Expanding Relativistic Shockwave Rings
      const ring1 = impactAge * 130 * zoom;
      const ring2 = impactAge * 220 * zoom;

      ctx.strokeStyle = `rgba(249, 115, 22, ${Math.max(0, 0.95 - impactAge * 0.35)})`;
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.arc(cx, cy, ring1, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = `rgba(254, 240, 138, ${Math.max(0, 0.85 - impactAge * 0.3)})`;
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.arc(cx, cy, ring2, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      // Blinding Fireball Plasma Core
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 80 * flashAlpha * zoom);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.2, '#fef08a');
      grad.addColorStop(0.55, '#f97316');
      grad.addColorStop(0.85, 'rgba(239, 68, 68, 0.4)');
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, 80 * flashAlpha * zoom, 0, Math.PI * 2);
      ctx.fill();
    }

    // 6. KESSLER SYNDROME DEBRIS FIELD EXPANSION (T > 0)
    if (time > 0) {
      ctx.save();

      // Debris Ground Zero Crosshair
      ctx.strokeStyle = 'rgba(249, 115, 22, 0.8)';
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 2]);
      ctx.beginPath();
      ctx.arc(cx, cy, 8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      // Gabbard Altitude Fan or Tactical Scatter View
      DEBRIS_FIELD.forEach((frag) => {
        let px = cx + frag.vx * time * 3.6 * zoom;
        let py = cy + frag.vy * time * 3.6 * zoom;

        // In Gabbard View, map Y axis to Altitude Scatter
        if (cameraView === 'GABBARD') {
          py = cy + frag.altOffsetKm * 0.45 * zoom;
        }

        const tailX = px - frag.vx * Math.min(time, 2.5) * 3.0 * zoom;
        const tailY = py - frag.vy * Math.min(time, 2.5) * 3.0 * zoom;

        // Particle Vapor Trail
        ctx.strokeStyle = frag.color;
        ctx.lineWidth = frag.size * 0.6;
        ctx.globalAlpha = 0.35;
        ctx.beginPath();
        ctx.moveTo(tailX, tailY);
        ctx.lineTo(px, py);
        ctx.stroke();

        // Shard Particle Core
        ctx.globalAlpha = 0.95;
        ctx.fillStyle = frag.color;
        ctx.beginPath();
        ctx.arc(px, py, frag.size * (cameraView === 'CLOSEUP' ? 1.6 : 1.0), 0, Math.PI * 2);
        ctx.fill();
      });

      ctx.restore();
    }

    // 7. Simulation Stage Badge Overlay
    ctx.fillStyle = 'rgba(3, 7, 18, 0.85)';
    ctx.strokeStyle = 'rgba(14, 165, 233, 0.35)';
    ctx.lineWidth = 1;

      // Top Right: Collision Phase Badge
      ctx.fillRect(w - 210, 20, 190, 48);
      ctx.strokeRect(w - 210, 20, 190, 48);

      ctx.fillStyle = '#94a3b8';
      ctx.font = '9px monospace';
      ctx.fillText('SIMULATION STAGE', w - 200, 34);

      ctx.fillStyle = isImpact ? '#ef4444' : isApproach ? '#38bdf8' : '#f59e0b';
      ctx.font = 'bold 11px monospace';
      ctx.fillText(
        isImpact ? '● KINETIC IMPACT' : isApproach ? '● CONVERGENCE' : '● KESSLER DISPERSION',
        w - 200,
        54
      );

    ctx.restore();
  }, [time, cameraView, showVectors, showEquations, isImpact, isApproach, currentRangeKm]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-5 bg-black/90 backdrop-blur-md select-none animate-fadeIn"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Modal Dialog Window with Physical Blast Screen Shake */}
      <div
        style={modalShakeStyle}
        className="relative w-full max-w-6xl h-[94vh] max-h-[860px] bg-[#02050f] border border-cyan-500/40 shadow-[0_0_60px_rgba(6,182,212,0.18)] flex flex-col overflow-hidden font-mono text-slate-200 rounded-lg"
      >
        {/* Fullscreen Kinetic Blast Shockwave Flash Overlay */}
        {time >= 0 && time <= 1.0 && (
          <div
            className="absolute inset-0 pointer-events-none z-50"
            style={{
              background: 'radial-gradient(circle at 45% 50%, rgba(255, 255, 255, 0.95) 0%, rgba(254, 240, 138, 0.6) 30%, rgba(249, 115, 22, 0.3) 60%, transparent 100%)',
              opacity: Math.max(0, 1 - time / 1.0),
              mixBlendMode: 'screen',
              transition: 'none',
            }}
          />
        )}

        {/* Top Header Bar */}
        <div className="h-11 px-4 bg-[#040816] border-b border-cyan-500/30 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
            <div className="flex items-center gap-2">
              <span className="text-xs font-black text-white tracking-widest uppercase">
                PROCEDURAL COLLISION RECONSTRUCTION // SIBERIA INTERSECT
              </span>
              <span className="text-[9px] text-cyan-300 font-bold px-1.5 py-0.5 bg-cyan-950/80 border border-cyan-500/40 rounded">
                MANIM MATH ENGINE
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Audio Toggle Button */}
            <button
              type="button"
              onClick={() => setAudioEnabled((prev) => !prev)}
              className={`p-1.5 border transition-colors cursor-pointer text-xs flex items-center gap-1 ${
                audioEnabled
                  ? 'border-cyan-500/40 text-cyan-300 bg-cyan-950/40'
                  : 'border-slate-700 text-slate-500 bg-black/40'
              }`}
              title={audioEnabled ? 'Mute procedural audio' : 'Enable procedural audio'}
            >
              {audioEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
              <span className="text-[10px] hidden sm:inline">{audioEnabled ? 'AUDIO ON' : 'MUTED'}</span>
            </button>

            {/* Vector Toggles */}
            <button
              type="button"
              onClick={() => setShowVectors((prev) => !prev)}
              className={`px-2 py-1 text-[10px] border transition-colors cursor-pointer ${
                showVectors ? 'border-cyan-500/40 text-cyan-300 bg-cyan-950/40' : 'border-slate-800 text-slate-500'
              }`}
            >
              VECTORS
            </button>

            {/* Equations Toggle */}
            <button
              type="button"
              onClick={() => setShowEquations((prev) => !prev)}
              className={`px-2 py-1 text-[10px] border transition-colors cursor-pointer ${
                showEquations ? 'border-cyan-500/40 text-cyan-300 bg-cyan-950/40' : 'border-slate-800 text-slate-500'
              }`}
            >
              FORMULAS
            </button>

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="px-2.5 py-1 border border-slate-700 hover:border-slate-400 text-slate-300 hover:text-white text-xs transition-colors cursor-pointer"
            >
              ESC / CLOSE
            </button>
          </div>
        </div>

        {/* Center Main Stage (Simulation Canvas & Telemetry HUD) */}
        <div className="flex-1 relative flex flex-col md:flex-row min-h-0 overflow-hidden">
          {/* Main Manim 2D Canvas */}
          <div className="flex-1 relative bg-[#02050e] overflow-hidden flex items-center justify-center">
            <canvas ref={canvasRef} className="w-full h-full block" />

            {/* 100% Human-Readable Astrodynamics Equations HUD */}
            {showEquations && (
              <div className="absolute top-3 left-3 z-30 w-84 max-w-[calc(100%-1.5rem)] bg-[#030714]/92 backdrop-blur-md border border-cyan-500/40 p-3 shadow-[0_0_25px_rgba(6,182,212,0.2)] rounded font-mono text-slate-200 select-none">
                <div className="flex items-center justify-between pb-1.5 mb-2 border-b border-cyan-500/30">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                    <span className="text-[10px] font-black text-cyan-300 tracking-wider uppercase">
                      ASTRODYNAMICS EQUATIONS // LEO
                    </span>
                  </div>
                  <span className="text-[9px] px-1.5 py-0.5 bg-cyan-950/80 border border-cyan-500/40 text-cyan-400 font-bold rounded">
                    LEO FORENSICS
                  </span>
                </div>

                {/* Section 1: Relative Velocity Equation */}
                <div className="mb-2 bg-[#02040c]/80 p-2 border border-slate-800 rounded">
                  <div className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-1">
                    1. Relative Velocity at Intersect:
                  </div>
                  <div className="text-amber-300 font-bold text-xs tracking-wide pl-1 py-0.5 bg-amber-950/20 border-l-2 border-amber-400 mb-1.5">
                    v<sub className="text-[9px]">rel</sub> = √(v<sub className="text-[9px]">1</sub><sup>2</sup> + v<sub className="text-[9px]">2</sub><sup>2</sup> − 2·v<sub className="text-[9px]">1</sub>·v<sub className="text-[9px]">2</sub>·cos(Δθ))
                  </div>
                  <div className="text-[9px] text-slate-300 space-y-0.5 border-t border-slate-800/80 pt-1">
                    <div className="flex justify-between">
                      <span>• v<sub className="text-[8px]">1</sub> (Iridium 33):</span>
                      <span className="text-cyan-400 font-bold">7.47 km/s (86.4° Inc)</span>
                    </div>
                    <div className="flex justify-between">
                      <span>• v<sub className="text-[8px]">2</sub> (Cosmos 2251):</span>
                      <span className="text-red-400 font-bold">7.47 km/s (74.0° Inc)</span>
                    </div>
                    <div className="flex justify-between">
                      <span>• Orbital Cross Angle Δθ:</span>
                      <span className="text-amber-400 font-bold">102.4°</span>
                    </div>
                  </div>
                  <div className="text-[10px] font-bold text-cyan-300 bg-cyan-950/50 px-1.5 py-1 border border-cyan-500/30 mt-1.5 flex justify-between items-center rounded-sm">
                    <span>Computed v<sub className="text-[8px]">rel</sub>:</span>
                    <span className="text-white">11.65 km/s (Mach 34)</span>
                  </div>
                </div>

                {/* Section 2: Kinetic Energy Equation */}
                <div className="bg-[#02040c]/80 p-2 border border-slate-800 rounded">
                  <div className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-1">
                    2. Hypervelocity Kinetic Energy:
                  </div>
                  <div className="text-red-400 font-bold text-xs tracking-wide pl-1 py-0.5 bg-red-950/20 border-l-2 border-red-500 mb-1.5">
                    E<sub className="text-[9px]">k</sub> = ½ · μ · v<sub className="text-[9px]">rel</sub><sup>2</sup>
                  </div>
                  <div className="text-[9px] text-slate-300 space-y-0.5 border-t border-slate-800/80 pt-1">
                    <div className="flex justify-between">
                      <span>• Reduced Mass (μ):</span>
                      <span className="text-white font-bold">345.2 kg</span>
                    </div>
                    <div className="text-slate-400 text-[8px]">
                      μ = (m<sub className="text-[7px]">1</sub>·m<sub className="text-[7px]">2</sub>) / (m<sub className="text-[7px]">1</sub>+m<sub className="text-[7px]">2</sub>) [560kg & 900kg]
                    </div>
                  </div>
                  <div className="text-[10px] font-bold text-red-400 bg-red-950/50 px-1.5 py-1 border border-red-500/30 mt-1.5 flex justify-between items-center rounded-sm">
                    <span>Impact Energy E<sub className="text-[8px]">k</sub>:</span>
                    <span className="text-white">43.2 GJ (≈ 10.3 t TNT)</span>
                  </div>
                </div>
              </div>
            )}

            {/* View Mode Switcher Tabs (Bottom Left of Canvas) */}
            <div className="absolute bottom-3 left-4 flex items-center gap-1.5 z-20 bg-black/80 backdrop-blur-md border border-cyan-500/30 p-1">
              <span className="text-[9px] text-zinc-500 px-1 font-bold">VIEW:</span>
              <button
                type="button"
                onClick={() => setCameraView('TACTICAL')}
                className={`px-2 py-0.5 text-[10px] uppercase font-bold transition-all cursor-pointer ${
                  cameraView === 'TACTICAL'
                    ? 'bg-cyan-500 text-black shadow-[0_0_8px_rgba(6,182,212,0.4)]'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                TACTICAL PLANE
              </button>
              <button
                type="button"
                onClick={() => setCameraView('CLOSEUP')}
                className={`px-2 py-0.5 text-[10px] uppercase font-bold transition-all cursor-pointer ${
                  cameraView === 'CLOSEUP'
                    ? 'bg-cyan-500 text-black shadow-[0_0_8px_rgba(6,182,212,0.4)]'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                CLOSEUP FOCUS
              </button>
              <button
                type="button"
                onClick={() => setCameraView('GABBARD')}
                className={`px-2 py-0.5 text-[10px] uppercase font-bold transition-all cursor-pointer ${
                  cameraView === 'GABBARD'
                    ? 'bg-amber-500 text-black shadow-[0_0_8px_rgba(245,158,11,0.4)]'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                ALTITUDE GABBARD
              </button>
            </div>
          </div>

          {/* Right-Hand Tactical Telemetry HUD */}
          <div className="w-full md:w-80 bg-[#030612] border-t md:border-t-0 md:border-l border-cyan-500/30 p-3.5 flex flex-col justify-between shrink-0 overflow-y-auto">
            <div className="space-y-3.5">
              {/* Mission Phase Indicator */}
              <div className="border border-cyan-500/30 bg-[#050a18] p-2.5">
                <div className="text-[9px] text-slate-400 uppercase tracking-widest">TIMELINE EVENT</div>
                <div className="text-xs font-bold mt-1 flex items-center gap-2">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      isApproach ? 'bg-cyan-400 animate-pulse' : isImpact ? 'bg-red-500 animate-ping' : 'bg-amber-400'
                    }`}
                  />
                  <span className={isImpact ? 'text-red-400 font-black' : isApproach ? 'text-cyan-300' : 'text-amber-300'}>
                    {isApproach
                      ? 'PHASE 1: CONVERGENCE'
                      : isImpact
                      ? 'PHASE 2: HYPERVELOCITY BREAKUP'
                      : 'PHASE 3: KESSLER SYNDROME FAN'}
                  </span>
                </div>
              </div>

              {/* 2x2 Telemetry Metric Tiles */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                {/* Metric 1: Separation */}
                <div className="bg-[#02040c] border border-slate-800 p-2">
                  <span className="text-[9px] text-slate-400 uppercase block">MISS DISTANCE</span>
                  <span className={`text-base font-bold font-mono ${time <= 0 ? 'text-red-400' : 'text-amber-400'}`}>
                    {time <= 0 ? `${currentRangeKm.toFixed(2)}` : `+${currentRangeKm.toFixed(1)}`}
                  </span>
                  <span className="text-[9px] text-slate-500 ml-1">KM</span>
                </div>

                {/* Metric 2: Fragments */}
                <div className="bg-[#02040c] border border-slate-800 p-2">
                  <span className="text-[9px] text-slate-400 uppercase block">TRACKED SHARDS</span>
                  <span className="text-base font-bold font-mono text-cyan-300">
                    {fragmentCount.toLocaleString()}
                  </span>
                  <span className="text-[9px] text-slate-500 ml-1">PCS</span>
                </div>

                {/* Metric 3: Relative Velocity */}
                <div className="bg-[#02040c] border border-slate-800 p-2">
                  <span className="text-[9px] text-slate-400 uppercase block">REL. VELOCITY</span>
                  <span className="text-sm font-bold text-white">11.65</span>
                  <span className="text-[9px] text-slate-500 ml-1">KM/S</span>
                </div>

                {/* Metric 4: Kinetic Energy */}
                <div className="bg-[#02040c] border border-slate-800 p-2">
                  <span className="text-[9px] text-slate-400 uppercase block">ENERGY RELEASE</span>
                  <span className="text-sm font-bold text-red-400">{kineticEnergyGJ}</span>
                  <span className="text-[9px] text-slate-500 ml-1">GJ</span>
                </div>
              </div>

              {/* Spacecraft Dossiers */}
              <div className="border border-slate-800/80 bg-[#02050f] p-2.5 space-y-2 text-[10px]">
                <div className="border-l-2 border-cyan-400 pl-2">
                  <div className="font-bold text-cyan-300">IRIDIUM 33 (USA)</div>
                  <div className="text-slate-400 text-[9px]">Commercial Comms · 560 kg · Active</div>
                  <div className="text-slate-500 text-[9px]">Orbit: 789.2 km · 86.4° Inclination</div>
                </div>

                <div className="border-l-2 border-red-500 pl-2">
                  <div className="font-bold text-red-400">COSMOS 2251 (RUSSIA)</div>
                  <div className="text-slate-400 text-[9px]">Military Strela-2M · 900 kg · Derelict</div>
                  <div className="text-slate-500 text-[9px]">Orbit: 786.5 km · 74.0° Inclination</div>
                </div>
              </div>

              {/* Historical Fact Note */}
              <div className="bg-red-950/20 border border-red-500/20 p-2 text-[9px] text-slate-300 leading-relaxed">
                <span className="text-red-400 font-bold block mb-0.5">HISTORICAL FORENSIC NOTE:</span>
                Feb 10, 2009 at 16:56 UTC over Taymyr, Siberia. The kinetic collision generated 2,296 trackable pieces exceeding 10 cm, expanding across altitudes from 500 to 1,400 km.
              </div>
            </div>

            {/* Quick Timeline Jumps */}
            <div className="mt-3 pt-2.5 border-t border-slate-800 flex gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setTime(-30.0);
                  setIsPlaying(true);
                }}
                className="flex-1 py-1 text-[9px] border border-cyan-500/30 hover:border-cyan-400 text-cyan-300 bg-cyan-950/20 uppercase cursor-pointer"
              >
                Approach (T-30s)
              </button>
              <button
                type="button"
                onClick={() => {
                  setTime(-2.5);
                  setIsPlaying(true);
                }}
                className="flex-1 py-1 text-[9px] border border-red-500/40 hover:border-red-400 text-red-300 bg-red-950/30 uppercase font-bold cursor-pointer"
              >
                Impact (T-0s)
              </button>
              <button
                type="button"
                onClick={() => {
                  setTime(15.0);
                  setIsPlaying(true);
                }}
                className="flex-1 py-1 text-[9px] border border-amber-500/30 hover:border-amber-400 text-amber-300 bg-amber-950/20 uppercase cursor-pointer"
              >
                Debris (T+15s)
              </button>
            </div>
          </div>
        </div>

        {/* Bottom Interactive Timeline Scrubber & Playback Controls */}
        <div className="h-18 bg-[#040816] border-t border-cyan-500/30 px-4 py-2 flex flex-col justify-between shrink-0">
          {/* Timeline Scrubber Slider */}
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono font-bold text-cyan-300 w-24 shrink-0">
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
                className="w-full h-1.5 bg-slate-800 rounded-none appearance-none cursor-pointer accent-cyan-400 focus:outline-none"
              />
            </div>

            <span className="text-[10px] text-slate-500 w-16 text-right shrink-0">
              T+60.0s
            </span>
          </div>

          {/* Buttons: Play, Pause, Speeds, Reset */}
          <div className="flex items-center justify-between gap-4 mt-1">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  if (time >= 59.9) {
                    setTime(-60.0);
                    setIsPlaying(true);
                  } else {
                    setIsPlaying((prev) => !prev);
                  }
                }}
                className="px-3 py-1 bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-xs uppercase flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                {isPlaying ? <Pause className="w-3 h-3 fill-current" /> : <Play className="w-3 h-3 fill-current" />}
                <span>{isPlaying ? 'PAUSE' : 'PLAY'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setTime(-60.0);
                  setIsPlaying(true);
                }}
                className="px-2.5 py-1 border border-slate-700 hover:border-slate-400 text-slate-300 text-xs uppercase flex items-center gap-1 transition-colors cursor-pointer"
                title="Reset to T-60s"
              >
                <RotateCcw className="w-3 h-3" />
                <span>REWIND</span>
              </button>

              {/* Playback Speed Multipliers */}
              <div className="flex items-center gap-1 ml-2">
                {[0.5, 1.0, 2.0, 4.0].map((speed) => (
                  <button
                    key={speed}
                    type="button"
                    onClick={() => setPlaybackSpeed(speed)}
                    className={`px-1.5 py-0.5 text-[10px] font-mono transition-all cursor-pointer ${
                      playbackSpeed === speed
                        ? 'bg-cyan-950 border border-cyan-400 text-cyan-200 font-bold'
                        : 'border border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {speed}x
                  </button>
                ))}
              </div>
            </div>

            {/* Tactical Status Pill */}
            <div className="flex items-center gap-1.5 text-[10px] font-mono text-zinc-400">
              <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse" />
              <span className="uppercase tracking-widest text-zinc-500">PROPAGATION:</span>
              <span className="text-zinc-200 font-bold">1:1 DETERMINISTIC PHYSICS</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
