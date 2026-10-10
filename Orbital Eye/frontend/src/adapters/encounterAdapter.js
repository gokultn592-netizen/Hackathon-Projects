/**
 * Lightweight adapter: maps backend response fields to component props.
 * If field names change, update this adapter instead of the backend.
 */

export const adaptEncounterResponse = (item) => {
  return {
    pair_id: item.pair_id,
    sat_a_name: item.sat_a_name,
    sat_b_name: item.sat_b_name,
    miss_distance_km: item.miss_distance_km,
    rel_velocity_kms: item.rel_velocity_kms,
    tca_utc: item.tca_utc,
    collision_prob: item.collision_prob,
  };
};

export const adaptEncounter = (raw) => {
  const tcaFormatted = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
  }).format(new Date(raw.tca_utc));

  return {
    id: raw.pair_id,
    satA: raw.sat_a_name,
    satB: raw.sat_b_name,
    missDistance: raw.miss_distance_km,
    relVelocity: raw.rel_velocity_kms,
    tcaFormatted,
    collisionProbPct: (raw.collision_prob * 100).toFixed(2),
  };
};
