/**
 * Unit tests for the encounter adapter.
 *
 * The adapter normalises the API's snake_case payload into the camelCase
 * shape the UI components consume, while keeping the original field names
 * available so that older call sites keep working.
 */
import { describe, it, expect } from 'vitest';
import { adaptEncounter } from '../adapters/encounterAdapter';

const FULL_PAYLOAD = {
  pair_id: 7,
  sat_a_name: 'IRIDIUM 33',
  sat_b_name: 'COSMOS 2251',
  miss_distance_km: 18.53,
  rel_velocity_kms: 7.55,
  tca_utc: '2026-10-03T12:00:00',
  collision_prob: 0.0042,
  sat_a_norad: 25544,
  sat_b_norad: 25546,
};

describe('adaptEncounter', () => {
  it('exposes both the camelCase and snake_case field names', () => {
    const result = adaptEncounter(FULL_PAYLOAD);

    expect(result.pairId).toBe(7);
    expect(result.pair_id).toBe(7);
    expect(result.id).toBe(7);

    expect(result.satA).toBe('IRIDIUM 33');
    expect(result.sat_a_name).toBe('IRIDIUM 33');
    expect(result.satB).toBe('COSMOS 2251');
    expect(result.sat_b_name).toBe('COSMOS 2251');

    expect(result.missDistance).toBe(18.53);
    expect(result.miss_distance_km).toBe(18.53);

    expect(result.relVelocity).toBe(7.55);
    expect(result.rel_velocity_kms).toBe(7.55);

    expect(result.collisionProb).toBe(0.0042);
    expect(result.collision_prob).toBe(0.0042);
  });

  it('preserves the NORAD identifiers', () => {
    const result = adaptEncounter(FULL_PAYLOAD);

    expect(result.satANorad).toBe(25544);
    expect(result.satBNorad).toBe(25546);
    expect(result.sat_a_norad).toBe(25544);
    expect(result.sat_b_norad).toBe(25546);
  });

  it('formats the collision probability as a percentage string', () => {
    const result = adaptEncounter({ ...FULL_PAYLOAD, collision_prob: 0.123456 });

    expect(result.collisionProbPct).toBe('12.35');
  });

  it('keeps the raw TCA timestamp', () => {
    const result = adaptEncounter(FULL_PAYLOAD);

    expect(result.tcaUtc).toBe('2026-10-03T12:00:00');
    expect(result.tca).toBe('2026-10-03T12:00:00');
  });

  it('falls back to a generated name when the satellite name is missing', () => {
    const result = adaptEncounter({
      pair_id: 1,
      sat_a_norad: 25544,
      sat_b_norad: 25546,
    });

    expect(result.satA).toBe('OBJECT-25544');
    expect(result.satB).toBe('OBJECT-25546');
  });

  it('falls back to placeholder names when nothing is available', () => {
    const result = adaptEncounter({});

    expect(result.satA).toBe('LEO-ALPHA');
    expect(result.satB).toBe('LEO-BETA');
    expect(result.id).toBe(0);
  });

  it('coerces missing numeric values to zero', () => {
    const result = adaptEncounter({ pair_id: 3 });

    expect(result.missDistance).toBe(0.0);
    expect(result.relVelocity).toBe(0.0);
    expect(result.collisionProb).toBe(0.0);
  });

  it('accepts the camelCase input shape as well', () => {
    const result = adaptEncounter({
      pairId: 11,
      satAName: 'ISS',
      satBName: 'TIANGONG',
      missDistance: 12.5,
      relVelocity: 7.1,
      collisionProb: 0.01,
    });

    expect(result.pairId).toBe(11);
    expect(result.satA).toBe('ISS');
    expect(result.satB).toBe('TIANGONG');
    expect(result.missDistance).toBe(12.5);
    expect(result.relVelocity).toBe(7.1);
    expect(result.collisionProb).toBe(0.01);
  });

  it('does not treat a non-numeric distance as a number', () => {
    const result = adaptEncounter({
      pair_id: 2,
      miss_distance_km: 'not a number',
    });

    expect(result.missDistance).toBe(0.0);
  });
});
