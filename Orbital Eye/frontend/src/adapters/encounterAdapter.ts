import { EncounterPairResponse } from '../types/encounter';

export interface AdaptedEncounter {
  id: number;
  pairId: number;
  pair_id?: number;
  satA: string;
  satB: string;
  satAName: string;
  satBName: string;
  sat_a_name: string;
  sat_b_name: string;
  satAId?: number;
  satBId?: number;
  sat_a_id?: number;
  sat_b_id?: number;
  sat_a_norad?: number;
  sat_b_norad?: number;
  missDistance: number;
  miss_distance_km: number;
  relVelocity: number;
  rel_velocity_kms: number;
  collisionProb: number;
  collision_prob: number;
  collisionProbPct: string;
  tcaUtc: string;
  tca_time_utc: string;
  tcaFormatted: string;
}

export function adaptEncounter(raw: EncounterPairResponse): AdaptedEncounter {
  let tcaFormatted = raw.tca_utc;
  try {
    tcaFormatted = new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'UTC',
    }).format(new Date(raw.tca_utc));
  } catch (e) {
    tcaFormatted = raw.tca_utc;
  }

  return {
    id: raw.pair_id,
    pairId: raw.pair_id,
    pair_id: raw.pair_id,
    satA: raw.sat_a_name,
    satB: raw.sat_b_name,
    satAName: raw.sat_a_name,
    satBName: raw.sat_b_name,
    sat_a_name: raw.sat_a_name,
    sat_b_name: raw.sat_b_name,
    satAId: raw.sat_a_norad,
    satBId: raw.sat_b_norad,
    sat_a_id: raw.sat_a_norad,
    sat_b_id: raw.sat_b_norad,
    sat_a_norad: raw.sat_a_norad,
    sat_b_norad: raw.sat_b_norad,
    missDistance: raw.miss_distance_km,
    miss_distance_km: raw.miss_distance_km,
    relVelocity: raw.rel_velocity_kms,
    rel_velocity_kms: raw.rel_velocity_kms,
    collisionProb: raw.collision_prob,
    collision_prob: raw.collision_prob,
    collisionProbPct: (raw.collision_prob * 100).toFixed(2),
    tcaUtc: raw.tca_utc,
    tca_time_utc: raw.tca_utc,
    tcaFormatted,
  };
}
