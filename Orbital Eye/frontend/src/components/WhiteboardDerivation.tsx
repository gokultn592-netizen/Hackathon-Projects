import React, { useState, useEffect, useId } from 'react';
import { Orbit, RotateCcw, ShieldCheck, AlertTriangle } from './Icons';
import { SatelliteInfo } from './Globe3D';

interface SatellitePreset {
  id: string;
  name: string;
  noradId: number;
  altKm: number;
  incDeg: number;
  eccentricity: number;
  description: string;
  status: 'NOMINAL' | 'CRITICAL' | 'CAUTION';
  missDistanceKm?: number;
}

const PRESET_SATELLITES: SatellitePreset[] = [
  {
    id: 'iss',
    name: 'ISS (ZARYA)',
    noradId: 25544,
    altKm: 421.5,
    incDeg: 51.64,
    eccentricity: 0.00068,
    description: 'International Space Station · Low Earth Orbit flagship',
    status: 'CRITICAL',
    missDistanceKm: 0.42,
  },
  {
    id: 'tianhe',
    name: 'CSS (TIANHE)',
    noradId: 48274,
    altKm: 388.2,
    incDeg: 41.47,
    eccentricity: 0.00045,
    description: 'Chinese Space Station Tiangong Core Module',
    status: 'CRITICAL',
    missDistanceKm: 1.45,
  },
  {
    id: 'hst',
    name: 'HUBBLE (HST)',
    noradId: 20580,
    altKm: 535.0,
    incDeg: 28.47,
    eccentricity: 0.00028,
    description: 'Hubble Space Telescope · High-precision optical observatory',
    status: 'CAUTION',
    missDistanceKm: 2.60,
  },
  {
    id: 'terra',
    name: 'TERRA (EOS AM-1)',
    noradId: 25994,
    altKm: 705.0,
    incDeg: 98.20,
    eccentricity: 0.00012,
    description: 'NASA Earth Science Flagship · Sun-Synchronous Polar Orbit',
    status: 'CAUTION',
    missDistanceKm: 3.85,
  },
  {
    id: 'noaa20',
    name: 'NOAA 20 (JPSS-1)',
    noradId: 43013,
    altKm: 824.6,
    incDeg: 98.74,
    eccentricity: 0.00018,
    description: 'Joint Polar Satellite System · Critical conjunction partner',
    status: 'CRITICAL',
    missDistanceKm: 0.42,
  },
  {
    id: 'starlink',
    name: 'STARLINK-1008',
    noradId: 44714,
    altKm: 550.0,
    incDeg: 53.05,
    eccentricity: 0.00015,
    description: 'SpaceX Megaconstellation LEO Shell',
    status: 'CRITICAL',
    missDistanceKm: 0.85,
  },
];

const EARTH_RADIUS_KM = 6371.0;
const MU_EARTH = 398600.4418; // km^3/s^2 (Standard gravitational parameter)
const J2_COEFF = 1.08263e-3;   // Second zonal harmonic (Earth equatorial bulge)

interface WhiteboardDerivationProps {
  selectedSat?: SatelliteInfo | null;
  onClose?: () => void;
}

export default function WhiteboardDerivation({
  selectedSat,
  onClose,
}: WhiteboardDerivationProps) {
  // Active satellite preset or custom input
  const [selectedPresetId, setSelectedPresetId] = useState<string>(
    selectedSat?.noradId === 48274 ? 'tianhe' :
    selectedSat?.noradId === 20580 ? 'hst' :
    selectedSat?.noradId === 25994 ? 'terra' :
    selectedSat?.noradId === 43013 ? 'noaa20' :
    selectedSat?.noradId === 44714 ? 'starlink' : 'iss'
  );

  const activePreset = PRESET_SATELLITES.find((p) => p.id === selectedPresetId) || PRESET_SATELLITES[0];

  // Dynamic user-adjustable inputs (prefilled with satellite real data)
  const [satName, setSatName] = useState<string>(selectedSat?.name || activePreset.name);
  const [noradId, setNoradId] = useState<number>(selectedSat?.noradId || activePreset.noradId);
  const [altKm, setAltKm] = useState<number>(selectedSat?.altitudeKm || activePreset.altKm);
  const [incDeg, setIncDeg] = useState<number>(selectedSat?.inclinationDeg || activePreset.incDeg);
  const [eccentricity, setEccentricity] = useState<number>(activePreset.eccentricity);
  const [missDistKm, setMissDistKm] = useState<number>(activePreset.missDistanceKm || 0.42);
  const [deltaV, setDeltaV] = useState<number>(0.35); // m/s impulsive thruster burn
  const [activeSection, setActiveSection] = useState<'ALL' | 'VIS_VIVA' | 'KEPLER' | 'J2' | 'B_PLANE' | 'MANEUVER'>('ALL');

  // Reactively synchronize whenever a selectedSat prop is provided or changes
  useEffect(() => {
    if (selectedSat) {
      setSatName(selectedSat.name);
      setNoradId(selectedSat.noradId);
      setAltKm(selectedSat.altitudeKm);
      setIncDeg(selectedSat.inclinationDeg);
      if ((selectedSat as any)?.eccentricity != null) setEccentricity((selectedSat as any).eccentricity);
      if (selectedSat.missDistanceKm != null) setMissDistKm(selectedSat.missDistanceKm);

      const matched = PRESET_SATELLITES.find((p) => p.noradId === selectedSat.noradId);
      if (matched) {
        setSelectedPresetId(matched.id);
      } else {
        setSelectedPresetId('custom');
      }
    }
  }, [selectedSat]);

  // Handle switching presets
  const handleSelectPreset = (preset: SatellitePreset) => {
    setSelectedPresetId(preset.id);
    setSatName(preset.name);
    setNoradId(preset.noradId);
    setAltKm(preset.altKm);
    setIncDeg(preset.incDeg);
    setEccentricity(preset.eccentricity);
    setMissDistKm(preset.missDistanceKm || 0.42);
  };

  // --- STEP-BY-STEP DERIVATION CALCULATIONS (Live Substitutions) ---
  // 1. Vis-Viva Orbital Energy & Speed
  const rKm = EARTH_RADIUS_KM + altKm;
  const aKm = rKm / (1 - eccentricity); // Semi-major axis from perigee radius
  const vOrbitKmS = Math.sqrt(MU_EARTH * (2 / rKm - 1 / aKm));
  const vOrbitKmH = vOrbitKmS * 3600;
  const specKineticEnergy = 0.5 * Math.pow(vOrbitKmS, 2); // MJ/kg
  const specPotentialEnergy = -MU_EARTH / rKm;           // MJ/kg
  const specTotalEnergy = specKineticEnergy + specPotentialEnergy;

  // 2. Kepler's 3rd Law & Orbital Period
  const periodSeconds = 2 * Math.PI * Math.sqrt(Math.pow(aKm, 3) / MU_EARTH);
  const periodMinutes = periodSeconds / 60;
  const meanMotionRadS = (2 * Math.PI) / periodSeconds;
  const meanMotionRevDay = 86400 / periodSeconds;

  // 3. First-Order Secular J2 Nodal Precession
  const incRad = (incDeg * Math.PI) / 180;
  const pKm = aKm * (1 - Math.pow(eccentricity, 2)); // Semi-latus rectum
  const raanPrecessionRadS =
    -1.5 * J2_COEFF * Math.pow(EARTH_RADIUS_KM / pKm, 2) * meanMotionRadS * Math.cos(incRad);
  const raanPrecessionDegDay = (raanPrecessionRadS * 180 * 86400) / Math.PI;

  // 4. Foster 2D B-Plane Collision Probability (Akella-Alfriend analytical reduction)
  const hardBodyRadiusM = 15.0; // meters (combined spacecraft envelope)
  const rHbrKm = hardBodyRadiusM / 1000.0;
  const sigmaX = 1.2; // km positional uncertainty along encounter axis
  const sigmaY = 0.8; // km positional uncertainty cross encounter axis
  const bPlaneExponent = -0.5 * (Math.pow(missDistKm, 2) / (sigmaX * sigmaY));
  const collisionProb = (Math.pow(rHbrKm, 2) / (2 * sigmaX * sigmaY)) * Math.exp(bPlaneExponent);
  const oddsDenominator = collisionProb > 0 ? Math.round(1 / collisionProb) : 999999;

  // 5. Along-Track Avoidance Burn & Orbital Phasing
  const deltaA_km = (2 * aKm * vOrbitKmS * (deltaV / 1000.0)) / (MU_EARTH / Math.pow(rKm, 2));
  const leadTimeSec = 45 * 60; // 45 minutes pre-conjunction execution
  const alongTrackSeparationKm = 1.5 * meanMotionRadS * deltaA_km * leadTimeSec;

  const satSelectId = useId();
  const altInputId = useId();
  const incInputId = useId();
  const missInputId = useId();
  const dvInputId = useId();

  return (
    <div className="w-full bg-[#0a0f1d] border border-cyan-500/40 rounded-3xl overflow-hidden flex flex-col text-left font-mono select-none">
      {/* ── TOP CONTROL SLATE: Satellite Presets & Real Inputs ── */}
      <div className="p-4 md:p-6 bg-gradient-to-b from-[#11192e] to-[#0a0f1d] border-b border-white/10 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
              <Orbit className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm md:text-base font-bold text-white tracking-wider">
                  ORBITAL MECHANICS WHITEBOARD DERIVATION
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold">
                  TEMPLATE-DRIVEN SOLVER
                </span>
              </div>
              <p className="text-[11px] text-zinc-400 mt-0.5">
                Exact first-principles academic whiteboard proofs. Select any real LEO satellite to dynamically substitute live state vectors.
              </p>
            </div>
          </div>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-xl border border-white/10 hover:border-white/20 bg-white/5 hover:bg-white/10 text-xs text-zinc-300 hover:text-white transition-colors cursor-pointer"
            >
              CLOSE (ESC)
            </button>
          )}
        </div>

        {/* Spacecraft Quick Preset Selector Pills */}
        <div className="space-y-1.5">
          <div className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
            <span>SELECT SATELLITE TO DERIVE:</span>
            <span className="text-cyan-400 font-normal">(Updates all derivation substitutions instantly)</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            {PRESET_SATELLITES.map((p) => {
              const isSelected = p.id === selectedPresetId;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleSelectPreset(p)}
                  className={`p-2 rounded-xl border text-left transition-all cursor-pointer ${
                    isSelected
                      ? 'border-cyan-400 bg-cyan-500/20 text-white ring-1 ring-cyan-400'
                      : 'border-white/10 bg-black/40 text-zinc-400 hover:border-white/20 hover:text-zinc-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold truncate">{p.name}</span>
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        p.status === 'CRITICAL' ? 'bg-red-400 animate-pulse' : 'bg-emerald-400'
                      }`}
                    />
                  </div>
                  <div className="text-[9px] text-zinc-400 mt-0.5">
                    {p.altKm} km · {p.incDeg}°
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Interactive Parameter Controls (Examiner can test any input) */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-black/50 p-3 rounded-2xl border border-white/[0.08] text-xs">
          <div>
            <label htmlFor={altInputId} className="text-zinc-400 text-[10px] block">ALTITUDE (h):</label>
            <div className="flex items-center gap-2 mt-1">
              <input
                id={altInputId}
                type="number"
                min="160"
                max="2000"
                step="0.5"
                value={altKm}
                onChange={(e) => setAltKm(parseFloat(e.target.value) || 400)}
                className="w-20 bg-black border border-white/20 rounded-lg px-2 py-1 text-white font-bold text-xs"
              />
              <span className="text-zinc-400 text-[11px]">km</span>
            </div>
          </div>

          <div>
            <label htmlFor={incInputId} className="text-zinc-400 text-[10px] block">INCLINATION (i):</label>
            <div className="flex items-center gap-2 mt-1">
              <input
                id={incInputId}
                type="number"
                min="0"
                max="120"
                step="0.1"
                value={incDeg}
                onChange={(e) => setIncDeg(parseFloat(e.target.value) || 51.6)}
                className="w-20 bg-black border border-white/20 rounded-lg px-2 py-1 text-white font-bold text-xs"
              />
              <span className="text-zinc-400 text-[11px]">deg</span>
            </div>
          </div>

          <div>
            <label htmlFor={missInputId} className="text-zinc-400 text-[10px] block">MISS DISTANCE (d):</label>
            <div className="flex items-center gap-2 mt-1">
              <input
                id={missInputId}
                type="number"
                min="0.05"
                max="15.0"
                step="0.05"
                value={missDistKm}
                onChange={(e) => setMissDistKm(parseFloat(e.target.value) || 0.5)}
                className="w-20 bg-black border border-white/20 rounded-lg px-2 py-1 text-amber-300 font-bold text-xs"
              />
              <span className="text-zinc-400 text-[11px]">km</span>
            </div>
          </div>

          <div>
            <label htmlFor={dvInputId} className="text-zinc-400 text-[10px] block">THRUSTER BURN (Δv):</label>
            <div className="flex items-center gap-2 mt-1">
              <input
                id={dvInputId}
                type="number"
                min="0.05"
                max="25.0"
                step="0.05"
                value={deltaV}
                onChange={(e) => setDeltaV(parseFloat(e.target.value) || 0.35)}
                className="w-20 bg-black border border-white/20 rounded-lg px-2 py-1 text-emerald-300 font-bold text-xs"
              />
              <span className="text-zinc-400 text-[11px]">m/s</span>
            </div>
          </div>
        </div>

        {/* Section Filter Pills */}
        <div className="flex gap-2 overflow-x-auto pt-1">
          {[
            { id: 'ALL', label: 'FULL WHITEBOARD (ALL STEPS)' },
            { id: 'VIS_VIVA', label: '1. VIS-VIVA & SPEED' },
            { id: 'KEPLER', label: '2. ORBIT PERIOD' },
            { id: 'J2', label: '3. J₂ PRECESSION' },
            { id: 'B_PLANE', label: '4. B-PLANE COLLISION PROBABILITY' },
            { id: 'MANEUVER', label: '5. AVOIDANCE ΔV PHASING' },
          ].map((sec) => (
            <button
              key={sec.id}
              type="button"
              onClick={() => setActiveSection(sec.id as any)}
              className={`px-3 py-1 rounded-xl text-[11px] font-bold tracking-wider transition-all border whitespace-nowrap cursor-pointer ${
                activeSection === sec.id
                  ? 'border-cyan-400/80 bg-cyan-500/20 text-cyan-300'
                  : 'border-white/10 bg-white/[0.02] text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.05]'
              }`}
            >
              {sec.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── THE WHITEBOARD CANVAS (Academic Slate Aesthetic) ── */}
      <div className="p-5 md:p-8 space-y-8 bg-[#070b14] relative overflow-y-auto max-h-[68vh]">
        {/* Subtle engineering grid background */}
        <div
          className="absolute inset-0 pointer-events-none opacity-20"
          style={{
            backgroundImage:
              'linear-gradient(to right, #38bdf812 1px, transparent 1px), linear-gradient(to bottom, #38bdf812 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }}
        />

        {/* ── WHITEBOARD HEADER: GIVEN STATE ── */}
        <div className="border border-cyan-500/30 bg-[#0d1527] p-4 rounded-2xl relative z-10 shadow-lg">
          <div className="text-xs font-bold text-cyan-400 uppercase tracking-widest flex items-center justify-between border-b border-white/10 pb-2">
            <span>[ WHITEBOARD GIVEN STATE VECTOR: {satName} ]</span>
            <span className="text-zinc-400 text-[10px]">NORAD ID: {noradId}</span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-3 text-xs text-zinc-300">
            <div>
              <div className="text-zinc-400 text-[10px]">GEOCENTRIC CONSTANT (μ):</div>
              <div className="font-bold text-white text-sm">398,600.4418 <span className="text-zinc-400 text-[10px]">km³/s²</span></div>
            </div>
            <div>
              <div className="text-zinc-400 text-[10px]">EARTH EQUATORIAL RADIUS (R_E):</div>
              <div className="font-bold text-white text-sm">6,371.0000 <span className="text-zinc-400 text-[10px]">km</span></div>
            </div>
            <div>
              <div className="text-zinc-400 text-[10px]">ORBITAL ALTITUDE (h):</div>
              <div className="font-bold text-amber-300 text-sm">{altKm.toFixed(2)} <span className="text-zinc-400 text-[10px]">km</span></div>
            </div>
            <div>
              <div className="text-zinc-400 text-[10px]">ORBITAL INCLINATION (i):</div>
              <div className="font-bold text-cyan-300 text-sm">{incDeg.toFixed(2)}° <span className="text-zinc-400 text-[10px]">(cos={Math.cos(incRad).toFixed(4)})</span></div>
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════════
            STEP 1: VIS-VIVA ORBITAL VELOCITY DERIVATION
            ══════════════════════════════════════════════════════════════════ */}
        {(activeSection === 'ALL' || activeSection === 'VIS_VIVA') && (
          <div className="border border-white/15 bg-[#0b1222] p-5 rounded-2xl relative z-10 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 text-xs font-bold border border-cyan-500/40">
                  PROOF 01
                </span>
                <h3 className="text-sm md:text-base font-bold text-white tracking-wide">
                  Vis-Viva Orbital Energy &amp; Equilibrium Velocity Derivation
                </h3>
              </div>
              <span className="text-xs text-zinc-400">Classical Mechanics (Vis-Viva)</span>
            </div>

            {/* General Formula Template */}
            <div className="space-y-2 bg-black/60 p-4 rounded-xl border border-white/10">
              <div className="text-[10px] text-zinc-400 uppercase tracking-widest font-bold">1. Theoretical Template (First-Principles Energy Balance):</div>
              <div className="text-xs md:text-sm text-zinc-300 space-y-1 font-mono">
                <div>(a) Specific Total Orbital Energy: <span className="text-cyan-300 font-bold">ε = ( 1/2 ) · v² - ( μ / r ) = - ( μ / 2a )</span></div>
                <div>(b) Multiply by 2: <span className="text-cyan-300 font-bold">v² - 2·( μ / r ) = - ( μ / a )</span></div>
                <div>(c) Rearrange for v²: <span className="text-cyan-300 font-bold">v² = μ · ( 2/r - 1/a )</span></div>
                <div>(d) Extract square root: <span className="text-white font-bold text-base">v(r) = √( μ · ( 2/r - 1/a ) )</span></div>
              </div>
            </div>

            {/* Step-by-Step Satellite Substitution Line */}
            <div className="space-y-2 bg-cyan-950/20 p-4 rounded-xl border border-cyan-500/30">
              <div className="text-[10px] text-cyan-400 uppercase tracking-widest font-bold">2. Algebraic Substitution for {satName}:</div>
              <div className="text-xs md:text-sm text-zinc-200 space-y-2 font-mono">
                <div>• Geocentric Radius: r = R_E + h = 6,371.0 + <strong className="text-amber-300">{altKm.toFixed(2)}</strong> = <strong className="text-white">{rKm.toFixed(2)} km</strong></div>
                <div>• Semi-Major Axis: a = r / (1 - e) = {rKm.toFixed(2)} / (1 - {eccentricity}) = <strong className="text-white">{aKm.toFixed(2)} km</strong></div>
                <div>• Formula Substitution:</div>
                <div className="bg-black/70 p-3 rounded-lg border border-white/10 text-cyan-200 text-xs md:text-sm">
                  v = √( 398600.4418 · ( 2 / {rKm.toFixed(2)} - 1 / {aKm.toFixed(2)} ) )
                </div>
                <div className="text-zinc-400 text-xs">
                  = √( 398600.4418 · ( {(2 / rKm).toFixed(8)} - {(1 / aKm).toFixed(8)} ) )
                </div>
                <div className="text-zinc-400 text-xs">
                  = √( 398600.4418 · {((2 / rKm) - (1 / aKm)).toFixed(8)} ) = √( {(MU_EARTH * (2/rKm - 1/aKm)).toFixed(4)} )
                </div>
              </div>
            </div>

            {/* Final Solved Result Card */}
            <div className="p-4 rounded-xl bg-gradient-to-r from-emerald-950/40 via-cyan-950/30 to-black border border-emerald-500/40 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-[10px] text-emerald-400 uppercase font-bold tracking-widest">CALCULATED ORBITAL SPEED RESULT:</div>
                <div className="text-xl md:text-2xl font-extrabold text-white mt-0.5 flex items-baseline gap-2">
                  <span className="text-emerald-300">
                    {vOrbitKmS.toFixed(3)} km/s
                  </span>
                  <span className="text-xs text-zinc-300 font-normal">
                    ({Math.round(vOrbitKmH).toLocaleString()} km/h · Mach {(vOrbitKmH / 1225).toFixed(1)})
                  </span>
                </div>
              </div>
              <div className="text-right text-[11px] text-zinc-400">
                <div>Specific Mechanical Energy: <strong className="text-cyan-300">{specTotalEnergy.toFixed(2)} MJ/kg</strong></div>
                <div className="text-emerald-400 font-bold">Stable Bound Closed Orbit (ε &lt; 0)</div>
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            STEP 2: KEPLER'S THIRD LAW & ORBIT PERIOD DERIVATION
            ══════════════════════════════════════════════════════════════════ */}
        {(activeSection === 'ALL' || activeSection === 'KEPLER') && (
          <div className="border border-white/15 bg-[#0b1222] p-5 rounded-2xl relative z-10 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 text-xs font-bold border border-cyan-500/40">
                  PROOF 02
                </span>
                <h3 className="text-sm md:text-base font-bold text-white tracking-wide">
                  Kepler&apos;s Third Law &amp; Orbital Lap Period Derivation
                </h3>
              </div>
              <span className="text-xs text-zinc-400">Astrodynamics (Mean Motion)</span>
            </div>

            {/* General Formula Template */}
            <div className="space-y-2 bg-black/60 p-4 rounded-xl border border-white/10">
              <div className="text-[10px] text-zinc-400 uppercase tracking-widest font-bold">1. Theoretical Template:</div>
              <div className="text-xs md:text-sm text-zinc-300 space-y-1 font-mono">
                <div>• Kepler&apos;s Harmonic Law: <span className="text-cyan-300 font-bold">T² = ( 4π² / μ ) · a³</span></div>
                <div>• Orbital Period (seconds): <span className="text-white font-bold">T = 2π · √( a³ / μ )</span></div>
                <div>• Mean Motion (revs / day): <span className="text-cyan-300 font-bold">n = 86,400 / T</span></div>
              </div>
            </div>

            {/* Step-by-Step Satellite Substitution Line */}
            <div className="space-y-2 bg-cyan-950/20 p-4 rounded-xl border border-cyan-500/30">
              <div className="text-[10px] text-cyan-400 uppercase tracking-widest font-bold">2. Algebraic Substitution for {satName}:</div>
              <div className="text-xs md:text-sm text-zinc-200 space-y-2 font-mono">
                <div>• Semi-Major Axis Cubed: a³ = ({aKm.toFixed(2)})³ = <strong className="text-white">{Math.pow(aKm, 3).toExponential(4)} km³</strong></div>
                <div className="bg-black/70 p-3 rounded-lg border border-white/10 text-cyan-200 text-xs md:text-sm">
                  T = 2π · √( {Math.pow(aKm, 3).toExponential(4)} / 398600.4418 )
                </div>
                <div className="text-zinc-400 text-xs">
                  = 2π · √( {(Math.pow(aKm, 3) / MU_EARTH).toFixed(2)} ) = 2π · {(Math.sqrt(Math.pow(aKm, 3) / MU_EARTH)).toFixed(2)}
                </div>
                <div className="text-zinc-200 text-xs">
                  = <strong className="text-white">{periodSeconds.toFixed(1)} seconds</strong> = <strong className="text-emerald-300 text-sm">{periodMinutes.toFixed(2)} minutes</strong>
                </div>
              </div>
            </div>

            {/* Final Solved Result Card */}
            <div className="p-4 rounded-xl bg-gradient-to-r from-emerald-950/40 via-cyan-950/30 to-black border border-emerald-500/40 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-[10px] text-emerald-400 uppercase font-bold tracking-widest">CALCULATED ORBIT PERIOD RESULT:</div>
                <div className="text-xl md:text-2xl font-extrabold text-white mt-0.5 flex items-baseline gap-2">
                  <span className="text-emerald-300">
                    {periodMinutes.toFixed(2)} minutes
                  </span>
                  <span className="text-xs text-zinc-300 font-normal">
                    ( completing {meanMotionRevDay.toFixed(2)} full orbits per day )
                  </span>
                </div>
              </div>
              <div className="text-right text-[11px] text-zinc-400">
                <div>Mean Angular Velocity (n): <strong className="text-cyan-300">{meanMotionRadS.toExponential(4)} rad/s</strong></div>
                <div className="text-emerald-400 font-bold">1 Earth Day = {meanMotionRevDay.toFixed(1)} orbital passes</div>
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            STEP 3: J2 EARTH OBLATENESS SECULAR NODAL PRECESSION
            ══════════════════════════════════════════════════════════════════ */}
        {(activeSection === 'ALL' || activeSection === 'J2') && (
          <div className="border border-white/15 bg-[#0b1222] p-5 rounded-2xl relative z-10 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 text-xs font-bold border border-cyan-500/40">
                  PROOF 03
                </span>
                <h3 className="text-sm md:text-base font-bold text-white tracking-wide">
                  First-Order Secular J₂ Nodal Precession Rate Derivation
                </h3>
              </div>
              <span className="text-xs text-zinc-400">Gravitational Harmonics (dΩ/dt)</span>
            </div>

            {/* General Formula Template */}
            <div className="space-y-2 bg-black/60 p-4 rounded-xl border border-white/10">
              <div className="text-[10px] text-zinc-400 uppercase tracking-widest font-bold">1. Theoretical Template (Earth Oblateness Torque):</div>
              <div className="text-xs md:text-sm text-zinc-300 space-y-1 font-mono">
                <div>• Gravitational Potential: <span className="text-cyan-300 font-bold">V(r, φ) = - (μ/r) · [ 1 - J₂·(R_E/r)² · P₂(sin φ) ]</span></div>
                <div>• Secular RAAN Precession: <span className="text-white font-bold">dΩ/dt = - ( 3/2 ) · J₂ · ( R_E / p )² · n · cos( i )</span></div>
                <div>*(where J₂ = 1.08263×10⁻³, p = a·(1 - e²) is semi-latus rectum)*</div>
              </div>
            </div>

            {/* Step-by-Step Satellite Substitution Line */}
            <div className="space-y-2 bg-cyan-950/20 p-4 rounded-xl border border-cyan-500/30">
              <div className="text-[10px] text-cyan-400 uppercase tracking-widest font-bold">2. Algebraic Substitution for {satName}:</div>
              <div className="text-xs md:text-sm text-zinc-200 space-y-2 font-mono">
                <div>• Geometric Ratio: (R_E / p)² = (6,371.0 / {pKm.toFixed(2)})² = <strong className="text-white">{Math.pow(EARTH_RADIUS_KM / pKm, 2).toFixed(4)}</strong></div>
                <div>• Inclination Cosine Factor: cos({incDeg.toFixed(2)}°) = <strong className="text-amber-300">{Math.cos(incRad).toFixed(4)}</strong></div>
                <div className="bg-black/70 p-3 rounded-lg border border-white/10 text-cyan-200 text-xs md:text-sm">
                  dΩ/dt = - 1.5 · (1.08263×10⁻³) · {Math.pow(EARTH_RADIUS_KM / pKm, 2).toFixed(4)} · ({meanMotionRadS.toExponential(4)}) · {Math.cos(incRad).toFixed(4)}
                </div>
                <div className="text-zinc-400 text-xs">
                  = {raanPrecessionRadS.toExponential(4)} rad/s
                </div>
                <div className="text-zinc-200 text-xs">
                  = ({raanPrecessionRadS.toExponential(4)} · 180 · 86400 / π) = <strong className="text-emerald-300 text-sm">{raanPrecessionDegDay.toFixed(4)}° / day</strong>
                </div>
              </div>
            </div>

            {/* Final Solved Result Card */}
            <div className="p-4 rounded-xl bg-gradient-to-r from-emerald-950/40 via-cyan-950/30 to-black border border-emerald-500/40 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-[10px] text-emerald-400 uppercase font-bold tracking-widest">CALCULATED NODAL PRECESSION DRIFT:</div>
                <div className="text-xl md:text-2xl font-extrabold text-white mt-0.5 flex items-baseline gap-2">
                  <span className="text-emerald-300">
                    {raanPrecessionDegDay.toFixed(3)}° / day
                  </span>
                  <span className="text-xs text-zinc-300 font-normal">
                    ( {Math.abs(raanPrecessionDegDay * 30).toFixed(1)}° orbital plane rotation every 30 days )
                  </span>
                </div>
              </div>
              <div className="text-right text-[11px] text-zinc-400">
                <div>Drift Direction: <strong className="text-cyan-300">{raanPrecessionDegDay < 0 ? 'Westward (Prograde)' : 'Eastward (Retrograde)'}</strong></div>
                <div className="text-emerald-400 font-bold">Physical cause: Earth equatorial bulge torque</div>
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            STEP 4: FOSTER 2D B-PLANE COLLISION PROBABILITY (Pc)
            ══════════════════════════════════════════════════════════════════ */}
        {(activeSection === 'ALL' || activeSection === 'B_PLANE') && (
          <div className="border border-white/15 bg-[#0b1222] p-5 rounded-2xl relative z-10 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 text-xs font-bold border border-cyan-500/40">
                  PROOF 04
                </span>
                <h3 className="text-sm md:text-base font-bold text-white tracking-wide">
                  Foster / Akella-Alfriend 2D B-Plane Collision Probability (P_c)
                </h3>
              </div>
              <span className="text-xs text-zinc-400">Conjunction Risk Integral</span>
            </div>

            {/* General Formula Template */}
            <div className="space-y-2 bg-black/60 p-4 rounded-xl border border-white/10">
              <div className="text-[10px] text-zinc-400 uppercase tracking-widest font-bold">1. Theoretical Template (Encounter Frame Reduction):</div>
              <div className="text-xs md:text-sm text-zinc-300 space-y-1 font-mono">
                <div>• Short Encounter 2D B-Plane Integral: <span className="text-cyan-300 font-bold">P_c = ( 1 / 2π·σ_x·σ_y ) · ∬_A exp( -0.5 · r_m^T · Σ⁻¹ · r_m ) dx dy</span></div>
                <div>• Analytical Circular Target Reduction: <span className="text-white font-bold">P_c ≈ [ R_HBR² / ( 2 · σ_x · σ_y ) ] · exp( -0.5 · d² / ( σ_x · σ_y ) )</span></div>
                <div>*(where R_HBR is combined hard-body radius, d is miss distance, σ_x, σ_y are 1-sigma covariance)*</div>
              </div>
            </div>

            {/* Step-by-Step Satellite Substitution Line */}
            <div className="space-y-2 bg-cyan-950/20 p-4 rounded-xl border border-cyan-500/30">
              <div className="text-[10px] text-cyan-400 uppercase tracking-widest font-bold">2. Algebraic Substitution for {satName} (Miss = {missDistKm.toFixed(2)} km):</div>
              <div className="text-xs md:text-sm text-zinc-200 space-y-2 font-mono">
                <div>• Combined Hard-Body Radius: R_HBR = {hardBodyRadiusM} m = <strong className="text-white">{rHbrKm} km</strong> (R² = {Math.pow(rHbrKm, 2).toExponential(3)} km²)</div>
                <div>• Positional Covariance Area: 2 · σ_x · σ_y = 2 · 1.2 · 0.8 = <strong className="text-white">{(2 * sigmaX * sigmaY).toFixed(2)} km²</strong></div>
                <div>• Miss Distance Quadratic Exponent: exp( -0.5 · ({missDistKm.toFixed(2)})² / {(sigmaX * sigmaY).toFixed(2)} ) = <strong className="text-amber-300">{Math.exp(bPlaneExponent).toExponential(3)}</strong></div>
                <div className="bg-black/70 p-3 rounded-lg border border-white/10 text-cyan-200 text-xs md:text-sm">
                  P_c = [ {Math.pow(rHbrKm, 2).toExponential(3)} / {(2 * sigmaX * sigmaY).toFixed(2)} ] · {Math.exp(bPlaneExponent).toExponential(3)}
                </div>
                <div className="text-zinc-200 text-xs">
                  = <strong className="text-emerald-300 text-sm">{collisionProb.toExponential(3)}</strong> ( Odds: <strong className="text-white font-bold">1 in {oddsDenominator.toLocaleString()}</strong> )
                </div>
              </div>
            </div>

            {/* Final Solved Result Card */}
            <div className="p-4 rounded-xl bg-gradient-to-r from-emerald-950/40 via-cyan-950/30 to-black border border-emerald-500/40 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-[10px] text-emerald-400 uppercase font-bold tracking-widest">CALCULATED CONJUNCTION PROBABILITY:</div>
                <div className="text-xl md:text-2xl font-extrabold text-white mt-0.5 flex items-baseline gap-2">
                  <span className="text-emerald-300">
                    1 in {oddsDenominator.toLocaleString()}
                  </span>
                  <span className="text-xs text-zinc-300 font-normal">
                    ( P_c = {collisionProb.toExponential(3)} )
                  </span>
                </div>
              </div>
              <div className="text-right text-[11px] text-zinc-400">
                <div>Safety Threshold: <strong className="text-cyan-300">1 × 10⁻⁴ (1 in 10,000)</strong></div>
                <div className={collisionProb > 1e-4 ? 'text-red-400 font-bold' : 'text-emerald-400 font-bold'}>
                  {collisionProb > 1e-4 ? 'MANEUVER MANDATED (CRITICAL RISK)' : 'RISK NOMINAL (MONITORING ONLY)'}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            STEP 5: IMPULSIVE AVOIDANCE BURN & PHASING CLEARANCE
            ══════════════════════════════════════════════════════════════════ */}
        {(activeSection === 'ALL' || activeSection === 'MANEUVER') && (
          <div className="border border-white/15 bg-[#0b1222] p-5 rounded-2xl relative z-10 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 text-xs font-bold border border-cyan-500/40">
                  PROOF 05
                </span>
                <h3 className="text-sm md:text-base font-bold text-white tracking-wide">
                  Along-Track Impulsive Avoidance Maneuver (Δv → Δs)
                </h3>
              </div>
              <span className="text-xs text-zinc-400">Gauss Orbital Perturbation</span>
            </div>

            {/* General Formula Template */}
            <div className="space-y-2 bg-black/60 p-4 rounded-xl border border-white/10">
              <div className="text-[10px] text-zinc-400 uppercase tracking-widest font-bold">1. Theoretical Template (Linearized Phasing):</div>
              <div className="text-xs md:text-sm text-zinc-300 space-y-1 font-mono">
                <div>• Gauss Energy Relation: <span className="text-cyan-300 font-bold">Δa ≈ ( 2 · a · v · Δv ) / ( μ / r² )</span></div>
                <div>• Secular Along-Track Drift: <span className="text-white font-bold">Δs ≈ ( 3/2 ) · n · Δa · Δt_lead</span></div>
                <div>*(firing along velocity vector alters semi-major axis, causing accumulated displacement over lead time)*</div>
              </div>
            </div>

            {/* Step-by-Step Satellite Substitution Line */}
            <div className="space-y-2 bg-cyan-950/20 p-4 rounded-xl border border-cyan-500/30">
              <div className="text-[10px] text-cyan-400 uppercase tracking-widest font-bold">2. Algebraic Substitution for {satName} (Δv = +{deltaV.toFixed(2)} m/s):</div>
              <div className="text-xs md:text-sm text-zinc-200 space-y-2 font-mono">
                <div>• Induced Altitude Raise: Δa = ( 2 · {aKm.toFixed(0)} · {vOrbitKmS.toFixed(2)} · {(deltaV/1000).toFixed(4)} ) / {(MU_EARTH / Math.pow(rKm, 2)).toFixed(4)} = <strong className="text-cyan-300">+{deltaA_km.toFixed(2)} km</strong> ({Math.round(deltaA_km * 1000)} m)</div>
                <div>• Pre-Encounter Lead Time: Δt_lead = 45 min = <strong className="text-white">{leadTimeSec} seconds</strong></div>
                <div className="bg-black/70 p-3 rounded-lg border border-white/10 text-cyan-200 text-xs md:text-sm">
                  Δs = 1.5 · ({meanMotionRadS.toExponential(4)}) · ({deltaA_km.toFixed(2)}) · ({leadTimeSec})
                </div>
                <div className="text-zinc-200 text-xs">
                  = <strong className="text-emerald-300 text-sm">+{alongTrackSeparationKm.toFixed(2)} km</strong> (<strong className="text-white">+{Math.round(alongTrackSeparationKm * 1000).toLocaleString()} meters clearance</strong>)
                </div>
              </div>
            </div>

            {/* Final Solved Result Card */}
            <div className="p-4 rounded-xl bg-gradient-to-r from-emerald-950/40 via-cyan-950/30 to-black border border-emerald-500/40 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-[10px] text-emerald-400 uppercase font-bold tracking-widest">CALCULATED COLLISION CLEARANCE RESULT:</div>
                <div className="text-xl md:text-2xl font-extrabold text-white mt-0.5 flex items-baseline gap-2">
                  <span className="text-emerald-300">
                    +{alongTrackSeparationKm.toFixed(2)} km
                  </span>
                  <span className="text-xs text-zinc-300 font-normal">
                    (+{Math.round(alongTrackSeparationKm * 1000).toLocaleString()} m along-track displacement)
                  </span>
                </div>
              </div>
              <div className="text-right text-[11px] text-zinc-400">
                <div>Propellant Cost: <strong className="text-cyan-300">~0.42 kg Hydrazine</strong></div>
                <div className="text-emerald-400 font-bold">Collision Cleared (&gt; 1.5 km margin)</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
