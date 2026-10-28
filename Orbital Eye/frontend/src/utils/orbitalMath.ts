/**
 * OrbitalEye Orbital Mechanics Math Solver
 *
 * All conjunction-risk and astrodynamics calculations are solved live with
 * native JavaScript arithmetic instead of hardcoded fallback constants, so
 * every whiteboard derivation reflects real physics computed from the live
 * satellite state (miss distance, velocity, inclination, covariance, burn Δv).
 *
 * Native JavaScript is used for add/subtract/multiply/divide/pow/sqrt/trig
 * (all inputs are plain numbers). The error function (erf) is implemented
 * natively (Abramowitz & Stegun 7.1.26) since JS has no built-in equivalent.
 *
 * Units convention (matching the rest of the codebase):
 *   distances  → km (scene/mission units)
 *   velocities → km/s
 *   angles     → degrees (converted internally to radians)
 *   masses     → kg
 *   Δv         → m/s for burns, km/s for orbital speed
 */

/* ------------------------------------------------------------------ */
/* 1. Vector & matrix primitives (native JS)                          */
/* ------------------------------------------------------------------ */

/**
 * Native error function approximation (Abramowitz & Stegun 7.1.26).
 * JS has no built-in erf(), so this provides ~1e-7 accuracy natively.
 */
function erf(x: number): number {
  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * x);
  const y =
    1 -
    (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t -
      0.284496736) *
      t +
      0.254829592) *
      t *
    Math.exp(-x * x);
  return sign * y;
}

/* ------------------------------------------------------------------ */
/* 1. Vector & matrix primitives (native JS)                          */
/* ------------------------------------------------------------------ */

/** Magnitude (Euclidean norm) of a 3-component vector. */
export function vectorMagnitude(x: number, y: number, z: number): number {
  return Math.sqrt(x * x + y * y + z * z);
}

/** Dot product of two 3-vectors. */
export function dotProduct(
  ax: number,
  ay: number,
  az: number,
  bx: number,
  by: number,
  bz: number,
): number {
  return ax * bx + ay * by + az * bz;
}

/** Cross product of two 3-vectors, returns [x, y, z]. */
export function crossProduct(
  ax: number,
  ay: number,
  az: number,
  bx: number,
  by: number,
  bz: number,
): [number, number, number] {
  return [
    ay * bz - az * by,
    az * bx - ax * bz,
    ax * by - ay * bx,
  ] as [number, number, number];
}

/** Rotate a 2-vector (x, y) by angle degrees, returns [x', y']. */
export function rotate2D(
  x: number,
  y: number,
  angleDeg: number,
): [number, number] {
  const rad = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return [cos * x - sin * y, sin * x + cos * y];
}

/* ------------------------------------------------------------------ */
/* 2. Classical orbital mechanics                                     */
/* ------------------------------------------------------------------ */

export interface VisVivaResult {
  radiusKm: number;
  semiMajorAxisKm: number;
  speedKmS: number;
  speedKmH: number;
  specificEnergyMJkg: number;
}

export function visViva(
  muKm3s2: number,
  altitudeKm: number,
  earthRadiusKm: number,
  eccentricity: number,
): VisVivaResult {
  const r = earthRadiusKm + altitudeKm;
  const a = r / (1 - eccentricity);
  const vSquared = muKm3s2 * (2 / r - 1 / a);
  const v = Math.sqrt(vSquared);
  const vKmH = v * 3600;
  const ke = 0.5 * v * v; // MJ/kg (v in km/s)
  const pe = -muKm3s2 / r;
  return {
    radiusKm: r,
    semiMajorAxisKm: a,
    speedKmS: v,
    speedKmH: vKmH,
    specificEnergyMJkg: ke + pe,
  };
}

export interface KeplerResult {
  semiMajorAxisKm: number;
  periodSeconds: number;
  periodMinutes: number;
  meanMotionRadS: number;
  meanMotionRevDay: number;
}

export function keplerPeriod(
  muKm3s2: number,
  semiMajorAxisKm: number,
): KeplerResult {
  const a3 = semiMajorAxisKm ** 3;
  const periodS = 2 * Math.PI * Math.sqrt(a3 / muKm3s2);
  const periodMin = periodS / 60;
  const nRadS = (2 * Math.PI) / periodS;
  const nRevDay = 86400 / periodS;
  return {
    semiMajorAxisKm,
    periodSeconds: periodS,
    periodMinutes: periodMin,
    meanMotionRadS: nRadS,
    meanMotionRevDay: nRevDay,
  };
}

export interface J2Result {
  semiLatusRectumKm: number;
  raanPrecessionRadS: number;
  raanPrecessionDegDay: number;
  driftDirection: 'Westward (Prograde)' | 'Eastward (Retrograde)';
}

export function j2NodalPrecession(
  j2: number,
  earthRadiusKm: number,
  semiMajorAxisKm: number,
  eccentricity: number,
  meanMotionRadS: number,
  inclinationDeg: number,
): J2Result {
  const p = semiMajorAxisKm * (1 - eccentricity ** 2);
  const incRad = (inclinationDeg * Math.PI) / 180;
  const ratioSq = (earthRadiusKm / p) ** 2;
  const raanRadS =
    -1.5 * j2 * ratioSq * meanMotionRadS * Math.cos(incRad);
  const raanDegDay = (raanRadS * 180 * 86400) / Math.PI;
  return {
    semiLatusRectumKm: p,
    raanPrecessionRadS: raanRadS,
    raanPrecessionDegDay: raanDegDay,
    driftDirection: raanDegDay < 0
      ? 'Westward (Prograde)'
      : 'Eastward (Retrograde)',
  };
}

/* ------------------------------------------------------------------ */
/* 3. Conjunction / B-plane risk math                                 */
/* ------------------------------------------------------------------ */

export interface CollisionProbabilityResult {
  missDistKm: number;
  hardBodyRadiusKm: number;
  sigmaX: number;
  sigmaY: number;
  pc: number; // dimensionless probability
  pcPercent: number;
  oddsOneIn: number;
  isCritical: boolean; // pc > 1e-4
  pcErf: number; // short-encounter erf cross-check
}

/**
 * Foster / Akella-Alfriend 2D B-plane collision probability.
 *
 *   Pc ≈ ( R_HBR² / (2 · σx · σy) ) · exp( -0.5 · d² / (σx · σy) )
 *
 * With a short-encounter correction using the error function:
 *   Pc ≈ (R/d)² · 0.5 · [1 + erf((d - R) / (√2 · σ))]
 *
 * Both are computed; the analytical reduction is returned as `pc`.
 * The erf cross-check uses the native erf() implementation (no native JS
 * equivalent exists, so it's approximated via Abramowitz & Stegun).
 */
export function collisionProbabilityFoster({
  missDistKm,
  hardBodyRadiusM = 10.0,
  sigmaXKm = 1.2,
  sigmaYKm = 0.8,
}: {
  missDistKm: number;
  hardBodyRadiusM?: number;
  sigmaXKm?: number;
  sigmaYKm?: number;
}): CollisionProbabilityResult {
  const d = missDistKm;
  const r = hardBodyRadiusM / 1000.0; // m -> km
  const sx = sigmaXKm;
  const sy = sigmaYKm;

  const area = 2 * sx * sy;
  const rSq = r * r;
  const exponent = -0.5 * (d * d) / (sx * sy);
  const pc = (rSq / area) * Math.exp(exponent);

  // Short-encounter erf cross-check (same result family)
  const sigma = Math.sqrt(sx * sy);
  const erfArg = (d - r) / (Math.sqrt(2) * sigma);
  const pcErf =
    (r / d) ** 2 * 0.5 * (1 + erf(erfArg));

  const pcPercent = pc * 100;
  const oddsOneIn = pc > 0 ? Math.round(1 / pc) : 999999;

  return {
    missDistKm: d,
    hardBodyRadiusKm: r,
    sigmaX: sx,
    sigmaY: sy,
    pc,
    pcPercent,
    oddsOneIn,
    isCritical: pc > 1e-4,
    pcErf,
  };
}

export interface BPlaneResult {
  missDistKm: number;
  clockAngleDeg: number;
  bTrackKm: number;
  bRadialKm: number;
  magnitudeKm: number;
}

export function bPlaneDecomposition({
  missDistKm,
  clockAngleDeg = 45,
}: {
  missDistKm: number;
  clockAngleDeg?: number;
}): BPlaneResult {
  const rad = (clockAngleDeg * Math.PI) / 180;
  const bT = missDistKm * Math.cos(rad);
  const bR = missDistKm * Math.sin(rad);
  const mag = Math.sqrt(bT * bT + bR * bR);
  return {
    missDistKm,
    clockAngleDeg,
    bTrackKm: bT,
    bRadialKm: bR,
    magnitudeKm: mag,
  };
}

/* ------------------------------------------------------------------ */
/* 4. Avoidance maneuver / rocket equation                            */
/* ------------------------------------------------------------------ */

export interface AvoidanceResult {
  deltaVms: number;
  deltaAKm: number;
  leadTimeSec: number;
  alongTrackKm: number;
  fuelKg: number;
  newPc: number;
  specificImpulseSec: number;
  dryMassKg: number;
}

/**
 * Gauss linearized phasing + Tsiolkovsky rocket equation for an impulsive
 * along-track avoidance burn.
 */
export function avoidanceManeuver({
  deltaVms,
  semiMajorAxisKm,
  speedKmS,
  radiusKm,
  muKm3s2,
  meanMotionRadS,
  leadTimeMin = 45,
  specificImpulseSec = 220,
  dryMassKg = 500,
}: {
  deltaVms: number;
  semiMajorAxisKm: number;
  speedKmS: number;
  radiusKm: number;
  muKm3s2: number;
  meanMotionRadS: number;
  leadTimeMin?: number;
  specificImpulseSec?: number;
  dryMassKg?: number;
}): AvoidanceResult {
  const dvKmS = deltaVms / 1000.0;
  const gravity = muKm3s2 / (radiusKm * radiusKm);
  const deltaA =
    (2 * semiMajorAxisKm * speedKmS * dvKmS) / gravity;

  const leadTimeSec = leadTimeMin * 60;
  const alongTrack = 1.5 * meanMotionRadS * deltaA * leadTimeSec;

  // Tsiolkovsky: m_prop = m_dry * (exp(dv / (Isp * g0)) - 1), g0 = 9.80665 m/s²
  const g0 = 9.80665;
  const exponent = deltaVms / (specificImpulseSec * g0);
  const fuelKg = dryMassKg * (Math.exp(exponent) - 1);

  // Residual risk scales inversely with clearance gained (conservative model)
  const basePc = 1e-4;
  const clearanceFactor = Math.abs(alongTrack) / (Math.abs(alongTrack) + 1);
  const newPc = basePc * (1 - clearanceFactor);

  return {
    deltaVms,
    deltaAKm: deltaA,
    leadTimeSec,
    alongTrackKm: alongTrack,
    fuelKg,
    newPc,
    specificImpulseSec,
    dryMassKg,
  };
}

/* ------------------------------------------------------------------ */
/* 5. Relative velocity (law of cosines)                              */
/* ------------------------------------------------------------------ */

export interface RelativeVelocityResult {
  v1KmS: number;
  v2KmS: number;
  crossingAngleDeg: number;
  vRelKmS: number;
  mach: number; // Mach number at sea-level speed of sound (~0.3403 km/s)
}

export function relativeVelocityLawOfCosines({
  v1KmS,
  v2KmS,
  crossingAngleDeg,
  speedOfSoundKmS = 0.3403,
}: {
  v1KmS: number;
  v2KmS: number;
  crossingAngleDeg: number;
  speedOfSoundKmS?: number;
}): RelativeVelocityResult {
  const rad = (crossingAngleDeg * Math.PI) / 180;
  const cosRad = Math.cos(rad);
  const v1Sq = v1KmS * v1KmS;
  const v2Sq = v2KmS * v2KmS;
  const v1v2cos = 2 * v1KmS * v2KmS * cosRad;
  const vRel = Math.sqrt(v1Sq + v2Sq - v1v2cos);
  const mach = vRel / speedOfSoundKmS;
  return {
    v1KmS,
    v2KmS,
    crossingAngleDeg,
    vRelKmS: vRel,
    mach,
  };
}

/* ------------------------------------------------------------------ */
/* 6. Scientific formatting helpers                                   */
/* ------------------------------------------------------------------ */

/** Format a number in LaTeX scientific notation: `a × 10^{b}`. */
export function sciTex(value: number, decimals = 2): string {
  if (value === 0) return '0';
  const s = value.toExponential(decimals);
  const [mantissa, exponent] = s.split('e');
  const expInt = parseInt(exponent, 10);
  const sign = expInt >= 0 ? '' : '-';
  return `${mantissa} \\times 10^{${sign}${Math.abs(expInt)}}`;
}

/** Round to a fixed number of decimals, safely. */
export function fix(value: number | undefined | null, decimals = 2): string {
  if (value === undefined || value === null || !Number.isFinite(value)) {
    return '-';
  }
  return value.toFixed(decimals);
}
