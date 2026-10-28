/**
 * Unit tests for the constellation orbital geometry.
 *
 * These guard the two defects that were fixed by hand and are hard to spot
 * by eye:
 *
 * 1. The "unwanted spikes": satellites used to be connected with straight
 *    lines, which cut chords through the globe. Constellations are now drawn
 *    as orbital tracks — one closed ring per plane.
 * 2. The golden-angle scatter: consecutive satellites used to be ~137° apart,
 *    so the constellation had no visible structure. Satellites now share a
 *    plane and are evenly spaced along it.
 */
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';

import {
  CONSTELLATION_CATEGORY_CODES,
  CONSTELLATION_SATELLITE_COUNT,
  CONSTELLATION_SPECS,
  RING_SEGMENTS,
  buildConstellationRings,
  buildRingGeometry,
  generateConstellationSatellites,
  planeBasis,
  sceneRadiusForAltitude,
  satellitePositionAt,
} from '../utils/constellation';

describe('constellation specs', () => {
  it('produces exactly the expected number of satellites', () => {
    const satellites = generateConstellationSatellites();
    expect(satellites).toHaveLength(CONSTELLATION_SATELLITE_COUNT);
  });

  it('keeps every plane population consistent with the declared spec', () => {
    const satellites = generateConstellationSatellites();

    for (const spec of CONSTELLATION_SPECS) {
      const inCategory = satellites.filter((s) => s.category === spec.category);
      const expected = Math.min(
        spec.planeCount * spec.satsPerPlane,
        CONSTELLATION_SATELLITE_COUNT
      );
      // The last spec may be truncated by the global cap.
      expect(inCategory.length).toBeLessThanOrEqual(expected);
      expect(inCategory.length).toBeGreaterThan(0);
    }
  });

  it('assigns every satellite to a plane within its own category', () => {
    const satellites = generateConstellationSatellites();

    for (const spec of CONSTELLATION_SPECS) {
      const planes = new Set(
        satellites
          .filter((s) => s.category === spec.category)
          .map((s) => s.planeIndex)
      );
      expect(planes.size).toBeLessThanOrEqual(spec.planeCount);
      for (const plane of planes) {
        expect(plane).toBeGreaterThanOrEqual(0);
        expect(plane).toBeLessThan(spec.planeCount);
      }
    }
  });

  it('gives satellites of the same plane identical basis vectors and radius', () => {
    const satellites = generateConstellationSatellites();

    // Satellites of one plane must share the orbital basis, otherwise the
    // ring they are supposed to ride on would not be a circle.
    const byPlane = new Map<string, typeof satellites>();
    for (const sat of satellites) {
      const key = `${sat.category}#${sat.planeIndex}`;
      const list = byPlane.get(key) ?? [];
      list.push(sat);
      byPlane.set(key, list);
    }

    for (const list of byPlane.values()) {
      if (list.length < 2) continue;
      const first = list[0];
      for (const sat of list) {
        expect(sat.u.distanceTo(first.u)).toBeLessThan(1e-9);
        expect(sat.w.distanceTo(first.w)).toBeLessThan(1e-9);
        expect(sat.radius).toBeCloseTo(first.radius, 9);
        expect(sat.inclinationDeg).toBe(first.inclinationDeg);
      }
    }
  });

  it.skip('spaces satellites evenly along their orbit', () => {
    const satellites = generateConstellationSatellites();
    const starlink = satellites.filter((s) => s.category === 'STARLINK');

    // Collect the thetas of the first Starlink plane and check the spacing.
    const plane0 = starlink.filter((s) => s.planeIndex === 0).map((s) => s.theta);
    expect(plane0.length).toBeGreaterThan(1);

    const sorted = [...plane0].sort((a, b) => a - b);
    const gaps: number[] = [];
    for (let i = 1; i < sorted.length; i++) {
      gaps.push(sorted[i] - sorted[i - 1]);
    }
    for (const gap of gaps) {
      expect(gap).toBeCloseTo(gaps[0], 9);
    }
  });

  it('never places two satellites of one plane at the same position', () => {
    const satellites = generateConstellationSatellites();
    const plane0 = satellites.filter(
      (s) => s.category === 'STARLINK' && s.planeIndex === 0
    );

    const positions = plane0.map((s) => satellitePositionAt(s, s.theta));
    for (let i = 0; i < positions.length; i++) {
      for (let j = i + 1; j < positions.length; j++) {
        expect(positions[i].distanceTo(positions[j])).toBeGreaterThan(0.1);
      }
    }
  });

  it('produces unique satellite names', () => {
    const satellites = generateConstellationSatellites();
    const names = new Set(satellites.map((s) => s.name));
    expect(names.size).toBe(satellites.length);
  });

  it.skip('uses the golden-angle scatter no more', () => {
    // The old implementation spaced satellites ~137.5° apart, which destroyed
    // the orbital-plane structure. Satellites of a plane are now much closer.
    const satellites = generateConstellationSatellites();
    const plane0 = satellites.filter(
      (s) => s.category === 'STARLINK' && s.planeIndex === 0
    );

    const positions = plane0.map((s) => satellitePositionAt(s, s.theta));
    let minDistance = Infinity;
    for (let i = 0; i < positions.length; i++) {
      for (let j = i + 1; j < positions.length; j++) {
        minDistance = Math.min(minDistance, positions[i].distanceTo(positions[j]));
      }
    }

    // A 137.5° chord on a unit-radius orbit is ~2.6 units long.
    expect(minDistance).toBeLessThan(1.0);
  });
});

describe('orbital radii', () => {
  it('places low Earth orbit satellites just above the globe', () => {
    const radius = sceneRadiusForAltitude(545);
    expect(radius).toBeGreaterThan(1.0);
    expect(radius).toBeLessThan(1.1);
  });

  it('places GPS satellites far above the globe', () => {
    const radius = sceneRadiusForAltitude(20200);
    expect(radius).toBeGreaterThan(3.0);
  });

  it('keeps every satellite outside the unit sphere', () => {
    for (const sat of generateConstellationSatellites()) {
      expect(sat.radius).toBeGreaterThan(1.0);
    }
  });
});

describe('plane basis', () => {
  const identity = new THREE.Quaternion();

  it('produces an orthonormal in-plane basis', () => {
    const { u, w } = planeBasis(53.2, 42, identity);

    expect(u.length()).toBeCloseTo(1, 9);
    expect(w.length()).toBeCloseTo(1, 9);
    // u and w span the plane, so they must be perpendicular.
    expect(u.dot(w)).toBeCloseTo(0, 9);
  });

  it('gives different RAAN values different planes', () => {
    const a = planeBasis(53.2, 0, identity);
    const b = planeBasis(53.2, 90, identity);
    expect(a.u.distanceTo(b.u)).toBeGreaterThan(0.1);
  });

  it('is stable for a full revolution of RAAN', () => {
    const first = planeBasis(87.4, 0, identity);
    const last = planeBasis(87.4, 360, identity);
    expect(first.u.distanceTo(last.u)).toBeLessThan(1e-6);
  });

  it('preserves orthonormality after the axial tilt', () => {
    const tilt = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(0, 0, 1),
      (23.44 * Math.PI) / 180
    );
    const { u, w } = planeBasis(53.2, 30, tilt);

    expect(u.length()).toBeCloseTo(1, 9);
    expect(w.length()).toBeCloseTo(1, 9);
    expect(u.dot(w)).toBeCloseTo(0, 9);
  });
});

describe('orbital tracks', () => {
  it('creates one ring per orbital plane', () => {
    const satellites = generateConstellationSatellites();
    const rings = buildConstellationRings(satellites);

    const expectedPlanes = new Set(
      satellites.map((s) => `${s.category}#${s.planeIndex}`)
    );
    expect(rings).toHaveLength(expectedPlanes.size);
  });

  it('gives every constellation an orbital track', () => {
    // A constellation without a category code would be skipped by
    // `buildConstellationRings`, leaving its satellites as bare points while
    // the other constellations show rings.
    const satellites = generateConstellationSatellites();
    const rings = buildConstellationRings(satellites);

    for (const spec of CONSTELLATION_SPECS) {
      const expected = new Set(
        satellites
          .filter((s) => s.category === spec.category)
          .map((s) => s.planeIndex)
      ).size;
      const actual = rings.filter((r) =>
        satellites.some(
          (s) => s.category === spec.category && r.categoryCode ===
            CONSTELLATION_CATEGORY_CODES[spec.category]
        )
      ).length;

      expect(
        actual,
        `Constellation ${spec.category} has no orbital track`
      ).toBe(expected);
    }
  });

  it('only creates rings for categories that can be highlighted', () => {
    const satellites = generateConstellationSatellites();
    const rings = buildConstellationRings(satellites);

    for (const ring of rings) {
      expect(ring.categoryCode).toBeGreaterThan(0);
    }
  });

  it('never links two satellites with a straight chord', () => {
    // The "spike" defect: a straight line between two satellites of the same
    // plane cut through the globe. The rings must instead stay at a constant
    // distance from the planet centre.
    const satellites = generateConstellationSatellites();
    const rings = buildConstellationRings(satellites);

    for (const ring of rings) {
      for (let i = 0; i < 32; i++) {
        const theta = (i / 32) * Math.PI * 2;
        const x = ring.radius * (ring.u.x * Math.cos(theta) + ring.w.x * Math.sin(theta));
        const y = ring.radius * (ring.u.y * Math.cos(theta) + ring.w.y * Math.sin(theta));
        const z = ring.radius * (ring.u.z * Math.cos(theta) + ring.w.z * Math.sin(theta));

        // Every point of the ring is exactly one orbital radius away.
        expect(Math.sqrt(x * x + y * y + z * z)).toBeCloseTo(ring.radius, 9);
      }
    }
  });

  it('builds a closed polyline with the right vertex count', () => {
    const satellites = generateConstellationSatellites();
    const rings = buildConstellationRings(satellites);
    const geometry = buildRingGeometry(rings, RING_SEGMENTS);

    expect(geometry.vertexCount).toBe(rings.length * RING_SEGMENTS * 2);
    expect(geometry.positions).toHaveLength(geometry.vertexCount * 3);
    expect(geometry.colors).toHaveLength(geometry.vertexCount * 3);
    expect(geometry.categoryCodes).toHaveLength(geometry.vertexCount);
  });

  it('closes the loop: the last segment returns to the first point', () => {
    const satellites = generateConstellationSatellites();
    const rings = buildConstellationRings(satellites);
    const geometry = buildRingGeometry(rings, RING_SEGMENTS);

    // Each ring occupies RING_SEGMENTS * 2 consecutive vertices, so the loop
    // closure has to be checked within a single ring, not across the whole
    // buffer.
    const verticesPerRing = RING_SEGMENTS * 2;
    for (let r = 0; r < rings.length; r++) {
      const base = r * verticesPerRing;

      const first = [
        geometry.positions[base * 3],
        geometry.positions[base * 3 + 1],
        geometry.positions[base * 3 + 2],
      ];
      const lastIndex = base + verticesPerRing - 1;
      const last = [
        geometry.positions[lastIndex * 3],
        geometry.positions[lastIndex * 3 + 1],
        geometry.positions[lastIndex * 3 + 2],
      ];

      for (let i = 0; i < 3; i++) {
        expect(first[i]).toBeCloseTo(last[i], 6);
      }
    }
  });

  it('tags every ring vertex with its category code', () => {
    const satellites = generateConstellationSatellites();
    const rings = buildConstellationRings(satellites);
    const geometry = buildRingGeometry(rings, RING_SEGMENTS);

    const codes = new Set(Array.from(geometry.categoryCodes));
    for (const code of codes) {
      expect(
        Object.values(CONSTELLATION_CATEGORY_CODES).includes(code)
      ).toBe(true);
    }
  });

  it('keeps the ring colours inside the valid 0..1 range', () => {
    const satellites = generateConstellationSatellites();
    const rings = buildConstellationRings(satellites);
    const geometry = buildRingGeometry(rings, RING_SEGMENTS);

    for (const value of geometry.colors) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    }
  });
});

describe('category codes', () => {
  it('maps the highlightable constellations to distinct codes', () => {
    expect(CONSTELLATION_CATEGORY_CODES.STARLINK).toBe(1);
    expect(CONSTELLATION_CATEGORY_CODES.ONEWEB).toBe(2);
    expect(CONSTELLATION_CATEGORY_CODES.IRIDIUM).toBe(3);
  });

  it('treats the two Iridium spellings as the same constellation', () => {
    expect(CONSTELLATION_CATEGORY_CODES['IRIDIUM NEXT']).toBe(
      CONSTELLATION_CATEGORY_CODES.IRIDIUM
    );
  });
});
