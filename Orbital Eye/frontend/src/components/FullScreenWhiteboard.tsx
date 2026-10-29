import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { motion } from 'framer-motion';
import AnimatedEquation from './whiteboard/AnimatedEquation';
import {
  visViva,
  keplerPeriod,
  j2NodalPrecession,
  collisionProbabilityFoster,
  avoidanceManeuver,
  sciTex,
} from '../utils/orbitalMath';

interface SatellitePosition {
  norad_id: number;
  name: string;
  x: number;
  y: number;
  z: number;
  lat_deg: number;
  lon_deg: number;
  alt_km: number;
  velocity_kms: number;
  inclination_deg: number;
  dataset_tag: string;
  risk_category: 'CRITICAL' | 'CAUTION' | 'NOMINAL';
}

interface FullScreenWhiteboardProps {
  satellites: SatellitePosition[];
  onClose: () => void;
}

interface FlatEquation {
  tex: string;
  label: string;
  stages: { highlight: string; delay: number; value?: string; label?: string }[];
  resultColor: string;
  sectionId: string;
  sectionLabel: string;
}

const EARTH_RADIUS_KM = 6371.0;
const MU_EARTH = 398600.4418;
const J2_COEFF = 1.08263e-3;

export default function FullScreenWhiteboard({
  satellites,
  onClose,
}: FullScreenWhiteboardProps) {
  // Top-level hooks declared unconditionally
  const [satIdx, setSatIdx] = useState<number>(0);
  const [activeEq, setActiveEq] = useState<number>(0);
  const [runId, setRunId] = useState<number>(0);
  const [userHasScrolledUp, setUserHasScrolledUp] = useState<boolean>(false);

  const canvasRef = useRef<HTMLDivElement>(null);
  const streamRef = useRef<HTMLDivElement>(null);
  const activeCardRef = useRef<HTMLDivElement>(null);
  const isUserScrolledRef = useRef<boolean>(false);

  // Safe satellite reference
  const hasSatellites = Boolean(satellites && satellites.length > 0);
  const safeSatIdx = Math.min(satIdx, hasSatellites ? satellites.length - 1 : 0);
  const satellite = hasSatellites ? (satellites[safeSatIdx] || satellites[0]) : null;

  const altKm = satellite?.alt_km ?? 420;
  const incDeg = satellite?.inclination_deg || 51.64;
  const eccentricity = 0.00068;
  const missDistKm = 0.42;
  const deltaV = 0.35;

  // Live Calculations
  const visVivaResult = useMemo(
    () => visViva(MU_EARTH, altKm, EARTH_RADIUS_KM, eccentricity),
    [altKm, eccentricity]
  );
  const rKm = visVivaResult.radiusKm;
  const aKm = visVivaResult.semiMajorAxisKm;
  const vOrbitKmS = visVivaResult.speedKmS;
  const specTotalEnergy = visVivaResult.specificEnergyMJkg;

  const keplerResult = useMemo(() => keplerPeriod(MU_EARTH, aKm), [aKm]);
  const periodSeconds = keplerResult.periodSeconds;
  const periodMinutes = keplerResult.periodMinutes;
  const meanMotionRadS = keplerResult.meanMotionRadS;
  const meanMotionRevDay = keplerResult.meanMotionRevDay;

  const j2Result = useMemo(
    () => j2NodalPrecession(J2_COEFF, EARTH_RADIUS_KM, aKm, eccentricity, meanMotionRadS, incDeg),
    [aKm, eccentricity, meanMotionRadS, incDeg]
  );
  const pKm = j2Result.semiLatusRectumKm;
  const raanPrecessionDegDay = j2Result.raanPrecessionDegDay;
  const incRad = (incDeg * Math.PI) / 180;

  const collisionResult = useMemo(
    () => collisionProbabilityFoster({
      missDistKm,
      hardBodyRadiusM: 15.0,
      sigmaXKm: 1.2,
      sigmaYKm: 0.8,
    }),
    [missDistKm]
  );
  const rHbrKm = collisionResult.hardBodyRadiusKm;
  const collisionProb = collisionResult.pc;
  const oddsDenominator = collisionResult.oddsOneIn;
  const bPlaneExponent = -0.5 * (missDistKm * missDistKm) / (collisionResult.sigmaX * collisionResult.sigmaY);

  const avoidanceResult = useMemo(
    () => avoidanceManeuver({
      deltaVms: deltaV,
      semiMajorAxisKm: aKm,
      speedKmS: vOrbitKmS,
      radiusKm: rKm,
      muKm3s2: MU_EARTH,
      meanMotionRadS,
    }),
    [deltaV, aKm, vOrbitKmS, rKm, meanMotionRadS]
  );
  const deltaA_km = avoidanceResult.deltaAKm;
  const leadTimeSec = avoidanceResult.leadTimeSec;
  const alongTrackSeparationKm = avoidanceResult.alongTrackKm;

  const satName = satellite?.name ?? 'TARGET SATELLITE';

  const allSections = useMemo(
    () => [
      {
        id: 'VIS_VIVA',
        label: 'Vis-Viva Orbital Energy & Equilibrium Velocity',
        equations: [
          {
            tex: `\\varepsilon = \\frac{1}{2}v^2 - \\frac{\\mu}{r} = -\\frac{\\mu}{2a}\\implies v(r) = \\sqrt{\\mu\\left(\\frac{2}{r} - \\frac{1}{a}\\right)}`,
            label: 'First-Principles Energy Balance',
            stages: [
              { highlight: '\\varepsilon', delay: 700, value: fix(specTotalEnergy, 2) + ' MJ/kg', label: 'Specific orbital energy' },
              { highlight: 'v(r)', delay: 1200, value: fix(vOrbitKmS, 3) + ' km/s', label: 'Equilibrium orbital speed' },
            ],
            resultColor: 'emerald',
          },
          {
            tex: `a = \\frac{r}{1-e} = \\frac{${fix(rKm, 2)}}{1 - ${eccentricity}} = ${fix(aKm, 2)}\\text{ km}\\implies v = \\sqrt{\\mu\\left(\\frac{2}{${fix(rKm, 2)}} - \\frac{1}{${fix(aKm, 2)}}\\right)}`,
            label: `Algebraic Substitution for ${satName}`,
            stages: [
              { highlight: 'a', delay: 700, value: fix(aKm, 2) + ' km', label: 'Semi-major axis' },
              { highlight: 'v', delay: 1200, value: fix(vOrbitKmS, 3) + ' km/s', label: 'Calculated speed' },
            ],
            resultColor: 'emerald',
          },
        ],
      },
      {
        id: 'KEPLER',
        label: "Kepler's Third Law & Orbital Period",
        equations: [
          {
            tex: `T^2 = \\frac{4\\pi^2}{\\mu} a^3\\implies T = 2\\pi\\sqrt{\\frac{a^3}{\\mu}}\\implies n = \\frac{86{,}400}{T}`,
            label: "Kepler's Harmonic Law",
            stages: [
              { highlight: 'T', delay: 700, value: fix(periodMinutes, 2) + ' min', label: 'Orbital period' },
              { highlight: 'n', delay: 1200, value: fix(meanMotionRevDay, 2) + ' rev/day', label: 'Revolutions per day' },
            ],
            resultColor: 'emerald',
          },
          {
            tex: `T = 2\\pi\\sqrt{\\frac{${fix(Math.pow(aKm, 3), 4)}}{398{,}600.4418}} = ${fix(periodSeconds, 1)}\\text{ s} = ${fix(periodMinutes, 2)}\\text{ min}\\implies n = ${fix(meanMotionRevDay, 2)}\\text{ rev/day}`,
            label: `Algebraic Substitution for ${satName}`,
            stages: [
              { highlight: 'T', delay: 700, value: fix(periodMinutes, 2) + ' min', label: 'Period result' },
              { highlight: 'n', delay: 1200, value: fix(meanMotionRevDay, 2) + ' rev/day', label: 'Daily orbit count' },
            ],
            resultColor: 'emerald',
          },
        ],
      },
      {
        id: 'J2',
        label: 'J₂ Secular Nodal Precession',
        equations: [
          {
            tex: `\\frac{d\\Omega}{dt} = -\\frac{3}{2} \\cdot J_2 \\cdot \\left(\\frac{R_E}{p}\\right)^2 \\cdot n \\cdot \\cos(i)\\quad (J_2 = 1.08263\\times 10^{-3})`,
            label: 'Earth Oblateness Torque',
            stages: [
              { highlight: 'J_2', delay: 700, value: '1.08263×10⁻³', label: 'Oblateness coefficient' },
              { highlight: '\\frac{d\\Omega}{dt}', delay: 1200, value: fix(raanPrecessionDegDay, 3) + '°/day', label: 'Nodal precession rate' },
            ],
            resultColor: 'emerald',
          },
          {
            tex: `\\frac{d\\Omega}{dt} = -1.5 \\cdot (1.08263\\times 10^{-3}) \\cdot \\left(\\frac{6{,}371.0}{${fix(pKm, 2)}}\\right)^2 \\cdot ${meanMotionRadS.toExponential(4)} \\cdot ${Math.cos(incRad).toFixed(4)} = ${fix(raanPrecessionDegDay, 3)}^\\circ\\text{/day}`,
            label: `Algebraic Substitution for ${satName}`,
            stages: [
              { highlight: 'p', delay: 700, value: fix(pKm, 2) + ' km', label: 'Semi-latus rectum' },
              { highlight: '\\frac{d\\Omega}{dt}', delay: 1200, value: fix(raanPrecessionDegDay, 3) + '°/day', label: 'Precession drift' },
            ],
            resultColor: 'emerald',
          },
        ],
      },
      {
        id: 'B_PLANE',
        label: 'B-Plane Collision Probability',
        equations: [
          {
            tex: `P_c \\approx \\frac{R_{HBR}^2}{2 \\cdot \\sigma_x \\cdot \\sigma_y} \\cdot \\exp\\left(-0.5 \\cdot \\frac{d^2}{\\sigma_x \\cdot \\sigma_y}\\right)`,
            label: 'Foster / Akella-Alfriend Reduction',
            stages: [
              { highlight: 'P_c', delay: 700, value: sciTex(collisionProb, 2), label: 'Collision probability' },
              { highlight: 'd', delay: 1200, value: fix(missDistKm, 2) + ' km', label: 'Miss distance' },
            ],
            resultColor: collisionProb > 1e-4 ? 'red' : 'emerald',
          },
          {
            tex: `P_c = \\left[\\frac{${fix(rHbrKm * rHbrKm, 4)}}{${fix(2 * collisionResult.sigmaX * collisionResult.sigmaY, 2)}}\\right] \\cdot \\exp(${fix(bPlaneExponent, 4)}) = ${sciTex(collisionProb, 3)} (1 in ${oddsDenominator.toLocaleString()})`,
            label: `Algebraic Substitution for ${satName}`,
            stages: [
              { highlight: 'R_{HBR}', delay: 700, value: fix(rHbrKm * 1000, 0) + ' m', label: 'Hard-body radius' },
              { highlight: '\\sigma_x', delay: 800, value: fix(collisionResult.sigmaX, 1) + ' km', label: 'Along-track covariance' },
              { highlight: '\\sigma_y', delay: 800, value: fix(collisionResult.sigmaY, 1) + ' km', label: 'Cross-track covariance' },
              { highlight: 'P_c', delay: 1200, value: sciTex(collisionProb, 3), label: 'Final probability' },
            ],
            resultColor: collisionProb > 1e-4 ? 'red' : 'emerald',
          },
        ],
      },
      {
        id: 'MANEUVER',
        label: 'Impulsive Avoidance Maneuver (Δv → Δs)',
        equations: [
          {
            tex: `\\Delta a \\approx \\frac{2 \\cdot a \\cdot v \\cdot \\Delta v}{\\mu / r^2}\\implies \\Delta s \\approx \\frac{3}{2} \\cdot n \\cdot \\Delta a \\cdot \\Delta t_{lead}`,
            label: 'Gauss Linearized Phasing',
            stages: [
              { highlight: '\\Delta v', delay: 700, value: fix(deltaV, 2) + ' m/s', label: 'Thruster burn magnitude' },
              { highlight: '\\Delta s', delay: 1200, value: fix(alongTrackSeparationKm, 2) + ' km', label: 'Along-track clearance' },
            ],
            resultColor: 'emerald',
          },
          {
            tex: `\\Delta a = \\frac{2 \\cdot ${fix(aKm, 0)} \cdot ${fix(vOrbitKmS, 2)} \cdot ${fix(deltaV / 1000, 4)}}{${fix(MU_EARTH / (rKm * rKm), 4)}} = +${fix(deltaA_km, 2)}\\text{ km}\\implies \\Delta s = 1.5 \\cdot ${meanMotionRadS.toExponential(4)} \cdot ${fix(deltaA_km, 2)} \cdot ${leadTimeSec} = +${fix(alongTrackSeparationKm, 2)}\\text{ km}`,
            label: `Algebraic Substitution for ${satName}`,
            stages: [
              { highlight: '\\Delta a', delay: 700, value: '+' + fix(deltaA_km, 2) + ' km', label: 'Semi-major axis change' },
              { highlight: '\\Delta s', delay: 1200, value: '+' + fix(alongTrackSeparationKm, 2) + ' km', label: 'Along-track displacement' },
            ],
            resultColor: 'emerald',
          },
        ],
      },
    ],
    [
      specTotalEnergy, vOrbitKmS, rKm, eccentricity, aKm, satName,
      periodMinutes, meanMotionRevDay, periodSeconds,
      raanPrecessionDegDay, pKm, meanMotionRadS, incRad,
      collisionProb, missDistKm, rHbrKm, collisionResult, bPlaneExponent, oddsDenominator,
      deltaV, alongTrackSeparationKm, deltaA_km, leadTimeSec,
    ]
  );

  // Flatten every section into one continuous writing stream
  const flatEquations: FlatEquation[] = useMemo(() => {
    const list: FlatEquation[] = [];
    allSections.forEach((sec) => {
      sec.equations.forEach((eq) => {
        list.push({
          tex: eq.tex,
          label: eq.label,
          stages: eq.stages,
          resultColor: eq.resultColor,
          sectionId: sec.id,
          sectionLabel: sec.label,
        });
      });
    });
    return list;
  }, [allSections]);

  const total = flatEquations.length;
  const current = Math.min(activeEq, Math.max(0, total - 1));
  const isComplete = total > 0 && activeEq >= total;

  // Stable advance callback
  const advance = useCallback(() => {
    setActiveEq((a) => a + 1);
  }, []);

  // When whole board is complete, pause 5s then replay
  useEffect(() => {
    if (total === 0 || activeEq < total) return;
    const timer = setTimeout(() => {
      isUserScrolledRef.current = false;
      setUserHasScrolledUp(false);
      setRunId((r) => r + 1);
      setActiveEq(0);
      canvasRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    }, 5000);
    return () => clearTimeout(timer);
  }, [activeEq, total]);

  // Detect manual user scrolling
  const handleScroll = useCallback(() => {
    const el = canvasRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - (el.scrollTop + el.clientHeight);
    const scrolledAway = distanceFromBottom > 120;
    if (scrolledAway !== isUserScrolledRef.current) {
      isUserScrolledRef.current = scrolledAway;
      setUserHasScrolledUp(scrolledAway);
    }
  }, []);

  // Smooth card scroll into view when active equation changes
  useEffect(() => {
    if (!isUserScrolledRef.current && activeCardRef.current) {
      const timer = setTimeout(() => {
        if (!isUserScrolledRef.current && activeCardRef.current) {
          activeCardRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }, 60);
      return () => clearTimeout(timer);
    }
  }, [activeEq]);

  // Keep active card in view as equation animates/expands
  useEffect(() => {
    const stream = streamRef.current;
    if (!stream) return;

    let rafId: number;
    const ro = new ResizeObserver(() => {
      if (isUserScrolledRef.current) return;
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        if (!isUserScrolledRef.current && activeCardRef.current) {
          activeCardRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      });
    });

    ro.observe(stream);
    return () => {
      cancelAnimationFrame(rafId);
      ro.disconnect();
    };
  }, [activeEq, runId]);

  const restart = useCallback(() => {
    isUserScrolledRef.current = false;
    setUserHasScrolledUp(false);
    setRunId((r) => r + 1);
    setActiveEq(0);
    canvasRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const selectSatellite = useCallback((idx: number) => {
    setSatIdx(idx);
    isUserScrolledRef.current = false;
    setUserHasScrolledUp(false);
    setRunId((r) => r + 1);
    setActiveEq(0);
    canvasRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const resumeAutoscroll = useCallback(() => {
    isUserScrolledRef.current = false;
    setUserHasScrolledUp(false);
    if (activeCardRef.current) {
      activeCardRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, []);

  // Guard rendered after all hooks have run
  if (!satellite || !hasSatellites) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-500 text-lg">
        Loading satellite data... Please wait.
      </div>
    );
  }

  const progressPct = total > 0 ? ((isComplete ? total : current + 1) / total) * 100 : 0;
  const currentSectionLabel = flatEquations[current]?.sectionLabel ?? '';

  return (
    <div className="flex-1 flex flex-col bg-white min-h-0 overflow-hidden relative">
      {/* Top bar */}
      <div className="shrink-0 flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-white">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-100 text-blue-600 border border-blue-200">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>
          </div>
          <div>
            <div className="text-sm font-bold text-gray-900 tracking-tight">Orbital Mechanics Whiteboard</div>
            <div className="text-xs text-gray-500">Self-solving first-principles derivations — writes itself, live</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Satellites tracked:</span>
          <span className="text-sm font-semibold text-gray-900">{satellites.length}</span>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-md border border-gray-300 bg-white hover:bg-gray-50 text-sm text-gray-700 font-medium transition-colors cursor-pointer"
          >
            Close Whiteboard
          </button>
        </div>
      </div>

      {/* Satellite selector bar */}
      <div className="shrink-0 px-6 py-3 border-b border-gray-200 bg-white overflow-x-auto">
        <div className="flex gap-2">
          {satellites.map((s, i) => {
            const isSelected = i === safeSatIdx;
            const riskColor = s.risk_category === 'CRITICAL' ? 'bg-red-500' : s.risk_category === 'CAUTION' ? 'bg-amber-500' : 'bg-emerald-500';
            return (
              <button
                key={s.norad_id}
                type="button"
                onClick={() => selectSatellite(i)}
                className={`flex items-center gap-2 px-3 py-2 rounded-md border text-left transition-all cursor-pointer ${
                  isSelected
                    ? 'border-blue-500 bg-blue-50/50 text-blue-900 font-bold shadow-sm'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${riskColor}`}></span>
                <span className="text-sm font-medium">{s.name}</span>
                <span className="text-xs text-gray-400 font-mono">NORAD {s.norad_id}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Auto-solving status bar */}
      <div className="shrink-0 px-6 py-2.5 border-b border-gray-100 bg-white flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-xs text-gray-600">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-600"></span>
          </span>
          <span className="font-semibold text-gray-900">
            {isComplete ? 'Derivation complete — replaying shortly' : 'Auto-solving'}
          </span>
          <span className="text-gray-300">·</span>
          <span>Line {Math.min(current + 1, total)} of {total}</span>
          <span className="text-gray-300">·</span>
          <span className="font-medium text-blue-600">{currentSectionLabel}</span>
          <span className="text-gray-300">·</span>
          <span className="font-medium text-gray-700">{satellite.name} (NORAD {satellite.norad_id})</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-40 h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-600 rounded-full transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            ></div>
          </div>
          <button
            type="button"
            onClick={restart}
            className="px-2.5 py-1 rounded-md border border-gray-300 bg-white text-xs text-gray-600 hover:bg-gray-50 font-medium cursor-pointer"
          >
            ↻ Replay
          </button>
        </div>
      </div>

      {/* Whiteboard canvas — smooth targeted auto-scroll */}
      <div
        ref={canvasRef}
        onScroll={handleScroll}
        className="flex-1 px-6 md:px-10 pt-6 pb-28 bg-white overflow-y-auto min-h-0"
      >
        <div className="max-w-4xl mx-auto">
          {/* Given state */}
          <div className="p-3.5 bg-gray-50 border border-gray-200 rounded-xl">
            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Given State Vector</div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs text-gray-600">
              <div>
                <div className="text-gray-400">μ (Geocentric Constant)</div>
                <div className="text-gray-900 font-mono">398,600.4418 km³/s²</div>
              </div>
              <div>
                <div className="text-gray-400">R_E (Earth Radius)</div>
                <div className="text-gray-900 font-mono">6,371.0000 km</div>
              </div>
              <div>
                <div className="text-gray-400">h (Altitude)</div>
                <div className="text-blue-600 font-mono font-bold">{fix(altKm, 2)} km</div>
              </div>
              <div>
                <div className="text-gray-400">i (Inclination)</div>
                <div className="text-blue-600 font-mono font-bold">{fix(incDeg, 2)}°</div>
              </div>
            </div>
          </div>

          {/* Writing stream */}
          <div ref={streamRef} className="mt-6 space-y-5 wb-writing-stream">
            {flatEquations.slice(0, Math.min(activeEq + 1, total)).map((eq, i) => {
              const isActive = i === activeEq;
              const prevSectionId = i > 0 ? flatEquations[i - 1].sectionId : null;
              const isSectionStart = eq.sectionId !== prevSectionId;
              const sectionNum = allSections.findIndex((s) => s.id === eq.sectionId) + 1;
              const sectionDone = flatEquations.slice(activeEq).every((e) => e.sectionId !== eq.sectionId);
              return (
                <div
                  key={`${runId}-${eq.sectionId}-${i}`}
                  ref={isActive ? activeCardRef : null}
                  className="space-y-3 scroll-mt-6"
                >
                  {isSectionStart && (
                    <motion.div
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.35 }}
                      className="flex items-center gap-3 pt-3"
                    >
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white text-xs font-bold">
                        {sectionNum}
                      </span>
                      <h3 className="text-sm font-bold text-gray-900 tracking-tight whitespace-nowrap">
                        {eq.sectionLabel}
                      </h3>
                      <div className="flex-1 h-px bg-gray-200"></div>
                      {sectionDone && (
                        <span className="text-xs font-semibold text-emerald-600">✓ solved</span>
                      )}
                    </motion.div>
                  )}
                  <AnimatedEquation
                    tex={eq.tex}
                    label={eq.label}
                    stages={eq.stages}
                    duration={500}
                    isCompletedInstant={i < activeEq}
                    onComplete={isActive ? advance : undefined}
                    resultColor={eq.resultColor as 'amber' | 'red' | 'emerald'}
                    className="w-full"
                  />
                </div>
              );
            })}
          </div>

          {isComplete && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-8 mb-4 text-center text-sm text-gray-500"
            >
              Full conjunction analysis written for <span className="font-semibold text-gray-800">{satellite.name}</span> —
              replaying on a fresh board shortly…
            </motion.div>
          )}
        </div>
      </div>

      {/* Manual scroll override pill: allows user to jump back to active derivation */}
      {userHasScrolledUp && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 pointer-events-auto">
          <button
            type="button"
            onClick={resumeAutoscroll}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-lg hover:shadow-xl transition-all cursor-pointer"
          >
            <svg className="w-3.5 h-3.5 animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
            <span>Resume Auto-Scroll</span>
          </button>
        </div>
      )}
    </div>
  );
}

function fix(value: number | undefined | null, decimals = 2): string {
  if (value === undefined || value === null || !Number.isFinite(value)) return '-';
  return value.toFixed(decimals);
}
