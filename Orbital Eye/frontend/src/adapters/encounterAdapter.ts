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

export function adaptEncounter(raw: any): AdaptedEncounter {
  const satA = raw.sat_a_name || raw.satAName || raw.satA || (raw.sat_a_norad ? `OBJECT-${raw.sat_a_norad}` : 'LEO-ALPHA');
  const satB = raw.sat_b_name || raw.satBName || raw.satB || (raw.sat_b_norad ? `OBJECT-${raw.sat_b_norad}` : 'LEO-BETA');
  const id = raw.pair_id ?? raw.pairId ?? raw.id ?? 0;
  const missDistance = typeof raw.miss_distance_km === 'number' ? raw.miss_distance_km : typeof raw.missDistance === 'number' ? raw.missDistance : 0.0;
  const relVelocity = typeof raw.rel_velocity_kms === 'number' ? raw.rel_velocity_kms : typeof raw.relVelocity === 'number' ? raw.relVelocity : 0.0;
  const collisionProb = typeof raw.collision_prob === 'number' ? raw.collision_prob : typeof raw.collisionProb === 'number' ? raw.collisionProb : 0.0;

  let tcaFormatted = raw.tca_utc || raw.tcaUtc || '';
  try {
    if (tcaFormatted) {
      tcaFormatted = new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'UTC',
      }).format(new Date(tcaFormatted));
    }
  } catch (e) {
    tcaFormatted = String(raw.tca_utc || raw.tcaUtc || '');
  }

  return {
    id,
    pairId: id,
    pair_id: id,
    satA,
    satB,
    satAName: satA,
    satBName: satB,
    sat_a_name: satA,
    sat_b_name: satB,
    satAId: raw.sat_a_norad ?? raw.satAId,
    satBId: raw.sat_b_norad ?? raw.satBId,
    sat_a_id: raw.sat_a_norad ?? raw.sat_a_id,
    sat_b_id: raw.sat_b_norad ?? raw.sat_b_id,
    sat_a_norad: raw.sat_a_norad,
    sat_b_norad: raw.sat_b_norad,
    missDistance,
    miss_distance_km: missDistance,
    relVelocity,
    rel_velocity_kms: relVelocity,
    collisionProb,
    collision_prob: collisionProb,
    collisionProbPct: (collisionProb * 100).toFixed(2),
    tcaUtc: raw.tca_utc || raw.tcaUtc || '',
    tca_time_utc: raw.tca_utc || raw.tca_time_utc || '',
    tcaFormatted,
  };
}
