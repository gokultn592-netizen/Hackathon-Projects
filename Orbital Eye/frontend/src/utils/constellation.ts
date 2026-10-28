/**
 * Constellation orbital geometry.
 *
 * The 3D globe renders a cloud of satellites that belong to real
 * mega-constellations (Starlink, OneWeb, Iridium NEXT, GPS, Planet/Spire).
 * This module holds the pure geometry that decides *where* those satellites
 * are, so it can be unit tested without a WebGL context.
 *
 * Two design rules matter, and both were learned the hard way:
 *
 * 1. Satellites are grouped into **orbital planes**. Every satellite of a
 *    plane shares one inclination and one RAAN, and the members are evenly
 *    spaced along that orbit. Scattering them randomly (the earlier
 *    golden-angle approach) destroyed the structure and made neighbouring
 *    satellites ~137° apart.
 *
 * 2. A constellation is drawn as its **orbital tracks** — one closed ring per
 *    plane. Connecting two satellites with a straight line instead produced a
 *    chord that cut through the globe, which read as an unwanted spike.
 */

import * as THREE from 'three';

/**
 * Real-world orbital plane definition for a constellation group.
 *
 * `planeCount` is the number of distinct orbital planes the satellites are
 * distributed across, and `satsPerPlane` is how many satellites ride in each
 * plane. Real mega-constellations (Starlink, OneWeb, Iridium) use many planes
 * each carrying a handful of satellites, which is what produces the familiar
 * "many parallel orbital rings" look.
 */
export interface ConstellationPlaneSpec {
  category: string;
  planeCount: number;
  satsPerPlane: number;
  altKm: number;
  velKms: number;
  incDeg: number;
  operator: string;
  description: string;
  namePrefix: string;
  noradBase: number;
  color: [number, number, number];
  colorVariants?: Array<[number, number, number]>;
}

/** A single orbital track of a constellation. */
export interface ConstellationRingSpec {
  /** Orbital basis of the plane the ring lies in. */
  u: THREE.Vector3;
  w: THREE.Vector3;
  radius: number;
  /** Category code used to highlight the ring of the selected constellation. */
  categoryCode: number;
  color: [number, number, number];
}

/** A generated satellite together with the plane it rides in. */
export interface ConstellationSatellite {
  name: string;
  noradId: number;
  category: string;
  planeIndex: number;
  /** Position along the orbit, in radians. */
  theta: number;
  /** Orbital radius in scene units (Earth radius = 1.0). */
  radius: number;
  altitudeKm: number;
  velocityKms: number;
  inclinationDeg: number;
  operator: string;
  description: string;
  color: [number, number, number];
  /** Basis vectors of the orbital plane, after the Earth's axial tilt. */
  u: THREE.Vector3;
  w: THREE.Vector3;
  /** Angular drift rate of the satellite along its orbit. */
  speed: number;
}

/**
 * Category codes used to highlight one constellation at a time.
 *
 * Every constellation needs a code: a category without one is skipped by
 * `buildConstellationRings`, which would leave its satellites floating as
 * bare points with no orbital track while the other constellations show
 * rings.
 */
export const CONSTELLATION_CATEGORY_CODES: Record<string, number> = {
  STARLINK: 1,
  ONEWEB: 2,
  IRIDIUM: 3,
  'IRIDIUM NEXT': 3,
  NAVIGATION: 4,
  'EARTH OBSERVATION': 5,
  'MARITIME & WEATHER': 6,
};

/** Total number of satellites rendered in the constellation cloud. */
export const CONSTELLATION_SATELLITE_COUNT = 0;

/** Earth's mean radius in km, used to convert an altitude to scene units. */
export const EARTH_RADIUS_KM = 6371;

/** Scene scale factor: how much an altitude lifts a satellite above the globe. */
export const SCENE_SCALE = 0.7;

/** Number of line segments used to approximate one orbital ring. */
export const RING_SEGMENTS = 96;

/**
 * Plane layout per constellation group. Plane counts and satellites per
 * plane are scaled so the total satellite count stays at
 * `CONSTELLATION_SATELLITE_COUNT`.
 */
export const CONSTELLATION_SPECS: ConstellationPlaneSpec[] = [];

/** Convert an altitude in km to a scene-space orbital radius. */
export function sceneRadiusForAltitude(altKm: number): number {
  return 1.0 + (altKm / EARTH_RADIUS_KM) * SCENE_SCALE;
}

/**
 * Build the basis vectors of one orbital plane.
 *
 * The plane is defined by its inclination (tilt of the orbital plane against
 * the equator) and its RAAN (the longitude of the ascending node, i.e. where
 * the plane crosses the equator). `u` and `w` span the plane, so any point on
 * the orbit is `radius * (u·cos θ + w·sin θ)`.
 */
export function planeBasis(
  incDeg: number,
  raanDeg: number,
  axialTiltQ: THREE.Quaternion
): { u: THREE.Vector3; w: THREE.Vector3 } {
  const incRad = (incDeg * Math.PI) / 180;
  const cosI = Math.cos(incRad);
  const sinI = Math.sin(incRad);

  const raanRad = (((raanDeg % 360) + 360) % 360 * Math.PI) / 180;
  const cosRaan = Math.cos(raanRad);
  const sinRaan = Math.sin(raanRad);

  // Orbit normal (angular momentum vector) in the equatorial frame.
  const n0 = new THREE.Vector3(sinI * sinRaan, cosI, -sinI * cosRaan).normalize();
  // In-plane basis vector pointing towards the ascending node.
  const u0 = new THREE.Vector3(cosRaan, 0, sinRaan).normalize();
  // Second in-plane basis vector, completing the right-handed frame.
  const w0 = new THREE.Vector3().crossVectors(n0, u0).normalize();

  return {
    u: u0.clone().applyQuaternion(axialTiltQ),
    w: w0.clone().applyQuaternion(axialTiltQ),
  };
}

/**
 * Generate the satellite cloud.
 *
 * Every satellite of a plane shares the plane's inclination and RAAN and is
 * evenly spaced along the orbit, so the cloud really is a set of concentric
 * orbital rings.
 */
export function generateConstellationSatellites(
  specs: ConstellationPlaneSpec[] = CONSTELLATION_SPECS,
  totalCount: number = CONSTELLATION_SATELLITE_COUNT
): ConstellationSatellite[] {
  const axialTiltQ = new THREE.Quaternion().setFromAxisAngle(
    new THREE.Vector3(0, 0, 1),
    (23.44 * Math.PI) / 180
  );

  const satellites: ConstellationSatellite[] = [];
  let c = 0;

  for (const spec of specs) {
    const r = sceneRadiusForAltitude(spec.altKm);
    const speed = 0.003 + (spec.velKms / 7.61) * 0.0035;

    for (let plane = 0; plane < spec.planeCount && c < totalCount; plane++) {
      // Planes are evenly distributed in RAAN around the Earth.
      const raanDeg = (plane / spec.planeCount) * 360 + spec.planeCount * 3.7;
      const { u, w } = planeBasis(spec.incDeg, raanDeg, axialTiltQ);

      for (let s = 0; s < spec.satsPerPlane && c < totalCount; s++) {
        // Satellites within a plane are evenly spaced along the orbit.
        const theta0 = (s / spec.satsPerPlane) * 360 * (Math.PI / 180);

        // Earth-observation satellites alternate between the Planet and Spire
        // operators, while every satellite still stays inside its own plane.
        const isEarthObs =
          spec.category === 'EARTH OBSERVATION' || spec.category === 'MARITIME & WEATHER';
        const name = isEarthObs
          ? c % 2 === 0
            ? `PLANET-FLOCK-${2100 + c}`
            : `LEMUR-2-${150 + c}`
          : `${spec.namePrefix}-${spec.category === 'STARLINK' ? 3000 + c : 101 + c}`;

        const color =
          spec.colorVariants && spec.colorVariants.length > 0
            ? spec.colorVariants[c % spec.colorVariants.length]
            : spec.color;

        satellites.push({
          name,
          noradId: spec.noradBase + c,
          category: spec.category,
          planeIndex: plane,
          theta: theta0,
          radius: r,
          altitudeKm: spec.altKm,
          velocityKms: spec.velKms,
          inclinationDeg: spec.incDeg,
          operator: spec.operator,
          description: spec.description,
          color,
          u,
          w,
          speed,
        });

        c++;
      }
    }
  }

  return satellites;
}

/**
 * Derive one orbital ring per plane from the generated satellites.
 *
 * A ring is the physical shape of the plane, so it is what makes the
 * constellation read as a set of orbits rather than a random cloud of dots.
 */
export function buildConstellationRings(
  satellites: ConstellationSatellite[]
): ConstellationRingSpec[] {
  const rings: ConstellationRingSpec[] = [];
  const seen = new Set<string>();

  for (const satellite of satellites) {
    const categoryCode = CONSTELLATION_CATEGORY_CODES[satellite.category];
    if (!categoryCode) continue;

    // The plane index restarts per constellation, so the key has to include
    // the category as well.
    const key = `${satellite.category}#${satellite.planeIndex}`;
    if (seen.has(key)) continue;
    seen.add(key);

    rings.push({
      u: satellite.u.clone(),
      w: satellite.w.clone(),
      radius: satellite.radius,
      categoryCode,
      color: satellite.color,
    });
  }

  return rings;
}

/**
 * Approximate one orbital ring with a closed polyline of line segments.
 *
 * Returns flat XYZ arrays ready to be copied into a `BufferGeometry`.
 */
export function buildRingGeometry(
  rings: ConstellationRingSpec[],
  segments: number = RING_SEGMENTS
): { positions: Float32Array; colors: Float32Array; categoryCodes: Float32Array; vertexCount: number } {
  const verticesPerRing = segments * 2;
  const vertexCount = rings.length * verticesPerRing;

  const positions = new Float32Array(vertexCount * 3);
  const colors = new Float32Array(vertexCount * 3);
  const categoryCodes = new Float32Array(vertexCount);

  let index = 0;
  for (const ring of rings) {
    for (let seg = 0; seg < segments; seg++) {
      const t0 = (seg / segments) * Math.PI * 2;
      const t1 = ((seg + 1) / segments) * Math.PI * 2;

      const x0 = ring.radius * (ring.u.x * Math.cos(t0) + ring.w.x * Math.sin(t0));
      const y0 = ring.radius * (ring.u.y * Math.cos(t0) + ring.w.y * Math.sin(t0));
      const z0 = ring.radius * (ring.u.z * Math.cos(t0) + ring.w.z * Math.sin(t0));
      const x1 = ring.radius * (ring.u.x * Math.cos(t1) + ring.w.x * Math.sin(t1));
      const y1 = ring.radius * (ring.u.y * Math.cos(t1) + ring.w.y * Math.sin(t1));
      const z1 = ring.radius * (ring.u.z * Math.cos(t1) + ring.w.z * Math.sin(t1));

      positions[index * 3] = x0;
      positions[index * 3 + 1] = y0;
      positions[index * 3 + 2] = z0;
      colors[index * 3] = ring.color[0];
      colors[index * 3 + 1] = ring.color[1];
      colors[index * 3 + 2] = ring.color[2];
      categoryCodes[index] = ring.categoryCode;
      index++;

      positions[index * 3] = x1;
      positions[index * 3 + 1] = y1;
      positions[index * 3 + 2] = z1;
      colors[index * 3] = ring.color[0];
      colors[index * 3 + 1] = ring.color[1];
      colors[index * 3 + 2] = ring.color[2];
      categoryCodes[index] = ring.categoryCode;
      index++;
    }
  }

  return { positions, colors, categoryCodes, vertexCount };
}

/**
 * The world position of a satellite at orbital angle `theta`.
 */
export function satellitePositionAt(
  satellite: ConstellationSatellite,
  theta: number
): THREE.Vector3 {
  return new THREE.Vector3()
    .addScaledVector(satellite.u, satellite.radius * Math.cos(theta))
    .addScaledVector(satellite.w, satellite.radius * Math.sin(theta));
}
